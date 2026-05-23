/**
 * Compaction Manager - Context compression with semantic-aware truncation and rolling summary
 * @module context/compactionManager
 */

import {
  estimateMessagesTokens,
  estimateMessageTokens,
  checkCompactionThreshold,
  detectModelPrefix,
  MODEL_BUFFERS,
} from './tokenCounter.js';

/**
 * Truncation strategy matrix by tool type
 * maxAge: 保留多少条旧消息（Infinity = 尽量保留）
 * maxChars: 最大字符数
 */
export const TRUNCATION_STRATEGY = {
  'read_file':           { maxAge: Infinity, maxChars: 2000, priority: 1 },
  'analyze_config_leak': { maxAge: Infinity, maxChars: 1500, priority: 2 },
  'query_local_cve':    { maxAge: 5, maxChars: 1000, priority: 3 },
  'fetch_online_cve':   { maxAge: 3, maxChars: 1200, priority: 3 },
  'glob':               { maxAge: 2, maxChars: 500, priority: 5 },
  'grep':               { maxAge: 2, maxChars: 800, priority: 4 },
  'bash':               { maxAge: 1, maxChars: 300, priority: 6 },
  'write_file':         { maxAge: Infinity, maxChars: 500, priority: 2 },
  'default':            { maxAge: 1, maxChars: 300, priority: 6 },
};

/**
 * Get truncation depth based on message age and tool type
 * @param {Object} message
 * @param {number} messageIndex
 * @param {number} totalMessages
 * @returns {{maxChars: number, marker: string}}
 */
function getTruncationDepth(message, messageIndex, totalMessages) {
  const toolName = message.name || message.tool_name || 'default';
  const strategy = TRUNCATION_STRATEGY[toolName] || TRUNCATION_STRATEGY.default;

  const age = totalMessages - messageIndex;

  // 越老的消息截得越狠
  if (age > strategy.maxAge && strategy.maxAge !== Infinity) {
    return { maxChars: 100, marker: ' [已省略]' };
  }
  if (age > strategy.maxAge / 2 && strategy.maxAge !== Infinity) {
    return { maxChars: Math.floor(strategy.maxChars / 2), marker: ' [部分省略]' };
  }

  return { maxChars: strategy.maxChars, marker: '' };
}

/**
 * Default summary prompt template
 */
const DEFAULT_SUMMARY_PROMPT = `请简洁地总结以下对话的核心内容，生成一个全局状态快照。

=== 对话历史 ===
{history}
===============

请以 JSON 格式输出：
{{
  "summary": "3-5句话核心总结",
  "keyDecisions": ["决定1", "决定2"],
  "pendingIssues": ["未解决问题"]
}}

只输出 JSON，不要有其他内容。`;

export class CompactionManager {
  /**
   * @param {Object} options
   * @param {number} [options.maxContextTokens=80000] - 最大上下文 token 数
   * @param {number} [options.warningThreshold=0.70] - 警告阈值
   * @param {number} [options.autoCompactThreshold=0.85] - 自动压缩阈值
   * @param {number} [options.preserveLatest=8] - SNIP 后保留最近消息数
   */
  constructor(options = {}) {
    this.maxContextTokens = options.maxContextTokens || 80000;
    this.warningThreshold = options.warningThreshold || 0.70;
    this.autoCompactThreshold = options.autoCompactThreshold || 0.85;
    this.preserveLatest = options.preserveLatest || 8;

    // 覆盖式摘要状态
    this.globalSnapshot = null;  // { summary, keyDecisions, pendingIssues, timestamp }

    // 错误补偿状态
    this.consecutiveErrors = 0;
    this.postErrorCompensation = 1.2;

    // 摘要提示词模板
    this.summaryPromptTemplate = options.summaryPromptTemplate || DEFAULT_SUMMARY_PROMPT;
  }

