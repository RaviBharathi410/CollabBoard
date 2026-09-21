import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBoard, getBoardMeta, shareBoard, getUserBoards, updateBoardTitle, deleteBoard, isFirestoreUnavailable, deriveRoleLists } from './db';
import * as firestore from 'firebase/firestore';

vi.mock('firebase/firestore', () => {
  const original = vi.importActual('firebase/firestore');
  return {
    ...original,
    collection: vi.fn(() => 'mock-boards-collection'),
    doc: vi.fn((_coll, id) => ({ id, path: `boards_meta/${id}` })),
    setDoc: vi.fn().mockResolvedValue(undefined),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    updateDoc: vi.fn().mockResolvedValue(undefined),
    deleteDoc: vi.fn().mockResolvedValue(undefined),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  };
});

vi.mock('./config', () => ({
  db: { type: 'firestore-instance' },
}));

describe('Firestore Database Layer & RBAC (src/firebase/db.js)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createBoard', () => {
    it('creates board metadata with empty shared arrays and ownerId', async () => {
      const newBoard = await createBoard('user-123', 'My System Design');
      expect(newBoard).toMatchObject({
        title: 'My System Design',
        ownerId: 'user-123',
        sharedWith: [],
        sharedEmails: [],
        editors: [],
        viewers: [],
      });
      expect(firestore.setDoc).toHaveBeenCalledTimes(1);
    });

    it('persists diagramType and starterShapes when provided in extraMeta', async () => {
      const starter = [{ id: 's1', type: 'rectangle', x: 10, y: 10 }];
      const newBoard = await createBoard('user-123', 'User Flow Sequence', {
        diagramType: 'sequence',
        starterShapes: starter,
      });

      expect(newBoard).toMatchObject({
        title: 'User Flow Sequence',
        ownerId: 'user-123',
        diagramType: 'sequence',
        starterShapes: starter,
      });
      expect(firestore.setDoc).toHaveBeenCalledTimes(1);
    });

    it('throws if userId is not provided', async () => {
      await expect(createBoard('')).rejects.toThrow('User ID is required to create a board');
    });
  });

  describe('getBoardMeta & Role-Based Access Control', () => {
    it('resolves role as owner when currentUser.uid matches ownerId', async () => {
      vi.mocked(firestore.getDoc).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          id: 'b-1',
          title: 'Owner Blueprint',
          ownerId: 'user-123',
          sharedWith: [{ email: 'editor@co.com', role: 'editor' }],
          createdAt: { toDate: () => new Date('2026-09-01T00:00:00Z') },
        }),
      });

      const meta = await getBoardMeta('b-1', { uid: 'user-123', email: 'owner@co.com' });
      expect(meta.role).toBe('owner');
      expect(meta.readOnly).toBe(false);
      expect(meta.title).toBe('Owner Blueprint');
    });

    it('resolves role as editor when currentUser.email matches invited editor', async () => {
      vi.mocked(firestore.getDoc).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          id: 'b-1',
          title: 'Shared Blueprint',
          ownerId: 'user-owner',
          sharedWith: [
            { email: 'editor@co.com', role: 'editor' },
            { email: 'viewer@co.com', role: 'viewer' },
          ],
        }),
      });

      const meta = await getBoardMeta('b-1', { uid: 'user-editor-456', email: 'editor@co.com' });
      expect(meta.role).toBe('editor');
      expect(meta.readOnly).toBe(false);
    });

    it('resolves role as viewer when currentUser.email matches invited viewer', async () => {
      vi.mocked(firestore.getDoc).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          id: 'b-1',
          title: 'Shared Blueprint',
          ownerId: 'user-owner',
          sharedWith: [{ email: 'viewer@co.com', role: 'viewer' }],
        }),
      });

      const meta = await getBoardMeta('b-1', { uid: 'user-viewer-789', email: 'viewer@co.com' });
      expect(meta.role).toBe('viewer');
      expect(meta.readOnly).toBe(true);
    });

    it('returns null if board document does not exist', async () => {
      vi.mocked(firestore.getDoc).mockResolvedValueOnce({
        exists: () => false,
      });

      const meta = await getBoardMeta('missing-board');
      expect(meta).toBeNull();
    });
  });

  describe('shareBoard', () => {
    it('appends a new collaborator to sharedWith and sharedEmails', async () => {
      vi.mocked(firestore.getDoc).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          id: 'b-100',
          ownerId: 'user-owner',
          sharedWith: [{ email: 'existing@co.com', role: 'viewer' }],
        }),
      });

      const updated = await shareBoard('b-100', 'newarchitect@co.com', 'editor');
      expect(updated).toHaveLength(2);
      expect(updated[1]).toMatchObject({
        email: 'newarchitect@co.com',
        role: 'editor',
      });
      expect(firestore.updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          sharedEmails: ['existing@co.com', 'newarchitect@co.com'],
          editors: ['newarchitect@co.com'],
          viewers: ['existing@co.com'],
        })
      );
    });

    it('updates role when user email was already invited', async () => {
      vi.mocked(firestore.getDoc).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          id: 'b-100',
          ownerId: 'user-owner',
          sharedWith: [{ email: 'promote@co.com', role: 'viewer' }],
        }),
      });

      const updated = await shareBoard('b-100', 'promote@co.com', 'editor');
      expect(updated).toHaveLength(1);
      expect(updated[0].role).toBe('editor');
    });

    it('throws if board does not exist', async () => {
      vi.mocked(firestore.getDoc).mockResolvedValueOnce({
        exists: () => false,
      });

      await expect(shareBoard('b-none', 'test@co.com')).rejects.toThrow('Board not found');
    });
  });

  describe('deriveRoleLists (Single Source of Truth Invariant)', () => {
    it('guarantees editors and viewers are strictly mutually exclusive and partition sharedEmails', () => {
      const input = [
        { email: 'Alice@example.com', role: 'editor' },
        { email: 'bob@example.COM ', role: 'viewer' },
        { email: 'carol@example.com', role: 'editor' },
      ];

      const { sharedWith, sharedEmails, editors, viewers } = deriveRoleLists(input);

      expect(sharedEmails).toEqual(['alice@example.com', 'bob@example.com', 'carol@example.com']);
      expect(editors).toEqual(['alice@example.com', 'carol@example.com']);
      expect(viewers).toEqual(['bob@example.com']);

      // Mutual exclusivity: intersection is empty
      const intersection = editors.filter((e) => viewers.includes(e));
      expect(intersection).toHaveLength(0);

      // Completeness: union equals sharedEmails
      const union = Array.from(new Set([...editors, ...viewers])).sort();
      expect(union).toEqual([...sharedEmails].sort());
    });

    it('deduplicates duplicate email entries keeping latest role', () => {
      const input = [
        { email: 'dave@co.com', role: 'viewer' },
        { email: 'dave@co.com', role: 'editor' },
      ];

      const { sharedWith, sharedEmails, editors, viewers } = deriveRoleLists(input);
      expect(sharedWith).toHaveLength(1);
      expect(sharedEmails).toEqual(['dave@co.com']);
      expect(editors).toEqual(['dave@co.com']);
      expect(viewers).toEqual([]);
    });

    it('handles empty or null input gracefully', () => {
      expect(deriveRoleLists([])).toEqual({
        sharedWith: [],
        sharedEmails: [],
        editors: [],
        viewers: [],
      });
      expect(deriveRoleLists(null)).toEqual({
        sharedWith: [],
        sharedEmails: [],
        editors: [],
        viewers: [],
      });
    });
  });

  describe('Utility & Error Helpers', () => {
    it('detects firestore unavailable errors', () => {
      expect(isFirestoreUnavailable({ code: 'permission-denied' })).toBe(true);
      expect(isFirestoreUnavailable({ code: 'unavailable' })).toBe(true);
      expect(isFirestoreUnavailable({ code: 'failed-precondition' })).toBe(true);
      expect(isFirestoreUnavailable({ code: 'not-found' })).toBe(false);
      expect(isFirestoreUnavailable(null)).toBe(false);
    });
  });
});

