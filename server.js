import 'dotenv/config';
import { Server } from '@hocuspocus/server';
import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import * as Y from 'yjs';
import fs from 'fs';
import path from 'path';
import net from 'net';
import { mountAIRoutes } from './server/ai/routes.js';

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once('error', () => resolve(false))
      .once('listening', () => tester.close(() => resolve(true)))
      .listen(port);
  });
}

const DEBUG_LOG = path.resolve('debug-c2ad74.log');
function serverLog(message, data, hypothesisId) {
  try {
    fs.appendFileSync(
      DEBUG_LOG,
      JSON.stringify({ sessionId: 'c2ad74', location: 'server.js', message, data, timestamp: Date.now(), hypothesisId, runId: 'post-fix-v2' }) + '\n'
    );
  } catch (_) { /* ignore */ }
}

// ── 0. Firebase Initialization ──
let db = null;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    db = admin.firestore();
    console.log('🔥 Firebase Admin initialized successfully');
  } else {
    console.log('⚠️ FIREBASE_SERVICE_ACCOUNT not found in .env, running without database persistence.');
  }
} catch (err) {
  console.error('❌ Failed to initialize Firebase:', err.message);
}

// ── 1. Hocuspocus Multiplayer Server ──
const HOCUSPOCUS_PORT = parseInt(process.env.HOCUSPOCUS_PORT || '1234', 10);

const hocuspocusServer = new Server({
  port: HOCUSPOCUS_PORT,
  onConnect(data) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.documentName);
    serverLog('client connected', { documentName: data.documentName, isUuid, isTemplateSlug: !isUuid }, 'H1');
    console.log(`🔌 Client connected to document: ${data.documentName}`);
  },
  onDisconnect(data) {
    console.log(`🔌 Client disconnected from: ${data.documentName}`);
  },
  async onLoadDocument(data) {
    if (!db) return;
    try {
      const doc = await db.collection('boards').doc(data.documentName).get();
      if (doc.exists && doc.data().state) {
        Y.applyUpdate(data.document, doc.data().state);
        console.log(`📂 Loaded board ${data.documentName} from Firebase`);
      }
    } catch (err) {
      if (err?.code === 7 || err?.reason === 'SERVICE_DISABLED') {
        serverLog('firestore disabled', { documentName: data.documentName, reason: err.reason }, 'H8');
        db = null;
        console.warn('⚠️ Firestore API disabled — canvas sync will run in memory only.');
      } else {
        console.error(`❌ Failed to load board ${data.documentName}:`, err.message);
      }
    }
    return data.document;
  },
  async onStoreDocument(data) {
    if (!db) return;
    try {
      const state = Y.encodeStateAsUpdate(data.document);
      await db.collection('boards').doc(data.documentName).set(
        { state: Buffer.from(state), updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
      console.log(`💾 Saved board ${data.documentName} to Firebase`);
    } catch (err) {
      if (err?.code === 7 || err?.reason === 'SERVICE_DISABLED') {
        serverLog('firestore disabled on save', { documentName: data.documentName }, 'H8');
        db = null;
      } else {
        console.error(`❌ Failed to save board ${data.documentName}:`, err.message);
      }
    }
  },
});

async function startHocuspocus() {
  const available = await isPortAvailable(HOCUSPOCUS_PORT);
  if (!available) {
    console.warn(
      `⚠️ WebSocket port ${HOCUSPOCUS_PORT} is already in use — skipping bind (another server instance is running).`
    );
    return;
  }
  try {
    await hocuspocusServer.listen(HOCUSPOCUS_PORT);
    console.log(`🚀 Hocuspocus WebSocket server running on ws://localhost:${HOCUSPOCUS_PORT}`);
  } catch (err) {
    console.error('❌ Hocuspocus failed to start:', err.message);
  }
}

// ── 2. Express AI Backend (start first so /api/health always works) ──
const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));

mountAIRoutes(app);

async function main() {
  const httpAvailable = await isPortAvailable(PORT);
  if (!httpAvailable) {
    console.warn(
      `⚠️ Port ${PORT} is already in use — stop old servers (Ctrl+C / taskkill node) and run "npm run server" again to load latest code.`
    );
  } else {
    await new Promise((resolve, reject) => {
      const httpServer = app.listen(PORT, () => {
        console.log(`🧠 AI Backend API running on http://localhost:${PORT}`);
        resolve();
      });
      httpServer.on('error', (err) => {
        if (err?.code === 'EADDRINUSE') {
          console.error(
            `❌ Port ${PORT} is already in use. Stop the other process (taskkill /F /IM node.exe) or set PORT=3002 in .env`
          );
        }
        reject(err);
      });
    });
  }

  await startHocuspocus();
}

main().catch((err) => {
  console.error('❌ Server startup failed:', err.message);
  process.exit(1);
});
