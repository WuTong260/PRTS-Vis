/**
 * Todo Write Tool - Session task checklist management
 * @module tools/tools/TodoWriteTool
 */

import { TOOL_ACCESS_MODE } from '../core/Tool.js';
import { appState } from '../../state/appState.js';

/**
 * @typedef {Object} TodoItem
 * @property {string} content - Task description
 * @property {'in_progress'|'pending'|'completed'} status
 * @property {string} [activeForm] - Present continuous form
 */

/**
 * Get session-specific todo key
 */
function getTodoKey(sessionId = 'default') {
  return `todos:${sessionId}`;
}

/**
 * Get current todos for session
 */
function getTodos(sessionId) {
  return appState.get(getTodoKey(sessionId), []);
}

export const TodoWriteTool = {
  name: 'todo_write',
  description: '管理会话任务清单。更新待办事项列表状态。',
  inputSchema: {
    type: 'object',
    properties: {
      todos: {
        type: 'array',
        description: '更新后的 todo 列表',
        items: {
          type: 'object',
          properties: {
            content: { type: 'string', description: '任务描述' },
            status: {
              type: 'string',
              enum: ['in_progress', 'pending', 'completed'],
              description: '任务状态' },
            activeForm: { type: 'string', description: '进行时形式（如"修复Bug"）' },
          },
          required: ['content', 'status'],
        },
      },
    },
    required: ['todos'],
  },
  accessMode: TOOL_ACCESS_MODE.READ,
  timeout: 5000,
  isReadOnly: () => false,
  isConcurrencySafe: () => false,
  isDestructive: () => false,

  async call(args, options = {}) {
    const { todos = [] } = args;
    const sessionId = options.context?.sessionId || 'default';
    const todoKey = getTodoKey(sessionId);

    // Get old todos for comparison
    const oldTodos = getTodos(sessionId);

    // Validate todos
    if (!Array.isArray(todos)) {
      return { success: false, error: 'todos must be an array' };
    }

    // Check for duplicate content
    const contents = todos.map(t => t.content);
    if (new Set(contents).size !== contents.length) {
      return { success: false, error: 'Todo contents must be unique' };
    }

    // If all todos are completed, clear the list ( Claude Code behavior)
    const allDone = todos.length > 0 && todos.every(t => t.status === 'completed');
    const newTodos = allDone ? [] : todos;

    // Update state
    appState.set(todoKey, newTodos);

    return {
      success: true,
      old_todos: oldTodos,
      new_todos: newTodos,
      message: allDone
        ? 'All tasks completed. Todo list cleared.'
        : `Updated todo list: ${newTodos.length} item(s)`,
    };
  },
};

/**
 * Get current todos (utility for other tools)
 */
export function getCurrentTodos(sessionId = 'default') {
  return getTodos(sessionId);
}

/**
 * Check if there are in-progress todos
 */
export function hasActiveTodos(sessionId = 'default') {
  const todos = getTodos(sessionId);
  return todos.some(t => t.status === 'in_progress');
}
