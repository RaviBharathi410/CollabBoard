import React, { useState, useEffect } from 'react';
import { Stage } from 'react-konva';
import ShapesLayer from '../canvas/layers/ShapesLayer';
import useCanvasStore from '../canvas/store/canvasStore';
import { useCaseLayout } from '../canvas/plugins/useCase/useCaseLayout';

export default function UseCaseVisualVerificationPage() {
  const [shapes, setShapes] = useState([]);

  const initialUseCaseShapes = [
    // ── 1. System Boundary ──
    {
      id: 'sys-collabboard',
      type: 'usecase_boundary',
      subtype: 'system_boundary',
      pluginType: 'use-case',
      name: 'CollabBoard Collaborative Atelier',
      x: 260,
      y: 60,
      width: 620,
      height: 480,
    },

    // ── 2. Primary Actors (Left) ──
    {
      id: 'actor-architect',
      type: 'usecase_actor',
      subtype: 'actor',
      pluginType: 'use-case',
      name: 'Software Architect',
      role: 'primary',
      x: 80,
      y: 110,
      width: 100,
      height: 120,
      stroke: '#4F46E5',
    },
    {
      id: 'actor-collaborator',
      type: 'usecase_actor',
      subtype: 'actor',
      pluginType: 'use-case',
      name: 'Peer Reviewer',
      role: 'collaborator',
      x: 80,
      y: 330,
      width: 100,
      height: 120,
      stroke: '#059669',
    },

    // ── 3. Secondary Actor (Right) ──
    {
      id: 'actor-ai-engine',
      type: 'usecase_actor',
      subtype: 'actor',
      pluginType: 'use-case',
      name: 'AI Vision Engine',
      role: 'service',
      isSecondary: true,
      position: 'right',
      x: 960,
      y: 220,
      width: 100,
      height: 120,
      stroke: '#D97706',
    },

    // ── 4. Use Cases (Inside Boundary) ──
    {
      id: 'uc-create-board',
      type: 'usecase_oval',
      subtype: 'use_case',
      pluginType: 'use-case',
      name: 'Create Board from Template',
      x: 320,
      y: 110,
      width: 190,
      height: 65,
      stroke: '#4F46E5',
    },
    {
      id: 'uc-draw-uml',
      type: 'usecase_oval',
      subtype: 'use_case',
      pluginType: 'use-case',
      name: 'Draft UML Diagram',
      x: 320,
      y: 220,
      width: 180,
      height: 65,
      stroke: '#4F46E5',
    },
    {
      id: 'uc-ai-enhance',
      type: 'usecase_oval',
      subtype: 'use_case',
      pluginType: 'use-case',
      name: 'AI Diagram Enhancement',
      stereotype: 'optional',
      x: 640,
      y: 110,
      width: 190,
      height: 65,
      stroke: '#D97706',
    },
    {
      id: 'uc-import-file',
      type: 'usecase_oval',
      subtype: 'use_case',
      pluginType: 'use-case',
      name: 'Import Draw.io / SVG',
      x: 320,
      y: 340,
      width: 190,
      height: 65,
      stroke: '#059669',
    },
    {
      id: 'uc-validate-syntax',
      type: 'usecase_oval',
      subtype: 'use_case',
      pluginType: 'use-case',
      name: 'Validate UML Syntax',
      x: 640,
      y: 340,
      width: 180,
      height: 65,
      stroke: '#7C3AED',
    },
    {
      id: 'uc-realtime-sync',
      type: 'usecase_oval',
      subtype: 'use_case',
      pluginType: 'use-case',
      name: 'Multiplayer Live Sync',
      x: 480,
      y: 440,
      width: 180,
      height: 65,
      stroke: '#2563EB',
    },

    // ── 5. Use Case Relationships ──
    // Association: Architect -> Create Board
    {
      id: 'edge-arch-create',
      type: 'usecase_edge',
      subtype: 'association',
      pluginType: 'use-case',
      source: 'actor-architect',
      target: 'uc-create-board',
      points: [160, 160, 320, 142],
      stroke: '#4F46E5',
      strokeWidth: 1.5,
    },
    // Association: Architect -> Draft UML
    {
      id: 'edge-arch-draft',
      type: 'usecase_edge',
      subtype: 'association',
      pluginType: 'use-case',
      source: 'actor-architect',
      target: 'uc-draw-uml',
      points: [160, 180, 320, 245],
      stroke: '#4F46E5',
      strokeWidth: 1.5,
    },
    // Association: Collaborator -> Multiplayer Sync
    {
      id: 'edge-collab-sync',
      type: 'usecase_edge',
      subtype: 'association',
      pluginType: 'use-case',
      source: 'actor-collaborator',
      target: 'uc-realtime-sync',
      points: [160, 380, 480, 460],
      stroke: '#059669',
      strokeWidth: 1.5,
    },
    // Extend: AI Diagram Enhancement -> Draft UML (dashed + open arrow + «extend»)
    {
      id: 'edge-extend-ai',
      type: 'usecase_edge',
      subtype: 'extend',
      pluginType: 'use-case',
      source: 'uc-ai-enhance',
      target: 'uc-draw-uml',
      points: [640, 160, 480, 225],
      stroke: '#D97706',
      strokeWidth: 1.5,
      label: '«extend»',
    },
    // Include: Import File -> Validate Syntax (dashed + open arrow + «include»)
    {
      id: 'edge-include-validate',
      type: 'usecase_edge',
      subtype: 'include',
      pluginType: 'use-case',
      source: 'uc-import-file',
      target: 'uc-validate-syntax',
      points: [510, 372, 640, 372],
      stroke: '#7C3AED',
      strokeWidth: 1.5,
      label: '«include»',
    },
    // Association: AI Engine -> AI Enhancement
    {
      id: 'edge-ai-service',
      type: 'usecase_edge',
      subtype: 'association',
      pluginType: 'use-case',
      source: 'actor-ai-engine',
      target: 'uc-ai-enhance',
      points: [960, 260, 830, 160],
      stroke: '#D97706',
      strokeWidth: 1.5,
    },
  ];

  useEffect(() => {
    useCanvasStore.setState({ shapes: initialUseCaseShapes, selectedIds: [] });
    setShapes(initialUseCaseShapes);
  }, []);

  const handleApplyLayout = () => {
    const nodes = shapes.filter((s) => s.type !== 'usecase_edge' && s.type !== 'arrow');
    const edges = shapes.filter((s) => s.type === 'usecase_edge' || s.type === 'arrow');

    const result = useCaseLayout({
      nodes,
      edges,
      options: {
        startX: 80,
        startY: 70,
        boundaryX: 280,
        boundaryWidth: 620,
        useCaseWidth: 180,
        useCaseHeight: 65,
        rowSpacing: 45,
      },
    });

    const newShapes = [...result.nodes, ...result.edges];
    useCanvasStore.setState({ shapes: newShapes });
    setShapes(newShapes);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#F8F9FB', display: 'flex', flexDirection: 'column' }}>
      {/* Top Header */}
      <div style={{ padding: '12px 24px', background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '18px', fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#1A1A2E', fontWeight: 700 }}>
            UML 2.5 Use Case Diagram Verification Reference
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748B', fontFamily: 'Inter, sans-serif' }}>
            Visual audit: Actor Stick Figures, Use Case Ovals, System Boundary Box, Associations, «include» & «extend» connectors with open arrowheads
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', fontSize: '11px', fontFamily: 'IBM Plex Mono, monospace' }}>
            <span style={{ padding: '4px 8px', background: '#EEF2FF', color: '#4F46E5', borderRadius: '4px', border: '1px solid #C7D2FE' }}>옷 Actor</span>
            <span style={{ padding: '4px 8px', background: '#F5F3FF', color: '#7C3AED', borderRadius: '4px', border: '1px solid #DDD6FE' }}>⤏ «include»</span>
            <span style={{ padding: '4px 8px', background: '#FEF3D6', color: '#D97706', borderRadius: '4px', border: '1px solid #FDE68A' }}>⤏ «extend»</span>
            <span style={{ padding: '4px 8px', background: '#F8FAFC', color: '#475569', borderRadius: '4px', border: '1px solid #CBD5E1' }}>▢ Boundary</span>
          </div>

          <button
            id="apply-usecase-layout-btn"
            onClick={handleApplyLayout}
            style={{
              padding: '6px 14px',
              background: '#4F46E5',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
            }}
          >
            Auto-Layout Use Case (Bipartite)
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <Stage width={window.innerWidth || 1280} height={Math.max(800, window.innerHeight - 80)}>
          <ShapesLayer selectedIds={[]} onSelect={() => {}} />
        </Stage>
      </div>
    </div>
  );
}
