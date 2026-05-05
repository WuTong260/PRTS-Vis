const { app, BrowserWindow, session, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const { autoUpdater } = require('electron-updater');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

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

var cpuPrev = os.cpus();

ipcMain.on('window-min', function () { BrowserWindow.getFocusedWindow()?.minimize(); });
ipcMain.on('window-max', function () { var w = BrowserWindow.getFocusedWindow(); if (w) w.isMaximized() ? w.unmaximize() : w.maximize(); });
ipcMain.on('window-close', function () { BrowserWindow.getFocusedWindow()?.close(); });

ipcMain.handle('get-sys-stats', function () {
  var cpus = os.cpus();
  var totalIdle = 0;
  var totalTick = 0;

  for (var i = 0; i < cpus.length; i++) {
    var cpu = cpus[i];
    for (var t in cpu.times) totalTick += cpu.times[t];
    totalIdle += cpu.times.idle;

    if (cpuPrev[i]) {
      var prevTotal = 0;
      var prevIdle = cpuPrev[i].times.idle;
      for (var pt in cpuPrev[i].times) prevTotal += cpuPrev[i].times[pt];
      totalTick -= prevTotal;
      totalIdle -= prevIdle;
    }
  }

  cpuPrev = cpus;
  var cpuUsage = totalTick > 0 ? Math.round((1 - totalIdle / totalTick) * 100) : 0;

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
  };
});

function setupAutoUpdater(win) {
  if (isDev) return;

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

app.whenReady().then(() => {
  setupPermissions();
  createWindow();
  setupAutoUpdater(BrowserWindow.getAllWindows()[0] || null);
});

app.on('window-all-closed', () => {
  app.quit();
});
