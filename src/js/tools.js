import { LOCAL_CVE_DB } from './cveDatabase.js';

function analyze_config_leak(args) {
  var text = (args && args.config_text) || '';
  var findings = [];

  if (/password\s*=\s*["'][^"']+["']/i.test(text)) {
    findings.push('Found hardcoded password assignment');
  }
  if (/\bAK[A-Za-z0-9]{16,}\b/.test(text)) {
    findings.push('Found suspected Access Key (AK) pattern');
  }
  if (/\bSK[A-Za-z0-9]{16,}\b/.test(text)) {
    findings.push('Found suspected Secret Key (SK) pattern');
  }

  if (findings.length === 0) {
    return JSON.stringify({ status: 'clean', details: 'No hardcoded credentials detected.' });
  }

  return JSON.stringify({
    status: 'vulnerable',
    details: findings.join('; '),
    count: findings.length,
  });
}

function query_local_cve(args) {
  var softwareName = (args && args.software_name) || '';
  var version = (args && args.version) || 'unknown';
  console.log('[AGENT.KERNEL] CVE lookup:', softwareName, version);
  var key = softwareName.toLowerCase().trim();
  var db = LOCAL_CVE_DB;

  // exact match first
  if (db[key]) {
    return JSON.stringify({ software: key, matches: db[key], count: db[key].length });
  }

  // fuzzy: partial substring match
  var dbKeys = Object.keys(db);
  for (var i = 0; i < dbKeys.length; i++) {
    if (dbKeys[i].indexOf(key) !== -1 || key.indexOf(dbKeys[i]) !== -1) {
      return JSON.stringify({ software: dbKeys[i], matches: db[dbKeys[i]], count: db[dbKeys[i]].length });
    }
  }

  return JSON.stringify({ status: 'safe', message: '本地指纹库未匹配到 ' + key + ' 的已知高危漏洞' });
}

async function fetch_online_cve(args) {
  var softwareName = (args && args.software_name) || '';
  console.log('[AGENT.KERNEL] Online CVE fetch:', softwareName);

  var keyword = softwareName.toLowerCase().trim();
  if (keyword.indexOf(' ') !== -1) {
    var parts = keyword.split(' ');
    keyword = parts[parts.length - 1];
  }

  try {
    var targetUrl = 'https://api.github.com/advisories?query=' + encodeURIComponent(keyword);
    var resp = await fetch(targetUrl, { signal: AbortSignal.timeout(12000) });

    if (!resp.ok) throw new Error('HTTP error! status: ' + resp.status);

    var results = await resp.json();
    if (!Array.isArray(results)) results = [];

    if (results.length === 0) {
      return JSON.stringify({ status: 'safe', message: 'GitHub Advisory 未检索到 ' + keyword + ' 的相关漏洞数据。' });
    }

    var top3 = results.slice(0, 3);
    var lines = [];
    for (var i = 0; i < top3.length; i++) {
      var item = top3[i];
      var cveId = item.cve_id || item.ghsa_id || 'CVE-UNKNOWN';
      var summary = (item.summary || item.description || '无简述').replace(/\n/g, ' ').slice(0, 120);
      var severity = item.severity ? ' [' + item.severity + ']' : '';
      lines.push((i + 1) + '. ' + cveId + severity + ' ' + summary);
    }

    return '发现在线漏洞情报:\n' + lines.join('\n');
  } catch (e) {
    console.error('[AGENT.TOOLS] fetch_online_cve 报错:', e.message || e);
    if (e.name === 'TimeoutError' || e.name === 'AbortError') {
      return JSON.stringify({ status: 'error', message: '联网查询超时，已自动转为本地知识库分析。' });
    }
    return JSON.stringify({ status: 'error', message: '在线抓取接口暂时出现技术故障。' });
  }
}

var TOOL_MAP = {
  analyze_config_leak: analyze_config_leak,
  query_local_cve: query_local_cve,
  fetch_online_cve: fetch_online_cve,
};

export async function executeTool(name, args) {
  console.log('[AGENT.KERNEL] Executing tool:', name, 'with args:', JSON.stringify(args));
  var fn = TOOL_MAP[name];
  if (!fn) {
    return JSON.stringify({ error: 'Unknown tool: ' + name });
  }
  try {
    var result = fn(args || {});
    console.log('[AGENT.KERNEL] Tool result:', result.slice(0, 200));
    return result;
  } catch (e) {
    return JSON.stringify({ error: 'Tool execution failed: ' + e.message });
  }
}
