/**
 * FetchOnlineCveTool - Fetch real-time CVE data from GitHub Advisory API
 * @module tools/tools/FetchOnlineCveTool
 */

import { TOOL_ACCESS_MODE } from '../core/Tool.js';

const SCHEMA = {
  type: 'object',
  properties: {
    software_name: {
      type: 'string',
      description: 'Software name to query (e.g., redis, log4j, openssh)',
      minLength: 2,
      maxLength: 128,
    },
  },
  required: ['software_name'],
};

// Degradation strategy - fallback to local analysis when online fails
const DEGRADATION = {
  strategy: 'fallback_to_knowledge',
  message: 'Online CVE fetch unavailable. Consider using query_local_cve for local database lookup.',
};

/**
 * @type {Object}
 */
export const FetchOnlineCveTool = {
  name: 'fetch_online_cve',
  description: 'Fetch real-time CVE vulnerability data from GitHub Advisory API. Use when local database misses or user requests latest intelligence.',
  inputSchema: SCHEMA,
  category: 'cve',
  timeout: 15000,
  accessMode: TOOL_ACCESS_MODE.READ,

  isConcurrencySafe: () => true,
  isReadOnly: () => true,
  isDestructive: () => false,
  isPrivacyRisk: () => false,

  getResourceId: (args) => `cve_online_${args.software_name || 'unknown'}`,

  validateInput(input) {
    const errors = [];

    if (!input || typeof input !== 'object') {
      return { valid: false, errors: [{ field: 'software_name', type: 'required', hint: 'software_name is required' }] };
    }

    if (typeof input.software_name !== 'string' || input.software_name.trim().length < 2) {
      errors.push({
        field: 'software_name',
        type: 'minLength',
        hint: 'software_name must be at least 2 characters',
      });
    }

    return { valid: errors.length === 0, errors, data: errors.length === 0 ? input : null };
  },

  async call(args, options = {}) {
    const { onProgress } = options;
    const softwareName = (args.software_name || '').toLowerCase().trim();

    console.log('[CVE.TOOL] Online fetch:', softwareName);
    onProgress?.({ type: 'fetching', source: 'github_advisory' });

    // Normalize software name
    let keyword = softwareName;
    if (keyword.includes(' ')) {
      keyword = keyword.split(' ').pop();
    }

    try {
      const url = `https://api.github.com/advisories?query=${encodeURIComponent(keyword)}`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(12000),
        headers: {
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'PRTS-Vis/1.0',
        },
      });

      onProgress?.({ type: 'received', status: response.status });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const results = await response.json();
      const advisories = Array.isArray(results) ? results : [];

      if (advisories.length === 0) {
        return {
          status: 'safe',
          software: keyword,
          message: `No related vulnerabilities found in GitHub Advisory for ${keyword}`,
          source: 'online',
          queryTime: Date.now(),
        };
      }

      // Format top results with key fields
      const topResults = advisories.slice(0, 10).map(item => ({
        id: item.cve_id || item.ghsa_id || 'UNKNOWN',
        severity: item.severity || 'unknown',
        summary: this._truncateText(item.summary || item.description || 'No description', 150),
        published: item.published_at,
        updated: item.updated_at,
        references: item.references?.slice(0, 3) || [],
        cvss: item.cvss?.score || null,
        cwe: item.cwe?.map(c => c.name) || [],
      }));

      const severityBreakdown = advisories.reduce((acc, a) => {
        const sev = a.severity || 'unknown';
        acc[sev] = (acc[sev] || 0) + 1;
        return acc;
      }, {});

      onProgress?.({ type: 'complete', count: advisories.length });

      return {
        status: 'found',
        software: keyword,
        totalMatches: advisories.length,
        severityBreakdown,
        advisories: topResults,
        source: 'github_advisory',
        queryTime: Date.now(),
      };
    } catch (error) {
      console.error('[CVE.TOOL] Online fetch failed:', error.message);

      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        return {
          status: 'degraded',
          software: keyword,
          message: 'Online query timeout. Try again later or use query_local_cve for offline database.',
          source: 'online_timeout',
          originalError: error.message,
          ...DEGRADATION,
        };
      }

      return {
        status: 'error',
        software: keyword,
        message: 'Failed to fetch from online CVE database',
        source: 'online_error',
        error: error.message,
        ...DEGRADATION,
      };
    }
  },

  _truncateText(text, maxLength) {
    if (!text) return '';
    const cleaned = text.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleaned.length <= maxLength) return cleaned;
    return cleaned.slice(0, maxLength - 3) + '...';
  },
};