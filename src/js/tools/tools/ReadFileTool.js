/**
 * Read File Tool - Read file contents with offset/limit support
 * @module tools/tools/ReadFileTool
 */

import { TOOL_ACCESS_MODE } from '../core/Tool.js';
import { validatePathSecurity, expandPath } from '../utils/pathSecurity.js';
import fs from 'node:fs/promises';
import path from 'node:path';

export const ReadFileTool = {
  name: 'read_file',
  description: '读取文件内容。用于查看源代码、配置文件、文档等。',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径（相对于 cwd）' },
      offset: { type: 'number', optional: true, description: '起始行号（默认 1）' },
      limit: { type: 'number', optional: true, description: '读取行数限制' },
    },
    required: ['path'],
  },
  accessMode: TOOL_ACCESS_MODE.READ,
  timeout: 30000,

  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  isDestructive: () => false,

  getResourceId: (args) => 'file:' + args.path,

  async call(args, options = {}) {
    const cwd = options.context?.cwd || process.cwd();
    const filePath = expandPath(args.path, cwd);

    const securityCheck = validatePathSecurity(filePath);
    if (!securityCheck.valid) throw new Error(securityCheck.error);

    let stats;
    try {
      stats = await fs.stat(filePath);
    } catch (e) {
      if (e.code === 'ENOENT') throw new Error(`File not found: ${args.path}`);
      throw e;
    }

    if (stats.isDirectory()) throw new Error(`Path is a directory: ${args.path}`);

    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const startLine = Math.max(0, (args.offset || 1) - 1);
    const endLine = args.limit ? startLine + args.limit : lines.length;

    return {
      path: filePath,
      content: lines.slice(startLine, endLine).join('\n'),
      lines: { total: lines.length, start: startLine + 1, end: endLine, count: endLine - startLine },
      size: stats.size,
      truncated: content.length > 100000,
    };
  },
};
