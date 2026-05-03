var STORAGE_KEY = 'prts-config';

export var PROVIDER_PRESETS = {
  OpenAI: {
    url: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o',
  },
  DeepSeek: {
    url: 'https://api.deepseek.com/chat/completions',
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

export function getConfig() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return { provider: 'Custom', url: '', apiKey: '', model: '' };
}

export function saveConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}
