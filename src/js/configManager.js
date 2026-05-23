import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

var STORAGE_KEY = 'prts-config';

export var PROVIDER_PRESETS = {
  OpenAI: {
    url: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o',
  },
  DeepSeek: {
    url: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-v4-pro',
  },
  SiliconFlow: {
    url: 'https://api.siliconflow.cn/v1/chat/completions',
    model: 'deepseek-ai/DeepSeek-V3',
  },
  Custom: {
    url: '',
    model: '',
  },
};

// Shared config path (Node.js only)
var SHARED_CONFIG_FILE = null;

function getSharedConfigFile() {
  if (SHARED_CONFIG_FILE) return SHARED_CONFIG_FILE;
  SHARED_CONFIG_FILE = path.join(os.homedir(), '.prts-vis', 'config.json');
  return SHARED_CONFIG_FILE;
}

/**
 * Load config from shared JSON file (Node.js / CLI mode)
 * @returns {Object|null}
 */
function loadFromSharedFile() {
  var file = getSharedConfigFile();
  try {
    if (fs.existsSync(file)) {
      var raw = fs.readFileSync(file, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) { /* ignore */ }
  return null;
}

/**
 * Save config to shared JSON file (Node.js / CLI mode)
 * @param {Object} config
 */
function saveToSharedFile(config) {
  var dir = path.join(os.homedir(), '.prts-vis');
  var file = getSharedConfigFile();
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(file, JSON.stringify(config, null, 2), 'utf8');
  } catch (e) {
    console.error('[CONFIG] Failed to save to shared file:', e.message);
  }
}

/**
 * Check if running in Node.js environment
 * @returns {boolean}
 */
function isNodeEnvironment() {
  return typeof window === 'undefined' && typeof process !== 'undefined' && process.versions && process.versions.node;
}

export function getConfig() {
  // Check environment variables first (for CLI override)
  if (process.env.PRTS_API_KEY) {
    return {
      provider: process.env.PRTS_PROVIDER || 'Custom',
      url: process.env.PRTS_API_URL || '',
      apiKey: process.env.PRTS_API_KEY,
      model: process.env.PRTS_MODEL || '',
    };
  }

  // Node.js / CLI mode: read from shared config file
  if (isNodeEnvironment()) {
    var fileConfig = loadFromSharedFile();
    if (fileConfig) {
      console.log('[CONFIG] Loaded from shared config file');
      return fileConfig;
    }
    return { provider: 'Custom', url: '', apiKey: '', model: '' };
  }

  // Browser / Electron renderer: fall back to localStorage
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return { provider: 'Custom', url: '', apiKey: '', model: '' };
}

export function saveConfig(config) {
  // Browser / Electron renderer: save to localStorage
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) { /* ignore */ }
  }

  // If in Electron renderer, also sync to shared file via IPC
  if (typeof window !== 'undefined' && window.ipcRenderer) {
    console.log('[CONFIG] Using IPC renderer path (window.ipcRenderer)');
    return window.ipcRenderer.invoke('save-config', config).then(function (result) {
      if (result && result.success) {
        console.log('[CONFIG] IPC sync succeeded');
      } else {
        console.warn('[CONFIG] IPC sync failed:', result);
      }
      return result;
    }).catch(function (e) {
      console.warn('[CONFIG] IPC sync error:', e.message);
      throw e;
    });
  } else if (typeof window !== 'undefined' && !isNodeEnvironment()) {
    // Try require('electron') in Electron renderer context
    try {
      var electron = require('electron');
      if (electron && electron.ipcRenderer) {
        console.log('[CONFIG] Using IPC renderer path (require(electron))');
        return electron.ipcRenderer.invoke('save-config', config).then(function (result) {
          if (result && result.success) {
            console.log('[CONFIG] IPC sync succeeded');
          } else {
            console.warn('[CONFIG] IPC sync failed:', result);
          }
          return result;
        }).catch(function (e) {
          console.warn('[CONFIG] IPC sync error:', e.message);
          throw e;
        });
      }
    } catch (e) { /* electron not available */ }
  }

  if (isNodeEnvironment()) {
    // Node.js / CLI mode: save directly to shared file
    saveToSharedFile(config);
  } else {
    console.log('[CONFIG] No IPC path available - config saved to localStorage only');
  }
}