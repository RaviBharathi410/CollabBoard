import { Link } from 'react-router-dom';
import { MoreHorizontal, Pin } from 'lucide-react';

export default function BoardTile({ 
  board, 
  collaborators = [], 
  onDelete, 
  onRename,
  isFocused = false,
  onFocus
}) {
  const dateStr = board.updatedAt 
    ? new Date(board.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : 'Recent';

  // Tactile diagram mini preview SVG
  const renderPreview = () => (
    <svg viewBox="0 0 200 110" fill="none" className="tile-svg" aria-hidden="true">
      <defs>
        <pattern id={`tileGrid-${board.id}`} x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="0.75" fill="#DAD6CC" />
        </pattern>
      </defs>
      <rect width="200" height="110" fill={`url(#tileGrid-${board.id})`} />
      
      {/* Node 1 */}
      <rect x="24" y="24" width="48" height="26" rx="3" fill="#FFFFFF" stroke="#DAD6CC" strokeWidth="1.2" />
      <line x1="72" y1="37" x2="116" y2="37" stroke="#8C887B" strokeWidth="1.2" strokeDasharray="3 2" />
      
      {/* Node 2 */}
      <rect x="116" y="20" width="60" height="34" rx="3" fill="#FFFFFF" stroke="#2B5C8F" strokeWidth="1.4" />
      <line x1="146" y1="54" x2="146" y2="76" stroke="#8C887B" strokeWidth="1.2" />
      
      {/* Node 3 */}
      <rect x="116" y="76" width="60" height="24" rx="3" fill="#F6F5F1" stroke="#DAD6CC" strokeWidth="1.2" />
    </svg>
  );

  return (
    <div 
      className={`board-tile ${isFocused ? 'focused' : ''}`}
      tabIndex={0}
      onFocus={onFocus}
      role="article"
      aria-label={`Board: ${board.title || 'Untitled Board'}`}
    >
      {/* Thumbnail Area */}
      <Link to={`/board/${board.id}`} className="tile-preview-link" tabIndex={-1}>
        <div className="tile-preview">
          {renderPreview()}
          
          {/* Presence Pin Badge (if collaborators are on this board) */}
          {collaborators.length > 0 && (
            <div className="presence-pin-cluster" title={`${collaborators.length} collaborator(s) drafting here`}>
              <Pin size={11} className="pin-icon" />
              <div className="pin-avatars">
                {collaborators.slice(0, 3).map((c, i) => (
                  <span 
                    key={i} 
                    className="pin-dot" 
                    style={{ background: c.color || 'var(--moss)' }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </Link>

      {/* Card Info Footer */}
      <div className="tile-footer">
        <div className="tile-meta">
          <Link to={`/board/${board.id}`} className="tile-title" title={board.title}>
            {board.title || 'Untitled Board'}
          </Link>
          <div className="tile-details">
            <span className="tile-timestamp">{dateStr}</span>
            <span className="tile-tag">Draft</span>
          </div>
        </div>

        <button 
          type="button" 
          className="tile-menu-btn"
          aria-label="Board options"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (onRename) {
              const newTitle = window.prompt('Rename board:', board.title);
              if (newTitle && newTitle.trim()) onRename(board.id, newTitle.trim());
            } else if (onDelete) {
              if (window.confirm(`Delete board "${board.title}"?`)) onDelete(board.id);
            }
          }}
        >
          <MoreHorizontal size={15} />
        </button>
      </div>

      <style>{`
        .board-tile {
          background: var(--surface-raised);
          border: 1px solid var(--line);
          border-radius: 4px;
          display: flex;
          flex-direction: column;
          box-shadow: var(--shadow-sm);
          transition: transform 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
          overflow: hidden;
          position: relative;
        }
        .board-tile:hover {
          border-color: var(--line-strong);
          box-shadow: var(--shadow-md);
          transform: translateY(-2px);
        }
        .board-tile:focus-visible,
        .board-tile.focused {
          border-color: var(--moss);
          box-shadow: 0 0 0 2px var(--moss-subtle), var(--shadow-md);
        }
        .tile-preview-link {
          text-decoration: none;
          display: block;
        }
        .tile-preview {
          height: 120px;
          background: var(--surface-paper);
          border-bottom: 1px solid var(--line-subtle);
          position: relative;
          overflow: hidden;
        }
        .tile-svg {
          width: 100%;
          height: 100%;
        }
        .presence-pin-cluster {
          position: absolute;
          top: 8px;
          right: 8px;
          background: var(--surface-raised);
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 2px 6px;
          display: flex;
          align-items: center;
          gap: 4px;
          box-shadow: var(--shadow-sm);
        }
        .pin-icon {
          color: var(--moss);
        }
        .pin-avatars {
          display: flex;
          gap: 3px;
        }
        .pin-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        .tile-footer {
          padding: 10px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          background: var(--surface-raised);
        }
        .tile-meta {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
          overflow: hidden;
        }
        .tile-title {
          font-size: 13.5px;
          font-weight: 500;
          color: var(--ink);
          text-decoration: none;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .tile-title:hover {
          color: var(--moss);
        }
        .tile-details {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .tile-timestamp {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--ink-faint);
        }
        .tile-tag {
          font-size: 10px;
          padding: 0 5px;
          border-radius: 3px;
          background: var(--surface-subtle);
          color: var(--ink-muted);
          border: 1px solid var(--line-subtle);
        }
        .tile-menu-btn {
          color: var(--ink-faint);
          padding: 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .tile-menu-btn:hover {
          color: var(--ink);
          background: var(--surface-subtle);
        }
      `}</style>
    </div>
  );
}
