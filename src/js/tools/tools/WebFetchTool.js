/**
 * Web Fetch Tool - Fetch web content with SSRF protection
 * @module tools/tools/WebFetchTool
 */

import { TOOL_ACCESS_MODE } from '../core/Tool.js';

/**
 * Detect if URL is internal/dangerous (SSRF protection)
 * Blocks: localhost, 127.x.x.x, 192.168.x.x, 10.x.x.x, 172.16-31.x.x, etc.
 */
function isBlockedInternalURL(url) {
  const hostname = url.hostname;

  // localhost variants
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return true;
  }

  // Private IP ranges
  const privatePatterns = [
    /^192\.168\./,           // 192.168.x.x - common private network
    /^10\./,                  // 10.x.x.x - large private network
    /^172\.(1[6-9]|2\d|3[01])\./, // 172.16-31.x.x - private network
    /^169\.254\./,           // 169.254.x.x - link-local address
    /^127\./,                // 127.x.x.x - localhost
    /^::1$/,                 // IPv6 localhost
    /^fc00:/,                // IPv6 unique local address
    /^fe80:/,                // IPv6 link-local address
  ];

  for (const pattern of privatePatterns) {
    if (pattern.test(hostname)) return true;
  }

  // Block common internal service ports
  const blockedPorts = [8080, 8443, 6379, 27017, 3306, 5432, 1433, 5984, 9200, 11211];
  if (blockedPorts.includes(parseInt(url.port))) return true;

  // Block URLs with internal-looking hosts that might be OAuth callbacks or similar
  if (hostname.match(/\.internal$/i) || hostname.match(/\.local$/i)) {
    return true;
  }

  return false;
}

export const WebFetchTool = {
  name: 'web_fetch',
  description: '获取网页内容',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: '网页 URL' },
    },
    required: ['url'],
  },
  accessMode: TOOL_ACCESS_MODE.READ,
  timeout: 30000,
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  isDestructive: () => false,

  async call(args, options = {}) {
    let url;
    try {
      url = new URL(args.url);
    } catch {
      throw new Error('Invalid URL format');
    }

    // Protocol check
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Access denied: only HTTP/HTTPS protocols supported');
    }

    // SSRF check - block internal URLs
    if (isBlockedInternalURL(url)) {
      throw new Error('Access denied: cannot fetch internal URLs');
    }

    const response = await fetch(args.url, {
      headers: {
        'User-Agent': 'PRTS-Vis/1.0',
        'Accept': 'text/html,application/xhtml+xml,*/*',
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    let content = await response.text();

    // Truncate very large content
    if (content.length > 100000) {
      content = content.slice(0, 100000) + '\n[Content truncated]';
    }

    return {
      url: args.url,
      content,
      contentType: contentType.split(';')[0],
      size: content.length,
    };
  },
};
