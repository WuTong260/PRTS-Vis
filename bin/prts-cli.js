#!/usr/bin/env node

/**
 * PRTS-CLI - Command-line interface for PRTS-Vis
 * @module bin/prts-cli
 */

import net from 'node:net';
import readline from 'node:readline';
import { argv, cwd, stdout, stdin, exit } from 'node:process';
import { writeFileSync } from 'node:fs';

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
let isWaitingForResponse = false;
let spinInterval = null;
let spinIndex = 0;
const SPIN_CHARS = ['|', '/', '-', '\\'];
let rawModeEnabled = false;
let pendingChunk = '';  // Buffer for incoming chunks
const LINE_BUFFER_MAX = 100;  // Flush after this many chars without newline

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
    socket = net.connect(SOCKET_PATH, () => {
      resolve();
    });

    socket.on('error', (err) => {
      console.error('[PRTS-CLI] Connection error:', err.message);
      reject(err);
    });

    socket.on('close', () => {
      // Silent on close
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
 * Start spinning cursor animation
 */
function startSpinner() {
  if (spinInterval) return;
  isWaitingForResponse = true;
  spinIndex = 0;
  spinInterval = setInterval(() => {
    process.stdout.write(`\r[WAIT] ${SPIN_CHARS[spinIndex % 4]} `);
    spinIndex++;
  }, 100);
}

/**
 * Stop spinning cursor and clear the line
 */
function stopSpinner() {
  if (!spinInterval) return;
  clearInterval(spinInterval);
  spinInterval = null;
  isWaitingForResponse = false;
  // Clear the spinner line with spaces
  process.stdout.write('\r        \r');
}

/**
 * Handle incoming messages from server
 * @param {Object} msg
 */
function handleServerMessage(msg) {
  switch (msg.type) {
    case 'init_ack':
      sessionId = msg.sessionId;
      break;

    case 'chunk':
      // Buffer chunks and output line-by-line with spinner awareness
      pendingChunk += msg.data;
      // Find last newline to flush complete lines
      const lastNewline = pendingChunk.lastIndexOf('\n');
      if (lastNewline !== -1) {
        const complete = pendingChunk.substring(0, lastNewline + 1);
        pendingChunk = pendingChunk.substring(lastNewline + 1);
        // Flush complete lines
        stopSpinner();
        stdout.write(complete);
      }
      // If buffer is getting long without newline, flush it anyway
      if (pendingChunk.length > LINE_BUFFER_MAX) {
        stopSpinner();
        stdout.write(pendingChunk);
        pendingChunk = '';
      }
      isWaitingForResponse = false;
      break;

    case 'done':
      // Flush any remaining buffered content
      if (pendingChunk.length > 0) {
        stopSpinner();
        stdout.write(pendingChunk);
        pendingChunk = '';
      }
      stdout.write('\n');
      if (isInteractive && rlStdin) {
        promptUser();
      } else {
        socket.end();
        exit(0);
      }
      break;

    case 'error':
      if (pendingChunk.length > 0) {
        stdout.write(pendingChunk);
        pendingChunk = '';
      }
      console.error('[PRTS-CLI] Server error:', msg.message);
      if (isInteractive && rlStdin) {
        promptUser();
      } else {
        socket.end();
        exit(1);
      }
      break;

    case 'interrupted':
      if (pendingChunk.length > 0) {
        stdout.write(pendingChunk);
        pendingChunk = '';
      }
      console.error('[PRTS-CLI] Interrupted');
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
      // Unknown message type - silent ignore
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

  startSpinner();
  socket.write(JSON.stringify(execMsg) + '\n');
}

/**
 * Prompt user for next command (interactive mode)
 */
function promptUser() {
  if (rlStdin) {
    rlStdin.question('PRTS> ', (answer) => {
      if (!answer || answer.trim() === 'exit' || answer.trim() === 'quit') {
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
 * Enable raw mode for ESC key detection
 */
async function enableRawMode() {
  if (process.platform === 'win32') {
    // Windows: use SetConsoleMode to enable raw input
    try {
      const { execSync } = await import('node:child_process');
      execSync('powershell -Command "'
        + 'Add-Type -AssemblyName System.Runtime.InteropServices;'
        + '$h = GetConsoleWindow;'
        + '$mode = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error();'
        + '[System.Console]::OutputEncoding = [System.Text.Encoding]::UTF8'
        + '"', { stdio: 'ignore' });
    } catch {}
    return false;
  } else {
    // Unix: use tcsetattr
    const tty = await import('node:tty');
    if (tty.isatty(stdin.fd)) {
      tty.setRawMode(true);
      return true;
    }
    return false;
  }
}

/**
 * Setup ESC key interrupt listener
 */
function setupInterruptListener() {
  if (!process.stdin.isTTY) return;

  // Use readline's existing key listener mechanism
  if (rlStdin && rlStdin.input) {
    rlStdin.input.on('keypress', (str, key) => {
      // ESC key or Ctrl+C
      if (key && key.name === 'escape') {
        if (isWaitingForResponse && socket && socket.writable) {
          stopSpinner();
          socket.write(JSON.stringify({ type: 'interrupt' }) + '\n');
          process.stdout.write('\r[ABORT] Interrupted!\n');
        }
      }
      // Ctrl+C also triggers SIGINT which we already handle
    });
  }
}

/**
 * Main entry point
 */
async function main() {
  // Suppress stderr output in CLI mode (we only want stdout content)
  // Keep stderr for critical errors only

  if (isInteractive) {
    console.error('[PRTS-CLI] PRTS-Vis CLI v1.0.0 - Interactive mode');
    console.error('[PRTS-CLI] Type "exit" to quit, ESC to interrupt');
  } else {
    console.error('[PRTS-CLI] PRTS-Vis CLI v1.0.0');
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

      // Enable raw mode for ESC detection
      if (process.stdin.isTTY) {
        stdin.setRawMode && stdin.setRawMode(true);
        rawModeEnabled = true;
      }
      // Resume stdin to enable keypress events
      stdin.resume();
      // Setup ESC key interrupt
      setupInterruptListener();

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