const fs = require('fs').promises;
const path = require('path');
const config = require('./config');
const logger = require('./logger');
const statsManager = require('./stats-manager');

/**
 * 增强的缓存管理器
 * 支持持久化缓存和智能缓存策略
 */
class CacheManager {
  constructor() {
    this.cache = new Map();
    this.enabled = config.cache.enabled;
    this.ttl = config.cache.ttl;
    this.maxSize = config.cache.maxSize;
    this.persistence = config.cache.persistence;
    this.strategy = config.cache.strategy;
    
    // 缓存统计信息
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      persistenceSaves: 0,
      persistenceLoads: 0,
      totalRequests: 0
    };
    
    // 访问频率统计（用于智能缓存策略）
    this.accessFrequency = new Map();
    
    // 初始化持久化缓存
    if (this.persistence.enabled) {
      this.initPersistence();
    }
    
    // 定期保存缓存（如果启用了持久化）
    if (this.persistence.enabled && this.persistence.autoSave) {
      this.startAutoSave();
    }
  }

  /**
   * 初始化持久化缓存
   */
  async initPersistence() {
    try {
      // 确保缓存目录存在
      const cacheDir = path.dirname(this.persistence.filePath);
      await fs.mkdir(cacheDir, { recursive: true });
      
      // 加载持久化缓存
      await this.loadFromDisk();
      logger.info('持久化缓存初始化完成', { path: this.persistence.filePath });
    } catch (error) {
      logger.warn('持久化缓存初始化失败', { error: error.message });
    }
  }

  /**
   * 从磁盘加载缓存
   */
  async loadFromDisk() {
    try {
      const data = await fs.readFile(this.persistence.filePath, 'utf8');
      const cacheData = JSON.parse(data);
      
      // 恢复缓存数据
      this.cache = new Map();
      for (const [key, item] of Object.entries(cacheData.cache || {})) {
        // 检查是否过期
        if (Date.now() - item.timestamp <= this.ttl) {
          this.cache.set(key, item);
        }
      }
      
      // 恢复访问频率统计
      this.accessFrequency = new Map(Object.entries(cacheData.accessFrequency || {}));
      
      this.stats.persistenceLoads++;
      logger.info('从磁盘加载缓存', { 
        items: this.cache.size,
        path: this.persistence.filePath 
      });
      
      this.updateGlobalSnapshot();
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.warn('加载缓存失败', { error: error.message });
      }
    }
  }

  /**
   * 保存缓存到磁盘
   */
  async saveToDisk() {
    if (!this.persistence.enabled) return;
    
    try {
      const cacheData = {
        cache: Object.fromEntries(this.cache),
        accessFrequency: Object.fromEntries(this.accessFrequency),
        timestamp: Date.now(),
        version: '1.0'
      };
      
      await fs.writeFile(
        this.persistence.filePath, 
        JSON.stringify(cacheData, null, 2),
        'utf8'
      );
      
      this.stats.persistenceSaves++;
      logger.debug('缓存已保存到磁盘', { 
        items: this.cache.size,
        path: this.persistence.filePath 
      });
    } catch (error) {
      logger.warn('保存缓存失败', { error: error.message });
    }
  }

  /**
   * 启动自动保存
   */
  startAutoSave() {
    this.autoSaveInterval = setInterval(
      () => this.saveToDisk(),
      this.persistence.saveInterval
    );
    
    // 优雅关闭时保存缓存
    process.on('SIGTERM', () => {
      this.saveToDisk();
    });
    
    process.on('SIGINT', () => {
      this.saveToDisk();
    });
  }

  /**
   * 计算智能TTL
   * @param {string} key - 缓存键
   * @param {object} data - 缓存数据
   * @returns {number} TTL值（毫秒）
   */
  calculateSmartTTL(key, data) {
    if (!this.strategy.enabled) {
      return this.ttl;
    }
    
    let ttl = this.ttl;
    
    // 基于文件大小的TTL策略
    if (this.strategy.sizeBased.enabled) {
      const contentSize = JSON.stringify(data).length;
      const isLargeFile = contentSize > 10240; // 10KB
      
      if (isLargeFile) {
        ttl = this.strategy.sizeBased.largeFileTtl;
      } else {
        ttl = this.strategy.sizeBased.smallFileTtl;
      }
    }
    
    // 基于访问频率的TTL策略
    if (this.strategy.frequencyBased.enabled) {
      const frequency = this.accessFrequency.get(key) || 0;
      if (frequency >= this.strategy.frequencyBased.hitThreshold) {
        ttl *= this.strategy.frequencyBased.bonusMultiplier;
      }
    }
    
    return ttl;
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
   * 获取缓存项 - 增强版
   * @param {string} key - 缓存键
   * @returns {object|null} 缓存数据或null
   */
  get(key) {
    if (!this.enabled) {
      this.stats.misses++;
      this.stats.totalRequests++;
      statsManager.incrementRequest();
      return null;
    }

    const item = this.cache.get(key);
    this.stats.totalRequests++;
    statsManager.incrementRequest();
    
    if (!item) {
      this.stats.misses++;
      return null;
    }

    // 更新访问频率
    const currentFrequency = this.accessFrequency.get(key) || 0;
    this.accessFrequency.set(key, currentFrequency + 1);

    // 检查是否过期
    const effectiveTTL = this.calculateSmartTTL(key, item.data);
    if (Date.now() - item.timestamp > effectiveTTL) {
      this.cache.delete(key);
      this.accessFrequency.delete(key);
      this.stats.misses++;
      this.stats.deletes++;
      
      // 更新全局快照
      this.updateGlobalSnapshot();
      return null;
    }

    this.stats.hits++;
    statsManager.incrementCacheHit();
    logger.debug('缓存命中', { key, frequency: currentFrequency + 1 });
    return item.data;
  }

  /**
   * 设置缓存项 - 增强版
   * @param {string} key - 缓存键
   * @param {object} data - 缓存数据
   */
  set(key, data) {
    if (!this.enabled) return;

    // 如果缓存达到最大大小，使用LRU策略删除最旧的一项
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data: data,
      timestamp: Date.now(),
      size: JSON.stringify(data).length
    });
    
    // 初始化访问频率
    if (!this.accessFrequency.has(key)) {
      this.accessFrequency.set(key, 0);
    }
    
    this.stats.sets++;
    logger.debug('缓存设置', { key, size: this.cache.size });
    
    this.updateGlobalSnapshot();
  }

  /**
   * 更新全局统计快照
   */
  updateGlobalSnapshot() {
    const memoryUsage = this.getMemoryUsage();
    statsManager.updateCacheSnapshot(this.cache.size, memoryUsage.totalSizeBytes);
  }

  /**
   * LRU淘汰策略
   */
  evictLRU() {
    let oldestKey = null;
    let oldestAccess = Infinity;
    
    for (const [key, frequency] of this.accessFrequency.entries()) {
      if (frequency < oldestAccess) {
        oldestAccess = frequency;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.accessFrequency.delete(oldestKey);
      this.stats.evictions++;
      logger.debug('LRU淘汰', { key: oldestKey, frequency: oldestAccess });
    }
  }

  /**
   * 清除缓存 - 增强版
   */
  clear() {
    const clearedCount = this.cache.size;
    this.cache.clear();
    this.accessFrequency.clear();
    this.stats.deletes += clearedCount;
    logger.info('缓存已清除', { clearedCount });
    this.updateGlobalSnapshot();
  }

  /**
   * 获取缓存统计信息 - 增强版
   * @returns {object} 缓存统计
   */
  getStats() {
    const hitRate = this.stats.totalRequests > 0 
      ? (this.stats.hits / this.stats.totalRequests * 100).toFixed(2)
      : 0;
    
    return {
      enabled: this.enabled,
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
      persistence: this.persistence,
      strategy: this.strategy,
      stats: {
        ...this.stats,
        hitRate: `${hitRate}%`,
        memoryUsage: this.getMemoryUsage()
      },
      topAccessed: this.getTopAccessedItems(5)
    };
  }

  /**
   * 获取内存使用情况
   * @returns {object} 内存使用信息
   */
  getMemoryUsage() {
    let totalSize = 0;
    for (const item of this.cache.values()) {
      totalSize += item.size || 0;
    }
    
    return {
      totalSizeBytes: totalSize,
      totalSizeHuman: this.formatBytes(totalSize),
      averageItemSize: this.cache.size > 0 ? Math.round(totalSize / this.cache.size) : 0
    };
  }

  /**
   * 获取访问频率最高的项目
   * @param {number} limit - 返回数量限制
   * @returns {Array} 访问频率最高的项目
   */
  getTopAccessedItems(limit = 5) {
    const items = Array.from(this.accessFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([key, frequency]) => ({
        key: key.replace('m3u8:', ''),
        frequency
      }));
    
    return items;
  }

  /**
   * 格式化字节数
   * @param {number} bytes - 字节数
   * @returns {string} 格式化后的字符串
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 手动触发持久化保存
   */
  async forceSave() {
    await this.saveToDisk();
  }
}

module.exports = CacheManager;