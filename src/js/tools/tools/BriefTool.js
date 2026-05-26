/**
 * Brief Tool - Send message/report to user
 * @module tools/tools/BriefTool
 */

import { TOOL_ACCESS_MODE } from '../core/Tool.js';
import { expandPath, validatePathSecurity } from '../utils/pathSecurity.js';
import fs from 'node:fs/promises';

/**
 * Validate attachment paths
 */
async function validateAttachments(paths, cwd) {
  const valid = [];
  for (const p of paths) {
    const fullPath = expandPath(p, cwd);
    const check = validatePathSecurity(fullPath);
    if (!check.valid) return { valid: false, error: `Invalid path: ${p}` };
    try {
      const stats = await fs.stat(fullPath);
      valid.push({ path: fullPath, size: stats.size, isImage: /\.(png|jpg|jpeg|gif|webp)$/i.test(p) });
    } catch {
      return { valid: false, error: `File not found: ${p}` };
    }
  }
  return { valid: true, attachments: valid };
}

export const BriefTool = {
  name: 'brief',
  description: '向用户发送消息/报告（主要输出通道）',
  inputSchema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: '要发送的消息（支持 markdown）',
      },
      attachments: {
        type: 'array',
        items: { type: 'string' },
        optional: true,
        description: '附件文件路径列表',
      },
      status: {
        type: 'string',
        enum: ['normal', 'proactive'],
        optional: true,
        description: "proactive 用于主动推送用户未请求的信息",
      },
    },
    required: ['message'],
  },
  accessMode: TOOL_ACCESS_MODE.READ,
  timeout: 10000,
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  isDestructive: () => false,

  async call(args, options = {}) {
    const cwd = options.context?.cwd || process.cwd();
    const { message, attachments, status = 'normal' } = args;

    if (!message || message.trim().length === 0) {
      return { success: false, error: 'Message is required' };
    }

    // Validate attachments if provided
    let resolvedAttachments = [];
    if (attachments && attachments.length > 0) {
      const validation = await validateAttachments(attachments, cwd);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }
      resolvedAttachments = validation.attachments;
    }

    return {
      success: true,
      message: message.trim(),
      attachments: resolvedAttachments,
      status,
      sentAt: new Date().toISOString(),
    };
  },
};