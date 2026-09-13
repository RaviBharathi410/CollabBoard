import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Grid, 
  Clock, 
  Star, 
  ListTree, 
  Layers, 
  LogOut, 
  Pin
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function IconRail({ onToggleOutline, isOutlineOpen = false }) {
  const location = useLocation();
  const { currentUser, logout } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  const displayName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';
  const initial = displayName.charAt(0).toUpperCase();

  const navItems = [
    { id: 'table', label: 'The Table', icon: Grid, path: '/dashboard' },
    { id: 'recent', label: 'Recent', icon: Clock, path: '/dashboard?filter=recent' },
    { id: 'starred', label: 'Starred', icon: Star, path: '/dashboard?filter=starred' },
    { id: 'templates', label: 'Templates', icon: Layers, path: '/dashboard?filter=templates' },
  ];

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const showExpanded = isPinned || isExpanded;

  return (
    <aside 
      className={`icon-rail ${showExpanded ? 'expanded' : ''}`}
      onMouseEnter={() => !isPinned && setIsExpanded(true)}
      onMouseLeave={() => !isPinned && setIsExpanded(false)}
      aria-label="Workspace Navigation Rail"
    >
      {/* Top Rail Header */}
      <div className="rail-top">
        <Link to="/dashboard" className="rail-brand" title="CollabBoard — The Drafting Table">
          <div className="brand-badge">
            <span className="brand-glyph">▤</span>
          </div>
          {showExpanded && <span className="brand-text">CollabBoard</span>}
        </Link>
        {showExpanded && (
          <button 
            type="button" 
            className={`pin-btn ${isPinned ? 'pinned' : ''}`} 
            onClick={() => setIsPinned(!isPinned)}
            title={isPinned ? 'Unpin Rail' : 'Pin Rail Open'}
            aria-label={isPinned ? 'Unpin Rail' : 'Pin Rail Open'}
          >
            <Pin size={14} />
          </button>
        )}
      </div>

      <div className="rail-divider" />

      {/* Main Navigation */}
      <nav className="rail-nav" aria-label="Main Navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || (item.id === 'table' && location.pathname === '/dashboard' && !location.search);
          return (
            <Link
              key={item.id}
              to={item.path}
              className={`rail-item ${isActive ? 'active' : ''}`}
              title={!showExpanded ? item.label : undefined}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="icon-wrapper">
                <Icon size={18} strokeWidth={isActive ? 2.2 : 1.75} />
              </div>
              {showExpanded && <span className="item-label">{item.label}</span>}
            </Link>
          );
        })}

        {/* Outline Mode Toggle (if callback provided) */}
        {onToggleOutline && (
          <button
            type="button"
            className={`rail-item ${isOutlineOpen ? 'active' : ''}`}
            onClick={onToggleOutline}
            title={!showExpanded ? 'Outline Mode (O)' : undefined}
            aria-label="Toggle Outline Mode"
          >
            <div className="icon-wrapper">
              <ListTree size={18} strokeWidth={isOutlineOpen ? 2.2 : 1.75} />
            </div>
            {showExpanded && (
              <span className="item-label">
                Outline <kbd className="rail-kbd">O</kbd>
              </span>
            )}
          </button>
        )}
      </nav>

      {/* Footer Profile & Logout */}
      <div className="rail-footer">
        <div className="rail-divider" />
        <div className="user-profile-row" title={displayName}>
          <div className="avatar-chip">{initial}</div>
          {showExpanded && (
            <div className="user-meta">
              <span className="user-name">{displayName}</span>
              <span className="user-status">Online</span>
            </div>
          )}
          {showExpanded && (
            <button 
              type="button" 
              className="logout-btn" 
              onClick={handleLogout}
              title="Log out"
              aria-label="Log out"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>

      <style>{`
        .icon-rail {
          position: fixed;
          left: 0;
          top: 0;
          bottom: 0;
          width: var(--rail-width);
          background: var(--surface-raised);
          border-right: 1px solid var(--line);
          z-index: 40;
          display: flex;
          flex-direction: column;
          padding: 8px 6px;
          transition: width 200ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 200ms ease;
          user-select: none;
        }
        .icon-rail.expanded {
          width: 200px;
          box-shadow: var(--shadow-lg);
        }
        .rail-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 40px;
          padding: 0 4px;
        }
        .rail-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--ink);
          font-weight: 600;
          text-decoration: none;
        }
        .brand-badge {
          width: 32px;
          height: 32px;
          border-radius: 4px;
          background: var(--moss);
          color: var(--ink-white);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          flex-shrink: 0;
        }
        .brand-glyph {
          line-height: 1;
        }
        .brand-text {
          font-size: 15px;
          font-weight: 600;
          white-space: nowrap;
          color: var(--ink);
        }
        .pin-btn {
          color: var(--ink-faint);
          padding: 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
        }
        .pin-btn:hover {
          color: var(--ink);
          background: var(--surface-subtle);
        }
        .pin-btn.pinned {
          color: var(--moss);
        }
        .rail-divider {
          height: 1px;
          background: var(--line-subtle);
          margin: 8px 4px;
        }
        .rail-nav {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
        }
        .rail-item {
          display: flex;
          align-items: center;
          gap: 12px;
          height: 36px;
          padding: 0 8px;
          border-radius: 4px;
          color: var(--ink-muted);
          text-decoration: none;
          font-size: 13.5px;
          font-weight: 500;
          transition: all 150ms ease;
          border: 1px solid transparent;
        }
        .rail-item:hover {
          background: var(--surface-subtle);
          color: var(--ink);
        }
        .rail-item.active {
          background: var(--moss-subtle);
          color: var(--moss);
          border-color: rgba(75, 100, 85, 0.2);
        }
        .icon-wrapper {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .item-label {
          white-space: nowrap;
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
        }
        .rail-kbd {
          font-family: var(--font-mono);
          font-size: 10px;
          background: var(--surface-raised);
          border: 1px solid var(--line);
          padding: 1px 4px;
          border-radius: 3px;
          color: var(--ink-faint);
        }
        .rail-footer {
          margin-top: auto;
        }
        .user-profile-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 4px;
          border-radius: 4px;
          height: 40px;
        }
        .avatar-chip {
          width: 28px;
          height: 28px;
          border-radius: 4px;
          background: var(--surface-subtle);
          border: 1px solid var(--line);
          color: var(--ink);
          font-weight: 600;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .user-meta {
          display: flex;
          flex-direction: column;
          flex: 1;
          overflow: hidden;
        }
        .user-name {
          font-size: 12.5px;
          font-weight: 500;
          color: var(--ink);
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
        }
        .user-status {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--moss);
        }
        .logout-btn {
          color: var(--ink-faint);
          padding: 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
        }
        .logout-btn:hover {
          color: var(--brick);
          background: var(--brick-subtle);
        }
      `}</style>
    </aside>
  );
}
