/**
 * Tool Search Tool - Search available tools by keywords
 * @module tools/tools/ToolSearchTool
 */

import { TOOL_ACCESS_MODE } from '../core/Tool.js';
import { toolRegistry } from '../core/ToolRegistry.js';

export const ToolSearchTool = {
  name: 'tool_search',
  description: '搜索可用的工具',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索查询词',
        minLength: 1,
      },
      max_results: {
        type: 'number',
        optional: true,
        description: '最大返回结果数（默认 5）',
      },
    },
    required: ['query'],
  },
  accessMode: TOOL_ACCESS_MODE.READ,
  timeout: 5000,
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  isDestructive: () => false,

  async call(args, options = {}) {
    const { query, max_results = 5 } = args;

    if (!query || query.trim().length === 0) {
      return { success: false, error: 'Query is required' };
    }

    const searchQuery = query.toLowerCase().trim();
    const allTools = toolRegistry.getAll();

    // Search by name and description
    const matches = allTools
      .filter((tool) => {
        const nameMatch = tool.name.toLowerCase().includes(searchQuery);
        const descMatch = tool.description?.toLowerCase().includes(searchQuery);
        return nameMatch || descMatch;
      })
      .slice(0, max_results)
      .map((tool) => ({
        name: tool.name,
        description: tool.description,
        accessMode: tool.accessMode,
      }));

    return {
      success: true,
      query,
      matches,
      total_tools: allTools.length,
      count: matches.length,
    };
  },
};