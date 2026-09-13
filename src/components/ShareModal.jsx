import React, { useState } from 'react';
import { X, Copy, Check, UserPlus, Shield, Eye, Edit3, Loader2 } from 'lucide-react';
import { shareBoard } from '../firebase/db';

export default function ShareModal({
  isOpen,
  onClose,
  boardId,
  boardTitle = 'Untitled Board',
  sharedWith = [],
  ownerEmail = 'Board Owner',
  isOwner = true,
  onInviteSuccess,
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  if (!isOpen) return null;

  const boardUrl = typeof window !== 'undefined' ? `${window.location.origin}/board/${boardId}` : '';

  const handleCopyLink = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(boardUrl);
      } else if (typeof document?.execCommand === 'function') {
        const textarea = document.createElement('textarea');
        textarea.value = boardUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleInvite = async (e) => {
    e?.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const updatedShared = await shareBoard(boardId, email.trim(), role);
      setStatusMessage(`Successfully shared with ${email.trim()} as ${role}.`);
      setEmail('');
      onInviteSuccess?.(updatedShared);
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err) {
      console.error('Failed to invite user:', err);
      setErrorMessage(err.message || 'Failed to update board permissions. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="share-modal-overlay" onClick={onClose} role="presentation">
      <div 
        className="share-modal-dialog" 
        onClick={(e) => e.stopPropagation()} 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="share-modal-title"
      >
        {/* Modal Header */}
        <div className="share-modal-header">
          <div className="share-header-left">
            <h2 id="share-modal-title" className="share-title">Share Blueprint</h2>
            <span className="share-subtitle">{boardTitle}</span>
          </div>
          <button 
            type="button" 
            className="share-close-btn" 
            onClick={onClose} 
            aria-label="Close share dialog"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="share-modal-body">
          {/* Quick Copy Link Row */}
          <div className="share-section">
            <label className="share-section-label">Direct Room Link</label>
            <div className="share-link-group">
              <input 
                type="text" 
                className="share-link-input" 
                value={boardUrl} 
                readOnly 
                data-testid="share-link-input"
              />
              <button 
                type="button" 
                className={`share-copy-btn ${copied ? 'copied' : ''}`}
                onClick={handleCopyLink}
                data-testid="copy-share-link-btn"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>

          {/* Invite Collaborator Form (Owners only) */}
          {isOwner ? (
            <div className="share-section">
              <label className="share-section-label">Invite Collaborator</label>
              <form onSubmit={handleInvite} className="share-invite-form">
                <div className="invite-inputs-row">
                  <input
                    type="email"
                    className="share-email-input"
                    placeholder="teammate@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    data-testid="invite-email-input"
                  />
                  <select
                    className="share-role-select"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    data-testid="invite-role-select"
                  >
                    <option value="viewer">Viewer (Read-Only)</option>
                    <option value="editor">Editor (Can Edit)</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="share-invite-btn"
                  disabled={isSubmitting || !email.trim()}
                  data-testid="invite-submit-btn"
                >
                  {isSubmitting ? <Loader2 size={14} className="spin-icon" /> : <UserPlus size={14} />}
                  <span>{isSubmitting ? 'Inviting...' : 'Invite'}</span>
                </button>
              </form>
            </div>
          ) : (
            <div className="share-notice viewer-notice">
              <Eye size={14} />
              <span>You are viewing this board with read-only permissions.</span>
            </div>
          )}

          {/* Alerts */}
          {statusMessage && (
            <div className="share-alert success-alert" data-testid="share-success-alert">
              <Check size={14} />
              <span>{statusMessage}</span>
            </div>
          )}
          {errorMessage && (
            <div className="share-alert error-alert" data-testid="share-error-alert">
              <Shield size={14} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Collaborator Roster */}
          <div className="share-section">
            <label className="share-section-label">Collaborators With Access</label>
            <div className="collaborator-list">
              {/* Board Owner */}
              <div className="collaborator-item owner-item">
                <div className="collaborator-avatar">
                  {ownerEmail.slice(0, 2).toUpperCase()}
                </div>
                <div className="collaborator-info">
                  <span className="collaborator-email">{ownerEmail}</span>
                  <span className="collaborator-meta">Created document</span>
                </div>
                <span className="role-tag owner-tag">Owner</span>
              </div>

              {/* Shared Members */}
              {sharedWith.map((member, idx) => (
                <div key={idx} className="collaborator-item">
                  <div className="collaborator-avatar member-avatar">
                    {member.email.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="collaborator-info">
                    <span className="collaborator-email">{member.email}</span>
                    <span className="collaborator-meta">
                      {member.role === 'editor' ? 'Can edit shapes' : 'Read-only access'}
                    </span>
                  </div>
                  <span className={`role-tag ${member.role}-tag`}>
                    {member.role === 'editor' ? (
                      <>
                        <Edit3 size={11} />
                        <span>Editor</span>
                      </>
                    ) : (
                      <>
                        <Eye size={11} />
                        <span>Viewer</span>
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <style>{`
          .share-modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(38, 36, 31, 0.45);
            backdrop-filter: blur(2px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
          }
          .share-modal-dialog {
            background: var(--surface-paper, #FDFCFA);
            border: 1px solid var(--line, #E5E2DC);
            border-radius: 8px;
            width: 90%;
            max-width: 480px;
            box-shadow: 0 16px 36px rgba(38, 36, 31, 0.18);
            overflow: hidden;
            font-family: var(--font-sans, system-ui, sans-serif);
          }
          .share-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding: 18px 20px;
            border-bottom: 1px solid var(--line, #E5E2DC);
            background: var(--surface-raised, #F6F5F1);
          }
          .share-title {
            font-size: 1rem;
            font-weight: 600;
            color: var(--ink-primary, #26241F);
            margin: 0 0 2px 0;
          }
          .share-subtitle {
            font-size: 0.8125rem;
            color: var(--ink-secondary, #66635B);
          }
          .share-close-btn {
            background: none;
            border: none;
            color: var(--ink-secondary, #66635B);
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
            display: flex;
            align-items: center;
          }
          .share-close-btn:hover {
            color: var(--ink-primary, #26241F);
            background: rgba(0, 0, 0, 0.05);
          }
          .share-modal-body {
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 18px;
          }
          .share-section {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .share-section-label {
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--ink-secondary, #66635B);
          }
          .share-link-group {
            display: flex;
            gap: 8px;
          }
          .share-link-input {
            flex: 1;
            padding: 8px 10px;
            font-size: 0.8125rem;
            border: 1px solid var(--line, #E5E2DC);
            border-radius: 4px;
            background: #FAF8F5;
            color: var(--ink-primary, #26241F);
            outline: none;
          }
          .share-copy-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 14px;
            font-size: 0.8125rem;
            font-weight: 500;
            border-radius: 4px;
            border: 1px solid var(--line, #E5E2DC);
            background: #FFFFFF;
            color: var(--ink-primary, #26241F);
            cursor: pointer;
            transition: all 0.15s ease;
          }
          .share-copy-btn:hover {
            background: var(--surface-raised, #F6F5F1);
          }
          .share-copy-btn.copied {
            background: var(--moss, #2C5E43);
            border-color: var(--moss, #2C5E43);
            color: #FFFFFF;
          }
          .share-invite-form {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .invite-inputs-row {
            display: flex;
            gap: 8px;
          }
          .share-email-input {
            flex: 2;
            padding: 8px 10px;
            font-size: 0.8125rem;
            border: 1px solid var(--line, #E5E2DC);
            border-radius: 4px;
            outline: none;
            background: #FFFFFF;
          }
          .share-email-input:focus {
            border-color: var(--moss, #2C5E43);
          }
          .share-role-select {
            flex: 1;
            padding: 8px 10px;
            font-size: 0.8125rem;
            border: 1px solid var(--line, #E5E2DC);
            border-radius: 4px;
            background: #FFFFFF;
            color: var(--ink-primary, #26241F);
            cursor: pointer;
          }
          .share-invite-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 8px 16px;
            font-size: 0.8125rem;
            font-weight: 500;
            border-radius: 4px;
            border: 1px solid var(--moss, #2C5E43);
            background: var(--moss, #2C5E43);
            color: #FFFFFF;
            cursor: pointer;
            transition: opacity 0.15s ease;
          }
          .share-invite-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
          .share-alert {
            padding: 10px 12px;
            border-radius: 4px;
            font-size: 0.8125rem;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .success-alert {
            background: #EAF3EC;
            color: #215136;
            border: 1px solid #C4DEC9;
          }
          .error-alert {
            background: #FDF1F0;
            color: #9C2E24;
            border: 1px solid #F5C6C2;
          }
          .viewer-notice {
            background: #F6F5F1;
            padding: 10px 12px;
            border-radius: 4px;
            font-size: 0.8125rem;
            color: var(--ink-secondary, #66635B);
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .collaborator-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
            max-height: 180px;
            overflow-y: auto;
          }
          .collaborator-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 10px;
            background: #FFFFFF;
            border: 1px solid var(--line, #E5E2DC);
            border-radius: 4px;
          }
          .collaborator-avatar {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: var(--moss, #2C5E43);
            color: #FFFFFF;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.75rem;
            font-weight: 600;
          }
          .member-avatar {
            background: #855B32;
          }
          .collaborator-info {
            flex: 1;
            display: flex;
            flex-direction: column;
          }
          .collaborator-email {
            font-size: 0.8125rem;
            font-weight: 500;
            color: var(--ink-primary, #26241F);
          }
          .collaborator-meta {
            font-size: 0.6875rem;
            color: var(--ink-secondary, #66635B);
          }
          .role-tag {
            font-size: 0.6875rem;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 12px;
            display: inline-flex;
            align-items: center;
            gap: 4px;
          }
          .owner-tag {
            background: #EAF3EC;
            color: #215136;
          }
          .editor-tag {
            background: #FBF0E6;
            color: #855B32;
          }
          .viewer-tag {
            background: #F0EFEA;
            color: #66635B;
          }
          .spin-icon {
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
