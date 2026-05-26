/**
 * AnalyzeConfigLeakTool - Enhanced tool for scanning hardcoded credentials
 * @module tools/tools/AnalyzeConfigLeakTool
 */

import { TOOL_ACCESS_MODE } from '../core/Tool.js';

const SCHEMA = {
  type: 'object',
  properties: {
    config_text: {
      type: 'string',
      description: 'The configuration content to scan for credential leaks',
    },
  },
  required: ['config_text'],
};

/**
 * @type {Object}
 */
export const AnalyzeConfigLeakTool = {
  name: 'analyze_config_leak',
  description: 'Analyze configuration text for hardcoded credentials such as passwords, access keys (AK), or secret keys (SK). Returns vulnerability assessment with findings.',
  inputSchema: SCHEMA,
  category: 'security',
  timeout: 5000,
  accessMode: TOOL_ACCESS_MODE.READ,

  isConcurrencySafe: () => true,
  isReadOnly: () => true,
  isDestructive: () => false,
  isPrivacyRisk: () => false,

  getResourceId: () => 'config_analysis',

  validateInput(input) {
    if (!input || typeof input !== 'object') {
      return { valid: false, errors: [{ field: 'config_text', type: 'required', hint: 'config_text is required' }] };
    }
    if (typeof input.config_text !== 'string') {
      return { valid: false, errors: [{ field: 'config_text', type: 'type', expected: 'string', received: typeof input.config_text }] };
    }
    return { valid: true, errors: [], data: input };
  },

  async call(args, options = {}) {
    const text = args.config_text || '';
    const findings = [];

    const patterns = [
      { regex: /password\s*[=:]\s*["'][^"']{1,128}["']/gi, label: 'hardcoded_password', severity: 'HIGH' },
      { regex: /api[_-]?key\s*[=:]\s*["'][^"']{8,128}["']/gi, label: 'api_key_assignment', severity: 'MEDIUM' },
      { regex: /bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/gi, label: 'bearer_token', severity: 'HIGH' },
      { regex: /\bAK[A-Za-z0-9]{16,32}\b/g, label: 'aws_access_key_pattern', severity: 'HIGH' },
      { regex: /\bSK[A-Za-z0-9]{16,32}\b/g, label: 'aws_secret_key_pattern', severity: 'HIGH' },
      { regex: /xox[baprs]-[0-9]{10,}[-A-Za-z0-9]*/gi, label: 'slack_token', severity: 'MEDIUM' },
      { regex: /ghp_[A-Za-z0-9]{36}/g, label: 'github_personal_token', severity: 'HIGH' },
      { regex: /sk-[A-Za-z0-9]{48}/g, label: 'openai_api_key', severity: 'CRITICAL' },
      { regex: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/gi, label: 'private_key', severity: 'CRITICAL' },
      { regex: /conn[_-]?str(ing)?\s*[=:]\s*["'][^"']{20,}["']/gi, label: 'connection_string', severity: 'MEDIUM' },
    ];

    for (const { regex, label, severity } of patterns) {
      const matches = text.match(regex);
      if (matches) {
        findings.push({
          type: label,
          severity,
          count: matches.length,
          samples: matches.slice(0, 3).map(m => m.length > 60 ? m.slice(0, 60) + '...' : m),
        });
      }
    }

    if (findings.length === 0) {
      return {
        status: 'clean',
        message: 'No hardcoded credentials detected in configuration',
        scannedLength: text.length,
      };
    }

    const severityCounts = findings.reduce((acc, f) => {
      acc[f.severity] = (acc[f.severity] || 0) + f.count;
      return acc;
    }, {});

    return {
      status: 'vulnerable',
      severityCounts,
      findings,
      totalFindings: findings.reduce((sum, f) => sum + f.count, 0),
      scannedLength: text.length,
      recommendation: 'Remove or externalize hardcoded credentials. Use environment variables or secret management systems.',
    };
  },
};