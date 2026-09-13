import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import TracingOverlay from './TracingOverlay';

describe('TracingOverlay Component', () => {
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

  it('does not render when isVisible is false', async () => {
    await act(async () => {
      root.render(<TracingOverlay isVisible={false} />);
    });

    expect(container.querySelector('.tracing-paper-overlay')).toBeNull();
  });

  it('renders suggestion title and node count when isVisible is true', async () => {
    await act(async () => {
      root.render(
        <TracingOverlay 
          isVisible={true} 
          suggestionTitle="Microservice Architecture" 
          nodeCount={4} 
        />
      );
    });

    expect(container.textContent).toContain('Microservice Architecture');
    expect(container.textContent).toContain('4 nodes suggested');
    expect(container.textContent).toContain('Trace to Accept');
    expect(container.textContent).toContain('Dismiss');
  });

  it('calls onAccept callback when Trace to Accept button is clicked', async () => {
    const onAccept = vi.fn();
    await act(async () => {
      root.render(<TracingOverlay isVisible={true} onAccept={onAccept} />);
    });

    const acceptBtn = container.querySelector('.accept-btn');
    expect(acceptBtn).not.toBeNull();
    acceptBtn.click();

    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss callback when Dismiss button is clicked', async () => {
    const onDismiss = vi.fn();
    await act(async () => {
      root.render(<TracingOverlay isVisible={true} onDismiss={onDismiss} />);
    });

    const dismissBtn = container.querySelector('.dismiss-btn');
    expect(dismissBtn).not.toBeNull();
    dismissBtn.click();

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
