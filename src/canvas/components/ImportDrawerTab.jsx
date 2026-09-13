import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileCode,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Sliders,
  Check,
} from 'lucide-react';

export default function ImportDrawerTab({
  onImportFile,
  onImportText,
  isImporting = false,
  error = null,
  previewDiagram = null,
  importMeta = null,
  highPrecision = false,
  setHighPrecision,
  engine = 'cloud',
  setEngine,
  onUpdateElement,
  onCommit,
  onClear,
}) {
  const [dragOver, setDragOver] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [mode, setMode] = useState('file'); // 'file' | 'text'
  const [lastFile, setLastFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setLastFile(file);
      onImportFile(file, engine);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setLastFile(file);
      onImportFile(file, engine);
    }
  };

  const handleReanalyzeWithAI = () => {
    if (lastFile) {
      setEngine?.('cloud');
      onImportFile(lastFile, 'cloud');
    }
  };

  const handleTextSubmit = (e) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    onImportText(textInput.trim());
    setTextInput('');
  };

  const report = previewDiagram?.confidenceReport;
  const isStructured = importMeta?.isStructured ?? false;

  return (
    <div className="tab-panel import-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
      {!previewDiagram ? (
        <>
          {/* Header Mode Toggle */}
          <div style={{ display: 'flex', gap: '8px', background: 'var(--surface-sunken, #F3F4F6)', padding: '4px', borderRadius: '8px' }}>
            <button
              type="button"
              onClick={() => setMode('file')}
              style={{
                flex: 1,
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: mode === 'file' ? '#FFFFFF' : 'transparent',
                boxShadow: mode === 'file' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                color: mode === 'file' ? '#1F2937' : '#6B7280',
                transition: 'all 0.15s ease',
              }}
            >
              Upload File
            </button>
            <button
              type="button"
              onClick={() => setMode('text')}
              style={{
                flex: 1,
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: mode === 'text' ? '#FFFFFF' : 'transparent',
                boxShadow: mode === 'text' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                color: mode === 'text' ? '#1F2937' : '#6B7280',
                transition: 'all 0.15s ease',
              }}
            >
              Paste Syntax
            </button>
          </div>

          {error && (
            <div style={{ padding: '10px 12px', background: '#FEE2E2', border: '1px solid #F87171', borderRadius: '8px', color: '#991B1B', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {mode === 'file' ? (
            <>
              {/* Drag & Drop Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? '#6C63FF' : '#D1D5DB'}`,
                  borderRadius: '12px',
                  padding: '32px 16px',
                  textAlign: 'center',
                  background: dragOver ? 'rgba(108, 99, 255, 0.04)' : '#FAFAFA',
                  cursor: isImporting ? 'wait' : 'pointer',
                  transition: 'border-color 0.2s, background-color 0.2s',
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".drawio,.xml,.svg,.mmd,.mermaid,.png,.jpg,.jpeg,.webp"
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                  disabled={isImporting}
                />
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px', color: '#6C63FF' }}>
                  {isImporting ? (
                    <RefreshCw size={36} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <UploadCloud size={36} />
                  )}
                </div>
                <div style={{ fontWeight: 600, fontSize: '14px', color: '#1F2937', marginBottom: '4px' }}>
                  {isImporting ? 'Analyzing & Parsing Diagram...' : 'Drop diagram file or click to browse'}
                </div>
                <div style={{ fontSize: '12px', color: '#6B7280', lineHeight: 1.4 }}>
                  Structured (.drawio, .svg, .mmd) or Images (.png, .jpg)
                </div>
              </div>

              {/* Supported Format Badges */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
                <span style={{ fontSize: '11px', background: '#EEEDFE', color: '#4F46E5', padding: '2px 8px', borderRadius: '12px', fontWeight: 500 }}>
                  .drawio
                </span>
                <span style={{ fontSize: '11px', background: '#EEEDFE', color: '#4F46E5', padding: '2px 8px', borderRadius: '12px', fontWeight: 500 }}>
                  Mermaid (.mmd)
                </span>
                <span style={{ fontSize: '11px', background: '#EEEDFE', color: '#4F46E5', padding: '2px 8px', borderRadius: '12px', fontWeight: 500 }}>
                  SVG Shapes
                </span>
                <span style={{ fontSize: '11px', background: '#FEF3C7', color: '#B45309', padding: '2px 8px', borderRadius: '12px', fontWeight: 500 }}>
                  Whiteboard / UML Photos
                </span>
              </div>

              {/* Image Recognition Engine Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: '#F9FAFB', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Image Recognition Engine
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setEngine?.('cloud')}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      border: engine === 'cloud' ? '1.5px solid #6C63FF' : '1px solid #D1D5DB',
                      background: engine === 'cloud' ? '#EEEDFE' : '#FFFFFF',
                      color: engine === 'cloud' ? '#4F46E5' : '#4B5563',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Sparkles size={13} color="#4F46E5" />
                      AI Vision (Recommended)
                    </span>
                    <span style={{ fontSize: '10px', color: '#6B7280', fontWeight: 400 }}>
                      UML, Architecture, Tables
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEngine?.('local')}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      border: engine === 'local' ? '1.5px solid #6C63FF' : '1px solid #D1D5DB',
                      background: engine === 'local' ? '#EEEDFE' : '#FFFFFF',
                      color: engine === 'local' ? '#4F46E5' : '#4B5563',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>Classical CV</span>
                    <span style={{ fontSize: '10px', color: '#6B7280', fontWeight: 400 }}>
                      Fast Offline Line-Art
                    </span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Syntax Paste Form */
            <form onSubmit={handleTextSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={`graph TD\n  Client[Web App] -->|HTTPS| API(Gateway)\n  API --> DB[(PostgreSQL)]`}
                rows={8}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #D1D5DB',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  resize: 'vertical',
                }}
              />
              <button
                type="submit"
                disabled={isImporting || !textInput.trim()}
                style={{
                  padding: '8px 16px',
                  background: '#6C63FF',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                {isImporting ? 'Parsing...' : 'Parse & Preview'}
              </button>
            </form>
          )}
        </>
      ) : (
        /* PRECISION REVIEW PANEL */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Precision Banner */}
          <div
            style={{
              padding: '12px',
              borderRadius: '8px',
              background: isStructured ? '#ECFDF5' : '#FFFBEB',
              border: `1px solid ${isStructured ? '#10B981' : '#F59E0B'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              {isStructured ? (
                <CheckCircle2 size={18} color="#059669" />
              ) : (
                <Sliders size={18} color="#D97706" />
              )}
              <span style={{ fontWeight: 700, fontSize: '13px', color: isStructured ? '#065F46' : '#92400E' }}>
                {isStructured
                  ? 'Exact Deterministic Import (~100% Fidelity)'
                  : `Vision & OCR Extraction (${Math.round((report?.overall || 0.8) * 100)}% Confidence)`}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: isStructured ? '#047857' : '#78350F' }}>
              {isStructured
                ? 'Extracted directly from structured geometries — no ML inference required.'
                : 'Extracted via local ONNX + OCR. Review any flagged elements below before committing.'}
            </div>

            {/* Source Breakdown Pills */}
            {report?.bySource && (
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                {report.bySource.parsed > 0 && (
                  <span style={{ fontSize: '11px', background: '#D1FAE5', color: '#065F46', padding: '2px 6px', borderRadius: '4px' }}>
                    parsed: {report.bySource.parsed}
                  </span>
                )}
                {report.bySource.ocr > 0 && (
                  <span style={{ fontSize: '11px', background: '#DBEAFE', color: '#1E40AF', padding: '2px 6px', borderRadius: '4px' }}>
                    ocr: {report.bySource.ocr}
                  </span>
                )}
                {report.bySource.detected > 0 && (
                  <span style={{ fontSize: '11px', background: '#EDE9FE', color: '#5B21B6', padding: '2px 6px', borderRadius: '4px' }}>
                    detected: {report.bySource.detected}
                  </span>
                )}
                {report.bySource.inferred > 0 && (
                  <span style={{ fontSize: '11px', background: '#FEF3C7', color: '#92400E', padding: '2px 6px', borderRadius: '4px' }}>
                    inferred: {report.bySource.inferred}
                  </span>
                )}
              </div>
            )}
            {importMeta?.fallbackReason && (
              <div
                style={{
                  marginTop: '10px',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  background: '#FEF3C7',
                  border: '1px solid #F59E0B',
                  fontSize: '11px',
                  color: '#92400E',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '6px',
                }}
              >
                <AlertTriangle size={14} color="#D97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{importMeta.fallbackReason}</span>
              </div>
            )}
          </div>

          {/* Diagram Summary */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#F3F4F6', borderRadius: '8px', fontSize: '12px' }}>
            <span><strong>Nodes:</strong> {previewDiagram.nodes?.length || 0}</span>
            <span><strong>Edges:</strong> {previewDiagram.edges?.length || 0}</span>
            <span><strong>Format:</strong> {importMeta?.format || 'diagram'}</span>
          </div>

          {/* Low-confidence items for review */}
          {report?.lowConfidenceElements?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#B45309', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertTriangle size={14} />
                Elements to Review ({report.lowConfidenceElements.length}):
              </div>

              {report.lowConfidenceElements.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: '8px 10px',
                    border: '1px solid #FCD34D',
                    borderRadius: '6px',
                    background: '#FFFBEB',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#78350F' }}>
                    <span>ID: {item.id}</span>
                    <span>Confidence: {Math.round(item.confidence * 100)}%</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      defaultValue={item.label}
                      placeholder="Label"
                      onBlur={(e) => onUpdateElement(item.id, { label: e.target.value })}
                      style={{
                        flex: 1,
                        padding: '4px 8px',
                        fontSize: '12px',
                        borderRadius: '4px',
                        border: '1px solid #D1D5DB',
                      }}
                    />
                    {item.kind === 'node' && (
                      <select
                        defaultValue={item.type}
                        onChange={(e) => onUpdateElement(item.id, { type: e.target.value })}
                        style={{
                          padding: '4px 6px',
                          fontSize: '11px',
                          borderRadius: '4px',
                          border: '1px solid #D1D5DB',
                          background: '#FFFFFF',
                        }}
                      >
                        <option value="rectangle">Rectangle</option>
                        <option value="circle">Circle</option>
                        <option value="diamond">Diamond</option>
                        <option value="database">Database</option>
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Re-analyze with AI Vision Banner if local CV was used */}
          {lastFile && (importMeta?.modelUsed === 'local-cv-pipeline' || importMeta?.format === 'raster_image') && (
            <button
              type="button"
              onClick={handleReanalyzeWithAI}
              disabled={isImporting}
              style={{
                width: '100%',
                padding: '9px 12px',
                background: '#EEEDFE',
                border: '1px solid #C7D2FE',
                borderRadius: '8px',
                color: '#4338CA',
                fontWeight: 600,
                fontSize: '12px',
                cursor: isImporting ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <Sparkles size={14} color="#6366F1" />
              <span>{isImporting ? 'Enhancing with AI Vision...' : '✨ Enhance with AI Vision (Gemini / GPT-4o)'}</span>
            </button>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={onCommit}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: '#6C63FF',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <Check size={16} />
              Commit to Canvas
            </button>
            <button
              type="button"
              onClick={onClear}
              style={{
                padding: '10px 14px',
                background: '#F3F4F6',
                color: '#4B5563',
                border: '1px solid #D1D5DB',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
