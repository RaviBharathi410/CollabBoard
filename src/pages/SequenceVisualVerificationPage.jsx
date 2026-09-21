import React, { useState, useEffect } from 'react';
import { Stage } from 'react-konva';
import ShapesLayer from '../canvas/layers/ShapesLayer';
import useCanvasStore from '../canvas/store/canvasStore';
import { sequenceLayout } from '../canvas/plugins/sequence/sequenceLayout';

export default function SequenceVisualVerificationPage() {
  const [shapes, setShapes] = useState([]);

  const initialSequenceShapes = [
    // ── 1. Lifelines (Participants) ──
    {
      id: 'll-client',
      type: 'sequence_lifeline',
      subtype: 'lifeline',
      pluginType: 'sequence',
      name: 'User : Client',
      role: 'actor',
      x: 120,
      y: 70,
      width: 140,
      height: 50,
      lineHeight: 460,
      fill: '#EEF2FF',
      stroke: '#4F46E5',
    },
    {
      id: 'll-gateway',
      type: 'sequence_lifeline',
      subtype: 'lifeline',
      pluginType: 'sequence',
      name: 'APIGateway',
      role: 'boundary',
      x: 380,
      y: 70,
      width: 140,
      height: 50,
      lineHeight: 460,
      fill: '#FEF3D6',
      stroke: '#D97706',
    },
    {
      id: 'll-auth',
      type: 'sequence_lifeline',
      subtype: 'lifeline',
      pluginType: 'sequence',
      name: 'AuthService',
      role: 'service',
      x: 640,
      y: 70,
      width: 140,
      height: 50,
      lineHeight: 460,
      fill: '#ECFDF5',
      stroke: '#059669',
    },
    {
      id: 'll-db',
      type: 'sequence_lifeline',
      subtype: 'lifeline',
      pluginType: 'sequence',
      name: 'UserDatabase',
      role: 'database',
      x: 900,
      y: 70,
      width: 140,
      height: 50,
      lineHeight: 460,
      fill: '#F5F3FF',
      stroke: '#7C3AED',
    },

    // ── 2. Activation Bars ──
    {
      id: 'act-gateway',
      type: 'sequence_activation',
      subtype: 'activation',
      pluginType: 'sequence',
      lifelineId: 'll-gateway',
      x: 443,
      y: 165,
      width: 14,
      height: 310,
      fill: '#FFFFFF',
      stroke: '#D97706',
    },
    {
      id: 'act-auth',
      type: 'sequence_activation',
      subtype: 'activation',
      pluginType: 'sequence',
      lifelineId: 'll-auth',
      x: 703,
      y: 215,
      width: 14,
      height: 200,
      fill: '#FFFFFF',
      stroke: '#059669',
    },
    {
      id: 'act-db',
      type: 'sequence_activation',
      subtype: 'activation',
      pluginType: 'sequence',
      lifelineId: 'll-db',
      x: 963,
      y: 265,
      width: 14,
      height: 80,
      fill: '#FFFFFF',
      stroke: '#7C3AED',
    },

    // ── 3. Messages (OMG UML 2.5 Semantics) ──
    // 1. Sync message: Client -> Gateway (solid line + filled arrowhead)
    {
      id: 'msg-1',
      type: 'sequence_message',
      subtype: 'sync_message',
      pluginType: 'sequence',
      source: 'll-client',
      target: 'll-gateway',
      points: [190, 170, 443, 170],
      order: 1,
      label: 'POST /api/v1/auth/login',
      stroke: '#1F2937',
    },
    // 2. Sync message: Gateway -> AuthService
    {
      id: 'msg-2',
      type: 'sequence_message',
      subtype: 'sync_message',
      pluginType: 'sequence',
      source: 'll-gateway',
      target: 'll-auth',
      points: [457, 220, 703, 220],
      order: 2,
      label: 'validateCredentials(email, pass)',
      stroke: '#1F2937',
    },
    // 3. Sync message: AuthService -> UserDB
    {
      id: 'msg-3',
      type: 'sequence_message',
      subtype: 'sync_message',
      pluginType: 'sequence',
      source: 'll-auth',
      target: 'll-db',
      points: [717, 270, 963, 270],
      order: 3,
      label: 'findUserByEmail(email)',
      stroke: '#1F2937',
    },
    // 4. Return message: UserDB -> AuthService (dashed line + open stick arrowhead)
    {
      id: 'msg-4',
      type: 'sequence_message',
      subtype: 'return_message',
      pluginType: 'sequence',
      source: 'll-db',
      target: 'll-auth',
      points: [963, 330, 717, 330],
      order: 4,
      label: 'userRecord (hash, salt)',
      stroke: '#059669',
    },
    // 5. Self message: AuthService -> AuthService (loop)
    {
      id: 'msg-5',
      type: 'sequence_message',
      subtype: 'sync_message',
      pluginType: 'sequence',
      source: 'll-auth',
      target: 'll-auth',
      points: [710, 365, 755, 365, 755, 390, 710, 390],
      isSelfMessage: true,
      order: 5,
      label: 'signJwtToken(claims)',
      stroke: '#4F46E5',
    },
    // 6. Return message: AuthService -> Gateway
    {
      id: 'msg-6',
      type: 'sequence_message',
      subtype: 'return_message',
      pluginType: 'sequence',
      source: 'll-auth',
      target: 'll-gateway',
      points: [703, 410, 457, 410],
      order: 6,
      label: '200 OK (JWT Token)',
      stroke: '#059669',
    },
    // 7. Return message: Gateway -> Client
    {
      id: 'msg-7',
      type: 'sequence_message',
      subtype: 'return_message',
      pluginType: 'sequence',
      source: 'll-gateway',
      target: 'll-client',
      points: [443, 460, 190, 460],
      order: 7,
      label: 'Set-Cookie: session_token',
      stroke: '#059669',
    },
  ];

  useEffect(() => {
    useCanvasStore.setState({ shapes: initialSequenceShapes, selectedIds: [] });
    setShapes(initialSequenceShapes);
  }, []);

  const handleApplyLayout = () => {
    const lifelinesAndActivations = shapes.filter((s) => s.type !== 'sequence_message' && s.type !== 'arrow');
    const messages = shapes.filter((s) => s.type === 'sequence_message' || s.type === 'arrow');

    const result = sequenceLayout({
      nodes: lifelinesAndActivations,
      edges: messages,
      options: {
        startX: 120,
        startY: 70,
        lifelineSpacing: 260,
        messageStartY: 170,
        messageSpacing: 55,
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
            UML 2.5 Sequence Diagram Verification Reference
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748B', fontFamily: 'Inter, sans-serif' }}>
            Visual audit: Parallel Lifelines with Vertical Dashed Centerlines, Activation Bars (Execution Specs), Sync Calls (solid + filled triangle), Return Messages (dashed + open arrow), Self Calls
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', fontSize: '11px', fontFamily: 'IBM Plex Mono, monospace' }}>
            <span style={{ padding: '4px 8px', background: '#EEF2FF', color: '#4F46E5', borderRadius: '4px', border: '1px solid #C7D2FE' }}>▶ Sync Call (Filled)</span>
            <span style={{ padding: '4px 8px', background: '#ECFDF5', color: '#059669', borderRadius: '4px', border: '1px solid #A7F3D0' }}>⇢ Return (Dashed)</span>
            <span style={{ padding: '4px 8px', background: '#FEF3D6', color: '#D97706', borderRadius: '4px', border: '1px solid #FDE68A' }}>▯ Activation Bar</span>
          </div>

          <button
            id="apply-sequence-layout-btn"
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
            Auto-Layout Sequence (Deterministic)
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
