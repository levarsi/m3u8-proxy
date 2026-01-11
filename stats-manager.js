const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

class StatsManager {
  constructor() {
    if (StatsManager.instance) {
      return StatsManager.instance;
    }

    this.statsFilePath = path.join(__dirname, 'data', 'global-stats.json');
    this.saveIntervalMs = 60000; // 1 minute
    this.autoSaveTimer = null;
    this.saveQueue = Promise.resolve(); // 保存队列，防止并发写入

    // Default stats structure
    this.stats = {
      lifetime: {
        startTime: Date.now(),
        totalRequests: 0,
        cacheHits: 0,
        adsFiltered: 0,
        trafficSavedBytes: 0
      },
      detectionStats: {
        byRegex: 0,
        byTSHeader: 0,
        byNeuralNet: 0
      },
      cacheSnapshot: {
        itemCount: 0,
        sizeBytes: 0,
        lastUpdated: Date.now()
      }
    };

    this.init();
    StatsManager.instance = this;
  }

  async init() {
    await this.loadStats();
    this.startAutoSave();
    this.setupProcessHandlers();
  }

  async loadStats() {
    try {
      const dir = path.dirname(this.statsFilePath);
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
      }

      try {
        const data = await fs.readFile(this.statsFilePath, 'utf8');
        const loadedStats = JSON.parse(data);

        // Merge loaded stats with default structure to ensure backward compatibility
        this.stats = {
          ...this.stats,
          ...loadedStats,
          lifetime: { ...this.stats.lifetime, ...loadedStats.lifetime },
          detectionStats: { ...this.stats.detectionStats, ...loadedStats.detectionStats },
          cacheSnapshot: { ...this.stats.cacheSnapshot, ...loadedStats.cacheSnapshot }
        };

        logger.info('Global statistics loaded from disk');
      } catch (error) {
        if (error.code === 'ENOENT') {
          logger.info('No existing statistics file found, starting fresh');
          await this.saveStats(); // Create initial file
        } else {
          throw error;
        }
      }
    } catch (error) {
      logger.error('Failed to load global statistics', error);
      // Continue with default stats in memory
    }
  }

  async saveStats() {
    try {
      this.stats.cacheSnapshot.lastUpdated = Date.now();

      // 使用保存队列防止并发写入
      this.saveQueue = this.saveQueue.then(async () => {
        await fs.writeFile(this.statsFilePath, JSON.stringify(this.stats, null, 2), 'utf8');
        logger.debug('Global statistics saved to disk');
      });

      await this.saveQueue;
    } catch (error) {
      logger.error('Failed to save global statistics', error);
    }
  }

  startAutoSave() {
    if (this.autoSaveTimer) clearInterval(this.autoSaveTimer);
    this.autoSaveTimer = setInterval(() => this.saveStats(), this.saveIntervalMs);
  }

  setupProcessHandlers() {
    const saveAndExit = () => {
      logger.info('Saving statistics before exit...');
      this.saveStats();
    };

    // We don't want to interfere with existing handlers too much, 
    // but we need to ensure we save. 
    // Note: server.js handles process.exit, so we just want to ensure save happens.
    // Ideally we expose a method to be called by server.js on shutdown.
  }

  // --- Public API for updating stats ---

  incrementRequest() {
    this.stats.lifetime.totalRequests++;
  }

  incrementCacheHit() {
    this.stats.lifetime.cacheHits++;
  }

  incrementAdsFiltered(count = 1, method = 'unknown') {
    this.stats.lifetime.adsFiltered += count;
    
    if (method === 'regex') this.stats.detectionStats.byRegex += count;
    else if (method === 'ts_header') this.stats.detectionStats.byTSHeader += count;
    else if (method === 'neural_net') this.stats.detectionStats.byNeuralNet += count;
  }

  addTrafficSaved(bytes) {
    this.stats.lifetime.trafficSavedBytes += bytes;
  }

  updateCacheSnapshot(itemCount, sizeBytes) {
    this.stats.cacheSnapshot.itemCount = itemCount;
    this.stats.cacheSnapshot.sizeBytes = sizeBytes;
  }

  // --- Getters ---

  getSummary() {
    const now = Date.now();
    const uptimeSeconds = (now - this.stats.lifetime.startTime) / 1000;
    
    // Calculate derived metrics
    const hitRate = this.stats.lifetime.totalRequests > 0 
      ? (this.stats.lifetime.cacheHits / this.stats.lifetime.totalRequests) * 100 
      : 0;

    return {
      ...this.stats,
      computed: {
        hitRate: parseFloat(hitRate.toFixed(2)),
        uptimeSeconds: Math.floor(uptimeSeconds)
      }
    };
  }
}

module.exports = new StatsManager();
