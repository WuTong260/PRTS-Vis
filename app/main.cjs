const { app, BrowserWindow, session, ipcMain, dialog } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

// autoUpdater loaded lazily in setupAutoUpdater() to avoid init errors
var autoUpdater = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// systeminformation is loaded lazily via getSystemInfo() to avoid blocking the main process
var si = null;
function getSystemInfo() {
  if (!si) si = require('systeminformation');
  return si;
}

function setupPermissions() {
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      const allowed = ['desktopCapturer', 'media', 'display-capture'];
      callback(allowed.includes(permission));
    },
  );

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Access-Control-Allow-Origin': ['*'],
        'Access-Control-Allow-Methods': ['GET, POST, PUT, DELETE, OPTIONS'],
        'Access-Control-Allow-Headers': ['*'],
      },
    });
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    frame: false,
    autoHideMenuBar: true,
    resizable: true,
    backgroundColor: '#0a0a0a',
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
      webSecurity: false,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

// cpuPrev initialized lazily on first call to avoid startup time skew
var cpuPrev = null;
function getCpuPrev() {
  if (!cpuPrev) cpuPrev = os.cpus();
  return cpuPrev;
}

ipcMain.on('window-min', function () { BrowserWindow.getFocusedWindow()?.minimize(); });
ipcMain.on('window-max', function () { var w = BrowserWindow.getFocusedWindow(); if (w) w.isMaximized() ? w.unmaximize() : w.maximize(); });
ipcMain.on('window-close', function () { BrowserWindow.getFocusedWindow()?.close(); });

// Tool confirmation dialog
ipcMain.handle('TOOL_CONFIRM', async function (event, payload) {
  var win = BrowserWindow.getFocusedWindow();
  if (!win) return { approved: false, reason: 'No focused window' };

  var buttons = ['取消', '确认执行'];
  if (payload.warnings && payload.warnings.length > 0) {
    buttons = ['取消 (Deny)', '确认执行 (Confirm)'];
  }

  var detail = `工具: ${payload.toolName}\n\n`;
  if (payload.args) {
    detail += `参数: ${JSON.stringify(payload.args, null, 2)}\n\n`;
  }
  if (payload.warnings && payload.warnings.length > 0) {
    detail += `⚠️ 警告:\n${payload.warnings.map(w => '• ' + w).join('\n')}\n\n`;
  }
  detail += '是否继续执行此工具？';

  var result = await dialog.showMessageBox(win, {
    type: 'warning',
    title: '工具执行确认',
    message: `即将执行: ${payload.toolName}`,
    detail: detail,
    buttons: buttons,
    defaultId: 1,
    cancelId: 0,
  });

  return {
    approved: result.response === 1,
    reason: result.response === 0 ? 'User cancelled' : null,
  };
});

