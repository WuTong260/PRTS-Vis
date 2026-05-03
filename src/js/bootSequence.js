import { startLogStream, stopLogStream, addLine } from './terminalLogger.js';
import { STATES, transition, is } from './stateMachine.js';
import { register, unregister } from './mainLoop.js';

var dom = {};
var progress = 0;
var loadStartTime = 0;
var loadingActive = false;
var warnedAt99 = false;

function getTargetProgress(elapsed) {
  if (elapsed < 1.0) return 0.35 * (elapsed / 1.0);
  if (elapsed < 3.0) return 0.35 + 0.35 * ((elapsed - 1.0) / 2.0);
  if (elapsed < 5.0) return 0.70 + 0.29 * ((elapsed - 3.0) / 2.0);
  if (elapsed < 5.8) return 0.99;
  return Math.min(1.0, 0.99 + 0.01 * ((elapsed - 5.8) / 0.4));
}

function updateStatusTag(p) {
  if (p < 0.3) dom.statusTag.textContent = 'NEURAL CONNECT // STANDBY';
  else if (p < 0.6) dom.statusTag.textContent = 'DECRYPTING TACTICAL DATA...';
  else if (p < 0.9) dom.statusTag.textContent = 'CALIBRATING ORIGINIUM MATRIX...';
  else if (p < 0.99) dom.statusTag.textContent = 'FINAL SYNCHRONIZATION...';
  else dom.statusTag.textContent = 'ALL SYSTEMS NOMINAL // AWAITING INPUT';
}

function loadFrame(timestamp) {
  if (!loadingActive) return;

  var elapsed = (timestamp - loadStartTime) / 1000;
  var target = getTargetProgress(elapsed);

  var noise = Math.sin(elapsed * 23.7) * 0.003;
  var display = target + noise;

  if (elapsed > 0.5 && elapsed < 5.5) {
    var freeze = Math.sin(elapsed * 11.3) * 0.5 + 0.5;
    if (freeze > 0.85) display = progress;
  }

  if (display < progress) display = progress;
  if (display > target) display = target;
  if (display > 1.0) display = 1.0;

  progress = display;

  dom.progressPct.textContent = (progress * 100).toFixed(2) + '%';

  var halfPct = progress * 50;
  dom.barLeft.style.width = halfPct + '%';
  dom.barRight.style.width = halfPct + '%';

  if (progress > 0.85) {
    dom.gapGlow.classList.add('visible');
    dom.gapGlow.style.opacity = (progress - 0.85) / 0.15;
  } else {
    dom.gapGlow.classList.remove('visible');
  }

  updateStatusTag(progress);

  if (progress >= 0.99 && progress < 1.0 && !warnedAt99) {
    warnedAt99 = true;
    addLine('[WRN] 源石能量波动，正在重新校准...', 'warn');
  }

  if (progress >= 1.0) {
    onLoadingComplete();
    return;
  }
}

function onLoadingComplete() {
  loadingActive = false;
  stopLogStream();
  unregister(loadFrame);

  dom.statusTag.textContent = 'ALL SYSTEMS NOMINAL // AWAITING INPUT';
  addLine('[SYS] 所有模块已加载。等待操作员指令。', 'ok');

  transition(STATES.READY);
}

export function initBootSequence(refs) {
  dom = refs;
}

export function startBootSequence() {
  if (!is(STATES.BOOTING)) return;

  var bootMsg = 'PRTS-Vis // BOOT SEQUENCE... OK';
  var charIdx = 0;

  var typeInterval = setInterval(function () {
    if (charIdx < bootMsg.length) {
      dom.bootText.textContent = bootMsg.slice(0, charIdx + 1);
      charIdx++;
    } else {
      clearInterval(typeInterval);
      setTimeout(function () {
        dom.bootCursor.classList.add('fade-out');
        dom.mainContent.classList.add('visible');
        setTimeout(function () {
          if (dom.bootCursor.parentNode) dom.bootCursor.remove();
        }, 500);
        transition(STATES.LOADING);
        startLoading();
      }, 400);
    }
  }, 60);
}

function startLoading() {
  loadStartTime = performance.now();
  loadingActive = true;
  startLogStream();
  register(loadFrame);
}
