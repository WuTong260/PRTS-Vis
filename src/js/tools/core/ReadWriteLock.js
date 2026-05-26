/**
 * Read-Write Lock Implementation
 * @module tools/core/ReadWriteLock
 */

/**
 * ReadWriteLock - Allows multiple readers or single writer
 *
 * Readers can access resource concurrently
 * Writers get exclusive access
 * Writers wait for all readers to finish
 */
export class ReadWriteLock {
  constructor() {
    this._readers = 0;
    this._writers = 0;
    this._pendingWriters = 0;
    this._readQueue = [];
    this._writeQueue = [];
  }

  /**
   * Acquire a read lock - multiple readers allowed
   * @returns {Promise<{release: Function}>}
   */
  async acquireRead() {
    if (this._writers === 0 && this._pendingWriters === 0) {
      this._readers++;
      return { release: () => this._releaseRead() };
    }

    return new Promise(resolve => {
      this._readQueue.push({ resolve, type: 'read' });
    });
  }

  /**
   * Acquire a write lock - exclusive access
   * @returns {Promise<{release: Function}>}
   */
  async acquireWrite() {
    if (this._readers === 0 && this._writers === 0) {
      this._writers++;
      return { release: () => this._releaseWrite() };
    }

    this._pendingWriters++;
    return new Promise(resolve => {
      this._writeQueue.push({ resolve, type: 'write' });
    });
  }

  _releaseRead() {
    this._readers--;
    if (this._readers === 0) {
      this._wakeWriterIfNeeded();
    }
  }

  _releaseWrite() {
    this._writers--;
    if (this._writers === 0) {
      this._wakeAllReaders();
    }
    this._wakeWriterIfNeeded();
  }

  _wakeAllReaders() {
    while (this._readQueue.length > 0 && this._writers === 0 && this._pendingWriters === 0) {
      const reader = this._readQueue.shift();
      this._readers++;
      reader.resolve({ release: () => this._releaseRead() });
    }
  }

  _wakeWriterIfNeeded() {
    if (this._writeQueue.length > 0 && this._readers === 0 && this._writers === 0) {
      const writer = this._writeQueue.shift();
      this._pendingWriters--;
      this._writers++;
      writer.resolve({ release: () => this._releaseWrite() });
    }
  }

  get stats() {
    return {
      readers: this._readers,
      writers: this._writers,
      pendingWriters: this._pendingWriters,
      readQueue: this._readQueue.length,
      writeQueue: this._writeQueue.length,
    };
  }
}

/**
 * Global lock manager for tool resources
 */
class LockManager {
  constructor() {
    this._locks = new Map();
  }

  /**
   * @param {string} resourceId
   * @returns {ReadWriteLock}
   */
  getLock(resourceId) {
    if (!this._locks.has(resourceId)) {
      this._locks.set(resourceId, new ReadWriteLock());
    }
    return this._locks.get(resourceId);
  }

  /**
   * Execute function with read lock
   * @param {string} resourceId
   * @param {Function} fn
   * @returns {Promise<*>}
   */
  async withReadLock(resourceId, fn) {
    const lock = this.getLock(resourceId);
    const acquired = await lock.acquireRead();
    try {
      return await fn();
    } finally {
      acquired.release();
    }
  }

  /**
   * Execute function with write lock
   * @param {string} resourceId
   * @param {Function} fn
   * @returns {Promise<*>}
   */
  async withWriteLock(resourceId, fn) {
    const lock = this.getLock(resourceId);
    const acquired = await lock.acquireWrite();
    try {
      return await fn();
    } finally {
      acquired.release();
    }
  }

  clear() {
    this._locks.clear();
  }
}

export const lockManager = new LockManager();