#!/usr/bin/env node

/**
 * PRTS-CLI - Command-line interface for PRTS-Vis
 * @module bin/prts-cli
 */

import net from 'node:net';
import readline from 'node:readline';
import { argv, cwd, stdout, stdin, exit } from 'node:process';

// Platform-specific socket path
const SOCKET_PATH = process.platform === 'win32'
  ? '\\\\.\\pipe\\prts-cli'
  : '/tmp/prts-cli.sock';

// Parse CLI arguments
const args = argv.slice(2);
const isInteractive = args.length === 0;
const userCommand = args.join(' ') || 'Hello, PRTS-Vis!';

let sessionId = null;
let socket = null;
let rlSocket = null;
let rlStdin = null;
let pendingCommand = null;
let responseBuffer = '';

/**
 * Get terminal size
 * @returns {{cols: number, rows: number}}
 */
function getTerminalSize() {
  return { cols: 80, rows: 24 };
}

/**
 * Connect to CLI server
 */
function connect() {
  return new Promise((resolve, reject) => {
    console.error('[PRTS-CLI] Connecting to', SOCKET_PATH);

    socket = net.connect(SOCKET_PATH, () => {
      console.error('[PRTS-CLI] Connected!');
      resolve();
    });

    socket.on('error', (err) => {
      console.error('[PRTS-CLI] Connection error:', err.message);
      reject(err);
    });

    socket.on('close', () => {
      console.error('[PRTS-CLI] Disconnected');
    });

    rlSocket = readline.createInterface({
      input: socket,
      crlfDelay: Infinity,
    });

    rlSocket.on('line', (line) => {
      if (!line.trim()) return;

      let msg;
      try {
        msg = JSON.parse(line);
      } catch (e) {
        console.error('[PRTS-CLI] Invalid JSON from server:', line);
        return;
      }

      handleServerMessage(msg);
    });
  });
}

/**
 * Handle incoming messages from server
 * @param {Object} msg
 */
function handleServerMessage(msg) {
  switch (msg.type) {
    case 'init_ack':
      sessionId = msg.sessionId;
      console.error('[PRTS-CLI] Session established:', sessionId);
      break;

    case 'chunk':
      stdout.write(msg.data);
      break;

    case 'done':
      stdout.write('\n');
      console.error('[PRTS-CLI] Done:', msg.messageId);
      if (isInteractive && rlStdin) {
        // Continue - ready for next command
        promptUser();
      } else {
        socket.end();
        exit(0);
      }
      break;

    case 'error':
      console.error('[PRTS-CLI] Server error:', msg.message);
      if (isInteractive && rlStdin) {
        promptUser();
      } else {
        socket.end();
        exit(1);
      }
      break;

    case 'interrupted':
      console.error('[PRTS-CLI] Operation interrupted');
      if (isInteractive && rlStdin) {
        promptUser();
      } else {
        socket.end();
        exit(130);
      }
      break;

    case 'heartbeat_ack':
      break;

    default:
      console.error('[PRTS-CLI] Unknown message type:', msg.type);
  }
}

/**
 * Initialize session
 */
async function initializeSession() {
  const initMsg = {
    type: 'init',
    cwd: cwd(),
    terminalSize: getTerminalSize(),
    sessionId: null,
    clientVersion: '1.0.0',
  };

  socket.write(JSON.stringify(initMsg) + '\n');
  console.error('[PRTS-CLI] Sent init:', cwd());
}

/**
 * Send execute message
 * @param {string} text
 */
function sendExecute(text) {
  const execMsg = {
    type: 'execute',
    text: text,
    cwd: cwd(),
  };

  socket.write(JSON.stringify(execMsg) + '\n');
  console.error('[PRTS-CLI] Sent execute:', text);
}

/**
 * Prompt user for next command (interactive mode)
 */
function promptUser() {
  if (rlStdin) {
    rlStdin.question('PRTS> ', (answer) => {
      if (!answer || answer.trim() === 'exit' || answer.trim() === 'quit') {
        console.error('[PRTS-CLI] Goodbye!');
        socket.end();
        exit(0);
      }
      if (answer.trim()) {
        sendExecute(answer.trim());
      } else {
        promptUser();
      }
    });
  }
}

/**
 * Setup signal handlers
 */
function setupSignalHandlers() {
  process.on('SIGINT', () => {
    console.error('\n[PRTS-CLI] Interrupt received');
    if (socket && socket.writable) {
      socket.write(JSON.stringify({ type: 'interrupt' }) + '\n');
    }
    exit(130);
  });

  process.on('SIGTERM', () => {
    if (socket) socket.end();
    exit(0);
  });
}

/**
 * Main entry point
 */
async function main() {
  console.error('[PRTS-CLI] PRTS-Vis CLI v1.0.0');
  console.error('[PRTS-CLI] CWD:', cwd());

  if (isInteractive) {
    console.error('[PRTS-CLI] Interactive mode - type "exit" to quit');
  } else {
    console.error('[PRTS-CLI] Command:', userCommand);
  }

  try {
    await connect();
    await initializeSession();

    if (isInteractive) {
      // Interactive mode - read from stdin
      rlStdin = readline.createInterface({
        input: stdin,
        output: stdout,
        prompt: 'PRTS> ',
        crlfDelay: Infinity,
      });

      rlStdin.on('close', () => {
        if (socket) socket.end();
        exit(0);
      });

      promptUser();
    } else {
      // Single command mode
      sendExecute(userCommand);
    }
  } catch (err) {
    console.error('[PRTS-CLI] Failed to connect:', err.message);
    console.error('[PRTS-CLI] Is PRTS-Vis running? (Start with: prts --server)');
    exit(1);
  }
}

setupSignalHandlers();
main();