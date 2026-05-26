/**
 * Bash Tool - Execute shell commands with zombie process handling
 * @module tools/tools/BashTool
 */

import { spawn } from 'node:child_process';
import { TOOL_ACCESS_MODE } from '../core/Tool.js';
import { isUncPath, hasSuspiciousWindowsPathPattern } from '../utils/pathSecurity.js';

const BASH_SEARCH_COMMANDS = new Set(['find', 'grep', 'rg', 'ag', 'ack', 'locate', 'which', 'ls', 'la', 'll']);
const BASH_SILENT_COMMANDS = new Set(['mv', 'cp', 'rm', 'mkdir', 'rmdir', 'chmod', 'chown', 'touch', 'ln', 'cd']);
const DANGEROUS_COMMANDS = /^(rm|del|rmdir|shutdown|reboot|init|halt|poweroff|pacman|snap|apt-get|yum|dnf)/i;

function classifyCommand(command) {
  const firstWord = command.trim().split(/\s+/)[0].toLowerCase();
  // Check dangerous first (most important for safety)
  if (DANGEROUS_COMMANDS.test(command)) return 'dangerous';
  if (BASH_SEARCH_COMMANDS.has(firstWord)) return 'search';
  if (BASH_SILENT_COMMANDS.has(firstWord)) return 'silent';
  return 'normal';
}

export const BashTool = {
  name: 'bash',
  description: '执行 bash 命令。用于文件操作、Git 命令、构建脚本等。',
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: '要执行的命令' },
      cwd: { type: 'string', optional: true, description: '工作目录' },
      timeout: { type: 'number', optional: true, description: '超时（毫秒）' },
    },
    required: ['command'],
  },
  accessMode: TOOL_ACCESS_MODE.EXCLUSIVE,
  timeout: 120000,
  isReadOnly: (args) => !DANGEROUS_COMMANDS.test(args.command),
  isConcurrencySafe: () => false,
  isDestructive: (args) => DANGEROUS_COMMANDS.test(args.command),
  isSystemModification: () => true,
  getResourceId: () => 'bash',

  async call(args, options = {}) {
    const cwd = options.context?.cwd || args.cwd || process.cwd();

    // Security checks for working directory
    if (isUncPath(cwd) || hasSuspiciousWindowsPathPattern(cwd)) {
      throw new Error('Access denied: suspicious working directory');
    }

    const commandType = classifyCommand(args.command);

    return new Promise((resolve, reject) => {
      // Use { shell: true, detached: false } to keep child in same process group
      const child = spawn(args.command, [], {
        shell: true,
        cwd,
        env: { ...process.env },
        detached: false,
      });

      let stdout = '', stderr = '';

      // Handle stdout - truncate if too large
      child.stdout.on('data', (data) => {
        stdout += data.toString();
        if (stdout.length > 50000) {
          stdout = stdout.slice(0, 50000) + '\n[Output truncated]';
          // Kill entire process group on Unix to stop the command
          if (process.platform !== 'win32') {
            try {
              process.kill(-child.pid, 'SIGTERM');
            } catch {}
          } else {
            child.kill();
          }
        }
      });

      // Handle stderr - truncate if too large
      child.stderr.on('data', (data) => {
        stderr += data.toString();
        if (stderr.length > 10000) {
          stderr = stderr.slice(0, 10000);
        }
      });

      const timeout = args.timeout || 60000;
      const timer = setTimeout(() => {
        // Kill entire process group (negative PID = process group on Unix)
        if (process.platform !== 'win32' && child.pid) {
          try {
            process.kill(-child.pid, 'SIGTERM'); // Kill whole group
          } catch {
            child.kill('SIGTERM');
          }
        } else {
          child.kill();
        }
        reject(new Error(`Command timeout after ${timeout}ms`));
      }, timeout);

      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          exit_code: code,
          stdout: stdout.slice(0, 50000),
          stderr: stderr.slice(0, 10000),
          commandType,
        });
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  },
};
