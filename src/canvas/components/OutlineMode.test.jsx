import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import OutlineMode from './OutlineMode';
import useCanvasStore from '../hooks/useCanvasStore';

describe('OutlineMode Component', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    // Populate mock shapes in canvas store
    useCanvasStore.setState({
      shapes: [
        { id: 'n1', type: 'rectangle', text: 'API Gateway', x: 100, y: 100 },
        { id: 'n2', type: 'circle', text: 'Auth Service', x: 250, y: 100 },
        { id: 'e1', type: 'arrow', label: 'HTTP GET', points: [150, 100, 250, 100] },
      ],
      selectedIds: [],
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('does not render when isOpen is false', async () => {
    await act(async () => {
      root.render(<OutlineMode isOpen={false} />);
    });

    expect(container.querySelector('.outline-panel')).toBeNull();
  });

  it('renders all shapes grouped by nodes and connections when open', async () => {
    await act(async () => {
      root.render(<OutlineMode isOpen={true} />);
    });

    expect(container.textContent).toContain('Canvas Outline');
    expect(container.textContent).toContain('3 elements');
    expect(container.textContent).toContain('API Gateway');
    expect(container.textContent).toContain('Auth Service');
    expect(container.textContent).toContain('HTTP GET');
  });

  it('selects shape in canvas store when outline item is clicked', async () => {
    await act(async () => {
      root.render(<OutlineMode isOpen={true} />);
    });

    const items = container.querySelectorAll('.outline-item');
    expect(items.length).toBe(3);

    await act(async () => {
      items[0].click();
    });

    expect(useCanvasStore.getState().selectedIds).toEqual(['n1']);
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    await act(async () => {
      root.render(<OutlineMode isOpen={true} onClose={onClose} />);
    });

    const closeBtn = container.querySelector('.outline-close-btn');
    expect(closeBtn).not.toBeNull();
    closeBtn.click();

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
