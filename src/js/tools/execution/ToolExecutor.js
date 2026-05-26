/**
 * Tool Executor - Execution with hooks, confirmation, and summarization
 * @module tools/execution/ToolExecutor
 */

import { toolRegistry } from '../core/ToolRegistry.js';
import { resultSummarizer } from '../formatters/ResultSummarizer.js';

export const TOOL_PERMISSIONS = {
  AUTO_ALLOW: 'auto_allow',
  REQUIRES_CONFIRM: 'confirm',
  DENIED: 'denied',
};

export class ToolExecutor {
  /**
   * @param {Object} orchestrator - ToolOrchestrator instance
   * @param {Object} options
   * @param {Function} [options.onProgress]
   * @param {Function} [options.ipcRenderer] - Electron IPC renderer
   * @param {Object} [options.degradationStrategies]
   */
  constructor(orchestrator, options = {}) {
    this.orchestrator = orchestrator;
    this.onProgress = options.onProgress || (() => {});
    this.ipcRenderer = options.ipcRenderer || null;
    this.degradationStrategies = options.degradationStrategies || {};
    this.summarizer = options.summarizer || resultSummarizer;
    this.maxRetries = options.maxRetries || 3;
  }

  /**
   * Execute tool with full lifecycle: hooks, confirmation, execution, summary
   * @param {Object} call - {id, name, arguments}
   * @param {Object} context
   * @returns {Promise<Object>} ToolResult
   */
  async execute(call, context = {}) {
    const tool = toolRegistry.get(call.name);

    // Permission check
    const permission = await this.checkPermission(tool, call, context);
    if (!permission.granted) {
      if (permission.requiresConfirm) {
        const confirmed = await this.requestUserConfirmation(tool, call, context);
        if (!confirmed.approved) {
          return this._deniedResult(call, confirmed.reason || 'User declined');
        }
        if (confirmed.modifiedArgs) {
          call = { ...call, arguments: confirmed.modifiedArgs };
        }
      } else {
        return this._deniedResult(call, permission.reason);
      }
    }

    // Execute via orchestrator
    let result = await this.orchestrator.executeSingle(call);

    // Error handling with retry and degradation
    if (!result.success) {
      const handled = this._handleError(result, call, context);
      if (handled.retryable && result.attempt < this.maxRetries) {
        result = await this._executeWithRetry(call, context, result.attempt || 0);
      }
    }

    // Summarize large results
    if (result.success && result.data) {
      const summary = this.summarizer.summarize(result.data);
      result.data = summary.summarized ? summary.summary : result.data;
      result._context = {
        summarized: summary.summarized,
        originalSizeKB: summary.sizeKB,
      };
    }

    return result;
  }

  /**
   * Check if tool requires confirmation
   */
  async checkPermission(tool, call, context) {
    if (!tool) {
      return { granted: false, reason: 'Unknown tool' };
    }

    // Check explicit permission policy
    if (tool.permissionPolicy === TOOL_PERMISSIONS.DENIED) {
      return { granted: false, reason: 'Tool permanently denied by policy' };
    }
    if (tool.permissionPolicy === TOOL_PERMISSIONS.AUTO_ALLOW) {
      return { granted: true };
    }

    // Check danger flags
    const isDestructive = tool.isDestructive?.(call.arguments);
    const isPrivacyRisk = tool.isPrivacyRisk?.(call.arguments);
    const isSystemModification = tool.isSystemModification?.(call.arguments);

    if (isDestructive || isSystemModification) {
      return { granted: false, requiresConfirm: true, reason: 'Destructive operation' };
    }
    if (isPrivacyRisk) {
      return { granted: false, requiresConfirm: true, reason: 'Privacy-sensitive operation' };
    }

    return { granted: true };
  }

  /**
   * Request user confirmation via Electron IPC
   */
  async requestUserConfirmation(tool, call, context) {
    if (!this.ipcRenderer) {
      console.warn('[TOOL.EXECUTOR] No IPC renderer, auto-denying confirmation');
      return { approved: false, reason: 'No IPC channel' };
    }

    const payload = {
      toolName: tool.name,
      description: tool.description,
      args: call.arguments,
      warnings: this.getWarnings(tool, call.arguments),
    };

    try {
      return await Promise.race([
        this.ipcRenderer.invoke('TOOL_CONFIRM', payload),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 30000)
        ),
      ]);
    } catch (err) {
      return { approved: false, reason: 'Confirmation request failed or timeout' };
    }
  }

  /**
   * Get warnings for user confirmation dialog
   */
  getWarnings(tool, args) {
    const warnings = [];
    if (tool.isDestructive?.(args)) {
      warnings.push('此操作可能会修改系统状态');
    }
    if (tool.isPrivacyRisk?.(args)) {
      warnings.push('此操作可能访问敏感数据');
    }
    if (tool.isSystemModification?.(args)) {
      warnings.push('此操作会修改系统配置');
    }
    if (tool.isLongRunning?.(args)) {
      warnings.push('此操作可能需要较长时间');
    }
    return warnings;
  }

  /**
   * Handle tool errors with degradation strategies
   */
  _handleError(result, call, context) {
    const strategy = this.degradationStrategies[call.name];

    if (strategy) {
      try {
        const degraded = strategy(result.error, call);
        return { ...degraded, degraded: true };
      } catch (e) {
        // Degradation failed
      }
    }

    // Check if error is retryable
    if (result.errorType === 'VALIDATION_ERROR') {
      return { retryable: false, shouldReturnCorrectionContext: true };
    }

    if (result.errorType === 'TimeoutError' || result.errorType === 'AbortError') {
      return { retryable: true };
    }

    return { retryable: true };
  }

  /**
   * Retry with exponential backoff
   */
  async _executeWithRetry(call, context, attempt) {
    const backoff = Math.min(1000 * Math.pow(2, attempt), 10000);
    await new Promise(resolve => setTimeout(resolve, backoff));

    const newCall = { ...call, attempt: attempt + 1 };
    return this.orchestrator.executeSingle(newCall);
  }

  /**
   * Format denied result
   */
  _deniedResult(call, reason) {
    return {
      id: call.id,
      name: call.name,
      success: false,
      error: reason,
      errorType: 'PermissionDenied',
      meta: { toolName: call.name, reason: 'permission_denied' },
    };
  }
}