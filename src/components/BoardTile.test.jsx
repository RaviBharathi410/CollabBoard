import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import BoardTile from './BoardTile';

// Mock react-router-dom Link
vi.mock('react-router-dom', () => ({
  Link: ({ to, children, className, ...props }) => (
    <a href={to} className={className} {...props}>
      {children}
    </a>
  ),
}));

describe('BoardTile Component', () => {
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

  it('renders board title and formatted date', async () => {
    const mockBoard = {
      id: 'board-123',
      title: 'Infrastructure Blueprint',
      updatedAt: '2026-09-01T12:00:00Z',
    };

    await act(async () => {
      root.render(<BoardTile board={mockBoard} />);
    });

    expect(container.textContent).toContain('Infrastructure Blueprint');
    expect(container.textContent).toContain('Sep 1');
    const link = container.querySelector('a.tile-title');
    expect(link.getAttribute('href')).toBe('/board/board-123');
  });

  it('renders collaborator presence pins when collaborators are present', async () => {
    const mockBoard = { id: 'board-456', title: 'User Journey' };
    const collaborators = [
      { name: 'Alice', color: '#2B5C8F' },
      { name: 'Bob', color: '#9E5826' },
    ];

    await act(async () => {
      root.render(<BoardTile board={mockBoard} collaborators={collaborators} />);
    });

    const pinCluster = container.querySelector('.presence-pin-cluster');
    expect(pinCluster).not.toBeNull();
    const dots = container.querySelectorAll('.pin-dot');
    expect(dots.length).toBe(2);
  });

  it('sets focused class when isFocused is true', async () => {
    const mockBoard = { id: 'board-789', title: 'Database Schema' };

    await act(async () => {
      root.render(<BoardTile board={mockBoard} isFocused={true} />);
    });

    const tile = container.querySelector('.board-tile');
    expect(tile.classList.contains('focused')).toBe(true);
  });
});
