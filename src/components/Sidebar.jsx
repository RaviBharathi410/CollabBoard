import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  LayoutGrid, Plus, Home, Clock, Star, Users,
  LayoutTemplate, Trash2, Settings
} from 'lucide-react';

const navItems = [
  { icon: Home, label: 'Home', id: 'home' },
  { icon: Clock, label: 'Recent', id: 'recent' },
  { icon: Star, label: 'Starred', id: 'starred' },
  { icon: Users, label: 'Shared with me', id: 'shared' },
  { icon: LayoutTemplate, label: 'Templates', id: 'templates' },
  { icon: Trash2, label: 'Trash', id: 'trash' },
];

const workspaces = [
  { name: 'Acme Inc.', color: 'var(--color-workspace-acme)' },
  { name: 'Product Team', color: 'var(--color-workspace-product)' },
  { name: 'Design Team', color: 'var(--color-workspace-design)' },
  { name: 'Engineering', color: 'var(--color-workspace-eng)' },
];

export default function Sidebar({ activePage = 'home' }) {
  return (
    <aside className="sidebar">
      {/* Logo */}
      <Link to="/" className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <LayoutGrid size={16} color="#fff" strokeWidth={2.5} />
        </div>
        <span className="sidebar-logo-text">CollabBoard</span>
      </Link>

      {/* New Board Button */}
      <motion.button
        className="sidebar-new-btn"
        whileHover={{ scale: 1.02, y: -1 }}
        whileTap={{ scale: 0.98 }}
      >
        <Plus size={18} />
        <span>New Board</span>
      </motion.button>

      {/* Nav Items */}
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <motion.div
              key={item.id}
              className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              whileHover={{ x: 3 }}
              transition={{ duration: 0.15 }}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </motion.div>
          );
        })}
      </nav>

      {/* Workspaces */}
      <div className="sidebar-section">
        <span className="sidebar-section-label">Workspaces</span>
        <div className="sidebar-workspaces">
          {workspaces.map((ws) => (
            <motion.div
              key={ws.name}
              className="sidebar-workspace-item"
              whileHover={{ x: 3 }}
              transition={{ duration: 0.15 }}
            >
              <span className="sidebar-workspace-dot" style={{ background: ws.color }} />
              <span>{ws.name}</span>
            </motion.div>
          ))}
          <div className="sidebar-workspace-item sidebar-new-workspace">
            <Plus size={16} />
            <span>New Workspace</span>
          </div>
        </div>
      </div>

      {/* User Profile */}
      <div className="sidebar-user">
        <div className="sidebar-user-avatar">JD</div>
        <div className="sidebar-user-info">
          <span className="sidebar-user-name">John Doe</span>
          <span className="sidebar-user-email">john@example.com</span>
        </div>
      </div>

      <style>{`
        .sidebar {
          width: var(--sidebar-width);
          height: 100vh;
          position: fixed;
          top: 0;
          left: 0;
          background: var(--color-bg-primary);
          border-right: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          padding: 20px 12px;
          z-index: 50;
          overflow-y: auto;
        }
        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 4px;
          margin-bottom: 20px;
        }
        .sidebar-logo-icon {
          width: 28px;
          height: 28px;
          background: var(--color-brand);
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .sidebar-logo-text {
          font-size: 1rem;
          font-weight: 700;
          color: var(--color-text-primary);
        }
        .sidebar-new-btn {
          width: 100%;
          height: 40px;
          background: var(--color-brand);
          color: var(--color-text-white);
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 20px;
          transition: background 0.2s ease;
        }
        .sidebar-new-btn:hover {
          background: var(--color-brand-dark);
        }
        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 2px;
          margin-bottom: 24px;
        }
        .sidebar-nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          height: 36px;
          padding: 0 12px;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .sidebar-nav-item:hover {
          background: var(--color-bg-tertiary);
        }
        .sidebar-nav-item.active {
          background: var(--color-bg-tertiary);
          color: var(--color-brand);
          font-weight: 600;
        }
        .sidebar-section {
          margin-bottom: 24px;
          flex: 1;
        }
        .sidebar-section-label {
          display: block;
          font-size: 0.6875rem;
          font-weight: 600;
          color: var(--color-text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 0 12px;
          margin-bottom: 8px;
        }
        .sidebar-workspaces {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .sidebar-workspace-item {
          display: flex;
          align-items: center;
          gap: 10px;
          height: 34px;
          padding: 0 12px;
          border-radius: 8px;
          font-size: 0.8125rem;
          font-weight: 500;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .sidebar-workspace-item:hover {
          background: var(--color-bg-tertiary);
        }
        .sidebar-workspace-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .sidebar-new-workspace {
          color: var(--color-text-tertiary);
        }
        .sidebar-new-workspace:hover {
          color: var(--color-text-secondary);
        }
        .sidebar-user {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--color-bg-secondary);
          padding: 12px;
          border-radius: 8px;
          margin-top: auto;
        }
        .sidebar-user-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--color-brand);
          color: var(--color-text-white);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 700;
          flex-shrink: 0;
        }
        .sidebar-user-info {
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .sidebar-user-name {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--color-text-primary);
        }
        .sidebar-user-email {
          font-size: 0.6875rem;
          color: var(--color-text-tertiary);
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
        }
      `}</style>
    </aside>
  );
}
