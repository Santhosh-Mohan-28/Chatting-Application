const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const { setupSocketHandlers } = require('./server/socketHandler');

const isDev = process.env.NODE_ENV !== 'production';
const isStandaloneBackend = process.env.STANDALONE_BACKEND === 'true';
const port = parseInt(process.env.PORT || '3000', 10);

// Configure CORS origins
function getAllowedOrigins() {
  if (process.env.CLIENT_ORIGIN) {
    return process.env.CLIENT_ORIGIN.split(',').map((origin) => origin.trim());
  }
  // In development, default to allowing standard local origins
  if (isDev) {
    return [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5000',
      'http://127.0.0.1:5000',
    ];
  }
  // In production unified mode, same-origin is handled by default
  return [];
}

async function startServer() {
  const expressApp = express();
  const server = http.createServer(expressApp);

  const allowedOrigins = getAllowedOrigins();

  // Setup Express CORS
  expressApp.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g., mobile apps, curl, same-origin)
        if (!origin) return callback(null, true);
        if (allowedOrigins.length === 0 || allowedOrigins.includes(origin) || isDev) {
          return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
      credentials: true,
    })
  );

  expressApp.use(express.json());

  // Setup Socket.IO
  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.length === 0 || allowedOrigins.includes(origin) || isDev) {
          return callback(null, true);
        }
        return callback(new Error(`Socket.IO Origin ${origin} not allowed by CORS`));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // WebSocket preferred, with polling fallback for maximum reliability
    transports: ['websocket', 'polling'],
  });

  // Attach Socket.IO chat logic
  const { activeUsers } = setupSocketHandlers(io);

  // Health check endpoint
  expressApp.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      onlineUsers: activeUsers.size,
      timestamp: new Date().toISOString(),
    });
  });

  if (isStandaloneBackend) {
    console.log('[Server] Running in standalone backend mode (no Next.js handler).');
    server.listen(port, '0.0.0.0', () => {
      console.log(`> Backend ready on http://localhost:${port}`);
    });
    return;
  }

  // Unified Mode: Next.js + Socket.IO on the same HTTP server and port
  console.log(`[Server] Initializing Next.js in ${isDev ? 'development' : 'production'} mode...`);
  const next = require('next');
  const nextApp = next({ dev: isDev });
  const handle = nextApp.getRequestHandler();

  await nextApp.prepare();

  // Pass all non-intercepted HTTP requests to Next.js
  expressApp.all('*', (req, res) => {
    return handle(req, res);
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`> Real-Time Chat is running on http://localhost:${port}`);
    console.log(`> Mode: ${isDev ? 'Development' : 'Production'}`);
    console.log(`> WebSocket / Socket.IO endpoint: http://localhost:${port}/socket.io/`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