  /**
   * Check if compaction is needed
   * @param {Object[]} messages
   * @param {string} [modelPrefix]
   * @returns {'warning' | 'autocompact' | null}
   */
  checkCompactionNeeded(messages, modelPrefix) {
    const tokens = estimateMessagesTokens(messages, modelPrefix);
    return checkCompactionThreshold({
      currentTokens: tokens,
      maxContextTokens: this.maxContextTokens,
      warningThreshold: this.warningThreshold,
      autoCompactThreshold: this.autoCompactThreshold,
    });
  }

  /**
   * Get current estimated tokens
   * @param {Object[]} messages
   * @param {string} [modelPrefix]
   * @returns {number}
   */
  getEstimatedTokens(messages, modelPrefix) {
    return estimateMessagesTokens(messages, modelPrefix);
  }

  /**
   * Main compaction entry point
   * @param {Object[]} messages - Full message history
   * @param {Object} llmClient - LLM client with complete(prompt) method
   * @param {string} [modelPrefix]
   * @returns {Promise<Object[]>} Compacted messages
   */
  async compact(messages, llmClient, modelPrefix = 'default') {
    console.log('[COMPACTION] Starting compaction, messages:', messages.length);

    // Step 1: SNIP - 裁剪旧消息（保留 system + 最近 N 条非 system 消息）
    let compacted = this.snip(messages);
    console.log('[COMPACTION] After SNIP:', compacted.length, 'messages');

    // Step 2: TRUNCATE - 差异化截断
    compacted = this.truncateByStrategy(compacted);
    console.log('[COMPACTION] After TRUNCATE:', compacted.length, 'messages');

    // 检查是否需要 LLM 摘要
    const compactionNeeded = this.checkCompactionNeeded(compacted, modelPrefix);

    // 如果已有全局快照，第二次压缩直接使用快照
    if (compactionNeeded === 'autocompact' && this.globalSnapshot) {
      console.log('[COMPACTION] Using existing rolling snapshot');
      return this.buildFromSnapshot(messages);
    }

    // 需要 LLM 摘要
    if (compactionNeeded === 'autocompact') {
      compacted = await this.generateRollingSummary(compacted, llmClient, modelPrefix);
      console.log('[COMPACTION] After SUMMARY:', compacted.length, 'messages');
    }

    const finalTokens = estimateMessagesTokens(compacted, modelPrefix);
    console.log('[COMPACTION] Final estimated tokens:', finalTokens);

    return compacted;
  }

  /**
   * SNIP: 裁剪旧消息，保留 system + 最近 N 条
   * @param {Object[]} messages
   * @returns {Object[]}
   */
  snip(messages) {
    const systemMsg = messages.find(m => m.role === 'system');
    const nonSystem = messages.filter(m => m.role !== 'system');
    const recent = nonSystem.slice(-this.preserveLatest);

    const result = systemMsg ? [systemMsg, ...recent] : recent;
    console.log('[COMPACTION] SNIP: kept', result.length, 'of', messages.length, 'messages');
    return result;
  }

  /**
   * TRUNCATE: 差异化截断工具结果
   * @param {Object[]} messages
   * @returns {Object[]}
   */
  truncateByStrategy(messages) {
    const total = messages.length;

    return messages.map((msg, idx) => {
      // 只截断 tool role 消息
      if (msg.role !== 'tool') return msg;

      const depth = getTruncationDepth(msg, idx, total);
      const content = typeof msg.content === 'string'
        ? msg.content
        : JSON.stringify(msg.content);

      // 如果内容已经比限制短，不截断
      if (content.length <= depth.maxChars) return msg;

      return {
        ...msg,
        content: content.slice(0, depth.maxChars) + depth.marker,
        _truncated: true,
        _originalLength: content.length,
        _truncatedAt: Date.now(),
      };
    });
  }

