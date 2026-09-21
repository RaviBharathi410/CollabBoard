import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Loader2, Layers, LayoutGrid } from 'lucide-react';
import IconRail from '../components/IconRail';
import DraftingTopBar from '../components/DraftingTopBar';
import CommandPalette from '../components/CommandPalette';
import BoardTile from '../components/BoardTile';
import { useAuth } from '../context/AuthContext';
import { getUserBoards, createBoard } from '../firebase/db';
import { TEMPLATES, getTemplateByTitle } from './templates/templateRegistry';

export default function DashboardPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeFilter = searchParams.get('filter') || 'all';

  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Load real boards from Firestore
  useEffect(() => {
    async function loadBoards() {
      if (!currentUser?.uid) return;
      try {
        setLoading(true);
        const userBoards = await getUserBoards(currentUser.uid);
        setBoards(userBoards);
      } catch (err) {
        console.error('Failed to load boards from Firestore:', err);
      } finally {
        setLoading(false);
      }
    }
    loadBoards();
  }, [currentUser]);

  // Handle board creation with optional template starter content
  const handleCreateBoard = async (title = 'Untitled Board', template = null) => {
    if (!currentUser?.uid || creating) return;
    const tpl = template || getTemplateByTitle(title);
    const finalTitle = tpl ? tpl.title : title;
    try {
      setCreating(true);
      const extraMeta = tpl ? {
        diagramType: tpl.diagramType,
        starterShapes: tpl.starterShapes,
      } : {};
      const newBoard = await createBoard(currentUser.uid, finalTitle, extraMeta);
      navigate(`/board/${newBoard.id}`, {
        state: {
          title: finalTitle,
          diagramType: tpl?.diagramType || 'flowchart',
          starterShapes: tpl?.starterShapes || [],
        },
      });
    } catch (err) {
      console.error('Failed to create board:', err);
    } finally {
      setCreating(false);
    }
  };

  // Keyboard navigation across board tiles (Spatial Drafting Table interaction)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept when command palette or inputs are active
      if (isSearchOpen || ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

      if (boards.length === 0) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % boards.length);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev - 1 + boards.length) % boards.length);
      } else if (e.key === 'Enter' && focusedIndex >= 0 && boards[focusedIndex]) {
        e.preventDefault();
        navigate(`/board/${boards[focusedIndex].id}`);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [boards, focusedIndex, isSearchOpen, navigate]);

  // Spatial mock collaborators for ambient presence demonstration on tiles
  const sampleCollaboratorsByBoard = {
    0: [{ name: 'Alice', color: '#2B5C8F' }, { name: 'Bob', color: '#9E5826' }],
    1: [{ name: 'Elena', color: '#2B5C8F' }],
  };

  const templates = TEMPLATES;

  return (
    <div className="table-layout bg-graph-paper">
      <IconRail />

      <div className="table-workspace">
        <DraftingTopBar 
          currentWorkspace="Core Atelier"
          collaboratorCount={boards.length > 0 ? 3 : 1}
          syncStatus="saved"
          onOpenSearch={() => setIsSearchOpen(true)}
        />

        <main className="table-main" role="main" aria-label="The Table Workspace">
          {/* Header & Table Controls */}
          <div className="table-header">
            <div className="table-header-title">
              <h1 className="page-title">The Table</h1>
              <p className="page-subtitle">
                Your spatial atelier. Boards laid out to draft, link, and collaborate.
              </p>
            </div>

            <div className="table-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleCreateBoard('Untitled Board')}
                disabled={creating}
              >
                {creating ? <Loader2 size={15} className="spin-icon" /> : <Plus size={15} />}
                <span>New Board</span>
              </button>
            </div>
          </div>

          {/* Spatial Tabs / Filters */}
          <div className="table-filter-bar" role="tablist" aria-label="Board Filters">
            {[
              { id: 'all', label: 'All Boards' },
              { id: 'recent', label: 'Recent' },
              { id: 'starred', label: 'Starred' },
              { id: 'templates', label: 'Templates' },
            ].map((tab) => {
              const isActive = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  className={`filter-tab ${isActive ? 'active' : ''}`}
                  onClick={() => setSearchParams(tab.id === 'all' ? {} : { filter: tab.id })}
                >
                  {tab.label}
                  {tab.id === 'all' && <span className="tab-count">{boards.length}</span>}
                </button>
              );
            })}
          </div>

          {/* Boards Grid */}
          {loading ? (
            <div className="table-loading">
              <Loader2 size={24} className="spin-icon text-moss" />
              <span>Setting up The Table...</span>
            </div>
          ) : activeFilter === 'templates' ? (
            <div className="templates-section">
              <h2 className="section-label">Kickstart from Blueprint Templates</h2>
              <div className="templates-grid">
                {templates.map((tpl) => (
                  <div
                    key={tpl.id || tpl.title}
                    className="template-tile card"
                    onClick={() => handleCreateBoard(tpl.title, tpl)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateBoard(tpl.title, tpl)}
                  >
                    <div className="template-preview">
                      <Layers size={28} className="template-icon" />
                    </div>
                    <div className="template-info">
                      <span className="template-title">{tpl.title}</span>
                      <span className="template-badge">{tpl.tag}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : boards.length === 0 ? (
            <div className="table-empty card">
              <div className="empty-icon-wrap">
                <LayoutGrid size={32} />
              </div>
              <h3>The Table is clear</h3>
              <p>Create a fresh board to begin drafting system diagrams, sketches, and user flows.</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleCreateBoard('Untitled Board')}
              >
                <Plus size={15} />
                <span>Draft First Board</span>
              </button>
            </div>
          ) : (
            <div className="boards-grid" role="region" aria-label="Boards List">
              {boards.map((board, index) => (
                <BoardTile
                  key={board.id}
                  board={board}
                  collaborators={sampleCollaboratorsByBoard[index] || []}
                  isFocused={index === focusedIndex}
                  onFocus={() => setFocusedIndex(index)}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* ⌘K Command Palette */}
      <CommandPalette
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        boards={boards}
        onCreateBoard={handleCreateBoard}
      />

      <style>{`
        .table-layout {
          min-height: 100vh;
          display: flex;
        }
        .table-workspace {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .table-main {
          flex: 1;
          max-width: 1180px;
          width: 100%;
          margin: 0 auto;
          padding: 24px 32px 64px 32px;
        }
        .table-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 20px;
          gap: 16px;
        }
        .table-header-title {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .page-title {
          font-size: var(--text-xl);
          font-weight: 600;
          color: var(--ink);
          letter-spacing: -0.02em;
        }
        .page-subtitle {
          font-size: var(--text-sm);
          color: var(--ink-muted);
        }
        .table-filter-bar {
          display: flex;
          gap: 4px;
          border-bottom: 1px solid var(--line);
          margin-bottom: 24px;
        }
        .filter-tab {
          font-family: var(--font-sans);
          font-size: 13.5px;
          font-weight: 500;
          padding: 8px 12px;
          color: var(--ink-muted);
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 120ms ease;
        }
        .filter-tab:hover {
          color: var(--ink);
        }
        .filter-tab.active {
          color: var(--moss);
          border-bottom-color: var(--moss);
        }
        .tab-count {
          font-family: var(--font-mono);
          font-size: 11px;
          background: var(--surface-subtle);
          border: 1px solid var(--line);
          padding: 0 4px;
          border-radius: 3px;
        }
        .boards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 20px;
        }
        .table-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 20px;
          gap: 12px;
          color: var(--ink-muted);
          font-size: 14px;
        }
        .table-empty {
          max-width: 440px;
          margin: 60px auto;
          padding: 36px 24px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .empty-icon-wrap {
          width: 52px;
          height: 52px;
          border-radius: 6px;
          background: var(--surface-subtle);
          border: 1px solid var(--line);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--ink-muted);
        }
        .table-empty h3 {
          font-size: var(--text-md);
          font-weight: 600;
          color: var(--ink);
        }
        .table-empty p {
          font-size: var(--text-sm);
          color: var(--ink-muted);
          line-height: 1.4;
          margin-bottom: 8px;
        }
        .templates-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .section-label {
          font-size: 14px;
          font-weight: 500;
          color: var(--ink-muted);
        }
        .templates-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 16px;
        }
        .template-tile {
          cursor: pointer;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .template-preview {
          height: 90px;
          background: var(--surface-paper);
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--moss);
        }
        .template-info {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .template-title {
          font-size: 13px;
          font-weight: 500;
          color: var(--ink);
        }
        .template-badge {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--ink-faint);
          background: var(--surface-subtle);
          padding: 1px 4px;
          border-radius: 3px;
        }
        .text-moss {
          color: var(--moss);
        }
        .spin-icon {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
