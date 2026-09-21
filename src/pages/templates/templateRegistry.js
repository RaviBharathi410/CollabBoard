/**
 * templateRegistry.js
 * Blueprint template registry for CollabBoard.
 * Defines concrete starter shapes, diagram types, and metadata for dashboard template cards.
 */

export const TEMPLATES = [
  {
    id: 'system-architecture',
    title: 'System Architecture',
    diagramType: 'flowchart',
    tag: 'Arch',
    description: 'Tiered client, gateway, and database cloud architecture starter.',
    starterShapes: [
      // 1. Client App Node
      {
        id: 'node-client',
        type: 'rectangle',
        x: 140,
        y: 200,
        width: 170,
        height: 70,
        fill: '#EEEDFE',
        stroke: '#6C63FF',
        strokeWidth: 2,
      },
      {
        id: 'text-client',
        type: 'text',
        text: 'Client App (React/Vite)',
        x: 152,
        y: 226,
        width: 150,
        fontSize: 13,
        fontFamily: 'Plus Jakarta Sans',
        fill: '#1A1A2E',
      },

      // 2. API Gateway Node
      {
        id: 'node-gateway',
        type: 'rectangle',
        x: 430,
        y: 200,
        width: 170,
        height: 70,
        fill: '#FEF3D6',
        stroke: '#F59E0B',
        strokeWidth: 2,
      },
      {
        id: 'text-gateway',
        type: 'text',
        text: 'API Gateway (Express/Node)',
        x: 440,
        y: 226,
        width: 150,
        fontSize: 13,
        fontFamily: 'Plus Jakarta Sans',
        fill: '#1A1A2E',
      },

      // 3. Database Node
      {
        id: 'node-db',
        type: 'rectangle',
        x: 720,
        y: 200,
        width: 170,
        height: 70,
        fill: '#E6F4EA',
        stroke: '#1E8E3E',
        strokeWidth: 2,
      },
      {
        id: 'text-db',
        type: 'text',
        text: 'Primary DB (PostgreSQL)',
        x: 732,
        y: 226,
        width: 150,
        fontSize: 13,
        fontFamily: 'Plus Jakarta Sans',
        fill: '#1A1A2E',
      },

      // Edge 1: Client -> API Gateway
      {
        id: 'edge-client-gateway',
        type: 'arrow',
        source: 'node-client',
        target: 'node-gateway',
        points: [310, 235, 430, 235],
        stroke: '#6C63FF',
        strokeWidth: 2,
        label: 'HTTPS / REST',
      },

      // Edge 2: API Gateway -> DB
      {
        id: 'edge-gateway-db',
        type: 'arrow',
        source: 'node-gateway',
        target: 'node-db',
        points: [600, 235, 720, 235],
        stroke: '#F59E0B',
        strokeWidth: 2,
        label: 'SQL / Pool',
      },
    ],
  },

  {
    id: 'user-flow-sequence',
    title: 'User Flow Sequence',
    diagramType: 'sequence',
    tag: 'Flow',
    description: 'Two-participant user authentication sequence with request and return messages.',
    starterShapes: [
      // Lifeline 1: Client / User
      {
        id: 'seq-ll-client',
        type: 'sequence_lifeline',
        subtype: 'lifeline',
        pluginType: 'sequence',
        name: 'User : Client',
        role: 'actor',
        x: 160,
        y: 80,
        width: 140,
        height: 50,
        lineHeight: 380,
        fill: '#EEF2FF',
        stroke: '#4F46E5',
        strokeWidth: 1.5,
      },
      // Lifeline 2: AuthService
      {
        id: 'seq-ll-auth',
        type: 'sequence_lifeline',
        subtype: 'lifeline',
        pluginType: 'sequence',
        name: 'AuthService',
        role: 'service',
        x: 440,
        y: 80,
        width: 140,
        height: 50,
        lineHeight: 380,
        fill: '#EEF2FF',
        stroke: '#4F46E5',
        strokeWidth: 1.5,
      },
      // Lifeline 3: Database
      {
        id: 'seq-ll-db',
        type: 'sequence_lifeline',
        subtype: 'lifeline',
        pluginType: 'sequence',
        name: 'UserDatabase',
        role: 'database',
        x: 720,
        y: 80,
        width: 140,
        height: 50,
        lineHeight: 380,
        fill: '#EEF2FF',
        stroke: '#4F46E5',
        strokeWidth: 1.5,
      },
      // Activation Bar: AuthService
      {
        id: 'seq-act-auth',
        type: 'sequence_activation',
        subtype: 'activation',
        pluginType: 'sequence',
        lifelineId: 'seq-ll-auth',
        x: 503,
        y: 175,
        width: 14,
        height: 185,
        fill: '#FFFFFF',
        stroke: '#4F46E5',
        strokeWidth: 1.5,
      },
      // Activation Bar: Database
      {
        id: 'seq-act-db',
        type: 'sequence_activation',
        subtype: 'activation',
        pluginType: 'sequence',
        lifelineId: 'seq-ll-db',
        x: 783,
        y: 225,
        width: 14,
        height: 70,
        fill: '#FFFFFF',
        stroke: '#4F46E5',
        strokeWidth: 1.5,
      },
      // Message 1 (Sync Call): Client -> AuthService
      {
        id: 'seq-msg-login',
        type: 'sequence_message',
        subtype: 'sync_message',
        pluginType: 'sequence',
        source: 'seq-ll-client',
        target: 'seq-ll-auth',
        points: [230, 185, 503, 185],
        stroke: '#4F46E5',
        strokeWidth: 1.5,
        order: 1,
        label: 'login(credentials)',
      },
      // Message 2 (Sync Call): AuthService -> Database
      {
        id: 'seq-msg-query',
        type: 'sequence_message',
        subtype: 'sync_message',
        pluginType: 'sequence',
        source: 'seq-ll-auth',
        target: 'seq-ll-db',
        points: [517, 235, 783, 235],
        stroke: '#4F46E5',
        strokeWidth: 1.5,
        order: 2,
        label: 'findByEmail(email)',
      },
      // Message 3 (Return): Database -> AuthService
      {
        id: 'seq-msg-result',
        type: 'sequence_message',
        subtype: 'return_message',
        pluginType: 'sequence',
        source: 'seq-ll-db',
        target: 'seq-ll-auth',
        points: [783, 285, 517, 285],
        stroke: '#059669',
        strokeWidth: 1.5,
        order: 3,
        label: 'userRecord',
      },
      // Message 4 (Return): AuthService -> Client
      {
        id: 'seq-msg-reply',
        type: 'sequence_message',
        subtype: 'return_message',
        pluginType: 'sequence',
        source: 'seq-ll-auth',
        target: 'seq-ll-client',
        points: [503, 345, 230, 345],
        stroke: '#059669',
        strokeWidth: 1.5,
        order: 4,
        label: '200 OK (JWT Token)',
      },
    ],
  },

  {
    id: 'er-diagram',
    title: 'ER Diagram & Schema',
    diagramType: 'erd',
    tag: 'Data',
    description: 'Relational database schema with User and Order tables linked by foreign key.',
    starterShapes: [
      // Table 1: Users Entity
      {
        id: 'erd-users',
        type: 'erd_table',
        pluginType: 'erd',
        subtype: 'table',
        x: 140,
        y: 150,
        width: 220,
        height: 150,
        name: 'users',
        columns: [
          { name: 'id', type: 'uuid', pk: true },
          { name: 'email', type: 'varchar(255)', unique: true },
          { name: 'created_at', type: 'timestamp' },
        ],
        stroke: '#2563EB',
      },

      // Table 2: Orders Entity
      {
        id: 'erd-orders',
        type: 'erd_table',
        pluginType: 'erd',
        subtype: 'table',
        x: 540,
        y: 150,
        width: 230,
        height: 160,
        name: 'orders',
        columns: [
          { name: 'id', type: 'uuid', pk: true },
          { name: 'user_id', type: 'uuid', fk: true },
          { name: 'total_cents', type: 'integer' },
          { name: 'status', type: 'varchar(32)' },
        ],
        stroke: '#2563EB',
      },

      // Cardinality Relationship Edge: users -> orders (1 to 0..*)
      {
        id: 'erd-rel-user-order',
        type: 'erd_edge',
        pluginType: 'erd',
        source: 'erd-users',
        target: 'erd-orders',
        subtype: 'one_to_many',
        points: [360, 220, 540, 220],
        sourceMultiplicity: '1',
        targetMultiplicity: '0..*',
        stroke: '#2563EB',
        strokeWidth: 1.5,
        label: 'places',
      },
    ],
  },

  {
    id: 'mindmap',
    title: 'Brainstorm & Mindmap',
    diagramType: 'mindmap',
    tag: 'Idea',
    description: 'Radial product roadmap ideation board with central topic and branch nodes.',
    starterShapes: [
      // Central Node: Product Roadmap
      {
        id: 'mm-root',
        type: 'rectangle',
        x: 420,
        y: 240,
        width: 180,
        height: 60,
        fill: '#F3E8FF',
        stroke: '#9333EA',
        strokeWidth: 2,
      },
      {
        id: 'text-mm-root',
        type: 'text',
        text: 'Product Roadmap',
        x: 440,
        y: 260,
        width: 150,
        fontSize: 14,
        fontFamily: 'Plus Jakarta Sans',
        fontStyle: 'bold',
        fill: '#581C87',
      },

      // Branch 1: Core Features (Top Left)
      {
        id: 'mm-branch-1',
        type: 'rectangle',
        x: 140,
        y: 120,
        width: 150,
        height: 50,
        fill: '#EFF6FF',
        stroke: '#3B82F6',
        strokeWidth: 1.5,
      },
      {
        id: 'text-mm-b1',
        type: 'text',
        text: 'Core Features',
        x: 160,
        y: 136,
        width: 120,
        fontSize: 12,
        fontFamily: 'Plus Jakarta Sans',
        fontStyle: 'bold',
        fill: '#1E3A8A',
      },

      // Branch 2: Cloud Architecture (Top Right)
      {
        id: 'mm-branch-2',
        type: 'rectangle',
        x: 720,
        y: 120,
        width: 160,
        height: 50,
        fill: '#ECFDF5',
        stroke: '#10B981',
        strokeWidth: 1.5,
      },
      {
        id: 'text-mm-b2',
        type: 'text',
        text: 'Cloud Architecture',
        x: 735,
        y: 136,
        width: 140,
        fontSize: 12,
        fontFamily: 'Plus Jakarta Sans',
        fontStyle: 'bold',
        fill: '#064E3B',
      },

      // Branch 3: Launch Strategy (Bottom Center)
      {
        id: 'mm-branch-3',
        type: 'rectangle',
        x: 430,
        y: 400,
        width: 160,
        height: 50,
        fill: '#FFFBEB',
        stroke: '#F59E0B',
        strokeWidth: 1.5,
      },
      {
        id: 'text-mm-b3',
        type: 'text',
        text: 'Launch Strategy',
        x: 445,
        y: 416,
        width: 140,
        fontSize: 12,
        fontFamily: 'Plus Jakarta Sans',
        fontStyle: 'bold',
        fill: '#78350F',
      },

      // Branch Connector 1: Root -> Core Features
      {
        id: 'mm-edge-1',
        type: 'arrow',
        source: 'mm-root',
        target: 'mm-branch-1',
        points: [420, 260, 290, 150],
        stroke: '#3B82F6',
        strokeWidth: 1.5,
      },

      // Branch Connector 2: Root -> Cloud Architecture
      {
        id: 'mm-edge-2',
        type: 'arrow',
        source: 'mm-root',
        target: 'mm-branch-2',
        points: [600, 260, 720, 150],
        stroke: '#10B981',
        strokeWidth: 1.5,
      },

      // Branch Connector 3: Root -> Launch Strategy
      {
        id: 'mm-edge-3',
        type: 'arrow',
        source: 'mm-root',
        target: 'mm-branch-3',
        points: [510, 300, 510, 400],
        stroke: '#F59E0B',
        strokeWidth: 1.5,
      },
    ],
  },
];

