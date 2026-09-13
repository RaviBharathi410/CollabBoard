import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Users, History, Sparkles, UploadCloud, X, Send, Pin } from 'lucide-react';
import ImportDrawerTab from './ImportDrawerTab';
import useImportDiagram from '../hooks/useImportDiagram';

export default function ContextDrawer({
  isOpen,
  onClose,
  collaborators = [],
  chatMessages = [],
  onSendMessage,
  historyEvents = [],
  onRestoreVersion,
  onAskAI,
  askResponse,
  isAsking = false,
  activeTab = 'chat',
  onTabChange,
  stageRef,
  importHook: propImportHook,
}) {
  const [currentTab, setCurrentTab] = useState(activeTab);
  const [chatInput, setChatInput] = useState('');
  const [aiQuestion, setAiQuestion] = useState('');

  useEffect(() => {
    if (activeTab) {
      setCurrentTab(activeTab);
    }
  }, [activeTab]);

  const fallbackStageRef = useRef({ current: null });
  const internalImportHook = useImportDiagram(stageRef || fallbackStageRef);
  const importHook = propImportHook || internalImportHook;

  const handleTabClick = (tabId) => {
    setCurrentTab(tabId);
    onTabChange?.(tabId);
  };

  const handleSendChat = (e) => {
    e?.preventDefault();
    if (!chatInput.trim()) return;
    onSendMessage?.(chatInput.trim());
    setChatInput('');
  };

  const handleSendAI = (e) => {
    e?.preventDefault();
    if (!aiQuestion.trim() || isAsking) return;
    onAskAI?.(aiQuestion.trim());
    setAiQuestion('');
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'chat', label: 'Chat', icon: MessageSquare, count: chatMessages.length },
    { id: 'participants', label: 'Who\'s Here', icon: Users, count: Math.max(collaborators.length, 1) },
    { id: 'history', label: 'History', icon: History, count: historyEvents.length },
    { id: 'ai', label: 'Ask AI', icon: Sparkles },
    { id: 'import', label: 'Import', icon: UploadCloud },
  ];

  return (
    <aside 
      className="context-drawer" 
      role="complementary" 
      aria-label="Collaboration and Context Drawer"
    >
      {/* Drawer Header with Tabs */}
      <div className="drawer-header">
        <div className="drawer-tabs" role="tablist" aria-label="Collaboration Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                id={`drawer-tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`drawer-panel-${tab.id}`}
                className={`drawer-tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => handleTabClick(tab.id)}
                title={tab.label}
              >
                <Icon size={16} />
                <span className="tab-text">{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="tab-badge">{tab.count}</span>
                )}
              </button>
            );
          })}
        </div>
        <button 
          type="button" 
          className="drawer-close-btn" 
          onClick={onClose} 
          aria-label="Close Drawer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Drawer Content Body */}
      <div className="drawer-content">
        {/* TAB 1: CHAT */}
        {currentTab === 'chat' && (
          <div 
            id="drawer-panel-chat" 
            role="tabpanel" 
            aria-labelledby="drawer-tab-chat"
            className="tab-panel chat-panel"
          >
            <div className="chat-stream">
              {chatMessages.length === 0 ? (
                <div className="chat-empty">
                  <p>No messages yet.</p>
                  <span>Leave a note or discuss the diagram in real time.</span>
                </div>
              ) : (
                chatMessages.map((msg, i) => (
                  <div key={i} className={`chat-message ${msg.isSelf ? 'self' : ''}`}>
                    <div className="chat-msg-header">
                      <span className="chat-author">{msg.author || 'Collaborator'}</span>
                      <span className="chat-time">{msg.time || 'now'}</span>
                    </div>
                    <div className="chat-msg-body">{msg.text}</div>
                  </div>
                ))
              )}
            </div>

            <form className="chat-composer" onSubmit={handleSendChat}>
              <input
                type="text"
                className="chat-input"
                placeholder="Type a message or note..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
              />
              <button type="submit" className="chat-send-btn" aria-label="Send message">
                <Send size={14} />
              </button>
            </form>
          </div>
        )}

        {/* TAB 2: PARTICIPANTS */}
        {currentTab === 'participants' && (
          <div 
            id="drawer-panel-participants" 
            role="tabpanel" 
            aria-labelledby="drawer-tab-participants"
            className="tab-panel participants-panel"
          >
            <div className="panel-subhead">
              <span>Active Collaborators</span>
              <span className="active-pill">● Live</span>
            </div>

            <ul className="participants-list">
              <li className="participant-row self-row">
                <span className="user-dot" style={{ background: 'var(--moss)' }} />
                <div className="participant-info">
                  <span className="participant-name">You (Current Editor)</span>
                  <span className="participant-status">Viewing / Editing</span>
                </div>
                <span className="presence-tag">Active</span>
              </li>

              {collaborators.map((c, i) => (
                <li key={i} className="participant-row">
                  <span className="user-dot" style={{ background: c.color || '#9E5826' }} />
                  <div className="participant-info">
                    <span className="participant-name">{c.name || `Collaborator ${i + 1}`}</span>
                    <span className="participant-status">Canvas cursor active</span>
                  </div>
                  <Pin size={13} className="pin-marker" title="Pinned to canvas" />
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* TAB 3: HISTORY */}
        {currentTab === 'history' && (
          <div 
            id="drawer-panel-history" 
            role="tabpanel" 
            aria-labelledby="drawer-tab-history"
            className="tab-panel history-panel"
          >
            <div className="panel-subhead">
              <span>Change Timeline</span>
              <span className="sync-pill">Yjs CRDT</span>
            </div>

            <ul className="history-timeline">
              <li className="history-item current-version">
                <div className="timeline-node" />
                <div className="history-info">
                  <div className="history-meta">
                    <span className="history-title">Current State</span>
                    <span className="history-time">Just now</span>
                  </div>
                  <span className="history-desc">All canvas sync updates applied</span>
                </div>
              </li>

              {historyEvents.length === 0 ? (
                <li className="history-item">
                  <div className="timeline-node subtle" />
                  <div className="history-info">
                    <div className="history-meta">
                      <span className="history-title">Session Initialized</span>
                      <span className="history-time">Recent</span>
                    </div>
                    <span className="history-desc">Board opened in Drafting Table mode</span>
                  </div>
                </li>
              ) : (
                historyEvents.map((h, i) => (
                  <li key={i} className="history-item">
                    <div className="timeline-node subtle" />
                    <div className="history-info">
                      <div className="history-meta">
                        <span className="history-title">{h.title || 'Canvas Edit'}</span>
                        <span className="history-time">{h.time || 'Earlier'}</span>
                      </div>
                      <span className="history-desc">{h.desc || 'Shapes modified'}</span>
                      {onRestoreVersion && (
                        <button
                          type="button"
                          className="history-restore-btn"
                          onClick={() => onRestoreVersion(h.versionId || i)}
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}

        {/* TAB 4: ASK AI */}
        {currentTab === 'ai' && (
          <div 
            id="drawer-panel-ai" 
            role="tabpanel" 
            aria-labelledby="drawer-tab-ai"
            className="tab-panel ai-panel"
          >
            <div className="panel-subhead">
              <span>Diagram Understanding</span>
              <span className="ai-model-tag">✦ Hybrid AI</span>
            </div>

            <div className="ai-chat-area">
              {askResponse?.answer ? (
                <div className="ai-response-card card">
                  <div className="ai-response-header">
                    <Sparkles size={14} className="ochre-icon" />
                    <span>AI Assistant</span>
                  </div>
                  <div className="ai-response-text">{askResponse.answer}</div>
                </div>
              ) : (
                <div className="ai-intro">
                  <p>Ask questions about your diagram architecture, dependencies, or request structural suggestions.</p>
                </div>
              )}
            </div>

            <form className="ai-composer" onSubmit={handleSendAI}>
              <input
                type="text"
                className="ai-input"
                placeholder="Ask about this diagram..."
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                disabled={isAsking}
              />
              <button 
                type="submit" 
                className="btn btn-primary ai-submit-btn" 
                disabled={isAsking || !aiQuestion.trim()}
              >
                {isAsking ? 'Thinking...' : 'Ask'}
              </button>
            </form>
          </div>
        )}

        {/* TAB 5: IMPORT */}
        {currentTab === 'import' && (
          <div 
            id="drawer-panel-import" 
            role="tabpanel" 
            aria-labelledby="drawer-tab-import"
            className="tab-panel"
          >
            <ImportDrawerTab
              onImportFile={importHook.importFile}
              onImportText={importHook.importText}
              isImporting={importHook.isImporting}
              error={importHook.error}
              previewDiagram={importHook.previewDiagram}
              importMeta={importHook.importMeta}
              highPrecision={importHook.highPrecision}
              setHighPrecision={importHook.setHighPrecision}
              onUpdateElement={importHook.updateElement}
              onCommit={importHook.commitToCanvas}
              onClear={importHook.clearPreview}
            />
          </div>
        )}
      </div>

      <style>{`
        .context-drawer {
          position: fixed;
          top: var(--navbar-height);
          right: 0;
          bottom: 0;
          width: 320px;
          background: var(--surface-raised);
          border-left: 1px solid var(--line);
          display: flex;
          flex-direction: column;
          z-index: 35;
          box-shadow: -2px 0 8px rgba(38, 36, 31, 0.04);
          font-family: var(--font-sans);
        }
        .drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--line);
          padding: 0 8px;
          height: 42px;
          background: var(--surface-subtle);
        }
        .drawer-tabs {
          display: flex;
          gap: 2px;
          height: 100%;
          align-items: flex-end;
        }
        .drawer-tab-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          font-size: 12.5px;
          color: var(--ink-muted);
          border-radius: 4px 4px 0 0;
          border-bottom: 2px solid transparent;
          cursor: pointer;
        }
        .drawer-tab-btn:hover {
          color: var(--ink);
          background: var(--surface-paper);
        }
        .drawer-tab-btn.active {
          color: var(--moss);
          font-weight: 500;
          background: var(--surface-raised);
          border-bottom-color: var(--moss);
        }
        .tab-badge {
          font-family: var(--font-mono);
          font-size: 10px;
          background: var(--surface-subtle);
          border: 1px solid var(--line);
          padding: 0 4px;
          border-radius: 3px;
        }
        .drawer-close-btn {
          color: var(--ink-faint);
          padding: 4px;
          border-radius: 3px;
        }
        .drawer-close-btn:hover {
          color: var(--ink);
          background: var(--surface-paper);
        }
        .drawer-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .tab-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .panel-subhead {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          border-bottom: 1px solid var(--line-subtle);
          font-size: 12px;
          font-weight: 500;
          color: var(--ink-muted);
        }
        .active-pill {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--moss);
        }
        .sync-pill {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--ink-faint);
        }
        .chat-stream {
          flex: 1;
          overflow-y: auto;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .chat-empty {
          margin: auto;
          text-align: center;
          color: var(--ink-faint);
          font-size: 13px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .chat-empty span {
          font-size: 11.5px;
        }
        .chat-message {
          display: flex;
          flex-direction: column;
          gap: 2px;
          background: var(--surface-subtle);
          padding: 8px 10px;
          border-radius: 4px;
          border: 1px solid var(--line-subtle);
        }
        .chat-message.self {
          background: var(--moss-subtle);
          border-color: rgba(75, 100, 85, 0.2);
        }
        .chat-msg-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11px;
        }
        .chat-author {
          font-weight: 600;
          color: var(--ink);
        }
        .chat-time {
          font-family: var(--font-mono);
          color: var(--ink-faint);
        }
        .chat-msg-body {
          font-size: 13px;
          color: var(--ink);
          line-height: 1.35;
        }
        .chat-composer {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px;
          border-top: 1px solid var(--line);
          background: var(--surface-raised);
        }
        .chat-input {
          flex: 1;
          height: 32px;
          padding: 0 10px;
          font-size: 13px;
          border: 1px solid var(--line-strong);
          border-radius: 4px;
          background: var(--surface-paper);
        }
        .chat-send-btn {
          width: 32px;
          height: 32px;
          border-radius: 4px;
          background: var(--moss);
          color: var(--ink-white);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .participants-list {
          flex: 1;
          overflow-y: auto;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .participant-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border-radius: 4px;
          background: var(--surface-paper);
          border: 1px solid var(--line-subtle);
        }
        .user-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .participant-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .participant-name {
          font-size: 13px;
          font-weight: 500;
          color: var(--ink);
        }
        .participant-status {
          font-size: 11px;
          color: var(--ink-faint);
        }
        .presence-tag {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--moss);
        }
        .pin-marker {
          color: var(--ink-faint);
        }
        .history-timeline {
          flex: 1;
          overflow-y: auto;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .history-item {
          display: flex;
          gap: 12px;
          position: relative;
        }
        .timeline-node {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: var(--moss);
          margin-top: 4px;
          flex-shrink: 0;
        }
        .timeline-node.subtle {
          background: var(--line-strong);
        }
        .history-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .history-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .history-title {
          font-size: 12.5px;
          font-weight: 500;
          color: var(--ink);
        }
        .history-time {
          font-family: var(--font-mono);
          font-size: 10.5px;
          color: var(--ink-faint);
        }
        .history-desc {
          font-size: 11.5px;
          color: var(--ink-muted);
        }
        .ai-panel {
          padding: 14px;
        }
        .ai-model-tag {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--ochre);
        }
        .ai-chat-area {
          flex: 1;
          overflow-y: auto;
          margin-bottom: 12px;
        }
        .ai-intro {
          padding: 20px 10px;
          text-align: center;
          font-size: 12.5px;
          color: var(--ink-muted);
          line-height: 1.4;
        }
        .ai-response-card {
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .ai-response-header {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: var(--ochre);
        }
        .ochre-icon {
          color: var(--ochre);
        }
        .ai-response-text {
          font-size: 13px;
          line-height: 1.45;
          color: var(--ink);
        }
        .ai-composer {
          display: flex;
          gap: 8px;
        }
        .ai-input {
          flex: 1;
          height: 34px;
          padding: 0 10px;
          font-size: 13px;
          border: 1px solid var(--line-strong);
          border-radius: 4px;
          background: var(--surface-paper);
        }
        .ai-submit-btn {
          height: 34px;
          padding: 0 12px;
        }
      `}</style>
    </aside>
  );
}
