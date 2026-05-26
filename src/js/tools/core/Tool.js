/**
 * Tool System Core Types
 * @module tools/core/Tool
 */

/**
 * @typedef {Object} ToolResult
 * @property {boolean} success
 * @property {*} [data]
 * @property {string} [error]
 * @property {Object} [meta]
 */

/**
 * @typedef {Object} ToolCall
 * @property {string} id
 * @property {string} name
 * @property {Object} arguments
 */

/**
 * @typedef {Object} ProgressEvent
 * @property {string} toolUseID
 * @property {string} type - 'start' | 'progress' | 'complete' | 'error'
 * @property {Object} [data]
 */

export const TOOL_RESULT_STATUS = {
  SUCCESS: 'success',
  ERROR: 'error',
  PARTIAL: 'partial',
};

export const TOOL_ACCESS_MODE = {
  READ: 'read',
  WRITE: 'write',
  EXCLUSIVE: 'exclusive',
};

export const TOOL_PERMISSIONS = {
  AUTO_ALLOW: 'auto_allow',
  REQUIRES_CONFIRM: 'confirm',
  DENIED: 'denied',
};

/**
 * @typedef {Object} Tool
 * @property {string} name
 * @property {string} description
 * @property {Object} inputSchema
 * @property {string} [category]
 * @property {number} [timeout]
 * @property {Function} call
 * @property {Function} [isConcurrencySafe]
 * @property {Function} [isReadOnly]
 * @property {Function} [isDestructive]
 * @property {Function} [isPrivacyRisk]
 * @property {Function} [isSystemModification]
 * @property {Function} [validateInput]
 * @property {Function} [renderProgress]
 * @property {Function} [renderResult]
 * @property {Function} [getResourceId]
 */