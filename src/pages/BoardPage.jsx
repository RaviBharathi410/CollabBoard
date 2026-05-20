import React from 'react';
import { motion } from 'framer-motion';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Share, Users, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import CanvasStage from '../canvas/CanvasStage';
import Toolbar from '../canvas/ui/Toolbar';
import PropertiesPanel from '../canvas/ui/PropertiesPanel';

export default function BoardPage() {
  const { id } = useParams();
  const { currentUser } = useAuth();
  
  const initial = currentUser?.email ? currentUser.email.charAt(0).toUpperCase() : '?';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="board-page"
    >
      {/* Top Navbar */}
      <div className="board-header">
        <div className="header-left">
          <Link to="/dashboard" className="back-btn">
            <ArrowLeft size={18} />
          </Link>
          <div className="board-title-group">
            <h1 className="board-title">Workspace: {id || 'Untitled Board'}</h1>
            <span className="board-status">Saved to cloud</span>
          </div>
        </div>

        <div className="header-right">
          <div className="avatars">
            <div className="avatar" style={{ background: '#6C63FF' }} title={currentUser?.email}>{initial}</div>
          </div>
          <button className="btn btn-secondary action-btn">
            <Settings size={16} />
          </button>
          <button className="btn btn-primary action-btn">
            <Share size={16} /> Share
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

        .board-title {
          font-size: 0.9375rem;
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .board-status {
          font-size: 0.6875rem;
          color: var(--color-text-tertiary);
        }

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
        }

        .board-workspace {
          flex: 1;
          position: relative;
        }
      `}</style>
    </motion.div>
  );
}
