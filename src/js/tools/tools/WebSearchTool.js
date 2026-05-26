/**
 * Web Search Tool - Search the web using Bing RSS
 * @module tools/tools/WebSearchTool
 */

import { TOOL_ACCESS_MODE } from '../core/Tool.js';

export const WebSearchTool = {
  name: 'web_search',
  description: '搜索网络获取最新信息',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索查询词',
        minLength: 2,
      },
      allowed_domains: {
        type: 'array',
        items: { type: 'string' },
        optional: true,
        description: '仅搜索这些域名',
      },
      blocked_domains: {
        type: 'array',
        items: { type: 'string' },
        optional: true,
        description: '排除这些域名',
      },
    },
    required: ['query'],
  },
  accessMode: TOOL_ACCESS_MODE.READ,
  timeout: 30000,
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  isDestructive: () => false,

  async call(args, options = {}) {
    const { query, allowed_domains, blocked_domains } = args;

    if (!query || query.trim().length < 2) {
      return { success: false, error: 'Query must be at least 2 characters' };
    }

    const startTime = Date.now();

    try {
      const searchQuery = encodeURIComponent(query.trim());
      const url = `https://cn.bing.com/search?q=${searchQuery}&format=rss`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`Search failed: HTTP ${response.status}`);
      }

      const text = await response.text();

      // Parse RSS for titles and links
      const titleMatches = text.match(/<title>([^<]+)<\/title>/g) || [];
      const linkMatches = text.match(/<link>([^<]+)<\/link>/g) || [];

      let results = [];
      for (let i = 1; i < Math.min(titleMatches.length, linkMatches.length); i++) {
        const title = titleMatches[i].replace(/<\/?title>/g, '').replace(/&amp;/g, '&');
        const link = linkMatches[i].replace(/<\/?link>/g, '');

        if (title && link && link.startsWith('http')) {
          results.push({ title, url: link });
        }
      }

      // Filter by allowed_domains
      if (allowed_domains && allowed_domains.length > 0) {
        results = results.filter((r) =>
          allowed_domains.some((d) => r.url.includes(d))
        );
      }

      // Filter by blocked_domains
      if (blocked_domains && blocked_domains.length > 0) {
        results = results.filter(
          (r) => !blocked_domains.some((d) => r.url.includes(d))
        );
      }

      // Limit results
      results = results.slice(0, 10);

      const durationSeconds = (Date.now() - startTime) / 1000;

      return {
        success: true,
        query,
        results,
        count: results.length,
        durationSeconds,
      };
    } catch (error) {
      return {
        success: false,
        error: `Search failed: ${error.message}`,
        query,
      };
    }
  },
};