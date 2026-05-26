export var AGENT_SYSTEM_PROMPT = '你是 PRTS (Primary Research and Tactical System) 安全审计内核。你是一个硬核、专业、冷静的自动化安全专家。你的职责是协助用户进行本地漏洞库查询、在线威胁情报抓取以及配置文件审计。不要提及你是由哪家公司开发的，也不要自称为特定的大模型名称。如果用户询问，请回答：『我是 PRTS 安全审计内核，当前正在执行 tactical 终端任务。』\n\n当调用工具并得到返回数据后，你必须使用以下格式输出点对点的分析报告：\n### [THREAT] [组件或漏洞名称]\n- **Evidence（证据）**: ...\n- **Explainer（原理）**: ...\n- **Action（修复建议）**: ...\n\n你可以综合本地工具和在线抓取工具的数据。如果是通过在线工具获取的情报，请在报告的 Evidence 中标注 [DATA_SOURCE: ONLINE]。';

export var TOOLS_SCHEMA = [
  {
    type: 'function',
    function: {
      name: 'analyze_config_leak',
      description: 'Analyze a configuration text for hardcoded credentials such as passwords, access keys (AK), or secret keys (SK). Returns a vulnerability assessment.',
      parameters: {
        type: 'object',
        properties: {
          config_text: {
            type: 'string',
            description: 'The configuration content to scan for credential leaks.',
          },
        },
        required: ['config_text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_local_cve',
      description: '查询本地离线漏洞库。当用户询问某软件或系统版本是否存在安全漏洞时调用此工具。返回匹配的 CVE 列表。',
      parameters: {
        type: 'object',
        properties: {
          software_name: {
            type: 'string',
            description: '软件名称，如 redis、nginx、log4j、openssh 等',
          },
          version: {
            type: 'string',
            description: '软件版本号，如 5.0.5。如果用户未提供版本则传 unknown',
          },
        },
        required: ['software_name', 'version'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fetch_online_cve',
      description: '当本地漏洞库无法命中，或者用户明确要求查询最新网络情报时，调用此工具获取外部 CVE 数据库的实时数据。',
      parameters: {
        type: 'object',
        properties: {
          software_name: {
            type: 'string',
            description: '要查询的软件名称，如 redis、log4j、openssh 等',
          },
        },
        required: ['software_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: '读取文件内容。用于查看源代码、配置文件、文档等。',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '文件路径（相对于 cwd）',
          },
          offset: {
            type: 'number',
            description: '起始行号（默认 1）',
          },
          limit: {
            type: 'number',
            description: '读取行数限制',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: '创建或覆盖文件内容',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '文件路径',
          },
          content: {
            type: 'string',
            description: '文件内容',
          },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'glob',
      description: '搜索匹配 glob 模式的文件',
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'Glob 模式，如 *.js, **/*.ts',
          },
          path: {
            type: 'string',
            description: '搜索目录（默认 cwd）',
          },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'grep',
      description: '在文件中搜索包含指定文本的行',
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: '搜索模式（支持正则）',
          },
          path: {
            type: 'string',
            description: '搜索目录',
          },
          case_sensitive: {
            type: 'boolean',
            description: '是否区分大小写',
          },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'bash',
      description: '执行 bash 命令。用于文件操作、Git 命令、构建脚本等。',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: '要执行的命令',
          },
          cwd: {
            type: 'string',
            description: '工作目录',
          },
          timeout: {
            type: 'number',
            description: '超时（毫秒）',
          },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_fetch',
      description: '获取网页内容',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: '网页 URL',
          },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit',
      description: '编辑文件内容。传入旧字符串和新字符串，精确替换文件中的指定文本。',
      parameters: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: '文件路径',
          },
          old_string: {
            type: 'string',
            description: '要替换的原始文本',
          },
          new_string: {
            type: 'string',
            description: '替换后的新文本',
          },
          replace_all: {
            type: 'boolean',
            description: '是否替换所有匹配项（默认 false）',
          },
        },
        required: ['file_path', 'old_string', 'new_string'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ask_user_question',
      description: '向用户提问以获取澄清信息。支持多选项选择题。',
      parameters: {
        type: 'object',
        properties: {
          questions: {
            type: 'array',
            description: '问题列表（1-4个问题）',
            items: {
              type: 'object',
              properties: {
                question: {
                  type: 'string',
                  description: '完整问题',
                },
                header: {
                  type: 'string',
                  description: '简短标签（最多12字符）',
                },
                options: {
                  type: 'array',
                  description: '选项列表（2-4个）',
                  items: {
                    type: 'object',
                    properties: {
                      label: { type: 'string' },
                      description: { type: 'string' },
                    },
                  },
                },
                multi_select: {
                  type: 'boolean',
                  description: '是否允许多选',
                },
              },
            },
          },
        },
        required: ['questions'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'todo_write',
      description: '管理会话任务清单。更新待办事项列表状态。',
      parameters: {
        type: 'object',
        properties: {
          todos: {
            type: 'array',
            description: '更新后的 todo 列表',
            items: {
              type: 'object',
              properties: {
                content: {
                  type: 'string',
                  description: '任务描述',
                },
                status: {
                  type: 'string',
                  enum: ['in_progress', 'pending', 'completed'],
                  description: '任务状态',
                },
                activeForm: {
                  type: 'string',
                  description: '进行时形式',
                },
              },
            },
          },
        },
        required: ['todos'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: '搜索网络获取最新信息',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '搜索查询词' },
          allowed_domains: { type: 'array', items: { type: 'string' }, description: '仅搜索这些域名' },
          blocked_domains: { type: 'array', items: { type: 'string' }, description: '排除这些域名' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'tool_search',
      description: '搜索可用的工具',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '搜索查询词' },
          max_results: { type: 'number', description: '最大返回结果数' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'task_create',
      description: '创建新任务到任务列表',
      parameters: {
        type: 'object',
        properties: {
          subject: { type: 'string', description: '任务标题' },
          description: { type: 'string', description: '任务详细描述' },
          activeForm: { type: 'string', description: '进行时形式' },
        },
        required: ['subject'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'brief',
      description: '向用户发送消息/报告',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: '消息内容' },
          attachments: { type: 'array', items: { type: 'string' }, description: '附件文件' },
          status: { type: 'string', enum: ['normal', 'proactive'] },
        },
        required: ['message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'notebook_edit',
      description: '编辑 Jupyter notebook 的 cell',
      parameters: {
        type: 'object',
        properties: {
          notebook_path: { type: 'string', description: 'Notebook 路径' },
          cell_id: { type: 'string', description: 'Cell ID' },
          new_source: { type: 'string', description: 'Cell 新内容' },
          cell_type: { type: 'string', enum: ['code', 'markdown'] },
          edit_mode: { type: 'string', enum: ['replace', 'insert', 'delete'] },
        },
        required: ['notebook_path', 'new_source'],
      },
    },
  },
];

// Tool System Imports
import { toolRegistry } from './tools/core/ToolRegistry.js';
import { ToolOrchestrator } from './tools/core/ToolOrchestrator.js';
import { ToolExecutor } from './tools/execution/ToolExecutor.js';
import { resultSummarizer } from './tools/formatters/ResultSummarizer.js';
import { executeTool } from './tools.js';

// Tool Implementations
import { AnalyzeConfigLeakTool } from './tools/tools/AnalyzeConfigLeakTool.js';
import { QueryLocalCveTool } from './tools/tools/QueryLocalCveTool.js';
import { FetchOnlineCveTool } from './tools/tools/FetchOnlineCveTool.js';
import { ReadFileTool } from './tools/tools/ReadFileTool.js';
import { WriteFileTool } from './tools/tools/WriteFileTool.js';
import { GlobTool } from './tools/tools/GlobTool.js';
import { GrepTool } from './tools/tools/GrepTool.js';
import { BashTool } from './tools/tools/BashTool.js';
import { WebFetchTool } from './tools/tools/WebFetchTool.js';
import { FileEditTool } from './tools/tools/FileEditTool.js';
import { AskUserQuestionTool } from './tools/tools/AskUserQuestionTool.js';
import { TodoWriteTool } from './tools/tools/TodoWriteTool.js';
import { WebSearchTool } from './tools/tools/WebSearchTool.js';
import { ToolSearchTool } from './tools/tools/ToolSearchTool.js';
import { TaskCreateTool } from './tools/tools/TaskCreateTool.js';
import { BriefTool } from './tools/tools/BriefTool.js';
import { NotebookEditTool } from './tools/tools/NotebookEditTool.js';

// Initialize Tool Registry
toolRegistry.registerAll([
  AnalyzeConfigLeakTool,
  QueryLocalCveTool,
  FetchOnlineCveTool,
  ReadFileTool,
  WriteFileTool,
  GlobTool,
  GrepTool,
  BashTool,
  WebFetchTool,
  FileEditTool,
  AskUserQuestionTool,
  TodoWriteTool,
  WebSearchTool,
  ToolSearchTool,
  TaskCreateTool,
  BriefTool,
  NotebookEditTool,
]);

// Create orchestrator and executor with progress callback
let _cliMode = false;

const toolOrchestrator = new ToolOrchestrator({
  maxConcurrency: 5,
  onProgress: (event) => {
    // Suppress verbose tool logging in CLI mode
    if (_cliMode) return;
    console.log('[TOOL.ORCH]', event.type, event.toolName || '', event.toolUseID || '');
  },
});

// Get IPC renderer for permission confirmations (if in Electron)
let _ipcRenderer = null;
try {
  const electron = await import('electron');
  _ipcRenderer = electron.ipcRenderer;
} catch {}

const toolExecutor = new ToolExecutor(toolOrchestrator, {
  summarizer: resultSummarizer,
  maxRetries: 3,
  ipcRenderer: _ipcRenderer,
});

// Degradation strategies
toolExecutor.degradationStrategies = {
  fetch_online_cve: (error, call) => ({
    success: true,
    data: {
      status: 'degraded',
      message: 'Online fetch unavailable, using local knowledge base',
      originalError: error.message,
    },
  }),
};

// Export for use by llmService
export { toolRegistry, toolOrchestrator, toolExecutor };

// Re-export for backward compatibility with tools.js
export { executeTool } from './tools.js';

var chatHistory = [];
var MAX_HISTORY = 10;

// Execution context for tool calls (cwd injection)
var executionContext = {};

export function clearHistory() {
  chatHistory = [];
  console.log('[AGENT.KERNEL] Chat history cleared.');
}

var currentController = null;

export function abortCurrent() {
  if (currentController) {
    currentController.abort();
    currentController = null;
  }
}

/**
 * Get current execution context (cwd, etc.)
 */
export function getExecutionContext() {
  return executionContext;
}

import { getConfig } from './configManager.js';

export async function sendMessage(text, onChunk, signal, options = {}) {
  var cfg = getConfig();

  // Enable CLI mode if context has cli: true
  if (options.context?.cli) {
    _cliMode = true;
  }

  if (!cfg.url || !cfg.apiKey) {
    if (onChunk) onChunk('[ERR] No API endpoint configured. Open [SYS.CONFIG] to set your provider credentials.');
    return;
  }

  // Store execution context (cwd) for tool calls
  executionContext = options.context || {};

  chatHistory.push({ role: 'user', content: text });

  var messages = [{ role: 'system', content: AGENT_SYSTEM_PROMPT }];
  var start = chatHistory.length > MAX_HISTORY ? chatHistory.length - MAX_HISTORY : 0;
  for (var i = start; i < chatHistory.length; i++) {
    messages.push(chatHistory[i]);
  }

  var fullResponse = '';
  function wrappedOnChunk(chunk) {
    fullResponse += chunk;
    if (onChunk) onChunk(chunk);
  }

  try {
    await _streamFetch(cfg, messages, TOOLS_SCHEMA, wrappedOnChunk, signal);
  } catch (e) {
    if (e.name === 'AbortError') {
      if (onChunk) onChunk('\n[SYS] 请求已中断。');
      return;
    }
    throw e;
  }

  if (fullResponse.trim()) {
    chatHistory.push({ role: 'assistant', content: fullResponse });
  }

  // Reset CLI mode after request completes
  _cliMode = false;
}

import { toolExecutor as executor } from './agentKernel.js';

async function _streamFetch(cfg, messages, tools, onChunk, signal) {
  var body = {
    model: cfg.model || 'gpt-4o',
    messages: messages,
    stream: true,
  };
  if (tools && tools.length > 0) {
    body.tools = tools;
  }

  var resp = await fetch(cfg.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + cfg.apiKey,
    },
    body: JSON.stringify(body),
    signal: signal || null,
  });

  if (!resp.ok) {
    var errText = await resp.text().catch(function () { return ''; });
    throw new Error('API error ' + resp.status + ': ' + (errText || resp.statusText).slice(0, 200));
  }

  var reader = resp.body.getReader();
  var decoder = new TextDecoder();
  var buffer = '';
  var toolCalls = {};
  var accumulatedContent = '';
  var accumulatedReasoning = '';
  var isInterceptingDSML = false;
  var dsmlBuffer = '';

  while (true) {
    var result = await reader.read();
    if (result.done) break;

    buffer += decoder.decode(result.value, { stream: true });
    var lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || !line.startsWith('data:')) continue;

      var data = line.slice(5).trim();
      if (data === '[DONE]') break;

      try {
        var json = JSON.parse(data);
        var delta = json.choices[0].delta;

        if (delta && delta.content) {
          var chunk = delta.content;

          if (!isInterceptingDSML && (/DSML/i.test(chunk) || /tool_calls/i.test(chunk) || /<[\s|｜]*DSML/i.test(chunk))) {
            isInterceptingDSML = true;
          }
          if (isInterceptingDSML) {
            isInterceptingDSML = true;
            dsmlBuffer += chunk;
          } else {
            accumulatedContent += chunk;
            if (onChunk) onChunk(chunk);
          }
        }

        if (delta && delta.reasoning_content) {
          accumulatedReasoning += delta.reasoning_content;
        }

        if (delta && delta.tool_calls) {
          console.log('[AGENT.KERNEL] Tool call delta detected');
          for (var j = 0; j < delta.tool_calls.length; j++) {
            var tc = delta.tool_calls[j];
            var idx = tc.index != null ? tc.index : 0;

            if (!toolCalls[idx]) {
              toolCalls[idx] = { id: '', name: '', arguments: '' };
            }

            if (tc.id) toolCalls[idx].id = tc.id;
            if (tc.type) toolCalls[idx].type = tc.type;
            if (tc.function) {
              if (tc.function.name) toolCalls[idx].name += tc.function.name;
              if (tc.function.arguments) toolCalls[idx].arguments += tc.function.arguments;
            }
          }
        }
      } catch (e) {
        // skip malformed SSE lines
      }
    }
  }

  // ── DSML fallback: intercept inline XML tool calls ──
  if (dsmlBuffer && Object.keys(toolCalls).length === 0) {
    console.log('[AGENT.KERNEL] DSML fallback triggered, buffer length:', dsmlBuffer.length);

    var invokeRe = /<[\s|｜]*DSML[\s|｜]*invoke\s+name="([^"]+)">([\s\S]*?)<\/[\s|｜]*DSML[\s|｜]*invoke>/gi;
    var paramRe = /<[\s|｜]*DSML[\s|｜]*parameter\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/[\s|｜]*DSML[\s|｜]*parameter>/gi;
    var invokeMatch;
    var dsmlToolCalls = [];

    while ((invokeMatch = invokeRe.exec(dsmlBuffer)) !== null) {
      var toolName = invokeMatch[1];
      var paramsBlock = invokeMatch[2];
      var args = {};

      paramRe.lastIndex = 0;
      var paramMatch;
      while ((paramMatch = paramRe.exec(paramsBlock)) !== null) {
        args[paramMatch[1]] = paramMatch[2].trim();
      }

      console.log('[AGENT.KERNEL] DSML parsed: ' + toolName + ' args=' + JSON.stringify(args));
      dsmlToolCalls.push({ name: toolName, args: args });
    }

    if (dsmlToolCalls.length > 0) {
      var fakeToolCalls = [];
      var toolMessages = [];

      for (var d = 0; d < dsmlToolCalls.length; d++) {
        var dtc = dsmlToolCalls[d];
        var fakeCallId = 'call_fallback_' + Date.now() + '_' + d;
        var argsJson = typeof dtc.args === 'string' ? dtc.args : JSON.stringify(dtc.args);

        fakeToolCalls.push({
          id: fakeCallId,
          type: 'function',
          function: { name: dtc.name, arguments: argsJson },
        });

        var dResult = await executeTool(dtc.name, dtc.args, executionContext);

        toolMessages.push({
          role: 'tool',
          tool_call_id: fakeCallId,
          name: dtc.name,
          content: dResult,
        });
      }

      var fallbackAssistantMsg = { role: 'assistant', content: dsmlBuffer, tool_calls: fakeToolCalls };
      if (accumulatedReasoning) {
        fallbackAssistantMsg.reasoning_content = accumulatedReasoning;
      }
      messages.push(fallbackAssistantMsg);
      for (var t = 0; t < toolMessages.length; t++) {
        messages.push(toolMessages[t]);
      }

      console.log('[AGENT.KERNEL] DSML re-invoking LLM...');
      await _streamFetch(cfg, messages, null, onChunk, signal);
      return;
    }
  }

  var tcIndices = Object.keys(toolCalls);
  if (tcIndices.length > 0) {
    console.log('[AGENT.KERNEL] Stream ended with ' + tcIndices.length + ' tool call(s)');

    // 1. Build and push assistant message with tool_calls FIRST
    var assistantMsg = { role: 'assistant', content: accumulatedContent || '', tool_calls: [] };
    if (accumulatedReasoning) {
      assistantMsg.reasoning_content = accumulatedReasoning;
    }
    for (var k = 0; k < tcIndices.length; k++) {
      var tcIdx = tcIndices[k];
      var tc = toolCalls[tcIdx];

      console.log('[AGENT.KERNEL] Tool call #' + tcIdx + ': ' + tc.name + ' | id=' + tc.id + ' | args=' + tc.arguments.slice(0, 80));

      assistantMsg.tool_calls.push({
        id: tc.id || ('call_' + tcIdx),
        type: tc.type || 'function',
        function: { name: tc.name, arguments: tc.arguments },
      });
    }
    messages.push(assistantMsg);

    // 2. Execute tools using new orchestrator and push tool results
    var toolCallsForOrchestrator = [];
    for (var k2 = 0; k2 < tcIndices.length; k2++) {
      var tcIdx2 = tcIndices[k2];
      var tc2 = toolCalls[tcIdx2];
      var callId = tc2.id || ('call_' + tcIdx2);

      var parsedArgs = {};
      try {
        parsedArgs = JSON.parse(tc2.arguments);
      } catch (e) {
        parsedArgs = { config_text: tc2.arguments };
      }

      toolCallsForOrchestrator.push({
        id: callId,
        name: tc2.name,
        arguments: parsedArgs,
      });
    }

    // Execute via orchestrator for proper locking/validation
    var orchestratorResults = [];
    for await (const result of toolOrchestrator.executeBatch(toolCallsForOrchestrator, executionContext)) {
      orchestratorResults.push(result);
    }

    // Push tool results
    for (var r = 0; r < orchestratorResults.length; r++) {
      var res = orchestratorResults[r];
      var toolContent = res.success
        ? JSON.stringify(res.data)
        : JSON.stringify({ error: res.error, errorType: res.errorType, correctionContext: res.correctionContext });

      messages.push({
        role: 'tool',
        tool_call_id: res.id,
        name: res.name,
        content: toolContent,
      });
    }

    console.log('[AGENT.KERNEL] Re-invoking LLM with tool results...');

    await _streamFetch(cfg, messages, null, onChunk, signal);
  }
}