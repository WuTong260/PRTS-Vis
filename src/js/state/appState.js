/**
 * App State - Simple global state management for PRTS-Vis
 * @module state/appState
 */

/**
 * Simple pub/sub state store
 */
class AppState {
  constructor() {
    /** @type {Map<string, any>} */
    this._state = new Map();
    /** @type {Map<string, Set<Function>>} */
    this._subscribers = new Map();
  }

  /**
   * Get a state value
   * @param {string} key
   * @param {*} defaultValue
   * @returns {*}
   */
  get(key, defaultValue = null) {
    return this._state.get(key) ?? defaultValue;
  }

  /**
   * Set a state value and notify subscribers
   * @param {string} key
   * @param {*} value
   */
  set(key, value) {
    const prev = this._state.get(key);
    if (prev === value) return;

    this._state.set(key, value);
    this._notify(key, value, prev);
  }

  /**
   * Update state with a partial merge (only changed fields)
   * @param {string} key
   * @param {Object} partial - partial update object
   */
  update(key, partial) {
    const prev = this._state.get(key) || {};
    if (typeof prev !== 'object' || prev === null) {
      this.set(key, partial);
      return;
    }

    const next = { ...prev, ...partial };
    this.set(key, next);
  }

  /**
   * Subscribe to state changes
   * @param {string} key
   * @param {Function} callback - (newValue, oldValue) => void
   * @returns {Function} unsubscribe function
   */
  subscribe(key, callback) {
    if (!this._subscribers.has(key)) {
      this._subscribers.set(key, new Set());
    }
    this._subscribers.get(key).add(callback);

    return () => {
      this._subscribers.get(key)?.delete(callback);
    };
  }

  /**
   * Get all keys
   * @returns {string[]}
   */
  keys() {
    return Array.from(this._state.keys());
  }

  /**
   * Get all state as plain object
   * @returns {Object}
   */
  toObject() {
    return Object.fromEntries(this._state);
  }

  /**
   * Clear all state
   */
  clear() {
    this._state.clear();
    this._subscribers.clear();
  }

  _notify(key, value, prev) {
    const subs = this._subscribers.get(key);
    if (subs) {
      for (const cb of subs) {
        try {
          cb(value, prev);
        } catch (e) {
          console.error(`[APPSTATE] Subscriber error for key "${key}":`, e);
        }
      }
    }
  }
}

// Session-scoped state instances
const _sessionStates = new Map();

/**
 * Get or create session-scoped state
 * @param {string} sessionId
 * @returns {AppState}
 */
export function getSessionState(sessionId = 'default') {
  if (!_sessionStates.has(sessionId)) {
    _sessionStates.set(sessionId, new AppState());
  }
  return _sessionStates.get(sessionId);
}

/**
 * Clear a specific session
 * @param {string} sessionId
 */
export function clearSessionState(sessionId = 'default') {
  _sessionStates.delete(sessionId);
}

/**
 * Clear all sessions
 */
export function clearAllSessions() {
  _sessionStates.clear();
}

// Default global state instance
export const appState = getSessionState('default');

// Convenience exports
export const getState = (key, defaultValue) => appState.get(key, defaultValue);
export const setState = (key, value) => appState.set(key, value);
export const updateState = (key, partial) => appState.update(key, partial);
export const subscribeState = (key, callback) => appState.subscribe(key, callback);
