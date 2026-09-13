import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAuthHeaders } from './useAIEngine';
import { auth } from '../../firebase/config';

// Mock the Firebase config auth module
vi.mock('../../firebase/config', () => {
  return {
    auth: {
      currentUser: null,
    },
  };
});

describe('useAIEngine.js:getAuthHeaders helper', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    auth.currentUser = null;
  });

  it('should return default Content-Type headers when user is not authenticated', async () => {
    auth.currentUser = null;
    
    const headers = await getAuthHeaders();
    
    expect(headers).toEqual({
      'Content-Type': 'application/json',
    });
  });

  it('should return Authorization Bearer token header when user is authenticated', async () => {
    // Mock user session and getIdToken function
    const mockIdToken = 'token_abc_123';
    auth.currentUser = {
      getIdToken: vi.fn().mockResolvedValue(mockIdToken),
    };
    
    const headers = await getAuthHeaders();
    
    expect(auth.currentUser.getIdToken).toHaveBeenCalled();
    expect(headers).toEqual({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${mockIdToken}`,
    });
  });

  it('should fallback gracefully to default headers if token retrieval throws an error', async () => {
    auth.currentUser = {
      getIdToken: vi.fn().mockRejectedValue(new Error('Auth token expired or connection failed')),
    };
    
    const headers = await getAuthHeaders();
    
    expect(headers).toEqual({
      'Content-Type': 'application/json',
    });
  });
});
