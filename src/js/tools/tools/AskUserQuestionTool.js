/**
 * Ask User Question Tool - Multi-choice question dialog
 * @module tools/tools/AskUserQuestionTool
 */

import { TOOL_ACCESS_MODE } from '../core/Tool.js';
import { appState } from '../../state/appState.js';

let _ipcRenderer = null;
try {
  // Will be set via injectIpcRenderer if in Electron
} catch {}

/**
 * Inject IPC renderer (call this from main.js in Electron context)
 */
export function injectIpcRenderer(ipc) {
  _ipcRenderer = ipc;
}

export const AskUserQuestionTool = {
  name: 'ask_user_question',
  description: '向用户提问以获取澄清信息。支持多选项选择题。',
  inputSchema: {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            question: { type: 'string', description: '完整问题' },
            header: { type: 'string', description: '简短标签（最多12字符）' },
            options: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string', description: '选项标签' },
                  description: { type: 'string', description: '选项说明' },
                },
                required: ['label'],
              },
              minItems: 2,
              maxItems: 4,
            },
            multi_select: { type: 'boolean', description: '是否允许多选' },
          },
          required: ['question', 'header', 'options'],
        },
        minItems: 1,
        maxItems: 4,
      },
    },
    required: ['questions'],
  },
  accessMode: TOOL_ACCESS_MODE.READ,
  timeout: 120000, // Long timeout since user needs to respond
  isReadOnly: () => true,
  isConcurrencySafe: () => false,
  isDestructive: () => false,
  isPrivacyRisk: () => true, // Collects user input

  async call(args, options = {}) {
    const { questions } = args;

    // Validate questions
    if (!questions || questions.length === 0) {
      return { success: false, error: 'At least one question is required' };
    }

    // Check for duplicate question texts
    const questionTexts = questions.map(q => q.question);
    if (new Set(questionTexts).size !== questionTexts.length) {
      return { success: false, error: 'Question texts must be unique' };
    }

    // Check for duplicate option labels within each question
    for (const q of questions) {
      const labels = q.options.map(o => o.label);
      if (new Set(labels).size !== labels.length) {
        return { success: false, error: `Option labels in question "${q.header}" must be unique` };
      }
    }

    // Store pending question in state
    const questionId = 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const pendingQuestion = {
      id: questionId,
      questions,
      timestamp: Date.now(),
      answered: false,
      answers: {},
    };

    // Save to state for retrieval
    const pendingKey = 'pending_question';
    const pending = appState.get(pendingKey, {});
    pending[questionId] = pendingQuestion;
    appState.set(pendingKey, pending);

    // Try Electron IPC dialog if available
    if (_ipcRenderer) {
      try {
        const result = await _ipcRenderer.invoke('ASK_USER_QUESTION', { questions });
        // Mark as answered
        pendingQuestion.answered = true;
        pendingQuestion.answers = result.answers || {};
        appState.set(pendingKey, pending);
        return {
          success: true,
          question_id: questionId,
          answers: result.answers || {},
        };
      } catch (e) {
        console.warn('[ASK_USER_QUESTION] IPC dialog failed:', e.message);
      }
    }

    // Fallback: return structured question for user to answer manually
    // The user should respond with their answer
    return {
      success: true,
      question_id: questionId,
      pending: true,
      message: 'Please answer the following question(s):',
      questions: questions.map(q => ({
        question: q.question,
        header: q.header,
        options: q.options.map(o => ({
          label: o.label,
          description: o.description || '',
        })),
        multi_select: q.multi_select || false,
      })),
      instructions: 'Use the ask_user_question tool again with your answer, or type your answer directly.',
    };
  },
};

/**
 * Get pending question by ID (for user to retrieve their answer)
 */
export function getPendingQuestion(questionId) {
  const pending = appState.get('pending_question', {});
  return pending[questionId] || null;
}

/**
 * Submit answer to a pending question
 */
export function submitAnswer(questionId, answers) {
  const pendingKey = 'pending_question';
  const pending = appState.get(pendingKey, {});
  if (pending[questionId]) {
    pending[questionId].answered = true;
    pending[questionId].answers = answers;
    appState.set(pendingKey, pending);
    return true;
  }
  return false;
}
