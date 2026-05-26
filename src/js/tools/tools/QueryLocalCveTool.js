/**
 * QueryLocalCveTool - Query local offline CVE database
 * @module tools/tools/QueryLocalCveTool
 */

import { LOCAL_CVE_DB } from '../../cveDatabase.js';
import { TOOL_ACCESS_MODE } from '../core/Tool.js';

const SCHEMA = {
  type: 'object',
  properties: {
    software_name: {
      type: 'string',
      description: 'Software name to query (e.g., redis, nginx, log4j)',
      minLength: 1,
      maxLength: 64,
    },
    version: {
      type: 'string',
      description: 'Software version (e.g., 5.0.5). Use "unknown" if not specified.',
      default: 'unknown',
    },
  },
  required: ['software_name'],
};

/**
 * @type {Object}
 */
export const QueryLocalCveTool = {
  name: 'query_local_cve',
  description: 'Query local offline vulnerability database. Returns matched CVE list when user asks about software security vulnerabilities.',
  inputSchema: SCHEMA,
  category: 'cve',
  timeout: 3000,
  accessMode: TOOL_ACCESS_MODE.READ,

  isConcurrencySafe: () => true,
  isReadOnly: () => true,
  isDestructive: () => false,
  isPrivacyRisk: () => false,

  getResourceId: (args) => `cve_local_${args.software_name || 'unknown'}`,

  validateInput(input) {
    const errors = [];

    if (!input || typeof input !== 'object') {
      return { valid: false, errors: [{ field: 'software_name', type: 'required', hint: 'software_name is required' }] };
    }

    if (typeof input.software_name !== 'string' || input.software_name.trim().length === 0) {
      errors.push({ field: 'software_name', type: 'required', hint: 'software_name must be a non-empty string' });
    }

    if (input.version !== undefined && typeof input.version !== 'string') {
      errors.push({ field: 'version', type: 'type', expected: 'string', received: typeof input.version });
    }

    return { valid: errors.length === 0, errors, data: errors.length === 0 ? input : null };
  },

  async call(args, options = {}) {
    const softwareName = (args.software_name || '').toLowerCase().trim();
    const version = args.version || 'unknown';

    console.log('[CVE.TOOL] Local lookup:', softwareName, version);

    // Exact match first
    if (LOCAL_CVE_DB[softwareName]) {
      const matches = LOCAL_CVE_DB[softwareName];

      // Check version range if specified
      const relevantMatches = version !== 'unknown'
        ? matches.filter(m => this._versionMatches(version, m.version_range))
        : matches;

      return {
        software: softwareName,
        version,
        matches: relevantMatches.length > 0 ? relevantMatches : matches,
        matchCount: relevantMatches.length > 0 ? relevantMatches.length : matches.length,
        totalInDb: matches.length,
        source: 'local',
        queryTime: Date.now(),
      };
    }

    // Fuzzy match
    const keys = Object.keys(LOCAL_CVE_DB);
    for (const key of keys) {
      if (key.includes(softwareName) || softwareName.includes(key)) {
        const matches = LOCAL_CVE_DB[key];
        return {
          software: key,
          originalQuery: softwareName,
          version,
          matches,
          matchCount: matches.length,
          source: 'local_fuzzy',
          queryTime: Date.now(),
          note: `Matched by fuzzy search: "${key}"`,
        };
      }
    }

    return {
      status: 'safe',
      software: softwareName,
      version,
      message: `No known high-risk vulnerabilities found for ${softwareName} in local database`,
      source: 'local',
      queryTime: Date.now(),
    };
  },

  _versionMatches(version, range) {
    if (!range || range === 'any' || range === '*') return true;

    // Simple version comparison for common cases
    if (range.startsWith('<=')) {
      const target = range.slice(2).trim();
      return this._compareVersions(version, target) <= 0;
    }
    if (range.startsWith('<')) {
      const target = range.slice(1).trim();
      return this._compareVersions(version, target) < 0;
    }
    if (range.startsWith('>=')) {
      const target = range.slice(2).trim();
      return this._compareVersions(version, target) >= 0;
    }

    // Handle range like "2.0-beta9 to 2.14.1"
    const match = range.match(/([\d.]+)\s+to\s+([\d.]+)/);
    if (match) {
      const [, low, high] = match;
      return this._compareVersions(version, low) >= 0 && this._compareVersions(version, high) <= 0;
    }

    return true;
  },

  _compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(p => parseInt(p, 10) || 0);
    const parts2 = v2.split('.').map(p => parseInt(p, 10) || 0);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 !== p2) return p1 - p2;
    }
    return 0;
  },
};