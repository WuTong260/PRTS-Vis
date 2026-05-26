/**
 * Glob Tool - Search files matching glob patterns
 * @module tools/tools/GlobTool
 */

import { TOOL_ACCESS_MODE } from '../core/Tool.js';
import { expandPath, validatePathSecurity } from '../utils/pathSecurity.js';
import fs from 'node:fs/promises';
import path from 'node:path';

function matchGlob(filename, pattern) {
  const parts = pattern.split('**/');
  if (parts.length === 2) {
    const prefix = parts[0];
    const suffix = parts[1].replace(/\*/g, '[^/]*');
    return new RegExp('^' + prefix + suffix + '$').test(filename);
  }
  const regexPattern = pattern.replace(/\*/g, '[^/]*').replace(/\?/g, '.');
  return new RegExp('^' + regexPattern + '$').test(filename);
}

async function searchDirectory(dirPath, pattern, results = [], depth = 0) {
  if (results.length >= 100) return results;

  const securityCheck = validatePathSecurity(dirPath);
  if (!securityCheck.valid) return results;

  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory() && depth < 10) {
      const childCheck = validatePathSecurity(fullPath);
      if (childCheck.valid) {
        await searchDirectory(fullPath, pattern, results, depth + 1);
      }
    } else if (entry.isFile() && matchGlob(entry.name, pattern)) {
      results.push(fullPath);
    }
  }
  return results;
}

export const GlobTool = {
  name: 'glob',
  description: '搜索匹配 glob 模式的文件',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Glob 模式，如 *.js, **/*.ts' },
      path: { type: 'string', optional: true, description: '搜索目录（默认 cwd）' },
    },
    required: ['pattern'],
  },
  accessMode: TOOL_ACCESS_MODE.READ,
  timeout: 30000,
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  isDestructive: () => false,

  async call(args, options = {}) {
    const cwd = options.context?.cwd || process.cwd();
    const searchPath = args.path ? expandPath(args.path, cwd) : cwd;

    const securityCheck = validatePathSecurity(searchPath);
    if (!securityCheck.valid) throw new Error(securityCheck.error);

    const results = await searchDirectory(searchPath, args.pattern);
    return { files: results.slice(0, 100), count: results.length, truncated: results.length > 100 };
  },
};
