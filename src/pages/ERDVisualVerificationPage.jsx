import React, { useState, useEffect } from 'react';
import { Stage } from 'react-konva';
import ShapesLayer from '../canvas/layers/ShapesLayer';
import useCanvasStore from '../canvas/store/canvasStore';

export default function ERDVisualVerificationPage() {
  const [shapes, setShapes] = useState([]);

  const initialErdShapes = [
    // ── Table 1: users ──
    {
      id: 'erd-users',
      type: 'erd_table',
      subtype: 'table',
      pluginType: 'erd',
      name: 'users',
      x: 80,
      y: 100,
      width: 230,
      height: 180,
      stroke: '#2563EB',
      columns: [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'email', type: 'varchar(255)', unique: true },
        { name: 'created_at', type: 'timestamp' },
        { name: 'status', type: 'varchar(32)' },
      ],
    },

    // ── Table 2: orders ──
    {
      id: 'erd-orders',
      type: 'erd_table',
      subtype: 'table',
      pluginType: 'erd',
      name: 'orders',
      x: 440,
      y: 100,
      width: 240,
      height: 200,
      stroke: '#2563EB',
      columns: [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'user_id', type: 'uuid', fk: true },
        { name: 'total_cents', type: 'integer' },
        { name: 'status', type: 'varchar(32)' },
        { name: 'ordered_at', type: 'timestamp' },
      ],
    },

    // ── Table 3: order_items ──
    {
      id: 'erd-order-items',
      type: 'erd_table',
      subtype: 'table',
      pluginType: 'erd',
      name: 'order_items',
      x: 810,
      y: 100,
      width: 250,
      height: 220,
      stroke: '#2563EB',
      columns: [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'order_id', type: 'uuid', fk: true },
        { name: 'product_id', type: 'uuid', fk: true },
        { name: 'quantity', type: 'integer' },
        { name: 'unit_price_cents', type: 'integer' },
      ],
    },

    // ── Table 4: products ──
    {
      id: 'erd-products',
      type: 'erd_table',
      subtype: 'table',
      pluginType: 'erd',
      name: 'products',
      x: 810,
      y: 380,
      width: 250,
      height: 190,
      stroke: '#059669',
      columns: [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'sku', type: 'varchar(64)', unique: true },
        { name: 'title', type: 'varchar(255)' },
        { name: 'stock_quantity', type: 'integer' },
      ],
    },

    // ── Relationships (Crow's Foot Cardinalities) ──
    // 1. users (1) -> (0..*) orders
    {
      id: 'rel-users-orders',
      type: 'erd_edge',
      subtype: 'one_to_many',
      pluginType: 'erd',
      source: 'erd-users',
      target: 'erd-orders',
      points: [310, 180, 440, 180],
      sourceMultiplicity: '1',
      targetMultiplicity: '0..*',
      label: 'places',
      stroke: '#2563EB',
    },
    // 2. orders (1) -> (1..*) order_items
    {
      id: 'rel-orders-items',
      type: 'erd_edge',
      subtype: 'one_to_many',
      pluginType: 'erd',
      source: 'erd-orders',
      target: 'erd-order-items',
      points: [680, 180, 810, 180],
      sourceMultiplicity: '1',
      targetMultiplicity: '1..*',
      label: 'contains',
      stroke: '#2563EB',
    },
    // 3. products (1) -> (0..*) order_items
    {
      id: 'rel-products-items',
      type: 'erd_edge',
      subtype: 'one_to_many',
      pluginType: 'erd',
      source: 'erd-products',
      target: 'erd-order-items',
      points: [935, 380, 935, 320],
      sourceMultiplicity: '1',
      targetMultiplicity: '0..*',
      label: 'included_in',
      stroke: '#059669',
    },
  ];

  useEffect(() => {
    useCanvasStore.setState({ shapes: initialErdShapes, selectedIds: [] });
    setShapes(initialErdShapes);
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#F8F9FB', display: 'flex', flexDirection: 'column' }}>
      {/* Top Header */}
      <div style={{ padding: '12px 24px', background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '18px', fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#1A1A2E', fontWeight: 700 }}>
            Entity-Relationship Diagram (ERD) Verification Reference
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748B', fontFamily: 'Inter, sans-serif' }}>
            Visual audit: Multi-compartment Table Cards, Primary Key [PK] badges (amber), Foreign Key [FK] badges (violet), and Crow's Foot cardinality lines (1 : N)
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontFamily: 'IBM Plex Mono, monospace' }}>
          <span style={{ padding: '4px 8px', background: '#FEF3C7', color: '#92400E', borderRadius: '4px', border: '1px solid #FDE68A' }}>PK Primary Key</span>
          <span style={{ padding: '4px 8px', background: '#EDE9FE', color: '#5B21B6', borderRadius: '4px', border: '1px solid #DDD6FE' }}>FK Foreign Key</span>
          <span style={{ padding: '4px 8px', background: '#EFF6FF', color: '#1E40AF', borderRadius: '4px', border: '1px solid #BFDBFE' }}>--{'>'} Crow's Foot (1:N)</span>
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
