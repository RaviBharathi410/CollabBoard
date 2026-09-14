import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Loader2, Check, Edit2, ImageDown, MessageSquare, ListTree, Share2, UploadCloud } from 'lucide-react';
import { toPng } from 'html-to-image';
import { useAuth } from '../context/AuthContext';
import { getBoardMeta, updateBoardTitle, createBoard, isFirestoreUnavailable } from '../firebase/db';
import IconRail from '../components/IconRail';
import DraftingTopBar from '../components/DraftingTopBar';
import CommandPalette from '../components/CommandPalette';
import CanvasStage from '../canvas/CanvasStage';
import ContextDrawer from '../canvas/components/ContextDrawer';
import ShareModal from '../components/ShareModal';
import useAIEngine from '../canvas/hooks/useAIEngine';
import useCanvasStore from '../canvas/hooks/useCanvasStore';

const BOARD_ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function slugToTitle(slug) {
  return slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function BoardPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const canvasSyncStatus = useCanvasStore((state) => state.syncStatus);

  
  const [boardMeta, setBoardMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [firestoreWarning, setFirestoreWarning] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  
  // Context Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState('chat');
  const [chatMessages, setChatMessages] = useState([
    { author: 'System', text: 'Board room session active. Real-time CRDT sync ready.', time: 'now' }
  ]);
  
  // Outline Mode state
  const [isOutlineOpen, setIsOutlineOpen] = useState(false);
  
  // Command Palette state
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // AI Engine — shared across ContextDrawer AI tab and CanvasStage
  // stageRef here is a proxy: chatToDiagram calls applyDiagramToCanvas which
  // reads from global CanvasStore, so it works even without direct Konva ref.
  const boardAIStageRef = useRef({ current: null });
  const {
    chatToDiagram,
    state: aiState,
  } = useAIEngine(boardAIStageRef);

  const openLocalBoard = useCallback((boardId, title) => {
    setFirestoreWarning(
      'Firestore is running in local memory mode. Drawing works; changes are stored in session.'
    );
    setBoardMeta({ id: boardId, title, ownerId: currentUser?.uid });
    setTitleInput(title);
    setLoading(false);
  }, [currentUser?.uid]);

  useEffect(() => {
    async function fetchMeta() {
      if (!currentUser || !id) return;
      if (!BOARD_ID_UUID.test(id)) {
        try {
          const newBoard = await createBoard(currentUser.uid, slugToTitle(id));
          navigate(`/board/${newBoard.id}`, { replace: true });
        } catch (err) {
          if (isFirestoreUnavailable(err)) {
            const localId = crypto.randomUUID();
            navigate(`/board/${localId}`, {
              replace: true,
              state: { localOnly: true, title: slugToTitle(id) },
            });
            return;
          }
          console.error('Failed to create board with UUID', err);
          navigate('/dashboard');
        }
        return;
      }

      if (location.state?.localOnly) {
        openLocalBoard(id, location.state.title || 'Untitled Board');
        return;
      }

      try {
        const meta = await getBoardMeta(id, currentUser);
        if (!meta) {
          navigate('/dashboard');
          return;
        }
        setBoardMeta(meta);
        setTitleInput(meta.title);
      } catch (err) {
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
  }, [id, currentUser, navigate, location.state, openLocalBoard]);

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
        setTitleInput(boardMeta.title);
      }
    }
  };

  const handleSendMessage = (text) => {
    const authorName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'You';
    setChatMessages((prev) => [
      ...prev,
      { author: authorName, text, time: 'Just now', isSelf: true }
    ]);
  };

  const handleExport = async () => {
    const node = document.getElementById('canvas-stage');
    if (!node || isExporting) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#F6F5F1',
      });

      const link = document.createElement('a');
      link.download = `${boardMeta?.title || 'Drafting_Table'}_export.png`;
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
      <div className="board-loading-screen bg-graph-paper">
        <Loader2 size={30} className="spin-icon text-moss" />
        <span>Loading Board Blueprint...</span>
      </div>
    );
  }

  return (
    <div className="drafting-board-page">
      {/* Persistent Left Icon Rail */}
      <IconRail 
        onToggleOutline={() => setIsOutlineOpen(!isOutlineOpen)}
        isOutlineOpen={isOutlineOpen}
      />

      <div className="board-main-viewport">
        {/* Top Utility Drafting Bar */}
        <DraftingTopBar 
          currentWorkspace="Core Atelier"
          activeDocumentTitle={boardMeta?.title || 'Untitled Board'}
          collaboratorCount={2}
          syncStatus={firestoreWarning ? 'offline' : (canvasSyncStatus || 'saved')}
          onOpenSearch={() => setIsSearchOpen(true)}
        />

        {firestoreWarning && (
          <div className="drafting-warning-banner" role="alert">
            {firestoreWarning}
          </div>
        )}

        {/* Sub-header with Title Editing & Context Drawer Controls */}
        <div className="board-subbar">
          <div className="subbar-left">
            {boardMeta?.role === 'viewer' || boardMeta?.readOnly ? (
              <div className="title-display-readonly" title="Read-only view">
                <h1 className="board-title-text">{boardMeta?.title || 'Untitled Board'}</h1>
                <span className="role-badge viewer-badge" data-testid="viewer-badge">Viewer (Read-Only)</span>
              </div>
            ) : isEditingTitle ? (
              <div className="title-edit-group">
                <input
                  type="text"
                  className="title-edit-input"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onBlur={handleTitleSubmit}
                  onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
                  autoFocus
                />
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleTitleSubmit}>
                  <Check size={14} />
                </button>
              </div>
            ) : (
              <div className="title-display" onClick={() => setIsEditingTitle(true)} title="Click to rename" data-testid="rename-title-btn">
                <h1 className="board-title-text">{boardMeta?.title || 'Untitled Board'}</h1>
                <Edit2 size={12} className="edit-glyph" />
              </div>
            )}
            <span className="doc-id-badge">ID: {id.slice(0, 8)}</span>
          </div>

          <div className="subbar-right">
            <button 
              type="button" 
              className={`btn btn-secondary btn-sm ${isOutlineOpen ? 'active-btn' : ''}`}
              onClick={() => setIsOutlineOpen(!isOutlineOpen)}
              title="Accessible Outline Mode (O)"
            >
              <ListTree size={14} />
              <span>Outline (O)</span>
            </button>

            <button 
              type="button" 
              className={`btn btn-secondary btn-sm ${isDrawerOpen && drawerTab === 'chat' ? 'active-btn' : ''}`}
              onClick={() => {
                if (isDrawerOpen && drawerTab === 'chat') {
                  setIsDrawerOpen(false);
                } else {
                  setDrawerTab('chat');
                  setIsDrawerOpen(true);
                }
              }}
              title="Toggle Context & Chat"
            >
              <MessageSquare size={14} />
              <span>Context & Chat</span>
            </button>

            <button 
              type="button" 
              className={`btn btn-secondary btn-sm ${isDrawerOpen && drawerTab === 'import' ? 'active-btn' : ''}`}
              onClick={() => {
                if (isDrawerOpen && drawerTab === 'import') {
                  setIsDrawerOpen(false);
                } else {
                  setDrawerTab('import');
                  setIsDrawerOpen(true);
                }
              }}
              title="Import Diagram or Image (Draw.io, Mermaid, SVG, Whiteboard)"
              data-testid="open-import-tab-btn"
            >
              <UploadCloud size={14} />
              <span>Import</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsShareModalOpen(true)}
              title="Share Blueprint & Invite Collaborators"
              data-testid="open-share-modal-btn"
            >
              <Share2 size={14} />
              <span>Share</span>
            </button>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleExport}
              disabled={isExporting}
              title="Export as PNG"
            >
              {isExporting ? <Loader2 size={13} className="spin-icon" /> : <ImageDown size={13} />}
              <span>{exportSuccess ? 'Exported!' : 'Export'}</span>
            </button>
          </div>
        </div>

        {/* Canvas Area with Konva Stage */}
        <div className="canvas-container-wrap">
          <CanvasStage 
            isOutlineOpen={isOutlineOpen}
            onCloseOutline={() => setIsOutlineOpen(false)}
          />
        </div>

        {/* Persistent Right Context Drawer */}
        <ContextDrawer 
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          activeTab={drawerTab}
          onTabChange={setDrawerTab}
          chatMessages={chatMessages}
          onSendMessage={handleSendMessage}
          collaborators={[{ name: 'Elena', color: '#9E5826' }]}
          onAskAI={chatToDiagram}
          askResponse={aiState.askResponse}
          isAsking={aiState.isAsking}
          stageRef={boardAIStageRef}
        />
      </div>

      {/* Quick Jump ⌘K Modal */}
      <CommandPalette 
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        boards={boardMeta ? [boardMeta] : []}
      />

      {/* Share & Role-Based Access Control Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        boardId={id}
        boardTitle={boardMeta?.title || 'Untitled Board'}
        sharedWith={boardMeta?.sharedWith || []}
        ownerEmail={boardMeta?.ownerEmail || currentUser?.email || 'Board Owner'}
        isOwner={!boardMeta || boardMeta.ownerId === currentUser?.uid || boardMeta.role === 'owner'}
        onInviteSuccess={(newShared) => {
          setBoardMeta((prev) => (prev ? { ...prev, sharedWith: newShared } : prev));
        }}
      />

      <style>{`
        .drafting-board-page {
          width: 100vw;
          height: 100vh;
          display: flex;
          overflow: hidden;
          background: var(--surface-paper);
          font-family: var(--font-sans);
        }
        .board-main-viewport {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          height: 100vh;
        }
        .board-loading-screen {
          width: 100vw;
          height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: var(--ink-muted);
        }
        .drafting-warning-banner {
          background: var(--ochre-subtle);
          color: var(--ochre);
          padding: 6px 16px 6px calc(var(--rail-width) + 16px);
          font-size: 12px;
          border-bottom: 1px solid var(--line);
        }
        .board-subbar {
          height: 40px;
          background: var(--surface-raised);
          border-bottom: 1px solid var(--line);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px 0 calc(var(--rail-width) + 16px);
          z-index: 25;
        }
        .subbar-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .title-display {
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .title-display:hover {
          background: var(--surface-subtle);
        }
        .board-title-text {
          font-size: 13.5px;
          font-weight: 600;
          color: var(--ink);
        }
        .edit-glyph {
          color: var(--ink-faint);
        }
        .title-edit-group {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .title-edit-input {
          height: 28px;
          font-size: 13px;
          font-weight: 600;
          border: 1px solid var(--moss);
          border-radius: 4px;
          padding: 0 6px;
          color: var(--ink);
          background: var(--surface-paper);
        }
        .doc-id-badge {
          font-family: var(--font-mono);
          font-size: 10.5px;
          color: var(--ink-faint);
          background: var(--surface-subtle);
          border: 1px solid var(--line);
          padding: 1px 5px;
          border-radius: 3px;
        }
        .subbar-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .btn-sm {
          height: 28px;
          padding: 0 10px;
          font-size: 12px;
          gap: 5px;
        }
        .active-btn {
          background: var(--moss-subtle) !important;
          color: var(--moss) !important;
          border-color: rgba(75, 100, 85, 0.3) !important;
        }
        .canvas-container-wrap {
          flex: 1;
          position: relative;
          overflow: hidden;
          margin-left: var(--rail-width);
        }
        .spin-icon {
          animation: spin 1s linear infinite;
        }
        .text-moss {
          color: var(--moss);
        }
      `}</style>
    </div>
  );
}
