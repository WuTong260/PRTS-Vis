/**
 * Tool Registry - Tool discovery and registration
 * @module tools/core/ToolRegistry
 */

import { InputValidator } from './InputValidator.js';

class ToolRegistry {
  constructor() {
    /** @type {Map<string, Object>} */
    this._tools = new Map();
    this._featureGates = new Map();
  }

  /**
   * Register a tool with full metadata
   * @param {Object} tool - Tool definition
   */
  register(tool) {
    if (!tool || !tool.name) {
      console.warn('[TOOL.REGISTRY] Cannot register tool without name');
      return;
    }

    if (this._tools.has(tool.name)) {
      console.warn(`[TOOL.REGISTRY] Tool ${tool.name} already registered, skipping`);
      return;
    }

    const registeredTool = {
      ...tool,
      _validator: tool.inputSchema ? new InputValidator(tool.inputSchema) : null,
    };

    this._tools.set(tool.name, registeredTool);
    console.log(`[TOOL.REGISTRY] Registered tool: ${tool.name}`);
  }

  /**
   * Register multiple tools
   * @param {Object[]} tools
   */
  registerAll(tools) {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /**
   * Get tool by name
   * @param {string} name
   * @returns {Object|undefined}
   */
  get(name) {
    return this._tools.get(name);
  }

  /**
   * Get all registered tools
   * @returns {Object[]}
   */
  getAll() {
    return Array.from(this._tools.values());
  }

  /**
   * Get tools by category
   * @param {string} category
   * @returns {Object[]}
   */
  getByCategory(category) {
    return this.getAll().filter(t => t.category === category);
  }

  /**
   * Find tools matching a query
   * @param {string} query
   * @returns {Object[]}
   */
  search(query) {
    const q = query.toLowerCase();
    return this.getAll().filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      t.category?.toLowerCase().includes(q)
    );
  }

  /**
   * Check if tool is enabled (feature gate check)
   * @param {string} name
   * @returns {boolean}
   */
  isEnabled(name) {
    const gate = this._featureGates.get(name);
    if (!gate) return true;

    if (typeof gate === 'function') {
      return gate();
    }
    if (typeof gate === 'string') {
      return process.env[gate] === 'true';
    }
    return true;
  }

  /**
   * Set feature gate for tool
   * @param {string} name
   * @param {string|Function} gate
   */
  setFeatureGate(name, gate) {
    this._featureGates.set(name, gate);
  }

  /**
   * Remove a tool from registry
   * @param {string} name
   */
  unregister(name) {
    this._tools.delete(name);
    console.log(`[TOOL.REGISTRY] Unregistered tool: ${name}`);
  }

  clear() {
    this._tools.clear();
    console.log('[TOOL.REGISTRY] Registry cleared');
  }
}

export const toolRegistry = new ToolRegistry();