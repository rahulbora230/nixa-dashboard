// Simple in-memory cache for production
// In production, consider using Redis or similar

class SimpleCache {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.accessOrder = [];
  }

  set(key, value, ttl = 300000) { // 5 minutes default TTL
    // Remove oldest items if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.accessOrder[0];
      this.cache.delete(oldestKey);
      this.accessOrder.shift();
    }

    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl
    });

    // Update access order
    if (!this.accessOrder.includes(key)) {
      this.accessOrder.push(key);
    }
  }

  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    // Check if item has expired
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
      return null;
    }

    // Update access order
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    this.accessOrder.push(key);

    return item.value;
  }

  has(key) {
    const item = this.cache.get(key);
    if (!item) return false;
    
    return Date.now() <= item.expiry;
  }

  delete(key) {
    this.cache.delete(key);
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  clear() {
    this.cache.clear();
    this.accessOrder = [];
  }

  // Cleanup expired items
  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
    
    // Rebuild access order
    this.accessOrder = Array.from(this.cache.keys());
  }

  size() {
    return this.cache.size;
  }
}

// Cache instances for different data types
const userCache = new SimpleCache(50);
const releaseCache = new SimpleCache(100);
const metadataCache = new SimpleCache(200);

// Periodic cleanup
setInterval(() => {
  userCache.cleanup();
  releaseCache.cleanup();
  metadataCache.cleanup();
}, 60000); // Every minute

module.exports = {
  userCache,
  releaseCache,
  metadataCache,
  SimpleCache
};
