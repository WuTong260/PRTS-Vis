import { start as startMainLoop } from './mainLoop.js';
import { initParticles } from './particleEngine.js';
import { initLogger } from './terminalLogger.js';
import { initParallax, pauseParallax } from './parallax.js';
import { initBootSequence, startBootSequence } from './bootSequence.js';
import { STATES, transition, onEnter, is } from './stateMachine.js';
import { sendMessage, clearHistory, abortCurrent } from './llmService.js';
var mammoth = null;
try { mammoth = _require('mammoth'); } catch (e) { /* mammoth not available */ }
import { PROVIDER_PRESETS, getConfig, saveConfig } from './configManager.js';
import { parse as markedParse } from './markedLocal.js';
import { initSysMonitor } from './sysMonitor.js';

var _require = typeof require !== 'undefined' ? require : globalThis.require;

var updateUIScale = function () {
  var vw = window.innerWidth;
  var vh = window.innerHeight;
  var min = vw < vh ? vw : vh;
  var scale = Math.max(0.5, Math.min(2.0, min / 900));
  document.documentElement.style.setProperty('--ui-scale', scale);
};
updateUIScale();
window.addEventListener('resize', updateUIScale);

// ── DOM refs ──────────────────────────────────────────
var bootCursor = document.getElementById('bootCursor');
var bootText = document.getElementById('bootText');
var mainContent = document.getElementById('mainContent');
var progressPct = document.getElementById('progressPercent');
var barLeft = document.getElementById('barLeft');
var barRight = document.getElementById('barRight');
var gapGlow = document.getElementById('gapGlow');
var statusTag = document.getElementById('statusTag');
var logLines = document.getElementById('logLines');
var enterWrap = document.getElementById('enterWrap');
var enterBtn = document.getElementById('enterBtn');
var loadingApp = document.getElementById('loading-app');
var blastDoors = document.getElementById('blastDoors');
var seamGlow = document.getElementById('seamGlow');
var clockDisplay = document.getElementById('clockDisplay');
var wireframeSphere = document.getElementById('wireframeSphere');
var particleCanvas = document.getElementById('particleCanvas');
var panelLeft = document.getElementById('panelLeft');
var panelRight = document.getElementById('panelRight');
var hudContainer = document.getElementById('hud-container');
var chatHistory = document.getElementById('chat-history');
var chatInput = document.getElementById('chat-input');
var btnConfig = document.getElementById('btn-config');
var configModal = document.getElementById('config-modal');
var configProvider = document.getElementById('config-provider');
var configUrl = document.getElementById('config-url');
var configKey = document.getElementById('config-key');
var configModel = document.getElementById('config-model');
var btnUpdate = document.getElementById('btn-update');
var btnCancel = document.getElementById('btn-cancel');
var btnApply = document.getElementById('btn-apply');

// ── Clock ─────────────────────────────────────────────
function updateClock() {
  var now = new Date();
  clockDisplay.textContent =
    String(now.getHours()).padStart(2, '0') + ':' +
    String(now.getMinutes()).padStart(2, '0') + ':' +
    String(now.getSeconds()).padStart(2, '0');
}

// ── Transition: burst sphere ──────────────────────────
function burstSphere() {
  var rings = wireframeSphere.querySelectorAll('.ring');
  pauseParallax();

  // Capture current computed transforms before locking
  var snapshots = [];
  for (var i = 0; i < rings.length; i++) {
    var m = getComputedStyle(rings[i]).transform;
    snapshots.push(m === 'none' ? '' : m);
  }

  // Lock each ring at current transform (no transition active yet)
  for (var i = 0; i < rings.length; i++) {
    rings[i].style.transform = snapshots[i]
      ? snapshots[i] + ' scale(1)'
      : 'scale(1)';
  }

  // Add burst class — CSS applies .burst .ring { transition: ... }
  wireframeSphere.classList.add('burst');

  // On next frame, apply burst transforms — transitions now active
  requestAnimationFrame(function () {
    for (var i = 0; i < rings.length; i++) {
      var delay = i * 0.04;
      var scale = 2.5 + Math.random() * 3;
      var extraRotate = (Math.random() - 0.5) * 180;
      rings[i].style.transition =
        'transform 1.3s cubic-bezier(0.7,0,0.3,1) ' + delay + 's, opacity 0.8s ease-out ' + (delay + 0.2) + 's';
      rings[i].style.transform = snapshots[i]
        ? snapshots[i] + ' scale(' + scale + ') rotate(' + extraRotate + 'deg)'
        : 'scale(' + scale + ') rotate(' + extraRotate + 'deg)';
      rings[i].style.opacity = '0';
    }
  });
}

