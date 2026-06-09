import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Download, Settings, Loader2, Check, Edit2, ImageDown } from 'lucide-react';
import { toPng } from 'html-to-image';
import { useAuth } from '../context/AuthContext';
import { getBoardMeta, updateBoardTitle, createBoard, isFirestoreUnavailable } from '../firebase/db';
import { agentLog } from '../debug/agentLog';
import CanvasStage from '../canvas/CanvasStage';
import Toolbar from '../canvas/ui/Toolbar';
import PropertiesPanel from '../canvas/ui/PropertiesPanel';

const BOARD_ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function slugToTitle(slug) {
  return slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function BoardPage() {
  const { id } = useParams();
  const location = useLocation();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [boardMeta, setBoardMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [firestoreWarning, setFirestoreWarning] = useState(null);

  const initial = currentUser?.email ? currentUser.email.charAt(0).toUpperCase() : '?';

  const openLocalBoard = (boardId, title) => {
    // #region agent log
    agentLog('BoardPage.jsx:openLocalBoard', 'local fallback', { boardId, title }, 'H8', 'post-fix-v3');
    // #endregion
    setFirestoreWarning(
      'Firestore is not set up yet. Drawing works locally; enable Firestore in Firebase Console to save boards to the cloud.'
    );
    setBoardMeta({ id: boardId, title, ownerId: currentUser.uid });
    setTitleInput(title);
    setLoading(false);
  };

  useEffect(() => {
    async function fetchMeta() {
      // #region agent log
      agentLog('BoardPage.jsx:fetchMeta', 'fetchMeta start', { boardId: id, hasUser: !!currentUser, userUid: currentUser?.uid ?? null }, 'H4-H5', 'post-fix');
      // #endregion
      if (!currentUser || !id) return;
      if (!BOARD_ID_UUID.test(id)) {
        // #region agent log
        agentLog('BoardPage.jsx:fetchMeta', 'template slug auto-create', { boardId: id }, 'H1', 'post-fix-v2');
        // #endregion
        try {
          const newBoard = await createBoard(currentUser.uid, slugToTitle(id));
          // #region agent log
          agentLog('BoardPage.jsx:fetchMeta', 'template slug created', { oldId: id, newBoardId: newBoard.id }, 'H1', 'post-fix-v2');
          // #endregion
          navigate(`/board/${newBoard.id}`, { replace: true });
        } catch (err) {
          // #region agent log
          agentLog('BoardPage.jsx:fetchMeta', 'template slug create failed', { boardId: id, errorCode: err?.code, errorMessage: err?.message }, 'H8', 'post-fix-v3');
          // #endregion
          if (isFirestoreUnavailable(err)) {
            const localId = crypto.randomUUID();
            navigate(`/board/${localId}`, {
              replace: true,
              state: { localOnly: true, title: slugToTitle(id) },
            });
            return;
          }
          navigate('/dashboard');
          setLoading(false);
        }
        return;
      }
      if (location.state?.localOnly) {
        openLocalBoard(id, location.state.title || 'Untitled Board');
        return;
      }
      try {
        const meta = await getBoardMeta(id);
        if (!meta || meta.ownerId !== currentUser.uid) {
          const rejectReason = !meta ? 'NO_META' : 'OWNER_MISMATCH';
          // #region agent log
          agentLog('BoardPage.jsx:fetchMeta', 'board rejected', { boardId: id, rejectReason, metaOwnerId: meta?.ownerId ?? null, userUid: currentUser.uid }, 'H1-H4', 'post-fix-v3');
          // #endregion
          console.warn('Unauthorized or missing board');
          navigate('/dashboard');
          return;
        }
        // #region agent log
        agentLog('BoardPage.jsx:fetchMeta', 'board accepted', { boardId: id, title: meta.title }, 'success', 'post-fix-v3');
        // #endregion
        setBoardMeta(meta);
        setTitleInput(meta.title);
      } catch (err) {
        // #region agent log
        agentLog('BoardPage.jsx:fetchMeta', 'fetchMeta error', { boardId: id, errorName: err?.name, errorCode: err?.code }, 'H3', 'post-fix-v3');
        // #endregion
        if (isFirestoreUnavailable(err)) {
          openLocalBoard(id, 'Untitled Board');
          return;
        }
        console.error('Failed to load board meta', err);
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    }
    fetchMeta();
  }, [id, currentUser, navigate, location.state]);

  const handleTitleSubmit = async () => {
    setIsEditingTitle(false);
    const newTitle = titleInput.trim() || 'Untitled Board';
    setTitleInput(newTitle);
    
    if (boardMeta && newTitle !== boardMeta.title) {
      try {
        await updateBoardTitle(id, newTitle);
        setBoardMeta({ ...boardMeta, title: newTitle });
      } catch (err) {
        console.error('Failed to update title', err);
        // Revert on failure
        setTitleInput(boardMeta.title);
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleTitleSubmit();
    }
  };

  const handleExport = async () => {
    const node = document.getElementById('canvas-stage');
    if (!node || isExporting) return;
    setIsExporting(true);
    try {
      // Temporarily hide UI overlays (AI button, toolbar) during export
      const overlays = node.querySelectorAll('.ai-fab-container');
      overlays.forEach(el => el.style.visibility = 'hidden');

      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 2, // 2x resolution for crisp export
        backgroundColor: '#F8F9FF',
      });

      overlays.forEach(el => el.style.visibility = '');

      // Trigger browser download
      const link = document.createElement('a');
      link.download = `${boardMeta?.title || 'CollabBoard'}_export.png`;
      link.href = dataUrl;
      link.click();

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 2500);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} className="animate-spin" color="var(--color-brand)" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="board-page"
    >
      {firestoreWarning && (
        <div className="firestore-warning-banner" role="alert">
          {firestoreWarning}
        </div>
      )}
      {/* Top Navbar */}
      <div className="board-header">
        <div className="header-left">
          <Link to="/dashboard" className="back-btn">
            <ArrowLeft size={18} />
          </Link>
          <div className="board-title-group">
            {isEditingTitle ? (
              <div className="title-edit-wrapper">
                <input
                  type="text"
                  className="title-input"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onBlur={handleTitleSubmit}
                  onKeyDown={handleKeyDown}
                  autoFocus
                />
                <button className="title-save-btn" onClick={handleTitleSubmit}>
                  <Check size={14} />
                </button>
              </div>
            ) : (
              <div className="title-display-wrapper" onClick={() => setIsEditingTitle(true)}>
                <h1 className="board-title">{boardMeta?.title || 'Untitled Board'}</h1>
                <Edit2 size={12} className="edit-icon" />
              </div>
            )}
            <span className="board-status">{firestoreWarning ? 'Local only (Firestore not set up)' : 'Saved to cloud'}</span>
          </div>
        </div>

        <div className="header-right">
          <div className="avatars">
            <div className="avatar" style={{ background: '#6C63FF' }} title={currentUser?.email}>{initial}</div>
          </div>
          <button className="btn btn-secondary action-btn" title="Settings">
            <Settings size={16} />
          </button>
          <button
            className={`btn action-btn export-btn ${exportSuccess ? 'export-success' : 'btn-primary'}`}
            onClick={handleExport}
            disabled={isExporting}
            title="Export as PNG"
          >
            {isExporting ? (
              <><Loader2 size={16} className="animate-spin" /> Exporting...</>
            ) : exportSuccess ? (
              <><Check size={16} /> Exported!</>
            ) : (
              <><ImageDown size={16} /> Export PNG</>
            )}
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="board-workspace">
        <Toolbar />
        <PropertiesPanel />
        <CanvasStage />
      </div>

      <style>{`
        .board-page {
          width: 100vw;
          height: 100vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: var(--color-bg-primary);
        }

        .firestore-warning-banner {
          background: #FEF3C7;
          color: #92400E;
          padding: 10px 16px;
          font-size: 0.8125rem;
          font-weight: 500;
          border-bottom: 1px solid #FDE68A;
          z-index: 101;
        }
        
        .board-header {
          height: 56px;
          border-bottom: 1px solid var(--color-border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          background: #fff;
          z-index: 100;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .back-btn {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-text-secondary);
          border-radius: 8px;
          transition: background 0.2s;
        }
        .back-btn:hover {
          background: var(--color-bg-secondary);
          color: var(--color-text-primary);
        }

        .board-title-group {
          display: flex;
          flex-direction: column;
        }

        .title-display-wrapper {
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: text;
          padding: 2px 6px;
          margin-left: -6px;
          border-radius: 4px;
          transition: background 0.15s;
        }
        .title-display-wrapper:hover {
          background: var(--color-bg-secondary);
        }
        .edit-icon {
          color: var(--color-text-tertiary);
          opacity: 0;
          transition: opacity 0.15s;
        }
        .title-display-wrapper:hover .edit-icon {
          opacity: 1;
        }

        .title-edit-wrapper {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .title-input {
          font-size: 0.9375rem;
          font-weight: 600;
          color: var(--color-text-primary);
          border: 1px solid var(--color-brand);
          border-radius: 4px;
          padding: 1px 4px;
          margin-left: -5px;
          outline: none;
          background: #fff;
          font-family: inherit;
        }
        .title-save-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          background: var(--color-brand);
          color: #fff;
          border-radius: 4px;
          border: none;
          cursor: pointer;
        }

        .board-title {
          font-size: 0.9375rem;
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .board-status {
          font-size: 0.6875rem;
          color: var(--color-text-tertiary);
        }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .header-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .avatars {
          display: flex;
          align-items: center;
          padding-right: 12px;
          border-right: 1px solid var(--color-border);
        }

        .avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          color: #fff;
          font-size: 0.75rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid #fff;
        }

        .action-btn {
          height: 36px;
          padding: 0 16px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.8125rem;
          font-weight: 600;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }

        .export-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .export-success {
          background: #10B981 !important;
          color: #fff !important;
        }

        .board-workspace {
          flex: 1;
          position: relative;
        }
      `}</style>
    </motion.div>
  );
}
