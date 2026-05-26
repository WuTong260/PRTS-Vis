/**
 * CLI Server - Unix Domain Socket / Named Pipe server for CLI communication
 * @module main/cliServer
 */

import net from 'node:net';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Platform-specific socket path
const SOCKET_PATH = process.platform === 'win32'
  ? '\\\\.\\pipe\\prts-cli'
  : '/tmp/prts-cli.sock';

// Suppress server logs in CLI mode (passive - check if stdout is suppressed)
const CLI_MODE = true;

/**
 * Log only if not in CLI mode
 */
function serverLog(...args) {
  if (!CLI_MODE) {
    console.log(...args);
  }
}

function serverError(...args) {
  if (!CLI_MODE) {
    console.error(...args);
  }
}

// In-memory connection context store (keyed by socket identifier)
const connectionContexts = new Map();

/**
 * Create readline interface for a socket, ensuring NDJSON compliance
 * @param {net.Socket} socket
 * @returns {readline.Interface}
 */
function createSocketInterface(socket) {
  return readline.createInterface({
    input: socket,
    crlfDelay: Infinity,
  });
}

/**
 * Handle incoming socket connections
 * @param {net.Socket} socket
 */
function handleConnection(socket) {
  const remoteAddress = socket.remoteAddress || 'local';
  serverLog(`[CLI.SERVER] Client connected: ${remoteAddress}`);

  const rl = createSocketInterface(socket);
  const context = {
    cwd: process.cwd(),
    terminalSize: { cols: 80, rows: 24 },
    sessionId: null,
  };

  connectionContexts.set(socket, context);

  rl.on('line', (line) => {
    if (!line.trim()) return;

    let msg;
    try {
      msg = JSON.parse(line);
    } catch (e) {
      serverError('[CLI.SERVER] Invalid JSON:', line);
      return;
    }

    serverLog('[CLI.SERVER] Received:', msg.type);

    switch (msg.type) {
      case 'init':
        handleInit(socket, context, msg);
        break;
      case 'execute':
        handleExecute(socket, context, msg);
        break;
      case 'interrupt':
        handleInterrupt(socket, context);
        break;
      case 'heartbeat':
        socket.write(JSON.stringify({ type: 'heartbeat_ack', timestamp: Date.now() }) + '\n');
        break;
      default:
        serverLog('[CLI.SERVER] Unknown message type:', msg.type);
    }
  });

  socket.on('close', () => {
    serverLog('[CLI.SERVER] Client disconnected:', remoteAddress);
    connectionContexts.delete(socket);
  });

  socket.on('error', (err) => {
    serverError('[CLI.SERVER] Socket error:', err.message);
    connectionContexts.delete(socket);
  });
}

/**
 * Handle init message - store connection context
 * @param {net.Socket} socket
 * @param {Object} context
 * @param {Object} msg
 */
function handleInit(socket, context, msg) {
  if (msg.cwd) context.cwd = msg.cwd;
  if (msg.terminalSize) context.terminalSize = msg.terminalSize;
  if (msg.sessionId) context.sessionId = msg.sessionId;

  serverLog('[CLI.SERVER] Context initialized:', context.cwd);

  socket.write(JSON.stringify({
    type: 'init_ack',
    sessionId: context.sessionId || generateSessionId(),
    serverVersion: '1.0.0',
  }) + '\n');
}

/**
 * Handle execute message - real Agent flow
 * @param {net.Socket} socket
 * @param {Object} context
 * @param {Object} msg
 */
async function handleExecute(socket, context, msg) {
  const text = msg.text || 'Hello from CLI';

  // Suppress server logs in CLI mode
  const originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = () => {};

  // Dynamic import to avoid circular deps
  const { sendMessage, abortCurrent } = await import('../js/agentKernel.js');

  // Store abort controller for interrupt
  const controller = new AbortController();
  context.currentController = controller;

  try {
    await sendMessage(
      text,
      (chunk) => {
        // Stream each chunk to client
        socket.write(JSON.stringify({ type: 'chunk', data: chunk }) + '\n');
      },
      controller.signal,
      { context: { cwd: context.cwd, cli: true } }
    );

    // Completion
    socket.write(JSON.stringify({
      type: 'done',
      messageId: generateMessageId(),
      context: {
        cwd: context.cwd,
        processedAt: Date.now(),
      },
    }) + '\n');

  } catch (e) {
    console.error('[CLI.SERVER] Agent error:', e.message);

    // Check for abort
    if (e.name === 'AbortError') {
      socket.write(JSON.stringify({
        type: 'interrupted',
        message: 'Request was cancelled',
      }) + '\n');
      return;
    }

    // Send error to client
    socket.write(JSON.stringify({
      type: 'error',
      code: 'AGENT_ERROR',
      message: e.message,
    }) + '\n');
  } finally {
    context.currentController = null;
    // Restore stdout
    process.stdout.write = originalWrite;
  }
}

/**
 * Handle interrupt message - cancel current operation
 * @param {net.Socket} socket
 * @param {Object} context
 */
function handleInterrupt(socket, context) {
  console.log('[CLI.SERVER] Interrupt received');

  if (context.currentController) {
    context.currentController.abort();
  }

  socket.write(JSON.stringify({ type: 'interrupted', message: 'Operation cancelled' }) + '\n');
}

/**
 * Generate unique session ID
 * @returns {string}
 */
function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Generate unique message ID
 * @returns {string}
 */
function generateMessageId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Start the CLI server
 */
function startServer() {
  // Clean up old socket file on Unix
  if (process.platform !== 'win32') {
    import('node:fs').then((fs) => {
      try {
        fs.unlinkSync(SOCKET_PATH);
      } catch {
        // Socket file doesn't exist, ignore
      }
      createServer();
    });
  } else {
    createServer();
  }
}

/**
 * Create and start the TCP server
 */
function createServer() {
  const server = net.createServer(handleConnection);

  server.on('error', (err) => {
    console.error('[CLI.SERVER] Server error:', err.message);
    process.exit(1);
  });

  server.listen(SOCKET_PATH, () => {
    console.log('[CLI.SERVER] Listening on:', SOCKET_PATH);
    console.log('[CLI.SERVER] Waiting for connections...');
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[CLI.SERVER] Shutting down...');
    server.close(() => {
      console.log('[CLI.SERVER] Server closed');
      process.exit(0);
    });
  });
}

// Auto-start if run directly
startServer();

export { startServer, SOCKET_PATH };