/**
 * Path Security Utilities - Claude Code-style security checks
 * @module tools/utils/pathSecurity
 */

import path from 'node:path';
import os from 'node:os';

// ============ 常量 ============

export const DANGEROUS_DIRECTORIES = ['.git', '.vscode', '.idea', '.claude'];

export const DANGEROUS_FILES = [
  '.gitconfig', '.gitmodules', '.bashrc', '.bash_profile',
  '.zshrc', '.zprofile', '.profile', '.ripgreprc',
  '.mcp.json', '.claude.json',
];

export const BLOCKED_DEVICE_PATHS = new Set([
  '/dev/zero', '/dev/random', '/dev/urandom', '/dev/full',
  '/dev/stdin', '/dev/tty', '/dev/console', '/dev/stdout', '/dev/stderr',
  '/dev/fd/0', '/dev/fd/1', '/dev/fd/2',
]);

// ============ 工具函数 ============

export function expandPath(inputPath, baseDir = process.cwd()) {
  if (inputPath.startsWith('~/') || inputPath === '~') {
    return path.resolve(os.homedir(), inputPath.slice(1));
  }
  if (path.isAbsolute(inputPath)) {
    return path.normalize(inputPath);
  }
  return path.resolve(baseDir, inputPath);
}

export function containsPathTraversal(inputPath) {
  return path.normalize(inputPath).includes('..');
}

export function isUncPath(filePath) {
  return filePath.startsWith('\\\\') || filePath.startsWith('//');
}

export function hasSuspiciousWindowsPathPattern(filePath) {
  // NTFS ADS (Alternate Data Streams)
  const colonIndex = filePath.indexOf(':', 2);
  if (colonIndex !== -1) return true;

  // Long path prefix
  if (filePath.includes('\\?\\')) return true;

  // Trailing dots or spaces (can hide extensions)
  if (filePath.endsWith('.') || filePath.endsWith(' ')) return true;

  // Multiple consecutive dots (path traversal obfuscation)
  if (/\.{3,}/.test(filePath)) return true;

  // Windows DOS device names (reserved filenames)
  const dosDevices = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'LPT1'];
  const baseName = path.basename(filePath).toUpperCase();
  for (const device of dosDevices) {
    if (baseName === device || baseName.startsWith(device + '.')) {
      return true;
    }
  }
  return false;
}

export function isBlockedDevicePath(filePath) {
  if (BLOCKED_DEVICE_PATHS.has(filePath)) return true;

  // Linux /proc virtual files - only block stdin/stdout/stderr fds
  if (filePath.startsWith('/proc/') &&
      (filePath.endsWith('/fd/0') || filePath.endsWith('/fd/1') || filePath.endsWith('/fd/2'))) {
    return true;
  }

  // Windows device paths
  if (/^[A-Z]:\\(dev|con|prn|aux|nul|com[1-9]|lpt[1-9])(\\.|$)/i.test(filePath)) {
    return true;
  }

  return false;
}

export function isDangerousPath(filePath) {
  const normalized = filePath.toLowerCase();
  const segments = normalized.split(path.sep);

  // Check for dangerous directory names
  for (const segment of segments) {
    for (const dir of DANGEROUS_DIRECTORIES) {
      if (segment === dir.toLowerCase()) return true;
    }
  }

  // Check for dangerous file names
  const baseName = path.basename(filePath).toLowerCase();
  for (const file of DANGEROUS_FILES) {
    if (baseName === file.toLowerCase()) return true;
  }

  return false;
}

export function validatePathSecurity(filePath, options = {}) {
  const { allowUnc = false, allowDangerous = false } = options;

  if (!filePath || typeof filePath !== 'string') {
    return { valid: false, error: 'Invalid path: must be a non-empty string' };
  }

  if (isBlockedDevicePath(filePath)) {
    return { valid: false, error: 'Access denied: blocked device file' };
  }

  if (!allowUnc && isUncPath(filePath)) {
    return { valid: false, error: 'Access denied: UNC path blocked' };
  }

  if (hasSuspiciousWindowsPathPattern(filePath)) {
    return { valid: false, error: 'Access denied: suspicious Windows path pattern' };
  }

  if (containsPathTraversal(filePath)) {
    return { valid: false, error: 'Access denied: path traversal detected' };
  }

  if (!allowDangerous && isDangerousPath(filePath)) {
    return { valid: false, error: 'Access denied: dangerous path' };
  }

  return { valid: true };
}
