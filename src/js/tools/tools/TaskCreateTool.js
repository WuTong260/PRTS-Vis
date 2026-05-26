/**
 * Task Create Tool - Create tasks in the task list
 * @module tools/tools/TaskCreateTool
 */

import { TOOL_ACCESS_MODE } from '../core/Tool.js';
import { appState } from '../../state/appState.js';

/**
 * Generate a unique task ID
 */
function generateTaskId() {
  return 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

/**
 * Get task list for session
 */
function getTaskList(sessionId = 'default') {
  return appState.get(`tasks:${sessionId}`, []);
}

/**
 * Create a new task
 */
async function createTask(sessionId, taskData) {
  const taskList = getTaskList(sessionId);
  const newTask = {
    id: generateTaskId(),
    subject: taskData.subject,
    description: taskData.description || '',
    activeForm: taskData.activeForm || '',
    status: taskData.status || 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  taskList.push(newTask);
  appState.set(`tasks:${sessionId}`, taskList);

  return newTask;
}

export const TaskCreateTool = {
  name: 'task_create',
  description: '创建新任务到任务列表',
  inputSchema: {
    type: 'object',
    properties: {
      subject: {
        type: 'string',
        description: '任务标题',
      },
      description: {
        type: 'string',
        optional: true,
        description: '任务详细描述',
      },
      activeForm: {
        type: 'string',
        optional: true,
        description: '进行时形式（如"正在修复Bug"）',
      },
    },
    required: ['subject'],
  },
  accessMode: TOOL_ACCESS_MODE.WRITE,
  timeout: 5000,
  isReadOnly: () => false,
  isConcurrencySafe: () => false,
  isDestructive: () => false,

  async call(args, options = {}) {
    const sessionId = options.context?.sessionId || 'default';

    if (!args.subject || args.subject.trim().length === 0) {
      return { success: false, error: 'Subject is required' };
    }

    try {
      const task = await createTask(sessionId, {
        subject: args.subject.trim(),
        description: args.description || '',
        activeForm: args.activeForm || '',
        status: 'pending',
      });

      return {
        success: true,
        task: {
          id: task.id,
          subject: task.subject,
          description: task.description,
          activeForm: task.activeForm,
          status: task.status,
          createdAt: task.createdAt,
        },
        message: `Task created: ${task.subject}`,
      };
    } catch (error) {
      return { success: false, error: `Failed to create task: ${error.message}` };
    }
  },
};