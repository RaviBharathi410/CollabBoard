import { collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './config';
import { v4 as uuidv4 } from 'uuid';
import { agentLog } from '../debug/agentLog';

// Reference to the metadata collection
const boardsCollection = collection(db, 'boards_meta');

/**
 * Creates a new board metadata document
 */
export async function createBoard(userId, title = 'Untitled Board') {
  if (!userId) throw new Error('User ID is required to create a board');
  
  const boardId = uuidv4();
  const boardRef = doc(boardsCollection, boardId);
  
  const newBoard = {
    id: boardId,
    title,
    ownerId: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(boardRef, newBoard);
  } catch (err) {
    // #region agent log
    agentLog('db.js:createBoard', 'setDoc failed', { boardId, errorCode: err?.code, errorMessage: err?.message }, 'H8', 'post-fix-v3');
    // #endregion
    throw err;
  }
  // #region agent log
  agentLog('db.js:createBoard', 'board created', { boardId, ownerId: userId, title }, 'H8', 'post-fix-v3');
  // #endregion
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
 * Fetches a single board's metadata
 */
export function isFirestoreUnavailable(err) {
  return !!err?.code && ['permission-denied', 'unavailable', 'failed-precondition'].includes(err.code);
}

export async function getBoardMeta(boardId) {
  const boardRef = doc(boardsCollection, boardId);
  let directSnap;
  try {
    directSnap = await getDoc(boardRef);
  } catch (err) {
    // #region agent log
    agentLog('db.js:getBoardMeta', 'getDoc failed', { boardId, errorCode: err?.code }, 'H8', 'post-fix-v3');
    // #endregion
    throw err;
  }
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(boardId);
  // #region agent log
  agentLog('db.js:getBoardMeta', 'getBoardMeta result', {
    boardId,
    isUuid,
    isTemplateSlug: !isUuid,
    directDocExists: directSnap.exists(),
    directDocOwnerId: directSnap.exists() ? directSnap.data()?.ownerId : null,
  }, 'H1-H2-H3', 'post-fix-v3');
  // #endregion
  if (!directSnap.exists()) return null;

  const data = directSnap.data();
  return {
    ...data,
    createdAt: data.createdAt?.toDate()?.toISOString(),
    updatedAt: data.updatedAt?.toDate()?.toISOString(),
  };
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
