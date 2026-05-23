import { getConfig } from './configManager.js';
import { AGENT_SYSTEM_PROMPT, TOOLS_SCHEMA } from './agentKernel.js';
import { executeTool } from './tools.js';
import { CompactionManager } from './context/compactionManager.js';
import { estimateMessagesTokens, detectModelPrefix, checkCompactionThreshold } from './context/tokenCounter.js';

var chatHistory = [];
var MAX_HISTORY = 10;

// Compaction manager instance
var compactionManager = new CompactionManager({
  maxContextTokens: 80000,
  warningThreshold: 0.70,
  autoCompactThreshold: 0.85,
  preserveLatest: 8,
});

// Pending compaction state
var _pendingCompaction = false;
var _messageQueue = [];
var _onCompactionStatus = null;

// LLM client wrapper for compaction
var _llmClient = null;

export function setCompactionStatusCallback(cb) {
  _onCompactionStatus = cb;
}

export function clearHistory() {
  chatHistory = [];
  compactionManager.reset();
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
 * Check if compaction is needed and trigger if so
 */
async function _checkAndCompact(cfg) {
  const modelPrefix = detectModelPrefix(cfg.model);
  const compactionNeeded = compactionManager.checkCompactionNeeded(chatHistory, modelPrefix);

  if (compactionNeeded === 'warning') {
    console.warn('[COMPACTION] Context approaching limit, estimated tokens:', compactionManager.getEstimatedTokens(chatHistory, modelPrefix));
    if (_onCompactionStatus) {
      _onCompactionStatus({ status: 'warning', message: '上下文即将达到限制' });
    }
  }

  if (compactionNeeded === 'autocompact' && !_pendingCompaction) {
    console.log('[COMPACTION] Triggering auto-compaction...');
    return await _triggerCompaction(cfg);
  }

  return false;
}

/**
 * Trigger compaction and wait for completion
 */
async function _triggerCompaction(cfg) {
  if (_pendingCompaction) return true;

  _pendingCompaction = true;

  if (_onCompactionStatus) {
    _onCompactionStatus({ status: 'compacting', message: '正在压缩上下文...' });
  }

  try {
    // Create LLM client for summary generation
    const summaryClient = {
      complete: async (prompt) => {
        const response = await fetch(cfg.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + cfg.apiKey,
          },
          body: JSON.stringify({
            model: cfg.model || 'gpt-4o',
            messages: [
              { role: 'system', content: '你是一个简洁的对话摘要助手。' },
              { role: 'user', content: prompt },
            ],
            max_tokens: 500,
            temperature: 0.3,
          }),
        });

        if (!response.ok) {
          throw new Error('Summary API error: ' + response.status);
        }

        const data = await response.json();
        return data.choices[0].message.content;
      },
    };

    const modelPrefix = detectModelPrefix(cfg.model);
    const compacted = await compactionManager.compact(chatHistory, summaryClient, modelPrefix);

    chatHistory = compacted;
    compactionManager.consecutiveErrors = 0;

    console.log('[COMPACTION] Compaction complete, messages now:', chatHistory.length);

    if (_onCompactionStatus) {
      _onCompactionStatus({ status: 'complete', message: '上下文压缩完成' });
    }

    // Process queued messages
    _processMessageQueue();

    return true;
  } catch (e) {
    console.error('[COMPACTION] Compaction failed:', e.message);
    if (_onCompactionStatus) {
      _onCompactionStatus({ status: 'error', message: '压缩失败: ' + e.message });
    }
    return false;
  } finally {
    _pendingCompaction = false;
  }
}

/**
 * Process queued messages after compaction
 */
function _processMessageQueue() {
  if (_messageQueue.length === 0) return;

  const next = _messageQueue.shift();
  console.log('[LLM] Processing queued message (' + _messageQueue.length + ' remaining)');

  // Use setTimeout to avoid blocking
  setTimeout(() => {
    sendMessage(next.text, next.onChunk, next.signal)
      .then(next.resolve)
      .catch(next.reject);
  }, 100);
}

export async function sendMessage(text, onChunk, signal) {
  var cfg = getConfig();

  if (!cfg.url || !cfg.apiKey) {
    if (onChunk) onChunk('[ERR] No API endpoint configured. Open [SYS.CONFIG] to set your provider credentials.');
    return;
  }

  // If compaction is in progress, queue this message
  if (_pendingCompaction) {
    console.log('[LLM] Compaction in progress, queueing message');
    return new Promise((resolve, reject) => {
      _messageQueue.push({ text, onChunk, signal, resolve, reject });
    });
  }

  return _doSendMessage(text, onChunk, signal, cfg);
}

async function _doSendMessage(text, onChunk, signal, cfg) {
  chatHistory.push({ role: 'user', content: text });

  // Check compaction before sending
  const modelPrefix = detectModelPrefix(cfg.model);
  const compactionNeeded = compactionManager.checkCompactionNeeded(chatHistory, modelPrefix);

  if (compactionNeeded === 'warning') {
    console.warn('[COMPACTION] Context approaching limit');
  }

  // Build messages with history limit
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

    // Check for context overflow error
    const isContextOverflow = e.message.includes('context') ||
      e.message.includes('maximum') ||
      e.message.includes('too many') ||
      e.message.includes('limit');

    if (isContextOverflow) {
      console.error('[LLM] Context overflow, triggering emergency compaction');

      // Handle overflow - increase error count
      compactionManager.handleContextOverflow(chatHistory);

      // Trigger compaction
      const compacted = await _triggerCompaction(cfg);

      if (compacted) {
        // Remove the failed message from history and retry
        chatHistory.pop();
        return _doSendMessage(text, onChunk, signal, cfg);
      }
    }

    throw e;
  }

  if (fullResponse.trim()) {
    chatHistory.push({ role: 'assistant', content: fullResponse });
  }
}

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

        var dResult = await executeTool(dtc.name, dtc.args);

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

    // 2. Execute tools and push tool results AFTER assistant message
    for (var k = 0; k < tcIndices.length; k++) {
      var tcIdx2 = tcIndices[k];
      var tc2 = toolCalls[tcIdx2];
      var callId = tc2.id || ('call_' + tcIdx2);

      var parsedArgs = {};
      try {
        parsedArgs = JSON.parse(tc2.arguments);
      } catch (e) {
        parsedArgs = { config_text: tc2.arguments };
      }

      var toolResult = await executeTool(tc2.name, parsedArgs);

      messages.push({
        role: 'tool',
        tool_call_id: callId,
        name: tc2.name,
        content: toolResult,
      });
    }

    console.log('[AGENT.KERNEL] 准备发起二次汇总请求...');

    await _streamFetch(cfg, messages, null, onChunk, signal);
  }
}