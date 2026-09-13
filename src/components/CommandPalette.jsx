import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Grid, ArrowRight, X } from 'lucide-react';

export default function CommandPalette({ isOpen, onClose, boards = [], onCreateBoard }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const handleClose = () => {
    setQuery('');
    setSelectedIndex(0);
    onClose();
  };

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const standardActions = [
    {
      id: 'action-new',
      type: 'action',
      title: 'Create new board',
      icon: Plus,
      run: () => {
        onCreateBoard?.('Untitled Board');
        handleClose();
      },
    },
    {
      id: 'action-table',
      type: 'action',
      title: 'Go to The Table (Dashboard)',
      icon: Grid,
      run: () => {
        navigate('/dashboard');
        handleClose();
      },
    },
  ];

  const boardItems = boards.map((b) => ({
    id: `board-${b.id}`,
    type: 'board',
    title: b.title || 'Untitled Board',
    icon: Grid,
    run: () => {
      navigate(`/board/${b.id}`);
      handleClose();
    },
  }));

  const allItems = [...standardActions, ...boardItems].filter((item) =>
    item.title.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      handleClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (allItems.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + (allItems.length || 1)) % (allItems.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allItems[selectedIndex]) {
        allItems[selectedIndex].run();
      }
    }
  };

  return (
    <div className="cmd-backdrop" onClick={handleClose} role="presentation">
      <div 
        className="cmd-dialog" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
        onKeyDown={handleKeyDown}
      >
        <div className="cmd-header">
          <Search size={16} className="cmd-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="cmd-input"
            placeholder="Type a command or search boards..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <button type="button" className="cmd-close" onClick={handleClose} aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>

        <div className="cmd-body" role="listbox">
          {allItems.length === 0 ? (
            <div className="cmd-empty">No matching boards or actions.</div>
          ) : (
            allItems.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  className={`cmd-item ${isSelected ? 'selected' : ''}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => item.run()}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <Icon size={16} className="cmd-item-icon" />
                  <span className="cmd-item-title">{item.title}</span>
                  {item.type === 'action' ? (
                    <span className="cmd-item-badge">Action</span>
                  ) : (
                    <span className="cmd-item-badge">Board</span>
                  )}
                  {isSelected && <ArrowRight size={14} className="cmd-item-arrow" />}
                </div>
              );
            })
          )}
        </div>

        <div className="cmd-footer">
          <span><kbd>↑</kbd> <kbd>↓</kbd> to navigate</span>
          <span><kbd>↵</kbd> to select</span>
          <span><kbd>ESC</kbd> to dismiss</span>
        </div>
      </div>

      <style>{`
        .cmd-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(38, 36, 31, 0.4);
          backdrop-filter: blur(2px);
          z-index: 100;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 15vh;
        }
        .cmd-dialog {
          width: 100%;
          max-width: 520px;
          background: var(--surface-raised);
          border: 1px solid var(--line-strong);
          border-radius: 6px;
          box-shadow: var(--shadow-lg);
          overflow: hidden;
          font-family: var(--font-sans);
        }
        .cmd-header {
          display: flex;
          align-items: center;
          padding: 10px 14px;
          border-bottom: 1px solid var(--line);
          gap: 10px;
        }
        .cmd-search-icon {
          color: var(--ink-faint);
          flex-shrink: 0;
        }
        .cmd-input {
          flex: 1;
          border: none;
          background: transparent;
          font-size: 14px;
          color: var(--ink);
          font-family: inherit;
        }
        .cmd-input::placeholder {
          color: var(--ink-faint);
        }
        .cmd-close {
          color: var(--ink-faint);
          padding: 2px;
          border-radius: 3px;
        }
        .cmd-close:hover {
          color: var(--ink);
          background: var(--surface-subtle);
        }
        .cmd-body {
          max-height: 280px;
          overflow-y: auto;
          padding: 6px;
        }
        .cmd-empty {
          padding: 20px;
          text-align: center;
          color: var(--ink-faint);
          font-size: 13px;
        }
        .cmd-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border-radius: 4px;
          font-size: 13.5px;
          color: var(--ink);
          cursor: pointer;
          transition: background 100ms ease;
        }
        .cmd-item.selected {
          background: var(--surface-subtle);
          color: var(--moss);
        }
        .cmd-item-icon {
          color: var(--ink-muted);
          flex-shrink: 0;
        }
        .cmd-item.selected .cmd-item-icon {
          color: var(--moss);
        }
        .cmd-item-title {
          flex: 1;
          text-overflow: ellipsis;
          overflow: hidden;
          white-space: nowrap;
        }
        .cmd-item-badge {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--ink-faint);
          border: 1px solid var(--line);
          padding: 1px 4px;
          border-radius: 3px;
        }
        .cmd-item-arrow {
          color: var(--moss);
        }
        .cmd-footer {
          display: flex;
          gap: 16px;
          padding: 8px 14px;
          background: var(--surface-subtle);
          border-top: 1px solid var(--line);
          font-size: 11px;
          color: var(--ink-faint);
        }
        .cmd-footer kbd {
          font-family: var(--font-mono);
          background: var(--surface-raised);
          border: 1px solid var(--line);
          padding: 1px 4px;
          border-radius: 3px;
        }
      `}</style>
    </div>
  );
}
