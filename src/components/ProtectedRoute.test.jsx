/**
 * ProtectedRoute.test.jsx
 * Tests authenticated access vs unauthenticated redirection.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import ProtectedRoute from './ProtectedRoute.jsx';

// Mocks
let mockCurrentUser = null;

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    currentUser: mockCurrentUser,
  }),
}));

vi.mock('react-router-dom', () => ({
  Navigate: ({ to }) => <div data-testid="mock-navigate" data-to={to}>Redirecting to {to}</div>,
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('ProtectedRoute Component', () => {
  let container;
  let root;

  beforeEach(() => {
    mockCurrentUser = null;
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

  it('redirects unauthenticated user to /auth without rendering children', async () => {
    mockCurrentUser = null;

    await act(async () => {
      root.render(
        <ProtectedRoute>
          <div data-testid="protected-content">Secret Board Content</div>
        </ProtectedRoute>
      );
    });

    const redirect = container.querySelector('[data-testid="mock-navigate"]');
    const content = container.querySelector('[data-testid="protected-content"]');

    expect(redirect).not.toBeNull();
    expect(redirect.getAttribute('data-to')).toBe('/auth');
    expect(content).toBeNull();
  });

  it('renders children when user is authenticated', async () => {
    mockCurrentUser = { uid: 'user-valid-123', email: 'architect@collabboard.io' };

    await act(async () => {
      root.render(
        <ProtectedRoute>
          <div data-testid="protected-content">Secret Board Content</div>
        </ProtectedRoute>
      );
    });

    const redirect = container.querySelector('[data-testid="mock-navigate"]');
    const content = container.querySelector('[data-testid="protected-content"]');

    expect(redirect).toBeNull();
    expect(content).not.toBeNull();
    expect(content.textContent).toBe('Secret Board Content');
  });
});
