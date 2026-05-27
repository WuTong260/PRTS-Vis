var _require = typeof require !== 'undefined' ? require : globalThis.require;

var cpuEl, ramEl, gpuEl, tempEl, fanEl, canvas, ctx, historyEl;
var cpuHistory = [];
var MAX_HISTORY = 50;
var pollTimer;

function appendSysLog(text) {
  if (!historyEl) return;
  var p = document.createElement('p');
  p.textContent = text;
  historyEl.appendChild(p);
  historyEl.scrollTop = historyEl.scrollHeight;
}

function formatBytes(bytes) {
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + 'GB';
}

function drawRadar() {
  requestAnimationFrame(drawRadar);

  var w = canvas.width;
  var h = canvas.height;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.fillRect(0, 0, w, h);

  if (cpuHistory.length < 2) return;

  var stepX = w / (MAX_HISTORY - 1);
  var startX = w - (cpuHistory.length - 1) * stepX;

  ctx.beginPath();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#00ffcc';
  ctx.shadowColor = '#00ffcc';
  ctx.shadowBlur = 6;

  for (var i = 0; i < cpuHistory.length; i++) {
    var x = startX + i * stepX;
    var y = h - (cpuHistory[i] / 100) * h * 0.85 - h * 0.08;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  var lastX = startX + (cpuHistory.length - 1) * stepX;
  var lastY = h - (cpuHistory[cpuHistory.length - 1] / 100) * h * 0.85 - h * 0.08;
  ctx.lineTo(lastX, h);
  ctx.lineTo(startX, h);
  ctx.closePath();
  ctx.shadowBlur = 0;

  var grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(0, 255, 204, 0.12)');
  grad.addColorStop(1, 'rgba(0, 255, 204, 0)');
  ctx.fillStyle = grad;
  ctx.fill();
}

function pollStats(ipcRenderer) {
  ipcRenderer.invoke('get-sys-stats').then(function (stats) {
    cpuEl.textContent = '[CPU: ' + stats.cpu + '%]';
    ramEl.textContent = '[RAM: ' + formatBytes(stats.usedMem) + ' / ' + formatBytes(stats.totalMem) + ']';
    cpuHistory.push(stats.cpu);
    if (cpuHistory.length > MAX_HISTORY) cpuHistory.shift();
  }).catch(function () {
    cpuEl.textContent = '[CPU: ERR]';
  });
}

function pollHardwareStats(ipcRenderer) {
  ipcRenderer.invoke('get-sys-stats').then(function (stats) {
    if (gpuEl) gpuEl.textContent = '[GPU: ' + (stats.gpu?.utilization || 0) + '% ' + (stats.gpu?.name?.substring(0, 15) || 'N/A') + ']';
    if (tempEl) tempEl.textContent = '[TEMP: ' + (stats.temperature || 0) + '°C]';
    if (fanEl) fanEl.textContent = '[FAN: ' + (stats.fanSpeed || 0) + ' RPM]';
  }).catch(function () {
    if (gpuEl) gpuEl.textContent = '[GPU: ERR]';
    if (tempEl) tempEl.textContent = '[TEMP: ERR]';
    if (fanEl) fanEl.textContent = '[FAN: ERR]';
  });
}

export function initSysMonitor() {
  var ipcRenderer;
  try {
    ipcRenderer = _require('electron').ipcRenderer;
  } catch (e) {
    return;
  }

  cpuEl = document.querySelector('.sys-metric.cpu');
  ramEl = document.querySelector('.sys-metric.ram');
  gpuEl = document.querySelector('.sys-metric.gpu');
  tempEl = document.querySelector('.sys-metric.temp');
  fanEl = document.querySelector('.sys-metric.fan');
  canvas = document.getElementById('sys-visualizer');
  ctx = canvas.getContext('2d');
  historyEl = document.getElementById('sys-history');

  var panel = document.getElementById('sys-monitor-panel');
  if (panel) panel.classList.remove('hidden');

  var specsEl = document.getElementById('sys-specs-matrix');

  ipcRenderer.invoke('get-sys-stats').then(function (stats) {
    appendSysLog('[SYS] Platform: ' + stats.platform + ' | Host: ' + stats.hostname + ' | Uptime: ' + Math.round(stats.uptime) + 's');
    appendSysLog('[SYS] Hardware monitor engaged.');

    if (specsEl) {
      var cpuName = stats.cpuModel;
      if (cpuName.length > 40) cpuName = cpuName.slice(0, 38) + '..';
      var specs = [
        { label: '[CPU]',       val: cpuName + ' (' + stats.cores + '核)' },
        { label: '[系统架构]',   val: stats.arch },
        { label: '[系统内核]',   val: stats.platform + ' ' + stats.release },
        { label: '[NET_IP]',    val: stats.ipAddress },
        { label: '[GPU]',       val: (stats.gpu?.name || 'N/A').substring(0, 25) },
        { label: '[温度]',       val: (stats.temperature || 0) + '°C' },
        { label: '[风扇]',       val: (stats.fanSpeed || 0) + ' RPM' },
        { label: '[驱动引擎]',   val: 'Node v' + stats.nodeVer },
        { label: '[终端外壳]',   val: 'Electron v' + stats.electronVer },
      ];
      var html = '';
      for (var i = 0; i < specs.length; i++) {
        html += '<div class="spec-row"><span class="spec-label">' + specs[i].label + '</span><span class="spec-val">' + specs[i].val + '</span></div>';
      }
      specsEl.innerHTML = html;
    }
  });

  pollStats(ipcRenderer);
  pollHardwareStats(ipcRenderer);
  pollTimer = setInterval(function () {
    pollStats(ipcRenderer);
    pollHardwareStats(ipcRenderer);
  }, 1000);
  drawRadar();
}
