/**
 * Write File Tool - Create or overwrite files with atomic write
 * @module tools/tools/WriteFileTool
 */

import { TOOL_ACCESS_MODE } from '../core/Tool.js';
import { expandPath, validatePathSecurity, isDangerousPath } from '../utils/pathSecurity.js';
import fs from 'node:fs/promises';
import path from 'node:path';

export const WriteFileTool = {
  name: 'write_file',
  description: '创建或覆盖文件内容',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径' },
      content: { type: 'string', description: '文件内容' },
    },
    required: ['path', 'content'],
  },
  accessMode: TOOL_ACCESS_MODE.WRITE,
  timeout: 30000,
  isReadOnly: () => false,
  isConcurrencySafe: () => false,
  isDestructive: (args) => {
    try {
      return fs.existsSync(args.path);
    } catch {
      return false;
    }
  },
  getResourceId: (args) => 'file:' + args.path,

  async call(args, options = {}) {
    const cwd = options.context?.cwd || process.cwd();
    const filePath = expandPath(args.path, cwd);

    const securityCheck = validatePathSecurity(filePath, { allowDangerous: false });
    if (!securityCheck.valid) throw new Error(securityCheck.error);

    if (isDangerousPath(filePath)) {
      throw new Error('Access denied: cannot write to dangerous path');
    }

    // Ensure parent directory exists
    const dir = path.dirname(filePath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch {}

    // Atomic write: write to temp file then rename
    const tempPath = filePath + '.tmp.' + Date.now();
    await fs.writeFile(tempPath, args.content, 'utf-8');
    await fs.rename(tempPath, filePath);

    const stats = await fs.stat(filePath);
    return { path: filePath, bytes: stats.size };
  },
};