  /**
   * Generate rolling summary (覆盖式摘要)
   * @param {Object[]} messages
   * @param {Object} llmClient
   * @param {string} modelPrefix
   * @returns {Promise<Object[]>}
   */
  async generateRollingSummary(messages, llmClient, modelPrefix) {
    const previousSnapshot = this.globalSnapshot;

    // 整合上下文：旧快照 + 新消息
    const historyText = this.formatMessagesForSummary(messages);
    const context = previousSnapshot
      ? `=== 前期快照 ===\n${previousSnapshot.summary}\n待办: ${previousSnapshot.pendingIssues?.join(', ')}\n===============\n\n=== 新消息 ===\n${historyText}`
      : historyText;

    // 构建提示词
    const prompt = this.summaryPromptTemplate.replace('{history}', context);

    try {
      console.log('[COMPACTION] Generating rolling summary...');
      const response = await llmClient.complete(prompt);

      // 解析 JSON 响应
      let snapshot;
      try {
        snapshot = JSON.parse(response.trim());
      } catch {
        // 降级：提取 JSON 部分
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          snapshot = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Failed to parse JSON');
        }
      }

      // 更新全局快照（覆盖式）
      this.globalSnapshot = {
        ...snapshot,
        timestamp: Date.now(),
        previousTimestamp: previousSnapshot?.timestamp,
      };

      console.log('[COMPACTION] New snapshot:', snapshot.summary?.slice(0, 50));

    } catch (e) {
      console.error('[COMPACTION] Summary failed:', e.message);
      // 降级：使用简单截断
      return this.snip(messages);
    }

    return this.buildFromSnapshot(messages);
  }

  /**
   * Build compacted message list from current snapshot
   * @param {Object[]} messages
   * @returns {Object[]}
   */
  buildFromSnapshot(messages) {
    const recent = messages.filter(m => m.role !== 'system').slice(-3);

    if (!this.globalSnapshot) {
      return recent;
    }

    const snapshotMsg = {
      role: 'user',
      content: `=== 对话状态快照 ===\n${this.globalSnapshot.summary}\n\n决定: ${this.globalSnapshot.keyDecisions?.join(', ') || '无'}\n待办: ${this.globalSnapshot.pendingIssues?.join(', ') || '无'}\n====================`,
      _isSnapshot: true,
      _snapshotTimestamp: this.globalSnapshot.timestamp,
    };

    return [snapshotMsg, ...recent];
  }

  /**
   * Format messages for summary prompt
   * @param {Object[]} messages
   * @returns {string}
   */
  formatMessagesForSummary(messages) {
    return messages
      .filter(m => m.role !== 'system')
      .slice(-20)  // 只取最近 20 条，避免 prompt 过长
      .map(m => {
        const content = typeof m.content === 'string'
          ? m.content
          : JSON.stringify(m.content).slice(0, 300);
        return `[${m.role}${m.name ? `(${m.name})` : ''}]: ${content}`;
      })
      .join('\n');
  }

  /**
   * Handle context overflow error - 后验式补偿
   * @param {Object[]} messages
   * @returns {number} emergency buffer tokens to use
   */
  handleContextOverflow(messages) {
    this.consecutiveErrors++;
    const factor = 1 + (this.consecutiveErrors - 1) * 0.1;

    const emergencyBuffer = Math.floor(
      (MODEL_BUFFERS.default?.overflowMargin || 5000) * factor
    );

    console.log(`[COMPACTION] Context overflow #${this.consecutiveErrors}, emergency buffer: ${emergencyBuffer} tokens`);

    // 紧急收紧：减少保留量
    this.preserveLatest = Math.max(3, this.preserveLatest - 1);

    return emergencyBuffer;
  }

  /**
   * Reset compaction state (e.g., when chat is cleared)
   */
  reset() {
    this.globalSnapshot = null;
    this.consecutiveErrors = 0;
    this.preserveLatest = 8;
    console.log('[COMPACTION] State reset');
  }

  /**
   * Get current snapshot for display
   * @returns {Object|null}
   */
  getSnapshot() {
    return this.globalSnapshot;
  }
}