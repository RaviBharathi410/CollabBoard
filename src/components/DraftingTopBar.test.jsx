import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import DraftingTopBar from './DraftingTopBar';

describe('DraftingTopBar Component', () => {
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

  it('renders workspace name and search trigger button', async () => {
    await act(async () => {
      root.render(
        <DraftingTopBar 
          currentWorkspace="Design Studio" 
          collaboratorCount={3} 
          syncStatus="saved" 
        />
      );
    });

    expect(container.textContent).toContain('Design Studio');
    expect(container.textContent).toContain('Search or jump to...');
    expect(container.textContent).toContain('⌘K');
    expect(container.textContent).toContain('Saved');
    expect(container.textContent).toContain('3');
  });

  it('displays active document title when passed', async () => {
    await act(async () => {
      root.render(
        <DraftingTopBar 
          currentWorkspace="Core Team" 
          activeDocumentTitle="System Architecture v2" 
        />
      );
    });

    expect(container.textContent).toContain('System Architecture v2');
  });

  it('invokes onOpenSearch when search button is clicked', async () => {
    const onSearch = vi.fn();
    await act(async () => {
      root.render(<DraftingTopBar onOpenSearch={onSearch} />);
    });

    const btn = container.querySelector('.command-trigger-btn');
    expect(btn).not.toBeNull();
    btn.click();

    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('renders syncing state spinner when syncStatus is syncing', async () => {
    await act(async () => {
      root.render(<DraftingTopBar syncStatus="syncing" />);
    });

    expect(container.textContent).toContain('Syncing');
    const spinner = container.querySelector('.spin-icon');
    expect(spinner).not.toBeNull();
  });
});
