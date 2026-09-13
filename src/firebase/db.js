import { collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './config';
import { v4 as uuidv4 } from 'uuid';

// Reference to the metadata collection
const boardsCollection = collection(db, 'boards_meta');

/**
 * Single source of truth for deriving fast-lookup role arrays from sharedWith.
 * Guarantees sharedEmails, editors, and viewers are mathematically derived from sharedWith
 * and can never diverge or fall out of sync on any write path.
 */
export function deriveRoleLists(sharedWith = []) {
  // Deduplicate by normalized email; latest role assignment wins
  const emailMap = new Map();
  for (const member of (sharedWith || [])) {
    const email = member?.email?.trim().toLowerCase();
    if (email) {
      emailMap.set(email, {
        ...member,
        email,
        role: member.role === 'editor' ? 'editor' : 'viewer',
      });
    }
  }

  const normalized = Array.from(emailMap.values());
  const sharedEmails = Array.from(emailMap.keys());
  const editors = normalized.filter((m) => m.role === 'editor').map((m) => m.email);
  const viewers = normalized.filter((m) => m.role === 'viewer').map((m) => m.email);

  return {
    sharedWith: normalized,
    sharedEmails,
    editors,
    viewers,
  };
}

/**
 * Creates a new board metadata document
 */
export async function createBoard(userId, title = 'Untitled Board') {
  if (!userId) throw new Error('User ID is required to create a board');
  
  const boardId = uuidv4();
  const boardRef = doc(boardsCollection, boardId);
  const { sharedWith, sharedEmails, editors, viewers } = deriveRoleLists([]);
  
  const newBoard = {
    id: boardId,
    title,
    ownerId: userId,
    sharedWith,
    sharedEmails,
    editors,
    viewers,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(boardRef, newBoard);
  } catch (err) {
    throw err;
  }
  return newBoard;
}

/**
 * Fetches all boards owned by a specific user
 */
export async function getUserBoards(userId) {
  if (!userId) return [];

  const q = query(
    boardsCollection, 
    where('ownerId', '==', userId),
    orderBy('updatedAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    ...doc.data(),
    // Convert Firestore timestamps to standard JS Dates for frontend use
    createdAt: doc.data().createdAt?.toDate()?.toISOString(),
    updatedAt: doc.data().updatedAt?.toDate()?.toISOString(),
  }));
}

/**
 * Fetches a single board's metadata and computes effective role
 */
export function isFirestoreUnavailable(err) {
  return !!err?.code && ['permission-denied', 'unavailable', 'failed-precondition'].includes(err.code);
}

export async function getBoardMeta(boardId, currentUser = null) {
  const boardRef = doc(boardsCollection, boardId);
  let directSnap;
  try {
    directSnap = await getDoc(boardRef);
  } catch (err) {
    throw err;
  }
  if (!directSnap.exists()) return null;

  const data = directSnap.data();

  // Resolve effective role based on currentUser
  let effectiveRole = data.role || 'viewer';
  if (currentUser) {
    if (data.ownerId === currentUser.uid) {
      effectiveRole = 'owner';
    } else {
      const match = (data.sharedWith || []).find(
        (m) => m.email?.toLowerCase() === currentUser.email?.toLowerCase()
      );
      if (match) {
        effectiveRole = match.role;
      }
    }
  }

  return {
    ...data,
    role: effectiveRole,
    readOnly: effectiveRole === 'viewer',
    createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : data.createdAt,
    updatedAt: data.updatedAt?.toDate?.() ? data.updatedAt.toDate().toISOString() : data.updatedAt,
  };
}

/**
 * Shares a board with a collaborator by email with role ('editor' | 'viewer')
 */
export async function shareBoard(boardId, email, role = 'viewer') {
  if (!boardId || !email) throw new Error('boardId and email are required to share board');
  const normalizedEmail = email.trim().toLowerCase();
  const boardRef = doc(boardsCollection, boardId);
  const snap = await getDoc(boardRef);
  if (!snap.exists()) throw new Error('Board not found');

  const data = snap.data();
  const currentShared = data.sharedWith || [];
  const existingIdx = currentShared.findIndex(
    (m) => m.email.toLowerCase() === normalizedEmail
  );

  let newShared;
  if (existingIdx >= 0) {
    newShared = [...currentShared];
    newShared[existingIdx] = {
      ...newShared[existingIdx],
      role,
      updatedAt: new Date().toISOString(),
    };
  } else {
    newShared = [
      ...currentShared,
      {
        email: normalizedEmail,
        role,
        invitedAt: new Date().toISOString(),
      },
    ];
  }

  const { sharedWith: finalShared, sharedEmails, editors, viewers } = deriveRoleLists(newShared);

  await updateDoc(boardRef, {
    sharedWith: finalShared,
    sharedEmails,
    editors,
    viewers,
    updatedAt: serverTimestamp(),
  });

  return finalShared;
}

/**
 * Updates a board's title
 */
export async function updateBoardTitle(boardId, newTitle) {
  const boardRef = doc(boardsCollection, boardId);
  await updateDoc(boardRef, {
    title: newTitle,
    updatedAt: serverTimestamp()
  });
}

/**
 * Deletes a board metadata document
 */
export async function deleteBoard(boardId) {
  const boardRef = doc(boardsCollection, boardId);
  await deleteDoc(boardRef);
}
