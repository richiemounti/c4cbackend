#!/usr/bin/env node

/**
 * Module dependencies.
 */



import app from '../app';
import debugLib from 'debug';
import http from 'http';
import { env } from '../config/env';
import {
  connectToDatabase,
  disconnectFromDatabase,
  checkDatabaseConnection,
} from '../database/mongodb';

// ── Socket.io ──────────────────────────────────────────────────────────────
import { initSocket } from '../services/socket.service';

const debug = debugLib('youthimpactbackend:server');
let server: http.Server;

/**
 * Connect to MongoDB first, then start everything else.
 */
startApplication();

async function startApplication() {
  try {
    await connectToDatabase();
    console.log('MongoDB connected successfully');

    startServer();
    setupHealthChecks();
  } catch (err) {
    console.error('Failed to start application:', err);
    process.exit(1);
  }
}

/**
 * Start the Express server and attach Socket.io after DB is ready.
 */
function startServer() {
  const port = env.PORT;
  app.set('port', port);

  // Create the HTTP server wrapping the Express app
  server = http.createServer(app);

  // ── Initialize Socket.io on the same HTTP server ─────────────────────────
  initSocket(server);

  server.listen(port);
  server.on('error', onError);
  server.on('listening', onListening);

  function onError(error: NodeJS.ErrnoException): void {
    if (error.syscall !== 'listen') {
      throw error;
    }

    const bind =
      typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

    switch (error.code) {
      case 'EACCES':
        console.error(bind + ' requires elevated privileges');
        process.exit(1);
        break;
      case 'EADDRINUSE':
        console.error(bind + ' is already in use');
        process.exit(1);
        break;
      default:
        throw error;
    }
  }

  function onListening(): void {
    const addr = server.address();
    const bind =
      typeof addr === 'string'
        ? 'pipe ' + addr
        : 'port ' + (addr?.port || 'unknown');
    console.log(
      `Youth Impact Platform API is running in ${env.NODE_ENV} mode on http://localhost:${port}`
    );
    debug('Listening on ' + bind);
  }
}

/**
 * Periodic database health checks.
 */
function setupHealthChecks() {
  const healthCheckInterval = setInterval(async () => {
    const isConnected = await checkDatabaseConnection();
    if (!isConnected) {
      console.warn('Database connection lost during health check');
    }
  }, 30000);

  process.on('SIGINT', () => clearInterval(healthCheckInterval));
  process.on('SIGTERM', () => clearInterval(healthCheckInterval));
}

/**
 * Graceful shutdown.
 */
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

async function gracefulShutdown() {
  console.log('Shutting down gracefully...');

  await disconnectFromDatabase();

  if (server) {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }

  setTimeout(() => {
    console.error('Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
}