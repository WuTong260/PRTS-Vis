/**
 * Token Counter - Estimates token count for messages with model-specific coefficients
 * @module context/tokenCounter
 */

/**
 * Model-specific buffer coefficients
 * safetyMargin: 估算时乘以此系数留出安全边距
 * overflowMargin: context overflow 后额外预留的 token 数
 */
export const MODEL_BUFFERS = {
  'claude': { safetyMargin: 0.85, overflowMargin: 15000 },
  'gpt-4':  { safetyMargin: 0.80, overflowMargin: 4000 },
  'gpt-3.5':{ safetyMargin: 0.75, overflowMargin: 2000 },
  'deepseek': { safetyMargin: 0.82, overflowMargin: 8000 },
  'default': { safetyMargin: 0.80, overflowMargin: 5000 },
};

/**
 * Detect model prefix from model name string
 * @param {string} modelName
 * @returns {string} model prefix key
 */
export function detectModelPrefix(modelName) {
  if (!modelName) return 'default';
  const lower = modelName.toLowerCase();

  if (lower.includes('claude')) return 'claude';
  if (lower.includes('gpt-4') || lower.includes('gpt4')) return 'gpt-4';
  if (lower.includes('gpt-3.5') || lower.includes('gpt3.5')) return 'gpt-3.5';
  if (lower.includes('deepseek')) return 'deepseek';

  return 'default';
}

/**
 * Estimate tokens in a text string
 * Chinese: ~2 tokens/char, English: ~0.75 tokens/word
 * @param {string} text
 * @param {string} modelPrefix
 * @returns {number} estimated tokens
 */
export function estimateTokens(text, modelPrefix = 'default') {
  if (!text) return 0;

  const buffer = MODEL_BUFFERS[modelPrefix] || MODEL_BUFFERS.default;
  const chinese = (text.match(/[一-龥]/g) || []).length;
  const english = text.split(/\s+/).filter(Boolean).length;
  const raw = chinese * 2 + english * 0.75 + text.length * 0.25;

  return Math.ceil(raw * buffer.safetyMargin);
}

/**
 * Estimate tokens in a message object
 * @param {Object} message - { role, content, tool_calls, etc }
 * @param {string} modelPrefix
 * @returns {number} estimated tokens
 */
export function estimateMessageTokens(message, modelPrefix = 'default') {
  if (!message) return 0;

  let content = '';
  if (typeof message.content === 'string') {
    content = message.content;
  } else if (Array.isArray(message.content)) {
    // Multi-modal content (images, etc) - estimate text parts
    content = message.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join(' ');
  } else if (message.content) {
    content = JSON.stringify(message.content);
  }

  // Tool call overhead
  let toolOverhead = 50;
  if (message.tool_calls && message.tool_calls.length > 0) {
    toolOverhead = 80 * message.tool_calls.length;
  }
  if (message.role === 'tool') {
    toolOverhead += 30;
  }

  // Base message overhead (role, brackets, etc)
  const roleOverhead = message.role === 'system' ? 10 : (message.role === 'assistant' ? 15 : 10);

  return estimateTokens(content, modelPrefix) + toolOverhead + roleOverhead;
}

/**
 * Estimate tokens for an array of messages
 * @param {Object[]} messages
 * @param {string} modelPrefix
 * @returns {number} total estimated tokens
 */
export function estimateMessagesTokens(messages, modelPrefix = 'default') {
  if (!messages || !Array.isArray(messages)) return 0;

  return messages.reduce((sum, msg) => sum + estimateMessageTokens(msg, modelPrefix), 0);
}

/**
 * Format token count for display
 * @param {number} tokens
 * @returns {string}
 */
export function formatTokens(tokens) {
  if (tokens < 1000) return `${tokens}`;
  if (tokens < 10000) return `${(tokens / 1000).toFixed(1)}K`;
  return `${(tokens / 1000).toFixed(1)}K`;
}

/**
 * Check if compaction is needed based on current usage
 * @param {Object} options
 * @param {number} options.currentTokens - Current estimated tokens
 * @param {number} options.maxContextTokens - Max context window
 * @param {number} [options.warningThreshold=0.70]
 * @param {number} [options.autoCompactThreshold=0.85]
 * @returns {'warning' | 'autocompact' | null}
 */
export function checkCompactionThreshold(options) {
  const {
    currentTokens,
    maxContextTokens,
    warningThreshold = 0.70,
    autoCompactThreshold = 0.85,
  } = options;

  const ratio = currentTokens / maxContextTokens;

  if (ratio >= autoCompactThreshold) return 'autocompact';
  if (ratio >= warningThreshold) return 'warning';
  return null;
}