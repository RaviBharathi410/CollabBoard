import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import AuthPage from './AuthPage.jsx';

const { mockNavigate, mockAuthValues } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockAuthValues: {
    login: vi.fn(),
    signup: vi.fn(),
    loginWithGoogle: vi.fn(),
    currentUser: null,
    authError: null,
    setAuthError: vi.fn(),
    resetPassword: vi.fn(),
    sendVerification: vi.fn(),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuthValues,
  formatAuthError: (err) => err?.message || 'Authentication failed',
}));

describe('AuthPage Component', () => {
  let container;
  let root;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthValues.currentUser = null;
    mockAuthValues.authError = null;
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

  it('renders login tab by default with credentials inputs and forgot password button', async () => {
    await act(async () => {
      root.render(<AuthPage />);
    });

    expect(container.querySelector('h1').textContent).toBe('Log In');
    expect(container.querySelector('#auth-email')).not.toBeNull();
    expect(container.querySelector('#auth-password')).not.toBeNull();
    expect(container.querySelector('button.auth-submit').textContent).toBe('Log In');
    expect(container.querySelector('button.forgot-password-btn')).not.toBeNull();
  });

  it('handles successful login submission and navigates to dashboard', async () => {
    mockAuthValues.login.mockResolvedValueOnce({ user: { uid: 'u1' } });

    await act(async () => {
      root.render(<AuthPage />);
    });

    const emailInput = container.querySelector('#auth-email');
    const passwordInput = container.querySelector('#auth-password');
    const form = container.querySelector('form.auth-form');

    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(emailInput, 'user@example.com');
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      emailInput.dispatchEvent(new Event('change', { bubbles: true }));

      nativeSetter.call(passwordInput, 'password123');
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mockAuthValues.login).toHaveBeenCalledWith('user@example.com', 'password123');
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('handles sign-up tab switch and calls signup with email verification dispatch', async () => {
    const mockUser = { uid: 'new-user', email: 'new@example.com' };
    mockAuthValues.signup.mockResolvedValueOnce({ user: mockUser });
    mockAuthValues.sendVerification.mockResolvedValueOnce(true);

    await act(async () => {
      root.render(<AuthPage />);
    });

    // Switch to Sign Up tab
    const tabs = container.querySelectorAll('.auth-tab');
    expect(tabs.length).toBe(2);

    await act(async () => {
      tabs[1].click(); // Sign Up tab
    });

    expect(container.querySelector('h1').textContent).toBe('Create Account');
    expect(container.querySelector('#full-name')).not.toBeNull();

    const emailInput = container.querySelector('#auth-email');
    const passwordInput = container.querySelector('#auth-password');
    const form = container.querySelector('form.auth-form');

    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(emailInput, 'new@example.com');
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      emailInput.dispatchEvent(new Event('change', { bubbles: true }));

      nativeSetter.call(passwordInput, 'securePass123');
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mockAuthValues.signup).toHaveBeenCalledWith('new@example.com', 'securePass123');
    expect(mockAuthValues.sendVerification).toHaveBeenCalledWith(mockUser);
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('switches to forgot password mode, submits email and shows confirmation banner', async () => {
    mockAuthValues.resetPassword.mockResolvedValueOnce(true);

    await act(async () => {
      root.render(<AuthPage />);
    });

    const forgotBtn = container.querySelector('button.forgot-password-btn');
    expect(forgotBtn).not.toBeNull();

    await act(async () => {
      forgotBtn.click();
    });

    expect(container.querySelector('h1').textContent).toBe('Reset Password');
    expect(container.querySelector('#reset-email')).not.toBeNull();
    expect(container.querySelector('button.auth-submit').textContent).toBe('Send Reset Link');

    const resetInput = container.querySelector('#reset-email');
    const form = container.querySelector('form.auth-form');

    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(resetInput, 'recovery@example.com');
      resetInput.dispatchEvent(new Event('input', { bubbles: true }));
      resetInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mockAuthValues.resetPassword).toHaveBeenCalledWith('recovery@example.com');
    const successBanner = container.querySelector('.auth-success-banner');
    expect(successBanner).not.toBeNull();
    expect(successBanner.textContent).toContain(
      'Password reset link sent to recovery@example.com. Please check your inbox.'
    );

    // Can return back to Log In
    const backBtn = container.querySelector('button.auth-back-btn');
    await act(async () => {
      backBtn.click();
    });

    expect(container.querySelector('h1').textContent).toBe('Log In');
  });

  it('renders auth error banner when authentication or reset fails', async () => {
    mockAuthValues.login.mockRejectedValueOnce(new Error('Invalid password provided'));

    await act(async () => {
      root.render(<AuthPage />);
    });

    const emailInput = container.querySelector('#auth-email');
    const passwordInput = container.querySelector('#auth-password');
    const form = container.querySelector('form.auth-form');

    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(emailInput, 'wrong@example.com');
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      emailInput.dispatchEvent(new Event('change', { bubbles: true }));

      nativeSetter.call(passwordInput, 'badpass');
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    const errorBanner = container.querySelector('.auth-error-banner');
    expect(errorBanner).not.toBeNull();
    expect(errorBanner.textContent).toBe('Invalid password provided');
  });
});