ipcMain.handle('get-sys-stats', async function () {
  var si = getSystemInfo();
  var totalMem = os.totalmem();
  var freeMem = os.freemem();
  var usedMem = totalMem - freeMem;

  var ipAddress = 'OFFLINE';
  var nets = os.networkInterfaces();
  for (var key in nets) {
    var ifaces = nets[key];
    for (var j = 0; j < ifaces.length; j++) {
      if (ifaces[j].family === 'IPv4' && !ifaces[j].internal) {
        ipAddress = ifaces[j].address;
        break;
      }
    }
    if (ipAddress !== 'OFFLINE') break;
  }

  // CPU: use systeminformation's currentLoad() which uses OS APIs
  var cpuUsage = 0;
  try {
    var load = await si.currentLoad();
    cpuUsage = Math.round(load.currentLoad);
  } catch (e) {}

  var cpus = os.cpus();

  // GPU: find the real discrete GPU (not Oray virtual driver)
  var si = getSystemInfo();
  var gpuInfo = { name: 'N/A', utilization: 0, memory: 0, temperature: 0 };
  var temperature = 0;
  var fanSpeed = 0;

  try {
    const graphics = await si.graphics();
    if (graphics.controllers && graphics.controllers.length > 0) {
      // Skip virtual/placeholder GPU devices, find the real GPU (NVIDIA/AMD/Intel)
      const realGpu = graphics.controllers.find(g =>
        g.vendor && !/oray|virtual|placeholder/i.test(g.vendor) && g.model !== 'Unknown GPU'
      ) || graphics.controllers[0];
      gpuInfo = {
        name: realGpu.model || 'Unknown GPU',
        utilization: realGpu.utilizationGpu || 0,
        memory: realGpu.memoryTotal || 0,
        temperature: realGpu.temperatureGpu || 0,
      };
      temperature = realGpu.temperatureGpu || 0;
          } else {
          }
  } catch (e) {
    console.error('[MAIN] GPU query failed:', e.message);
  }

  // Temperature: use cpuTemperature, fall back to GPU temp
  try {
    const cpuTemp = await si.cpuTemperature();
    if (cpuTemp && cpuTemp.main != null) {
      temperature = cpuTemp.main;
          }
  } catch (e) {
    console.error('[MAIN] CPU temp query failed:', e.message);
  }

  // Fan: systeminformation may not expose fan data on this platform
  try {
    // Try fans() if available (newer versions)
    if (typeof si.fans === 'function') {
      const fans = await si.fans();
      if (fans && fans.length > 0) {
        fanSpeed = fans[0].speed || 0;
              }
    } else {
          }
  } catch (e) {
    console.error('[MAIN] Fan query failed:', e.message);
  }

  return {
    cpu: cpuUsage,
    totalMem: totalMem,
    freeMem: freeMem,
    usedMem: usedMem,
    platform: os.platform(),
    hostname: os.hostname(),
    uptime: os.uptime(),
    cpuModel: cpus[0].model,
    cores: cpus.length,
    arch: os.arch(),
    release: os.release(),
    electronVer: process.versions.electron,
    nodeVer: process.versions.node,
    ipAddress: ipAddress,
    gpu: gpuInfo,
    temperature: temperature,
    fanSpeed: fanSpeed,
  };
});

function setupAutoUpdater(win) {
  if (isDev) return;

  // Lazy load autoUpdater to avoid initialization errors
  if (!autoUpdater) {
    try {
      autoUpdater = require('electron-updater');
    } catch (e) {
            return;
    }
  }

  autoUpdater.autoDownload = false;

  autoUpdater.on('update-available', function (info) {
    win.webContents.send('update-status', {
      status: 'available',
      version: info.version,
    });
  });

  autoUpdater.on('download-progress', function (progress) {
    win.webContents.send('update-status', {
      status: 'downloading',
      percent: Math.round(progress.percent),
    });
  });

  autoUpdater.on('update-downloaded', function (info) {
    win.webContents.send('update-status', {
      status: 'downloaded',
      version: info.version,
    });
  });

  autoUpdater.on('error', function (err) {
    win.webContents.send('update-status', {
      status: 'error',
      message: err.message,
    });
  });

  autoUpdater.on('update-not-available', function () {
    win.webContents.send('update-status', { status: 'up-to-date' });
  });

  // Check after a short delay so the window is ready
  setTimeout(function () {
    autoUpdater.checkForUpdates().catch(function () {});
  }, 5000);
}

ipcMain.handle('check-for-update', function () {
  if (isDev) return { status: 'dev-mode' };
  try {
    var result = autoUpdater.checkForUpdates();
    return result;
  } catch (e) {
    return { status: 'error', message: e.message };
  }
});

ipcMain.on('start-download', function () {
  if (!isDev) autoUpdater.downloadUpdate();
});

ipcMain.on('quit-and-install', function () {
  autoUpdater.quitAndInstall();
});

// ── Shared Config File Sync ──
var CONFIG_DIR = path.join(os.homedir(), '.prts-vis');
var CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

ipcMain.handle('save-config', function (_event, config) {
    try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
        return { success: true };
  } catch (e) {
    console.error('[MAIN] Failed to save config:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('load-config', function () {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return { success: true, config: null };
    }
    var raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    var config = JSON.parse(raw);
        return { success: true, config };
  } catch (e) {
    console.error('[MAIN] Failed to load config:', e.message);
    return { success: false, error: e.message, config: null };
  }
});

app.whenReady().then(() => {
  setupPermissions();
  createWindow();
  setupAutoUpdater(BrowserWindow.getAllWindows()[0] || null);
});

app.on('window-all-closed', () => {
  app.quit();
});
