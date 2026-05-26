/**
 * Grep Tool - Search for patterns in files
 * @module tools/tools/GrepTool
 */

import { TOOL_ACCESS_MODE } from '../core/Tool.js';
import { expandPath, validatePathSecurity } from '../utils/pathSecurity.js';
import fs from 'node:fs/promises';
import path from 'node:path';

async function grepInFile(filePath, pattern, options = {}) {
  const { caseSensitive = false, limit = 50 } = options;
  const results = [];
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        results.push({ line: i + 1, content: lines[i].slice(0, 200) });
        if (results.length >= limit) break;
      }
    }
  } catch {}
  return results;
}

async function searchDirectory(dirPath, pattern, options, results = [], depth = 0) {
  if (results.length >= 500) return results;

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
        await searchDirectory(fullPath, pattern, options, results, depth + 1);
      }
    } else if (entry.isFile()) {
      const matches = await grepInFile(fullPath, pattern, options);
      if (matches.length > 0) results.push({ file: fullPath, matches });
    }
  }
  return results;
}

export const GrepTool = {
  name: 'grep',
  description: '在文件中搜索包含指定文本的行',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: '搜索模式（支持正则）' },
      path: { type: 'string', optional: true, description: '搜索目录' },
      case_sensitive: { type: 'boolean', optional: true },
    },
    required: ['pattern'],
  },
  accessMode: TOOL_ACCESS_MODE.READ,
  timeout: 60000,
  isReadOnly: () => true,
  isConcurrencySafe: () => false,
  isDestructive: () => false,

  async call(args, options = {}) {
    const cwd = options.context?.cwd || process.cwd();
    const searchPath = args.path ? expandPath(args.path, cwd) : cwd;

    const securityCheck = validatePathSecurity(searchPath);
    if (!securityCheck.valid) throw new Error(securityCheck.error);

    const results = await searchDirectory(searchPath, args.pattern, { caseSensitive: args.case_sensitive });
    return { results: results.slice(0, 100), totalFiles: results.length, truncated: results.length > 100 };
  },
};
