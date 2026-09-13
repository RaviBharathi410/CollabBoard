import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import IconRail from './IconRail';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  Link: ({ to, children, className, ...props }) => (
    <a href={to} className={className} {...props}>
      {children}
    </a>
  ),
  useLocation: () => ({ pathname: '/dashboard' }),
}));

// Mock AuthContext
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { displayName: 'Ada Lovelace', email: 'ada@example.com' },
    logout: vi.fn(),
  }),
}));

describe('IconRail Component', () => {
  let container;
  let root;

  beforeEach(() => {
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

  it('renders brand glyph and primary navigation items', async () => {
    await act(async () => {
      root.render(<IconRail />);
    });

    expect(container.textContent).toContain('▤');
    const links = container.querySelectorAll('a');
    expect(links.length).toBeGreaterThanOrEqual(4);
    
    const hrefs = Array.from(links).map(l => l.getAttribute('href'));
    expect(hrefs).toContain('/dashboard');
    expect(hrefs).toContain('/dashboard?filter=recent');
    expect(hrefs).toContain('/dashboard?filter=starred');
    expect(hrefs).toContain('/dashboard?filter=templates');
  });

  it('renders outline toggle button when onToggleOutline prop is passed', async () => {
    const onToggle = vi.fn();
    await act(async () => {
      root.render(<IconRail onToggleOutline={onToggle} isOutlineOpen={false} />);
    });

    const outlineBtn = container.querySelector('button[aria-label="Toggle Outline Mode"]');
    expect(outlineBtn).not.toBeNull();
    
    outlineBtn.click();
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders user initial in avatar chip', async () => {
    await act(async () => {
      root.render(<IconRail />);
    });

    const avatar = container.querySelector('.avatar-chip');
    expect(avatar).not.toBeNull();
    expect(avatar.textContent).toBe('A');
  });
});
