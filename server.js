import 'dotenv/config';
import { Server } from '@hocuspocus/server';
import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import * as Y from 'yjs';
import net from 'net';
import { mountAIRoutes } from './server/ai/routes.js';
import { importRouter } from './server/import/routes.js';
import { validateEnvironment } from './server/config/envValidator.js';
import { errorMonitorMiddleware, getMetricsSummary } from './server/monitoring/errorMonitor.js';

// Structural security check at boot: aborts if insecure flags (e.g. auth bypass) are set in production
validateEnvironment(process.env);

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once('error', () => resolve(false))
      .once('listening', () => tester.close(() => resolve(true)))
      .listen(port);
  });
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
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
      : ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(errorMonitorMiddleware);

app.get('/api/health/metrics', (req, res) => {
  res.json(getMetricsSummary());
});

mountAIRoutes(app);
app.use('/api/import', importRouter);

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