const ID_ALIASES = {
  'architecture': 'system-architecture',
  'system-architecture': 'system-architecture',
  'sequence': 'user-flow-sequence',
  'user-flow-sequence': 'user-flow-sequence',
  'erd': 'er-diagram',
  'er-diagram': 'er-diagram',
  'mindmap': 'mindmap',
  'brainstorm-mindmap': 'mindmap',
  'brainstorm': 'mindmap',
};

const TITLE_ALIASES = {
  'architecture': 'system-architecture',
  'system architecture': 'system-architecture',
  'sequence': 'user-flow-sequence',
  'user flow sequence': 'user-flow-sequence',
  'user flow': 'user-flow-sequence',
  'erd': 'er-diagram',
  'er diagram': 'er-diagram',
  'er diagram & schema': 'er-diagram',
  'mindmap': 'mindmap',
  'brainstorm & mindmap': 'mindmap',
  'brainstorm': 'mindmap',
};

export function getTemplateById(id) {
  if (!id) return null;
  const normalized = id.trim().toLowerCase();
  const resolvedId = ID_ALIASES[normalized] || normalized;
  return TEMPLATES.find((t) => t.id === resolvedId) || null;
}

export function getTemplateByTitle(title) {
  if (!title) return null;
  const normalized = title.trim().toLowerCase();
  // Check exact title match first
  const exact = TEMPLATES.find((t) => t.title.toLowerCase() === normalized);
  if (exact) return exact;
  // Check title aliases
  const aliasId = TITLE_ALIASES[normalized];
  if (aliasId) {
    return TEMPLATES.find((t) => t.id === aliasId) || null;
  }
  // Check if title contains primary keywords
  if (normalized.includes('arch')) return TEMPLATES.find((t) => t.id === 'system-architecture') || null;
  if (normalized.includes('sequence')) return TEMPLATES.find((t) => t.id === 'user-flow-sequence') || null;
  if (normalized.includes('erd') || normalized.includes('schema')) return TEMPLATES.find((t) => t.id === 'er-diagram') || null;
  if (normalized.includes('mindmap') || normalized.includes('brainstorm')) return TEMPLATES.find((t) => t.id === 'mindmap') || null;

  return null;
}
