import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const PROJECT_ID = 'demo-collabboard-rules';
const RULES_PATH = 'firestore.rules';

describe('Firestore Security Rules (@firebase/rules-unit-testing)', () => {
  let testEnv;

  beforeAll(async () => {
    // Read the exact firestore.rules file from workspace root
    const rules = readFileSync(RULES_PATH, 'utf8');

    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules,
        host: process.env.FIRESTORE_EMULATOR_HOST?.split(':')[0] || '127.0.0.1',
        port: Number(process.env.FIRESTORE_EMULATOR_HOST?.split(':')[1] || 8080),
      },
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();

    // Seed baseline test board using Admin context (bypasses security rules)
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'boards_meta', 'test-board-1'), {
        id: 'test-board-1',
        title: 'Architecture Review',
        ownerId: 'owner-alice',
        sharedEmails: ['editor-bob@co.com', 'viewer-charlie@co.com'],
        editors: ['editor-bob@co.com'],
        viewers: ['viewer-charlie@co.com'],
        sharedWith: [
          { email: 'editor-bob@co.com', role: 'editor' },
          { email: 'viewer-charlie@co.com', role: 'viewer' },
        ],
      });

      // Seed Yjs binary doc
      await setDoc(doc(adminDb, 'boards', 'test-board-1'), {
        yjsUpdate: 'AQIDBA==',
      });
    });
  });

  describe('Board Read Access (/boards_meta/{boardId})', () => {
    it('allows owner to read the board metadata', async () => {
      const ownerCtx = testEnv.authenticatedContext('owner-alice', { email: 'alice@co.com' });
      const boardRef = doc(ownerCtx.firestore(), 'boards_meta', 'test-board-1');
      await assertSucceeds(getDoc(boardRef));
    });

    it('allows invited editor to read the board metadata', async () => {
      const editorCtx = testEnv.authenticatedContext('editor-bob-uid', { email: 'editor-bob@co.com' });
      const boardRef = doc(editorCtx.firestore(), 'boards_meta', 'test-board-1');
      await assertSucceeds(getDoc(boardRef));
    });

    it('allows invited viewer to read the board metadata', async () => {
      const viewerCtx = testEnv.authenticatedContext('viewer-charlie-uid', { email: 'viewer-charlie@co.com' });
      const boardRef = doc(viewerCtx.firestore(), 'boards_meta', 'test-board-1');
      await assertSucceeds(getDoc(boardRef));
    });

    it('BLOCKS uninvited authenticated user from reading board metadata', async () => {
      const attackerCtx = testEnv.authenticatedContext('attacker-uid', { email: 'mallory@evil.com' });
      const boardRef = doc(attackerCtx.firestore(), 'boards_meta', 'test-board-1');
      await assertFails(getDoc(boardRef));
    });

    it('BLOCKS unauthenticated guest from reading board metadata', async () => {
      const unauthCtx = testEnv.unauthenticatedContext();
      const boardRef = doc(unauthCtx.firestore(), 'boards_meta', 'test-board-1');
      await assertFails(getDoc(boardRef));
    });
  });

  describe('Board Update & Privilege Escalation Defenses (/boards_meta/{boardId})', () => {
    it('allows editor to update board title and content without altering permissions', async () => {
      const editorCtx = testEnv.authenticatedContext('editor-bob-uid', { email: 'editor-bob@co.com' });
      const boardRef = doc(editorCtx.firestore(), 'boards_meta', 'test-board-1');
      await assertSucceeds(updateDoc(boardRef, {
        title: 'Updated Title by Bob',
      }));
    });

    it('BLOCKS editor from escalating privileges by tampering with editors array', async () => {
      const editorCtx = testEnv.authenticatedContext('editor-bob-uid', { email: 'editor-bob@co.com' });
      const boardRef = doc(editorCtx.firestore(), 'boards_meta', 'test-board-1');
      await assertFails(updateDoc(boardRef, {
        editors: ['editor-bob@co.com', 'mallory@evil.com'],
      }));
    });

    it('BLOCKS editor from rewriting ownerId to steal board ownership', async () => {
      const editorCtx = testEnv.authenticatedContext('editor-bob-uid', { email: 'editor-bob@co.com' });
      const boardRef = doc(editorCtx.firestore(), 'boards_meta', 'test-board-1');
      await assertFails(updateDoc(boardRef, {
        ownerId: 'editor-bob-uid',
      }));
    });

    it('BLOCKS viewer from updating any board fields (server-side readOnly enforcement)', async () => {
      const viewerCtx = testEnv.authenticatedContext('viewer-charlie-uid', { email: 'viewer-charlie@co.com' });
      const boardRef = doc(viewerCtx.firestore(), 'boards_meta', 'test-board-1');
      await assertFails(updateDoc(boardRef, {
        title: 'Hacked Title by Charlie',
      }));
    });
  });

  describe('Owner Privilege & Board Deletion (/boards_meta/{boardId})', () => {
    it('allows owner to update permissions and sharing list', async () => {
      const ownerCtx = testEnv.authenticatedContext('owner-alice', { email: 'alice@co.com' });
      const boardRef = doc(ownerCtx.firestore(), 'boards_meta', 'test-board-1');
      await assertSucceeds(updateDoc(boardRef, {
        title: 'Renamed by Alice',
        sharedEmails: ['editor-bob@co.com', 'viewer-charlie@co.com', 'new@co.com'],
        editors: ['editor-bob@co.com', 'new@co.com'],
      }));
    });

    it('allows owner to delete the board', async () => {
      const ownerCtx = testEnv.authenticatedContext('owner-alice', { email: 'alice@co.com' });
      const boardRef = doc(ownerCtx.firestore(), 'boards_meta', 'test-board-1');
      await assertSucceeds(deleteDoc(boardRef));
    });

    it('BLOCKS non-owner (editor) from deleting the board', async () => {
      const editorCtx = testEnv.authenticatedContext('editor-bob-uid', { email: 'editor-bob@co.com' });
      const boardRef = doc(editorCtx.firestore(), 'boards_meta', 'test-board-1');
      await assertFails(deleteDoc(boardRef));
    });

    it('BLOCKS non-owner (viewer) from deleting the board', async () => {
      const viewerCtx = testEnv.authenticatedContext('viewer-charlie-uid', { email: 'viewer-charlie@co.com' });
      const boardRef = doc(viewerCtx.firestore(), 'boards_meta', 'test-board-1');
      await assertFails(deleteDoc(boardRef));
    });
  });

  describe('Canvas Binary State Lockdown (/boards/{boardId})', () => {
    it('BLOCKS direct client read of Yjs document', async () => {
      const ownerCtx = testEnv.authenticatedContext('owner-alice', { email: 'alice@co.com' });
      const yjsRef = doc(ownerCtx.firestore(), 'boards', 'test-board-1');
      await assertFails(getDoc(yjsRef));
    });

    it('BLOCKS direct client write to Yjs document', async () => {
      const ownerCtx = testEnv.authenticatedContext('owner-alice', { email: 'alice@co.com' });
      const yjsRef = doc(ownerCtx.firestore(), 'boards', 'test-board-1');
      await assertFails(setDoc(yjsRef, { yjsUpdate: 'malicious-override' }));
    });
  });
});
