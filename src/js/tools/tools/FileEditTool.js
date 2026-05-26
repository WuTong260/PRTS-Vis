/**
 * File Edit Tool - Smart file editing with old_string/new_string replacement
 * @module tools/tools/FileEditTool
 */

import { TOOL_ACCESS_MODE } from '../core/Tool.js';
import { validatePathSecurity, expandPath, isDangerousPath } from '../utils/pathSecurity.js';
import fs from 'node:fs/promises';
import path from 'node:path';

export const FileEditTool = {
  name: 'edit',
  description: '编辑文件内容。传入旧字符串和新字符串，精确替换文件中的指定文本。',
  inputSchema: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: '文件路径' },
      old_string: { type: 'string', description: '要替换的原始文本' },
      new_string: { type: 'string', description: '替换后的新文本' },
      replace_all: { type: 'boolean', optional: true, description: '是否替换所有匹配项（默认 false）' },
    },
    required: ['file_path', 'old_string', 'new_string'],
  },
  accessMode: TOOL_ACCESS_MODE.WRITE,
  timeout: 30000,
  isReadOnly: () => false,
  isConcurrencySafe: () => false,
  isDestructive: () => false, // edits are targeted, not destructive
  isSystemModification: () => true,
  getResourceId: (args) => 'file:' + args.file_path,

  async call(args, options = {}) {
    const cwd = options.context?.cwd || process.cwd();
    const filePath = expandPath(args.file_path, cwd);

    // Security checks
    const securityCheck = validatePathSecurity(filePath);
    if (!securityCheck.valid) {
      return { success: false, error: securityCheck.error };
    }

    if (isDangerousPath(filePath)) {
      return { success: false, error: 'Access denied: cannot edit dangerous path' };
    }

    const { old_string, new_string, replace_all = false } = args;

    // Validation
    if (!old_string || old_string.length === 0) {
      return { success: false, error: 'old_string cannot be empty' };
    }

    if (old_string === new_string) {
      return { success: false, error: 'old_string and new_string must be different' };
    }

    // Read file
    let fileContent;
    try {
      fileContent = await fs.readFile(filePath, 'utf-8');
    } catch (e) {
      if (e.code === 'ENOENT') {
        return { success: false, error: `File not found: ${filePath}` };
      }
      return { success: false, error: `Failed to read file: ${e.message}` };
    }

    // Normalize line endings
    fileContent = fileContent.replace(/\r\n/g, '\n');

    // Find the old_string
    const actualOldString = fileContent.includes(old_string)
      ? old_string
      : null;

    if (!actualOldString) {
      return {
        success: false,
        error: `String to replace not found in file.\nString: ${old_string.slice(0, 100)}`,
      };
    }

    // Count matches
    const matches = fileContent.split(old_string).length - 1;

    if (matches > 1 && !replace_all) {
      return {
        success: false,
        error: `Found ${matches} matches of the string to replace, but replace_all is false. Set replace_all to true to replace all, or provide more context to uniquely identify one instance.`,
      };
    }

    // Perform replacement
    let newContent;
    let actualMatches;
    if (replace_all) {
      newContent = fileContent.split(old_string).join(new_string);
      actualMatches = matches;
    } else {
      const idx = fileContent.indexOf(old_string);
      newContent = fileContent.slice(0, idx) + new_string + fileContent.slice(idx + old_string.length);
      actualMatches = 1;
    }

    // Atomic write: temp file + rename
    const tempPath = filePath + '.edit.tmp.' + Date.now();
    try {
      await fs.writeFile(tempPath, newContent, 'utf-8');
      await fs.rename(tempPath, filePath);
    } catch (e) {
      // Clean up temp file on error
      try { await fs.unlink(tempPath); } catch {}
      return { success: false, error: `Failed to write file: ${e.message}` };
    }

    // Return structured result
    return {
      success: true,
      file_path: filePath,
      old_string,
      new_string,
      replace_all,
      matches_replaced: actualMatches,
      message: `Successfully replaced ${actualMatches} occurrence(s) in ${filePath}`,
    };
  },
};
