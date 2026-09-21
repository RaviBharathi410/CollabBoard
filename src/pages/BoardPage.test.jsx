import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import BoardPage from './BoardPage';
import ProtectedRoute from '../components/ProtectedRoute';
import * as db from '../firebase/db';
import useCanvasStore from '../canvas/hooks/useCanvasStore';

// Hoisted mocks
const { mockNavigate, mockUser, testBoardId } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUser: { uid: 'user-123', email: 'test@collabboard.io' },
  testBoardId: '12345678-1234-4234-8234-123456789abc',
}));

let currentMockAuthUser = mockUser;
let currentMockBoardId = testBoardId;
let currentMockLocationState = null;

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: currentMockBoardId }),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ search: '', pathname: `/board/${currentMockBoardId}`, state: currentMockLocationState }),
  Navigate: ({ to }) => <div data-testid="mock-navigate" data-to={to}>Redirecting to {to}</div>,
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    currentUser: currentMockAuthUser,
    logout: vi.fn(),
  }),
}));

vi.mock('../firebase/db', () => ({
  getBoardMeta: vi.fn().mockResolvedValue({ id: '12345678-1234-4234-8234-123456789abc', title: 'System Architecture Board', ownerId: 'user-123' }),
  updateBoardTitle: vi.fn().mockResolvedValue(true),
  createBoard: vi.fn().mockResolvedValue({ id: 'new-board-uuid-999', title: 'Untitled Board' }),
  isFirestoreUnavailable: vi.fn().mockReturnValue(false),
}));

vi.mock('../canvas/CanvasStage', () => ({
  default: () => <div id="mock-canvas-stage">Mock Canvas Stage</div>,
}));

vi.mock('../canvas/components/ContextDrawer', () => ({
  default: ({ isOpen }) => (isOpen ? <div id="mock-context-drawer">Mock Drawer</div> : null),
}));

vi.mock('../canvas/hooks/useAIEngine', () => ({
  default: () => ({
    chatToDiagram: vi.fn(),
    state: { isProcessing: false, isEnhancing: false },
  }),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('BoardPage Component', () => {
  let container;
  let root;

  beforeEach(() => {
    vi.clearAllMocks();
    currentMockAuthUser = mockUser;
    currentMockBoardId = testBoardId;
    currentMockLocationState = null;
    useCanvasStore.setState({ shapes: [], selectedIds: [], undoStack: [], redoStack: [] });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('renders board title, top bar, and canvas stage', async () => {
    await act(async () => {
      root.render(<BoardPage />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });

    expect(container.textContent).toContain('System Architecture Board');
    expect(container.querySelector('#mock-canvas-stage')).not.toBeNull();
    expect(container.textContent).toContain('Export');
  });

  it('updates board title and calls updateBoardTitle Firestore method on blur', async () => {
    await act(async () => {
      root.render(<BoardPage />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });

    // Click title display to trigger edit mode
    const titleDisplay = container.querySelector('.title-display');
    expect(titleDisplay).not.toBeNull();

    await act(async () => {
      titleDisplay.click();
    });

    const titleInput = container.querySelector('input.title-edit-input');
    expect(titleInput).not.toBeNull();

    // Type a new title using React's value setter and submit
    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(titleInput, 'Distributed Payment Gateway');
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      const submitBtn = container.querySelector('.title-edit-group button');
      if (submitBtn) {
        submitBtn.click();
      } else {
        titleInput.dispatchEvent(new Event('blur', { bubbles: true }));
      }
      await new Promise((r) => setTimeout(r, 60));
    });

    expect(db.updateBoardTitle).toHaveBeenCalledWith(
      testBoardId,
      'Distributed Payment Gateway'
    );
  });

  it('redirects to /dashboard if board does not exist in Firestore', async () => {
    vi.mocked(db.getBoardMeta).mockResolvedValueOnce(null);

    await act(async () => {
      root.render(<BoardPage />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('redirects unauthenticated user to /auth when protected', async () => {
    currentMockAuthUser = null;

    await act(async () => {
      root.render(
        <ProtectedRoute>
          <BoardPage />
        </ProtectedRoute>
      );
    });

    const redirect = container.querySelector('[data-testid="mock-navigate"]');
    expect(redirect).not.toBeNull();
    expect(redirect.getAttribute('data-to')).toBe('/auth');
    expect(container.querySelector('#mock-canvas-stage')).toBeNull();
  });

  it('resets canvas store when navigating directly from Board A to Board B', async () => {
    // 1. Mount Board A with shapes already present on canvas
    currentMockBoardId = '11111111-1111-4111-8111-111111111111';
    vi.mocked(db.getBoardMeta).mockResolvedValueOnce({
      id: currentMockBoardId,
      title: 'Board A',
      ownerId: 'user-123',
      starterShapes: [],
    });

    useCanvasStore.setState({
      shapes: [
        { id: 'shape-a-1', type: 'rectangle', text: 'Board A Node' },
        { id: 'shape-a-2', type: 'arrow' },
      ],
      selectedIds: ['shape-a-1'],
    });

    await act(async () => {
      root.render(<BoardPage />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });

    expect(container.textContent).toContain('Board A');
    expect(useCanvasStore.getState().shapes).toHaveLength(2);

    // 2. Navigate directly to Board B (a blank board without starterShapes)
    currentMockBoardId = '22222222-2222-4222-8222-222222222222';
    vi.mocked(db.getBoardMeta).mockResolvedValueOnce({
      id: currentMockBoardId,
      title: 'Board B',
      ownerId: 'user-123',
      starterShapes: [],
    });

    await act(async () => {
      root.render(<BoardPage />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });

    expect(container.textContent).toContain('Board B');
    // Confirm Board A's shapes were cleanly wiped out and not retained
    expect(useCanvasStore.getState().shapes).toEqual([]);
    expect(useCanvasStore.getState().selectedIds).toEqual([]);

    // 3. Navigate directly to Board C (with its own starterShapes)
    currentMockBoardId = '33333333-3333-4333-8333-333333333333';
    const boardCShapes = [
      { id: 'shape-c-1', type: 'rectangle', text: 'Board C Gateway' },
    ];
    vi.mocked(db.getBoardMeta).mockResolvedValueOnce({
      id: currentMockBoardId,
      title: 'Board C',
      ownerId: 'user-123',
      starterShapes: boardCShapes,
    });

    await act(async () => {
      root.render(<BoardPage />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });

    expect(container.textContent).toContain('Board C');
    // Confirm Board C has ONLY its own starter shapes
    expect(useCanvasStore.getState().shapes).toEqual(boardCShapes);
  });
});