// ── ENTER button ──────────────────────────────────────
function onEnterClick() {
  if (!is(STATES.READY)) return;
  if (!transition(STATES.TRANSITIONING)) return;

  enterBtn.disabled = true;
  enterBtn.textContent = 'ACCESS GRANTED';
}

// ── Init ──────────────────────────────────────────────
function init() {
  updateClock();
  setInterval(updateClock, 1000);

  initParticles(particleCanvas);
  initLogger(logLines);
  initParallax(wireframeSphere);
  startMainLoop();

  initBootSequence({
    bootCursor: bootCursor,
    bootText: bootText,
    mainContent: mainContent,
    loadingApp: loadingApp,
    progressPct: progressPct,
    barLeft: barLeft,
    barRight: barRight,
    gapGlow: gapGlow,
    statusTag: statusTag,
    enterWrap: enterWrap,
    wireframeSphere: wireframeSphere,
    seamGlow: seamGlow,
    panelLeft: panelLeft,
    panelRight: panelRight,
  });

  // ── State-driven UI ────────────────────────────────
  onEnter(STATES.LOADING, function () {
    loadingApp.classList.add('interactive');
  });

  onEnter(STATES.READY, function () {
    wireframeSphere.classList.add('grown');
    barLeft.style.width = '50%';
    barRight.style.width = '50%';
    gapGlow.style.opacity = '1';
    setTimeout(function () { progressPct.classList.add('fade-num'); }, 300);
    setTimeout(function () {
      enterWrap.classList.add('visible');
      seamGlow.style.opacity = '0';
      seamGlow.style.transition = 'opacity 0.5s ease';
      panelLeft.classList.add('visible');
      panelRight.classList.add('visible');
    }, 700);
  });

  onEnter(STATES.TRANSITIONING, function () {
    burstSphere();
    setTimeout(function () {
      blastDoors.classList.add('open');
      setTimeout(function () {
        loadingApp.style.opacity = '0';
        loadingApp.style.transition = 'opacity 0.2s ease';
      }, 300);
      setTimeout(function () {
        blastDoors.style.opacity = '0';
        blastDoors.style.transition = 'opacity 0.3s ease';
      }, 800);
      setTimeout(function () {
        transition(STATES.SYSTEM_ONLINE);
      }, 800);
    }, 700);
  });

  enterBtn.addEventListener('click', onEnterClick);

  // ── HUD: SYSTEM_ONLINE ──────────────────────────────
  onEnter(STATES.SYSTEM_ONLINE, function () {
    loadingApp.style.display = 'none';
    blastDoors.style.display = 'none';
    hudContainer.classList.remove('hidden');
    initSysMonitor();

    var cfg = getConfig();
    if (!cfg.apiKey) {
      appendMessage('ai', '[SYS] 未检测到 API 密钥。请点击 [SYS.CONFIG] 配置您的 Provider 凭证以激活安全审计内核。');
    }

    chatInput.focus();
  });

  function wrapThreatCards(html) {
    if (html.indexOf('[THREAT]') === -1) return html;

    var level = 'info';
    if (/critical|highest|critical/i.test(html)) level = 'high';
    else if (/medium|high|warning/i.test(html)) level = 'medium';

    var cardHtml = '<div class="threat-card level-' + level + '">';

    // Extract the h3 header
    var h3Match = html.match(/<h3>\[THREAT\](.*?)<\/h3>/i);
    if (h3Match) {
      cardHtml += '<div class="card-header"><span class="pulse-dot"></span>[THREAT]' + h3Match[1] + '</div>';
      html = html.replace(h3Match[0], '');
    }

    cardHtml += '<div class="card-body">' + html + '</div>';
    cardHtml += '</div>';
    return cardHtml;
  }

  function appendMessage(role, text) {
    var div = document.createElement('div');
    div.className = 'chat-msg ' + role;
    div.textContent = text;
    chatHistory.appendChild(div);
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }

  // ── Config panel ───────────────────────────────────
  document.getElementById('btn-clear').addEventListener('click', function () {
    clearHistory();
    chatHistory.innerHTML = '';
    var clearMsg = document.createElement('div');
    clearMsg.className = 'chat-msg ai';
    clearMsg.textContent = '[SYS] 聊天记忆已清空。';
    chatHistory.appendChild(clearMsg);
    setTimeout(function () {
      if (clearMsg.parentNode) clearMsg.remove();
    }, 2000);
  });

  btnConfig.addEventListener('click', function () {
    var cfg = getConfig();
    configProvider.value = cfg.provider || 'Custom';
    configUrl.value = cfg.url || '';
    configKey.value = cfg.apiKey || '';
    configModel.value = cfg.model || '';
    configModal.classList.remove('hidden');
  });

  configProvider.addEventListener('change', function () {
    var preset = PROVIDER_PRESETS[configProvider.value];
    if (!preset) return;
    if (configProvider.value !== 'Custom') {
      configUrl.value = preset.url;
      configModel.value = preset.model;
      appendMessage('ai', '[SYS] Vendor profile loaded: ' + configProvider.value);
    }
  });

  btnCancel.addEventListener('click', function () {
    configModal.classList.add('hidden');
  });

  btnApply.addEventListener('click', function () {
    saveConfig({
      provider: configProvider.value,
      url: configUrl.value.trim(),
      apiKey: configKey.value.trim(),
      model: configModel.value.trim(),
    });
    configModal.classList.add('hidden');
    appendMessage('ai', '[SYS] Configuration Updated.');
  });

  document.querySelector('.config-overlay').addEventListener('click', function () {
    configModal.classList.add('hidden');
  });

  chatInput.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var text = chatInput.value.trim();
    if (!text) return;

    appendMessage('user', text);
    chatInput.value = '';

    // Abort previous request if still running
    abortCurrent();

    var aiDiv = document.createElement('div');
    aiDiv.className = 'chat-msg ai markdown-body';
    chatHistory.appendChild(aiDiv);

    var currentAiText = '';
    var thinkingDots = document.createElement('span');
    thinkingDots.className = 'thinking-indicator';
    thinkingDots.innerHTML = '<span></span><span></span><span></span>';
    chatHistory.appendChild(thinkingDots);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    var firstChunk = true;

    var controller = new AbortController();

    sendMessage(text, function (chunk) {
      if (firstChunk) {
        firstChunk = false;
        if (thinkingDots.parentNode) thinkingDots.remove();
      }
      currentAiText += chunk;
      aiDiv.innerHTML = markedParse(currentAiText);
      chatHistory.scrollTop = chatHistory.scrollHeight;
    }, controller.signal).then(function () {
      aiDiv.innerHTML = wrapThreatCards(markedParse(currentAiText));
      var cards = aiDiv.querySelectorAll('.threat-card');
      for (var ci = 0; ci < cards.length; ci++) cards[ci].classList.add('entered');
      chatHistory.scrollTop = chatHistory.scrollHeight;
    }).catch(function (err) {
      if (thinkingDots.parentNode) thinkingDots.remove();
      if (err.name !== 'AbortError') aiDiv.textContent = '[ERR] ' + err.message;
    }).finally(function () {
      chatInput.focus();
    });
  });

  // ── Horizontal resizer ──────────────────────────────
  var hResizer = document.querySelector('.resizer-horizontal');
  var leftSidebar = document.getElementById('left-sidebar');
  hResizer.addEventListener('mousedown', function (e) {
    e.preventDefault();
    var startX = e.clientX;
    var startW = leftSidebar.offsetWidth;
    hResizer.classList.add('active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function onMouseMove(me) {
      var newW = startW + me.clientX - startX;
      if (newW > 150 && newW < window.innerWidth * 0.4) {
        leftSidebar.style.width = newW + 'px';
      }
    }
    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      hResizer.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

  // ── Drag & Drop ─────────────────────────────────────
  var dragOverlay = document.getElementById('drag-overlay');
  var fileList = document.getElementById('file-list');

  document.addEventListener('dragover', function (e) {
    e.preventDefault();
    dragOverlay.classList.remove('hidden');
  });
  dragOverlay.addEventListener('dragleave', function () {
    dragOverlay.classList.add('hidden');
  });
  document.addEventListener('drop', function (e) {
    e.preventDefault();
    dragOverlay.classList.add('hidden');
    var files = e.dataTransfer.files;
    for (var fi = 0; fi < files.length; fi++) {
      (async function (file) {
        if (file.size === 0 && !file.path) {
          appendMessage('ai', '[SYS] 文件为空或受系统保护，已跳过: ' + file.name);
          return;
        }
        if (file.size > 1024 * 1024) {
          appendMessage('ai', '[SYS] 文件过大 (>1MB)，已跳过: ' + file.name);
          return;
        }

        var fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.textContent = file.name;
        fileItem.style.color = 'var(--amber)';
        fileList.appendChild(fileItem);

        appendMessage('ai', '[SYS.MSG] 正在解析文件: ' + file.name + '...');

        // ── .docx handling ──
        var isDocx = /\.docx$/i.test(file.name);
        var isDoc = /\.doc$/i.test(file.name) && !isDocx;
        if (isDoc) {
          fileItem.style.color = '#ff4d4d';
          appendMessage('ai', '[SYS] 暂不支持旧版 .doc 或加密文档，请转换为 .docx 后重试。');
          return;
        }

        if (isDocx && mammoth && file.path) {
          appendMessage('ai', '[SYS.MSG] 正在解码 Office 文档: ' + file.name + '...');
          try {
            var fs = _require('fs');
            var buf = fs.readFileSync(file.path);
            var docxResult = await mammoth.extractRawText({ buffer: buf });
            fileItem.style.color = '#2ecc71';
            appendMessage('ai', '[SYS.MSG] 解析成功，正在同步至审计内核...');
            var prompt = '[SYSTEM_ACTION: FILE_UPLOAD]\n文件名: ' + file.name + '\n文件内容如下:\n---\n' + docxResult.value.slice(0, 8000) + '\n---\n请分析此文件的内容并告知我。';
            sendMessage(prompt, function () {});
          } catch (docxErr) {
            fileItem.style.color = '#ff4d4d';
            appendMessage('ai', '[SYS] Word 文档解析失败: ' + (docxErr.message || '未知错误'));
          }
          return;
        }

        var filePath = file.path;
        var content = null;

        // Electron: use Node fs for real path access
        if (filePath) {
          try {
            var fs = _require('fs');
            content = fs.readFileSync(filePath, 'utf8');
          } catch (fsErr) {
            // fall through to FileReader
          }
        }

        if (content !== null) {
          fileItem.style.color = '#2ecc71';
          appendMessage('ai', '[SYS.MSG] 文件读取成功: ' + file.name + ' (' + (content.length / 1024).toFixed(2) + ' KB)');
          var prompt = '[SYSTEM_ACTION: FILE_UPLOAD]\n文件名: ' + file.name + '\n文件内容如下:\n---\n' + content.slice(0, 8000) + '\n---\n请分析此文件的内容并告知我。';
          sendMessage(prompt, function () {});
          return;
        }

        // Fallback: FileReader
        var reader = new FileReader();
        reader.onload = function (ev) {
          var text = ev.target.result;
          if (text && text.length > 0) {
            fileItem.style.color = '#2ecc71';
            appendMessage('ai', '[SYS.MSG] 文件读取成功: ' + file.name + ' (' + (text.length / 1024).toFixed(2) + ' KB)');
            var prompt2 = '[SYSTEM_ACTION: FILE_UPLOAD]\n文件名: ' + file.name + '\n文件内容如下:\n---\n' + text.slice(0, 8000) + '\n---\n请分析此文件的内容并告知我。';
            sendMessage(prompt2, function () {});
          } else {
            fileItem.style.color = '#ff4d4d';
            appendMessage('ai', '[SYS] 文件读取失败（空内容）: ' + file.name);
          }
        };
        reader.onerror = function () {
          fileItem.style.color = '#ff4d4d';
          appendMessage('ai', '[SYS] 文件读取失败: ' + file.name);
        };
        reader.readAsText(file);
      })(files[fi]);
    }
  });

  // ── Resizer handle ──────────────────────────────────
  var resizer = document.querySelector('.resizer-handle');
  var cmdLine = document.getElementById('command-line');

  resizer.addEventListener('mousedown', function (e) {
    e.preventDefault();
    var startY = e.clientY;
    var startHeight = cmdLine.offsetHeight;
    resizer.classList.add('active');
    chatHistory.style.pointerEvents = 'none';
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';

    function onMouseMove(moveEvent) {
      var deltaY = startY - moveEvent.clientY;
      var newHeight = startHeight + deltaY;
      if (newHeight > 60 && newHeight < window.innerHeight * 0.7) {
        cmdLine.style.height = newHeight + 'px';
      }
    }

    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      resizer.classList.remove('active');
      chatHistory.style.pointerEvents = '';
      document.body.style.cursor = 'default';
      document.body.style.userSelect = '';
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

  // ── Window controls ─────────────────────────────────
  var ipcRenderer;
  try { ipcRenderer = _require('electron').ipcRenderer; } catch (e) { ipcRenderer = null; }
  if (ipcRenderer) {
    document.getElementById('btn-min').addEventListener('click', function () { ipcRenderer.send('window-min'); });
    document.getElementById('btn-max').addEventListener('click', function () { ipcRenderer.send('window-max'); });
    document.getElementById('btn-close').addEventListener('click', function () { ipcRenderer.send('window-close'); });

    // ── Auto-updater ──────────────────────────────
    btnUpdate.addEventListener('click', async function () {
      appendMessage('ai', '[SYS] 正在检查更新...');
      var result = await ipcRenderer.invoke('check-for-update');
      if (result && result.status === 'dev-mode') {
        appendMessage('ai', '[SYS] 开发模式，跳过更新检查。');
      }
    });

    ipcRenderer.on('update-status', function (_event, data) {
      if (data.status === 'available') {
        appendMessage('ai', '[SYS] 发现新版本 v' + data.version + '，正在下载...');
        ipcRenderer.send('start-download');
      } else if (data.status === 'downloaded') {
        appendMessage('ai', '[SYS] 更新已下载完成 (v' + data.version + ')。点击 [UPDATE] 立即重启安装。');
        btnUpdate.textContent = '[RESTART]';
        btnUpdate.addEventListener('click', function handler() {
          btnUpdate.removeEventListener('click', handler);
          ipcRenderer.send('quit-and-install');
        });
      } else if (data.status === 'up-to-date') {
        appendMessage('ai', '[SYS] 已是最新版本。');
      } else if (data.status === 'error') {
        appendMessage('ai', '[SYS] 更新检查失败: ' + data.message);
      }
    });
  }

  // Kick off
  setTimeout(function () {
    transition(STATES.BOOTING);
    startBootSequence();
  }, 300);
}

init();
