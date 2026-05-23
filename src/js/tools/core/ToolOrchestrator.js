/**
 * Tool Orchestrator - Parallel/Serial execution dispatch with ReadWriteLock
 * @module tools/core/ToolOrchestrator
 */

import { toolRegistry } from './ToolRegistry.js';
import { lockManager } from './ReadWriteLock.js';
import { TOOL_ACCESS_MODE } from './Tool.js';

export class ToolOrchestrator {
  /**
   * @param {Object} options
   * @param {number} [options.maxConcurrency=10]
   * @param {Function} [options.onProgress]
   * @param {Object} [options.permissionContext]
   */
  constructor(options = {}) {
    this.maxConcurrency = options.maxConcurrency || 10;
    this.onProgress = options.onProgress || (() => {});
    this.permissionContext = options.permissionContext || {};
  }

  /**
   * Execute multiple tool calls with appropriate strategy
   * @param {Array<{id: string, name: string, arguments: Object}>} calls
   * @returns {AsyncGenerator<Object>}
   */
  async *executeBatch(calls, context = {}) {
    if (!calls || calls.length === 0) return;

    // Partition by concurrency safety
    const batches = this.partitionByConcurrency(calls);

    for (const batch of batches) {
      if (batch.concurrent) {
        yield* this.executeConcurrently(batch.calls, context);
      } else {
        yield* this.executeSerially(batch.calls, context);
      }
    }
  }

  /**
   * Partition calls into concurrent-safe and exclusive batches
   */
  partitionByConcurrency(calls) {
    const batches = [];
    let readBatch = [];
    let writeBatch = [];
    let exclusiveBatch = [];

    for (const call of calls) {
      const tool = toolRegistry.get(call.name);

      if (!tool) {
        console.warn(`[TOOL.ORCHESTRATOR] Unknown tool: ${call.name}`);
        continue;
      }

      // Check access mode
      const accessMode = tool.accessMode || TOOL_ACCESS_MODE.READ;
      const isReadOnly = tool.isReadOnly?.(call.arguments) ?? (accessMode === TOOL_ACCESS_MODE.READ);

      // Exclusive tools always run serially with their own lock
      if (accessMode === TOOL_ACCESS_MODE.EXCLUSIVE) {
        if (readBatch.length > 0) {
          batches.push({ concurrent: true, calls: readBatch });
          readBatch = [];
        }
        if (writeBatch.length > 0) {
          batches.push({ concurrent: false, calls: writeBatch });
          writeBatch = [];
        }
        exclusiveBatch.push(call);
        batches.push({ concurrent: false, calls: exclusiveBatch, requiresLock: true, resourceId: call.name });
        exclusiveBatch = [];
        continue;
      }

      if (isReadOnly) {
        readBatch.push(call);
      } else {
        // Write operation - flush read batch first
        if (readBatch.length > 0) {
          batches.push({ concurrent: true, calls: readBatch });
          readBatch = [];
        }
        writeBatch.push(call);
      }
    }

    // Flush remaining
    if (readBatch.length > 0) {
      batches.push({ concurrent: true, calls: readBatch });
    }
    if (writeBatch.length > 0) {
      batches.push({ concurrent: false, calls: writeBatch });
    }

    return batches;
  }

  /**
   * Execute read-only tools in parallel
   */
  async *executeConcurrently(calls, context) {
    const promises = calls.map(call => this.executeSingleWithLock(call, context));
    for (const promise of promises) {
      yield await promise;
    }
  }

  /**
   * Execute write/destructive tools serially
   */
  async *executeSerially(calls, context) {
    for (const call of calls) {
      yield await this.executeSingleWithLock(call, context);
    }
  }

  /**
   * Execute single tool with appropriate lock
   */
  async executeSingleWithLock(call, context) {
    const tool = toolRegistry.get(call.name);
    if (!tool) {
      return this._formatError(call, `Unknown tool: ${call.name}`);
    }

    const accessMode = tool.accessMode || TOOL_ACCESS_MODE.READ;
    const resourceId = tool.getResourceId?.(call.arguments) || call.name;

    if (accessMode === TOOL_ACCESS_MODE.EXCLUSIVE || !tool.isReadOnly?.(call.arguments)) {
      // Write lock
      return await lockManager.withWriteLock(resourceId, () => this.executeSingle(call, context));
    } else {
      // Read lock
      return await lockManager.withReadLock(resourceId, () => this.executeSingle(call, context));
    }
  }

  /**
   * Execute single tool (no lock management)
   */
  async executeSingle(call, context) {
    const tool = toolRegistry.get(call.name);
    if (!tool) {
      return this._formatError(call, `Unknown tool: ${call.name}`);
    }

    // 1. Input validation
    if (tool._validator) {
      try {
        tool._validator.validateOrThrow(call.arguments);
      } catch (validationError) {
        return {
          id: call.id,
          name: call.name,
          success: false,
          error: validationError.message,
          errorType: 'VALIDATION_ERROR',
          correctionContext: validationError.correctionContext,
        };
      }
    }

    // 2. Permission check
    if (!this._checkPermissions(tool, call.arguments)) {
      return this._formatError(call, 'Permission denied', 'PermissionError');
    }

    // 3. Execute with progress
    this.onProgress({ type: 'start', toolUseID: call.id, toolName: tool.name });
    const startTime = Date.now();

    try {
      const result = await this._executeWithTimeout(tool, call.arguments);
      const duration = Date.now() - startTime;

      this.onProgress({ type: 'complete', toolUseID: call.id, duration });

      return {
        id: call.id,
        name: tool.name,
        success: true,
        data: result,
        meta: { duration, toolName: tool.name },
      };
    } catch (error) {
      return this._handleToolError(call, tool, error);
    }
  }

  async _executeWithTimeout(tool, args) {
    const timeout = tool.timeout || 60000;
    return Promise.race([
      tool.call(args),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Tool timeout after ${timeout}ms`)), timeout)
      ),
    ]);
  }

  _checkPermissions(tool, args) {
    const rules = this.permissionContext.rules || {};
    const toolRules = rules[tool.name] || {};

    if (toolRules.mode === 'deny') return false;
    if (toolRules.mode === 'ask' && !toolRules.approved) return false;

    return true;
  }

  _handleToolError(call, tool, error) {
    return {
      id: call.id,
      name: tool.name,
      success: false,
      error: error.message,
      errorType: error.name || 'ExecutionError',
      meta: { toolName: tool.name },
    };
  }

  _formatError(call, message, errorCode = 'UnknownError') {
    return {
      id: call.id,
      name: call.name,
      success: false,
      error: message,
      meta: { errorCode, toolName: call.name },
    };
  }
}