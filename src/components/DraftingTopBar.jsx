import { useState, useEffect } from 'react';
import { Search, Bell, ChevronDown, RefreshCw } from 'lucide-react';

export default function DraftingTopBar({
  currentWorkspace = 'Acme Inc.',
  onOpenSearch,
  syncStatus = 'saved', // 'saved' | 'syncing' | 'offline'
  collaboratorCount = 1,
  activeDocumentTitle = null,
}) {
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenSearch?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenSearch]);

  return (
    <header className="drafting-topbar" role="banner">
      {/* Left: Workspace dropdown / Active Document */}
      <div className="topbar-left">
        <button 
          type="button" 
          className="workspace-trigger"
          onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
          aria-expanded={workspaceMenuOpen}
          aria-haspopup="true"
        >
          <span className="workspace-name">{currentWorkspace}</span>
          <ChevronDown size={14} className="caret-icon" />
        </button>

        {activeDocumentTitle && (
          <>
            <span className="breadcrumb-slash">/</span>
            <span className="active-doc-badge">{activeDocumentTitle}</span>
          </>
        )}
      </div>

      {/* Center: Search & Quick Jump Command Input Trigger */}
      <div className="topbar-center">
        <button 
          type="button" 
          className="command-trigger-btn"
          onClick={onOpenSearch}
          aria-label="Search or jump to board (Command K)"
        >
          <Search size={14} className="search-icon" />
          <span className="search-placeholder">Search or jump to...</span>
          <kbd className="cmd-badge">⌘K</kbd>
        </button>
      </div>

      {/* Right: Sync state, Ambient presence dots, Notifications */}
      <div className="topbar-right">
        {/* Sync Status Badge */}
        <div className={`sync-status-indicator ${syncStatus}`}>
          {syncStatus === 'syncing' ? (
            <>
              <RefreshCw size={11} className="spin-icon" />
              <span>Syncing</span>
            </>
          ) : syncStatus === 'offline' ? (
            <>
              <span className="sync-dot offline-dot" />
              <span>Offline</span>
            </>
          ) : (
            <>
              <span className="sync-dot saved-dot" />
              <span>Saved</span>
            </>
          )}
        </div>

        <div className="topbar-v-rule" />

        {/* Ambient Presence Counter */}
        <div 
          className="ambient-presence" 
          title={`${collaboratorCount} collaborator${collaboratorCount > 1 ? 's' : ''} connected`}
          aria-label={`${collaboratorCount} collaborator${collaboratorCount > 1 ? 's' : ''} connected`}
        >
          <span className="presence-dots">
            {Array.from({ length: Math.min(collaboratorCount, 4) }).map((_, i) => (
              <span key={i} className="presence-dot live" />
            ))}
            {collaboratorCount === 0 && <span className="presence-dot idle" />}
          </span>
          <span className="presence-count">{collaboratorCount}</span>
        </div>

        <button type="button" className="utility-btn" title="Notifications" aria-label="Notifications">
          <Bell size={15} />
        </button>
      </div>

      <style>{`
        .drafting-topbar {
          position: sticky;
          top: 0;
          height: var(--navbar-height);
          background: var(--surface-raised);
          border-bottom: 1px solid var(--line);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px 0 calc(var(--rail-width) + 16px);
          z-index: 30;
          font-family: var(--font-sans);
          user-select: none;
        }
        .topbar-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .workspace-trigger {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 13.5px;
          font-weight: 500;
          color: var(--ink);
          border: 1px solid transparent;
        }
        .workspace-trigger:hover {
          background: var(--surface-subtle);
          border-color: var(--line);
        }
        .caret-icon {
          color: var(--ink-faint);
        }
        .breadcrumb-slash {
          color: var(--line-strong);
          font-size: 13px;
        }
        .active-doc-badge {
          font-size: 13px;
          font-weight: 600;
          color: var(--ink);
          max-width: 220px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .topbar-center {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1;
          max-width: 420px;
          margin: 0 16px;
        }
        .command-trigger-btn {
          width: 100%;
          height: 30px;
          background: var(--surface-subtle);
          border: 1px solid var(--line);
          border-radius: 4px;
          padding: 0 10px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--ink-faint);
          cursor: pointer;
          transition: all 150ms ease;
        }
        .command-trigger-btn:hover {
          background: var(--surface-paper);
          border-color: var(--line-strong);
          color: var(--ink-muted);
        }
        .search-icon {
          flex-shrink: 0;
        }
        .search-placeholder {
          font-size: 12.5px;
          flex: 1;
          text-align: left;
        }
        .cmd-badge {
          font-family: var(--font-mono);
          font-size: 10px;
          padding: 1px 5px;
          border-radius: 3px;
          background: var(--surface-raised);
          border: 1px solid var(--line);
          color: var(--ink-muted);
        }
        .topbar-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .sync-status-indicator {
          font-family: var(--font-mono);
          font-size: 11px;
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--ink-muted);
        }
        .sync-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        .saved-dot {
          background: var(--moss);
        }
        .offline-dot {
          background: var(--brick);
        }
        .spin-icon {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .topbar-v-rule {
          width: 1px;
          height: 16px;
          background: var(--line);
        }
        .ambient-presence {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 3px 6px;
          background: var(--surface-subtle);
          border: 1px solid var(--line);
          border-radius: 3px;
        }
        .presence-dots {
          display: flex;
          gap: 3px;
          align-items: center;
        }
        .presence-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
        }
        .presence-dot.live {
          background: var(--moss);
        }
        .presence-dot.idle {
          background: var(--ink-faint);
        }
        .presence-count {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--ink-muted);
        }
        .utility-btn {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          color: var(--ink-muted);
        }
        .utility-btn:hover {
          background: var(--surface-subtle);
          color: var(--ink);
        }
      `}</style>
    </header>
  );
}
