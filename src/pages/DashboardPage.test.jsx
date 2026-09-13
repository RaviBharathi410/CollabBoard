import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import DashboardPage from './DashboardPage';
import ProtectedRoute from '../components/ProtectedRoute';
import * as db from '../firebase/db';

// Mocks
const mockNavigate = vi.fn();
const mockSetSearchParams = vi.fn();
const mockUser = { uid: 'user-123', email: 'architect@collabboard.io' };
let currentMockAuthUser = mockUser;

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/dashboard', search: '' }),
  useSearchParams: () => [new URLSearchParams(), mockSetSearchParams],
  Navigate: ({ to }) => <div data-testid="mock-navigate" data-to={to}>Redirecting to {to}</div>,
  Link: ({ to, children, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    currentUser: currentMockAuthUser,
    logout: vi.fn(),
  }),
}));

vi.mock('../firebase/db', () => ({
  getUserBoards: vi.fn().mockResolvedValue([
    { id: 'b1', title: 'Distributed Cache Architecture', updatedAt: '2026-09-01T12:00:00Z' },
    { id: 'b2', title: 'Auth Service Pipeline', updatedAt: '2026-09-02T12:00:00Z' },
  ]),
  createBoard: vi.fn().mockResolvedValue({ id: 'b-new', title: 'Untitled Board' }),
  isFirestoreUnavailable: vi.fn().mockReturnValue(false),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('DashboardPage Component', () => {
  let container;
  let root;

  beforeEach(() => {
    vi.clearAllMocks();
    currentMockAuthUser = mockUser;
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

  it('renders dashboard with drafting table title and user boards from Firestore', async () => {
    await act(async () => {
      root.render(<DashboardPage />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });

    expect(db.getUserBoards).toHaveBeenCalledWith('user-123');
    expect(container.textContent).toContain('The Table');
    expect(container.textContent).toContain('Distributed Cache Architecture');
    expect(container.textContent).toContain('Auth Service Pipeline');
  });

  it('triggers board creation with correct user ID and navigates to new board', async () => {
    await act(async () => {
      root.render(<DashboardPage />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });

    const createBtn = container.querySelector('.table-actions button');
    expect(createBtn).not.toBeNull();

    await act(async () => {
      createBtn.click();
      await new Promise((r) => setTimeout(r, 60));
    });

    expect(db.createBoard).toHaveBeenCalledWith('user-123', 'Untitled Board');
    expect(mockNavigate).toHaveBeenCalledWith('/board/b-new');
  });

  it('renders empty state when user has no boards', async () => {
    vi.mocked(db.getUserBoards).mockResolvedValueOnce([]);

    await act(async () => {
      root.render(<DashboardPage />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });

    expect(container.textContent).toContain('The Table is clear');
  });

  it('redirects unauthenticated access via ProtectedRoute', async () => {
    currentMockAuthUser = null;

    await act(async () => {
      root.render(
        <ProtectedRoute>
          <DashboardPage />
        </ProtectedRoute>
      );
    });

    const redirect = container.querySelector('[data-testid="mock-navigate"]');
    expect(redirect).not.toBeNull();
    expect(redirect.getAttribute('data-to')).toBe('/auth');
    expect(container.textContent).not.toContain('The Table');
  });
});
