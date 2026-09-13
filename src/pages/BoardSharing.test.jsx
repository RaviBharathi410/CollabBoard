import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import BoardPage from './BoardPage';
import * as db from '../firebase/db';

const { mockNavigate, mockUser, testBoardId } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUser: { uid: 'user-owner-123', email: 'owner@collabboard.io' },
  testBoardId: '12345678-1234-4234-8234-123456789abc',
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: testBoardId }),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ search: '', pathname: `/board/${testBoardId}`, state: null }),
  Navigate: ({ to }) => <div data-testid="mock-navigate" data-to={to}>Redirecting to {to}</div>,
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    currentUser: mockUser,
    logout: vi.fn(),
  }),
}));

vi.mock('../firebase/db', () => ({
  getBoardMeta: vi.fn(),
  updateBoardTitle: vi.fn().mockResolvedValue(true),
  createBoard: vi.fn(),
  shareBoard: vi.fn().mockResolvedValue([
    { email: 'teammate@company.com', role: 'editor', invitedAt: '2026-09-13T01:00:00Z' },
  ]),
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
    state: { isAsking: false, askResponse: null },
  }),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('BoardSharing & Access Control (BoardPage.jsx)', () => {
  let container;
  let root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders owner view with rename capability when user is board owner', async () => {
    vi.mocked(db.getBoardMeta).mockResolvedValueOnce({
      id: testBoardId,
      title: 'Distributed Architecture',
      ownerId: 'user-owner-123',
      role: 'owner',
    });

    await act(async () => {
      root.render(<BoardPage />);
    });

    expect(container.textContent).toContain('Distributed Architecture');

    // Rename button should exist for owner
    const renameBtn = container.querySelector('[data-testid="rename-title-btn"]');
    expect(renameBtn).not.toBeNull();
    expect(container.querySelector('[data-testid="viewer-badge"]')).toBeNull();

    // Clicking opens edit input
    await act(async () => {
      renameBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const input = container.querySelector('.title-edit-input');
    expect(input).not.toBeNull();
    expect(input.value).toBe('Distributed Architecture');

    // Type new title using React nativeSetter
    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(input, 'Updated System Design');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      const submitBtn = container.querySelector('.title-edit-group button');
      if (submitBtn) {
        submitBtn.click();
      }
      await new Promise((r) => setTimeout(r, 60));
    });

    expect(db.updateBoardTitle).toHaveBeenCalledWith(testBoardId, 'Updated System Design');
  });

  it('renders read-only viewer mode when board role is viewer', async () => {
    vi.mocked(db.getBoardMeta).mockResolvedValueOnce({
      id: testBoardId,
      title: 'Shared Team Specs',
      ownerId: 'different-owner-456',
      role: 'viewer',
      readOnly: true,
    });

    await act(async () => {
      root.render(<BoardPage />);
    });

    expect(container.textContent).toContain('Shared Team Specs');

    // Viewer badge must be displayed
    const viewerBadge = container.querySelector('[data-testid="viewer-badge"]');
    expect(viewerBadge).not.toBeNull();
    expect(viewerBadge.textContent).toContain('Viewer (Read-Only)');

    // Rename button must NOT exist for viewers
    const renameBtn = container.querySelector('[data-testid="rename-title-btn"]');
    expect(renameBtn).toBeNull();
    expect(container.querySelector('.title-edit-input')).toBeNull();
  });

  it('redirects to /dashboard when board does not exist or user has no access', async () => {
    vi.mocked(db.getBoardMeta).mockResolvedValueOnce(null);

    await act(async () => {
      root.render(<BoardPage />);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('opens Share modal and allows owner to invite collaborators by email and role', async () => {
    vi.mocked(db.getBoardMeta).mockResolvedValueOnce({
      id: testBoardId,
      title: 'Infrastructure Blueprint',
      ownerId: 'user-owner-123',
      role: 'owner',
      sharedWith: [],
    });

    await act(async () => {
      root.render(<BoardPage />);
    });

    // Share button should be visible in subbar
    const shareBtn = container.querySelector('[data-testid="open-share-modal-btn"]');
    expect(shareBtn).not.toBeNull();

    // Clicking Share opens ShareModal
    await act(async () => {
      shareBtn.click();
    });

    const modalDialog = container.querySelector('[role="dialog"]');
    expect(modalDialog).not.toBeNull();
    expect(container.textContent).toContain('Share Blueprint');

    // Fill in email
    const emailInput = container.querySelector('[data-testid="invite-email-input"]');
    expect(emailInput).not.toBeNull();

    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(emailInput, 'architect@company.com');
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Change role to editor
    const roleSelect = container.querySelector('[data-testid="invite-role-select"]');
    expect(roleSelect).not.toBeNull();
    await act(async () => {
      const selectSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
      selectSetter.call(roleSelect, 'editor');
      roleSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Submit invite form
    const submitBtn = container.querySelector('[data-testid="invite-submit-btn"]');
    expect(submitBtn).not.toBeNull();

    await act(async () => {
      submitBtn.click();
      await new Promise((r) => setTimeout(r, 60));
    });

    // Assert db.shareBoard was called with correct arguments
    expect(db.shareBoard).toHaveBeenCalledWith(testBoardId, 'architect@company.com', 'editor');

    // Confirm success message feedback is displayed
    const successAlert = container.querySelector('[data-testid="share-success-alert"]');
    expect(successAlert).not.toBeNull();
    expect(successAlert.textContent).toContain('Successfully shared with architect@company.com as editor');
  });

  it('copies direct board link to clipboard with confirmation', async () => {
    vi.mocked(db.getBoardMeta).mockResolvedValueOnce({
      id: testBoardId,
      title: 'Infrastructure Blueprint',
      ownerId: 'user-owner-123',
      role: 'owner',
      sharedWith: [],
    });

    await act(async () => {
      root.render(<BoardPage />);
    });

    await act(async () => {
      const shareBtn = container.querySelector('[data-testid="open-share-modal-btn"]');
      shareBtn.click();
    });

    const writeTextMock = vi.fn().mockResolvedValue();
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

    const copyBtn = container.querySelector('[data-testid="copy-share-link-btn"]');
    expect(copyBtn).not.toBeNull();
    expect(copyBtn.textContent).toContain('Copy Link');

    await act(async () => {
      copyBtn.click();
      await new Promise((r) => setTimeout(r, 60));
    });

    expect(writeTextMock).toHaveBeenCalled();
    expect(copyBtn.textContent).toContain('Copied!');
  });
});
