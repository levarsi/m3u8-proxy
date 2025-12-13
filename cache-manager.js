const config = require('./config');

/**
 * 简单的缓存管理器
 */
class CacheManager {
  constructor() {
    this.cache = new Map();
    this.enabled = config.cache.enabled;
    this.ttl = config.cache.ttl;
    this.maxSize = config.cache.maxSize;
  }

  /**
   * 生成缓存键
   * @param {string} url - 源URL
   * @returns {string} 缓存键
   */
  generateKey(url) {
    return `m3u8:${url}`;
  }

  /**
   * 获取缓存项
   * @param {string} key - 缓存键
   * @returns {object|null} 缓存数据或null
   */
  get(key) {
    if (!this.enabled) return null;

    const item = this.cache.get(key);
    if (!item) return null;

    // 检查是否过期
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  /**
   * 设置缓存项
   * @param {string} key - 缓存键
   * @param {object} data - 缓存数据
   */
  set(key, data) {
    if (!this.enabled) return;

    // 如果缓存达到最大大小，删除最旧的一项
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data: data,
      timestamp: Date.now()
    });
  }

  /**
   * 清除缓存
   */
  clear() {
    this.cache.clear();
  }

  /**
   * 获取缓存统计信息
   * @returns {object} 缓存统计
   */
  getStats() {
    return {
      enabled: this.enabled,
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl
    };
  }
}

module.exports = CacheManager;