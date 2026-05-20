import { Server } from '@hocuspocus/server';
import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import admin from 'firebase-admin';
import * as Y from 'yjs';
import dotenv from 'dotenv';

dotenv.config();

// ── 0. Firebase Initialization ──
let db = null;
try {
  // Try to parse the service account JSON from environment variable
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
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
const hocuspocusServer = new Server({
  port: 1234,
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
      console.error(`❌ Failed to load board ${data.documentName}:`, err);
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
      console.error(`❌ Failed to save board ${data.documentName}:`, err);
    }
  }
});
hocuspocusServer.listen();
console.log('🚀 Hocuspocus WebSocket server running on ws://localhost:1234');

// ── 2. Express AI Backend ──
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'DUMMY_KEY');

const SYSTEM_PROMPT = `You are an expert diagram interpretation engine for a collaborative whiteboard application called CollabBoard.

Your task is to analyze rough hand-drawn sketches and convert them into a structured diagram representation.

You MUST behave like a deterministic parser, NOT a chatbot.

Your responsibilities:
1. Detect diagram elements
2. Detect relationships and connections
3. Infer likely diagram intent
4. Extract readable text labels
5. Return STRICT JSON ONLY

You are NOT allowed to:
* Explain your reasoning
* Add markdown
* Add comments
* Add natural language
* Return anything outside valid JSON

The user sketch may contain:
* rectangles
* circles
* diamonds
* arrows
* cylinders/databases
* text labels
* freehand notes
* UML-like structures
* architecture diagrams
* flowcharts
* ER diagrams

Interpret shapes intelligently based on context.

CRITICAL RULES:
* Never hallucinate extra nodes
* Never invent labels not visually present
* Preserve all detected relationships
* Prefer simple structures over over-complicated assumptions
* If uncertain, set confidence lower instead of guessing

You MUST classify the diagram type as one of:
* architecture
* flowchart
* erd
* sequence
* mindmap
* unknown

You MUST return output using the exact JSON schema provided:
{
  "type": "string",
  "nodes": [
    { "id": "string", "type": "rectangle|circle|database|diamond", "label": "string", "confidence": 0.0 }
  ],
  "edges": [
    { "source": "node_id", "target": "node_id", "label": "string" }
  ]
}
`;

app.post('/api/analyze', async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'No image provided' });

    console.log('🤖 Received image for AI analysis...');

    // Strip data header if present
    const base64Data = imageBase64.replace(/^data:image\/(png|jpeg);base64,/, "");

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

    const result = await model.generateContent([
      SYSTEM_PROMPT,
      {
        inlineData: {
          data: base64Data,
          mimeType: 'image/png'
        }
      }
    ]);

    const responseText = result.response.text();
    
    // Parse the JSON (stripping markdown backticks if Gemini accidentally adds them)
    const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(jsonStr);
    
    console.log(`✅ Successfully parsed diagram type: ${data.type}`);
    res.json(data);
  } catch (error) {
    console.error('❌ AI Analysis Error:', error);
    res.status(500).json({ error: 'Failed to parse diagram' });
  }
});

app.listen(3001, () => {
  console.log('🧠 AI Backend API running on http://localhost:3001');
});
