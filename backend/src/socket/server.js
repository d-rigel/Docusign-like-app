/**
 * src/socket/server.js
 *
 * Standalone Socket.IO server for real-time collaboration.
 * Run with:  node src/socket/server.js
 * Or:        PORT=3001 node src/socket/server.js
 *
 * This server handles:
 *  - Real-time document editing (OT-lite conflict resolution)
 *  - Presence (who is online / typing)
 *  - Signature events
 *  - Notifications
 */

const { createServer } = require('http');
const { Server }       = require('socket.io');

const PORT            = process.env.SOCKET_PORT || 3001;
const FRONTEND_ORIGIN = process.env.FRONTEND_URL  || 'http://localhost:5173';

// ─── State ────────────────────────────────────────────────────────────────────
/** documentId → Map<socketId, { userId, name, email, color, cursor }> */
const rooms = new Map();

/** documentId → { content, version } – last known snapshot per document */
const docSnapshots = new Map();

/** Assign a distinct colour to each collaborator */
const COLOURS = [
  '#f44336','#e91e63','#9c27b0','#3f51b5',
  '#2196f3','#00bcd4','#009688','#4caf50',
  '#ff9800','#ff5722',
];
let colourIdx = 0;
const nextColour = () => COLOURS[colourIdx++ % COLOURS.length];

// ─── HTTP + Socket.IO bootstrap ───────────────────────────────────────────────
const httpServer = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'Socket server running', port: PORT }));
});

const io = new Server(httpServer, {
  cors: {
    origin: [FRONTEND_ORIGIN, 'http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 30000,
  pingInterval: 10000,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getRoom(docId) {
  if (!rooms.has(docId)) rooms.set(docId, new Map());
  return rooms.get(docId);
}

function broadcastPresence(docId) {
  const room = getRoom(docId);
  const users = Array.from(room.values());
  io.to(docId).emit('presence:update', { users });
}

// ─── Connection handler ───────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  let currentDocId = null;
  let currentUser  = null;

  // ── Join a document room ──────────────────────────────────────────────────
  socket.on('doc:join', ({ documentId, user }) => {
    if (!documentId || !user) return;

    // Leave previous room if any
    if (currentDocId) {
      socket.leave(currentDocId);
      const prevRoom = getRoom(currentDocId);
      prevRoom.delete(socket.id);
      broadcastPresence(currentDocId);
    }

    currentDocId = String(documentId);
    currentUser  = { ...user, color: nextColour() };

    socket.join(currentDocId);
    getRoom(currentDocId).set(socket.id, {
      socketId: socket.id,
      ...currentUser,
      typing: false,
      cursor: null,
    });

    // Send the last known snapshot to the new joiner
    const snapshot = docSnapshots.get(currentDocId);
    if (snapshot) {
      socket.emit('doc:snapshot', snapshot);
    }

    broadcastPresence(currentDocId);

    socket.to(currentDocId).emit('notification', {
      type: 'join',
      message: `${currentUser.name || currentUser.email} joined the document`,
      user: currentUser,
    });

    console.log(`[Socket] ${currentUser.email} joined doc:${currentDocId}`);
  });

  // ── Text edit delta ───────────────────────────────────────────────────────
  socket.on('doc:delta', ({ documentId, delta, version, source }) => {
    if (!documentId) return;
    const docId = String(documentId);

    // Broadcast delta to all OTHER clients in the room
    socket.to(docId).emit('doc:delta', {
      delta,
      version,
      source: source || socket.id,
      senderId: socket.id,
    });
  });

  // ── Full content sync (autosave checkpoint) ───────────────────────────────
  socket.on('doc:content', ({ documentId, content, version }) => {
    if (!documentId) return;
    const docId = String(documentId);
    docSnapshots.set(docId, { content, version, updatedAt: Date.now() });
    // Broadcast to others so late joiners can receive a full sync
    socket.to(docId).emit('doc:content', { content, version, senderId: socket.id });
  });

  // ── Typing indicator ─────────────────────────────────────────────────────
  socket.on('typing:start', ({ documentId }) => {
    if (!documentId || !currentUser) return;
    const docId = String(documentId);
    const room  = getRoom(docId);
    const entry = room.get(socket.id);
    if (entry) entry.typing = true;
    socket.to(docId).emit('typing:update', {
      socketId: socket.id,
      user: currentUser,
      typing: true,
    });
  });

  socket.on('typing:stop', ({ documentId }) => {
    if (!documentId || !currentUser) return;
    const docId = String(documentId);
    const room  = getRoom(docId);
    const entry = room.get(socket.id);
    if (entry) entry.typing = false;
    socket.to(docId).emit('typing:update', {
      socketId: socket.id,
      user: currentUser,
      typing: false,
    });
  });

  // ── Cursor position ───────────────────────────────────────────────────────
  socket.on('cursor:move', ({ documentId, range }) => {
    if (!documentId || !currentUser) return;
    const docId = String(documentId);
    const room  = getRoom(docId);
    const entry = room.get(socket.id);
    if (entry) entry.cursor = range;
    socket.to(docId).emit('cursor:update', {
      socketId: socket.id,
      user: currentUser,
      range,
      color: currentUser.color,
    });
  });

  // ── Signature added ───────────────────────────────────────────────────────
  socket.on('signature:added', ({ documentId, signature }) => {
    if (!documentId) return;
    const docId = String(documentId);
    socket.to(docId).emit('signature:added', { signature, addedBy: currentUser });
    io.to(docId).emit('notification', {
      type: 'signed',
      message: `${currentUser?.name || currentUser?.email || 'Someone'} signed the document`,
      user: currentUser,
    });
  });

  // ── Generic notification broadcast ───────────────────────────────────────
  socket.on('notification:send', ({ documentId, notification }) => {
    if (!documentId) return;
    socket.to(String(documentId)).emit('notification', notification);
  });

  // ── Disconnect ────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    if (currentDocId) {
      const room = getRoom(currentDocId);
      room.delete(socket.id);

      if (room.size === 0) {
        rooms.delete(currentDocId);
        docSnapshots.delete(currentDocId); // Clean up snapshot when room is empty
      } else {
        broadcastPresence(currentDocId);
        if (currentUser) {
          socket.to(currentDocId).emit('notification', {
            type: 'leave',
            message: `${currentUser.name || currentUser.email} left the document`,
            user: currentUser,
          });
        }
      }
    }
    console.log(`[Socket] Disconnected: ${socket.id}`);
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`\n🔌 Socket.IO server listening on port ${PORT}`);
  console.log(`   CORS allowed: ${FRONTEND_ORIGIN}\n`);
});
