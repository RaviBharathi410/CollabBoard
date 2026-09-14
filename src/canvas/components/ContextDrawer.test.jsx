import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import ContextDrawer from './ContextDrawer';

describe('ContextDrawer Component', () => {
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

  it('does not render when isOpen is false', async () => {
    await act(async () => {
      root.render(<ContextDrawer isOpen={false} />);
    });

    expect(container.querySelector('.context-drawer')).toBeNull();
  });

  it('renders all 5 tabs including Import when isOpen is true', async () => {
    await act(async () => {
      root.render(
        <ContextDrawer 
          isOpen={true} 
          collaborators={[{ name: 'Sarah', color: '#2B5C8F' }]} 
        />
      );
    });

    const drawer = container.querySelector('.context-drawer');
    expect(drawer).not.toBeNull();

    const tabs = container.querySelectorAll('button[role="tab"]');
    expect(tabs.length).toBe(5);
    expect(container.textContent).toContain('Chat');
    expect(container.textContent).toContain("Who's Here");
    expect(container.textContent).toContain('History');
    expect(container.textContent).toContain('Ask AI');
    expect(container.textContent).toContain('Import');
  });

  it('switches to Import tab on tab click', async () => {
    await act(async () => {
      root.render(
        <ContextDrawer 
          isOpen={true} 
        />
      );
    });

    const importTab = container.querySelector('#drawer-tab-import');
    expect(importTab).not.toBeNull();

    await act(async () => {
      importTab.click();
    });

    expect(container.textContent).toContain('Upload File');
    expect(container.textContent).toContain('Paste Syntax');
  });

  it('switches to Participants tab on tab click', async () => {
    await act(async () => {
      root.render(
        <ContextDrawer 
          isOpen={true} 
          collaborators={[{ name: 'Marcus', color: '#9E5826' }]} 
        />
      );
    });

    const participantsTab = container.querySelector('#drawer-tab-participants');
    expect(participantsTab).not.toBeNull();

    await act(async () => {
      participantsTab.click();
    });

    expect(container.textContent).toContain('Marcus');
    expect(container.textContent).toContain('Active Collaborators');
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    await act(async () => {
      root.render(<ContextDrawer isOpen={true} onClose={onClose} />);
    });

    const closeBtn = container.querySelector('.drawer-close-btn');
    expect(closeBtn).not.toBeNull();
    closeBtn.click();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', async () => {
    const onClose = vi.fn();
    await act(async () => {
      root.render(<ContextDrawer isOpen={true} onClose={onClose} />);
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
