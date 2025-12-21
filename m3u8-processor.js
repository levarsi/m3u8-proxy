const url = require('url');
const axios = require('axios');
const config = require('./config');
const logger = require('./logger');
const TSMetadataDetector = require('./ts-metadata-detector');

/**
 * M3U8处理器类 - 增强版
 * 负责解析、过滤和重写M3U8播放列表
 */
class M3U8Processor {
  constructor(options = {}) {
    // 合并默认模式和自定义模式
    this.adPatterns = [
      ...config.adFilter.patterns,
      ...(options.adPatterns || []),
      ...(config.adFilter.customPatterns || [])
    ];
    this.baseUrl = '';
    this.isAdFilterEnabled = config.adFilter.enabled;
    
    // 初始化TS元数据检测器
    this.tsDetector = new TSMetadataDetector(options.tsDetector || {});
    
    // 配置是否启用TS内容检测
    this.enableTSDetection = config.adFilter.enableTSDetection !== false;
    
    this.stats = {
      totalProcessed: 0,
      adsFiltered: 0,
      segmentsKept: 0,
      processingTime: 0,
      tsDetectionStats: {
        totalAnalyzed: 0,
        adsDetectedByTS: 0,
        tsAnalysisTime: 0
      }
    };
  }

  /**
   * 检测是否为广告片段 - 增强版（集成TS检测）
   * @param {string} line - M3U8行内容
   * @param {number} currentDuration - 当前片段时长
   * @returns {Promise<boolean>} 是否为广告
   */
  async isAdvertisement(line, currentDuration = null) {
    if (!this.isAdFilterEnabled) return false;
    
    // 基础关键词检测
    for (const pattern of this.adPatterns) {
      if (pattern.test(line)) {
        this.logFilterAction('拦截广告', line, pattern);
        return true;
      }
    }
    
    // 高级检测：基于URL结构的广告检测
    if (this.isStructuralAd(line)) {
      this.logFilterAction('结构化广告拦截', line, 'STRUCTURAL');
      return true;
    }
    
    // 高级检测：基于时长的广告检测
    if (this.isDurationBasedAd(line, currentDuration)) {
      this.logFilterAction('时长广告拦截', line, 'DURATION');
      return true;
    }
    
    // 新增：TS内容检测
    if (this.enableTSDetection) {
      const tsAdResult = await this.isAdByTSContent(line);
      if (tsAdResult.isAd) {
        this.logFilterAction('TS内容广告拦截', line, `TS_CONTENT_${tsAdResult.probability.toFixed(2)}`);
        return true;
      }
    }
    
    return false;
  }

  /**
   * 基于URL结构的广告检测
   * @param {string} line - URL行
   * @returns {boolean} 是否为广告
   */
  isStructuralAd(line) {
    // 检测常见的广告服务器域名
    const adDomains = [
      'doubleclick.net',
      'googlesyndication.com',
      'googleadservices.com',
      'googletagmanager.com',
      'facebook.com/tr',
      'amazon-adsystem.com',
      'adnxs.com',
      'adsystem.com',
      'advertising.com',
      'adsafeprotected.com',
      'moatads.com',
      'scorecardresearch.com',
      'ads-twitter.com',
      'linkedin.com/ad'
    ];
    
    try {
      const urlObj = new URL(line.startsWith('http') ? line : this.baseUrl + line);
      return adDomains.some(domain => urlObj.hostname.includes(domain));
    } catch (error) {
      return false;
    }
  }

  /**
   * 基于时长的广告检测（需要与前一个EXTINF标签配合）
   * @param {string} line - URL行
   * @param {number} currentDuration - 当前片段时长
   * @returns {boolean} 是否为广告
   */
  isDurationBasedAd(line, currentDuration = null) {
    if (!currentDuration) return false;
    
    // 仅检测明确的广告特征时长（保守策略）
    const exactAdDurations = [5, 10, 15];  // 精确的广告时长
    const roundedDuration = Math.round(currentDuration);
    const isExactAdDuration = exactAdDurations.includes(roundedDuration);
    
    // 检测异常短时长（仅过滤明显无效的超短片段）
    const isTooShort = currentDuration < 0.5;
    
    // 必须同时满足多个条件才判断为广告
    // 只有明确的广告时长且URL也符合广告特征时才判定
    if (isExactAdDuration && this.containsAdKeywords(line)) {
      return true;
    }
    
    // 仅过滤明显无效的超短片段，不误删正常的短片段
    return isTooShort;
  }

  /**
   * 检查URL是否包含广告关键词（避免递归调用）
   * @param {string} line - URL行
   * @returns {boolean} 是否包含广告关键词
   */
  containsAdKeywords(line) {
    // 仅检查基本的广告关键词，避免过于激进的检测
    const adKeywords = [
      'ad_', 'advertisement', 'commercial', 'adjump'
    ];
    
    return adKeywords.some(keyword => 
      line.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  /**
   * 基于TS内容的广告检测
   * @param {string} line - TS文件URL
   * @returns {Promise<object>} 检测结果
   */
  async isAdByTSContent(line) {
    const startTime = Date.now();
    this.stats.tsDetectionStats.totalAnalyzed++;
    
    try {
      // 构建完整的TS文件URL
      const tsUrl = this.resolveUrl(line);
      
      // 创建上下文信息
      const context = {
        url: tsUrl,
        baseUrl: this.baseUrl,
        segmentUrl: line
      };
      
      // 执行TS内容检测
      const result = await this.tsDetector.detectAdFeatures(tsUrl, context);
      
      // 更新统计
      this.stats.tsDetectionStats.tsAnalysisTime += Date.now() - startTime;
      if (result.isAd) {
        this.stats.tsDetectionStats.adsDetectedByTS++;
      }
      
      logger.debug('TS内容检测完成', {
        module: 'processor',
        url: tsUrl,
        isAd: result.isAd,
        probability: result.probability,
        confidence: result.confidence,
        analysisTime: result.analysisTime
      });
      
      return result;
      
    } catch (error) {
      logger.error('TS内容检测失败', error, { module: 'processor', url: line });
      
      // 检测失败时返回保守结果
      return {
        isAd: false,
        probability: 0,
        confidence: 0,
        error: error.message,
        analysisTime: Date.now() - startTime
      };
    }
  }

  /**
   * 记录过滤操作 - 增强版
   * @param {string} action - 操作类型
   * @param {string} content - 内容
   * @param {RegExp|string} pattern - 匹配的模式
   */
  logFilterAction(action, content, pattern) {
    const logLevel = config.adFilter.logLevel;
    if (logLevel === 'none') return;
    
    const logData = {
      action,
      content,
      pattern: pattern instanceof RegExp ? pattern.source : pattern,
      timestamp: new Date().toISOString()
    };
    
    if (logLevel === 'debug' || config.adFilter.logFilteredSegments) {
      logger.debug('广告过滤操作', { module: 'processor', ...logData });
    } else if (logLevel === 'info') {
      logger.info(`广告过滤: ${action}`, { module: 'processor' });
    }
    
    // 注意：统计信息在process方法中更新，这里不再重复更新
    // 避免重复计算导致统计错误
  }

  /**
   * 将相对路径转换为绝对URL
   * @param {string} line - 文件路径行
   * @returns {string} 转换后的URL
   */
  resolveUrl(line) {
    // 已经是绝对URL，直接返回
    if (line.startsWith('http')) {
      return line;
    }

    // 尝试解析为绝对URL
    try {
      return new url.URL(line, this.baseUrl).href;
    } catch (error) {
      console.warn(`URL解析失败，保留原样: ${line}`, error.message);
      return line;
    }
  }

  /**
   * 判断是否为顶级/全局标签
   * @param {string} line - 标签行
   * @returns {boolean} 是否为顶级标签
   */
  isGlobalTag(line) {
    return line.startsWith('#EXTM3U') ||
           line.startsWith('#EXT-X-VERSION') ||
           line.startsWith('#EXT-X-TARGETDURATION') ||
           line.startsWith('#EXT-X-PLAYLIST-TYPE') ||
           line.startsWith('#EXT-X-MEDIA-SEQUENCE') ||
           line.startsWith('#EXT-X-ALLOW-CACHE') ||
           line.startsWith('#EXT-X-ENDLIST') ||
           line.startsWith('#EXT-X-STREAM-INF') ||
           line.startsWith('#EXT-X-DISCONTINUITY') ||
           line.startsWith('#EXT-X-KEY');
  }

  /**
   * 处理M3U8内容 - 增强版（支持TS检测）
   * @param {string} m3u8Content - 原始M3U8内容
   * @param {string} sourceUrl - 源URL
   * @returns {Promise<object>} 处理结果
   */
  async process(m3u8Content, sourceUrl) {
    const startTime = Date.now();
    
    // 重置统计信息
    this.stats.totalProcessed = 0;
    this.stats.adsFiltered = 0;
    this.stats.segmentsKept = 0;
    
    // 设置基础URL用于路径解析
    this.baseUrl = sourceUrl.substring(0, sourceUrl.lastIndexOf('/') + 1);

    const lines = m3u8Content.split('\n');
    const processedLines = [];
    const filteredSegments = []; // 记录被过滤的片段信息
    let bufferTags = []; // 暂存与切片相关的标签
    let isVod = false;
    let currentDuration = null; // 当前片段的时长

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line) continue;

      // 检测是否为VOD类型
      if (line.startsWith('#EXT-X-PLAYLIST-TYPE:VOD')) {
        isVod = true;
      }

      // 解析EXTINF标签获取时长信息
      if (line.startsWith('#EXTINF:')) {
        const durationMatch = line.match(/#EXTINF:([\d.]+)/);
        if (durationMatch) {
          currentDuration = parseFloat(durationMatch[1]);
        }
      }

      // 处理标签行
      if (line.startsWith('#')) {
        // 全局标签直接写入
        if (this.isGlobalTag(line)) {
          // 如果缓存里还有标签，先写入
          if (bufferTags.length > 0) {
            processedLines.push(...bufferTags);
            bufferTags = [];
          }
          processedLines.push(line);
        } else {
          // 切片相关标签缓存等待判断
          bufferTags.push(line);
        }
      } else {
        // 处理文件路径/URL行
        this.stats.totalProcessed++;
        const isAd = await this.isAdvertisement(line, currentDuration);

        if (isAd) {
          // 广告片段，记录并清空缓存的标签
          filteredSegments.push({
            url: line,
            duration: currentDuration,
            reason: 'advertisement'
          });
          bufferTags = [];
          this.stats.adsFiltered++;
        } else {
          // 正常片段，先写入缓存的标签
          if (bufferTags.length > 0) {
            processedLines.push(...bufferTags);
            bufferTags = [];
          }

          // 路径重写
          const resolvedUrl = this.resolveUrl(line);
          processedLines.push(resolvedUrl);
          this.stats.segmentsKept++;
        }
        
        // 重置当前时长
        currentDuration = null;
      }
    }

    // 循环结束后，如果缓存中还有残留标签（理论上不应该），为了安全写入
    if (bufferTags.length > 0) {
      processedLines.push(...bufferTags);
    }

    // 添加处理信息注释
    if (processedLines.length > 0 && processedLines[0].startsWith('#EXTM3U')) {
      processedLines.splice(1, 0, `# Processed by M3U8-Proxy at ${new Date().toISOString()}`);
      if (this.isAdFilterEnabled) {
        processedLines.splice(2, 0, `# Advertisements filtered: ${this.stats.adsFiltered}/${this.stats.totalProcessed}`);
        processedLines.splice(3, 0, `# Processing time: ${Date.now() - startTime}ms`);
      }
    }

    // 计算处理时间
    this.stats.processingTime = Date.now() - startTime;

    // 记录处理统计
    logger.info('M3U8处理完成', {
      module: 'processor',
      url: sourceUrl,
      stats: this.stats,
      isVod,
      filteredSegments: filteredSegments.length
    });

    return {
      content: processedLines.join('\n'),
      isVod: isVod,
      segmentCount: processedLines.filter(line => !line.startsWith('#')).length,
      stats: { ...this.stats },
      filteredSegments: filteredSegments
    };
  }

  /**
   * 获取处理统计信息
   * @returns {object} 统计信息
   */
  getStats() {
    return {
      ...this.stats,
      tsDetectorStats: this.tsDetector.getStats()
    };
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      totalProcessed: 0,
      adsFiltered: 0,
      segmentsKept: 0,
      processingTime: 0,
      tsDetectionStats: {
        totalAnalyzed: 0,
        adsDetectedByTS: 0,
        tsAnalysisTime: 0
      }
    };
    this.tsDetector.resetStats();
  }

  /**
   * 动态添加广告过滤规则
   * @param {RegExp|string} pattern - 新的过滤规则
   */
  addAdPattern(pattern) {
    if (pattern instanceof RegExp) {
      this.adPatterns.push(pattern);
      logger.info('添加广告过滤规则', { module: 'processor', pattern: pattern.source });
    } else if (typeof pattern === 'string') {
      const regex = new RegExp(pattern, 'i');
      this.adPatterns.push(regex);
      logger.info('添加广告过滤规则', { module: 'processor', pattern });
    }
  }

  /**
   * 移除广告过滤规则
   * @param {number} index - 规则索引
   */
  removeAdPattern(index) {
    if (index >= 0 && index < this.adPatterns.length) {
      const removed = this.adPatterns.splice(index, 1)[0];
      logger.info('移除广告过滤规则', { module: 'processor', pattern: removed.source || removed });
    }
  }

  /**
   * 获取所有广告过滤规则
   * @returns {Array} 过滤规则列表
   */
  getAdPatterns() {
    return this.adPatterns.map((pattern, index) => ({
      index,
      pattern: pattern.source || pattern,
      type: pattern instanceof RegExp ? 'regex' : 'string'
    }));
  }
}

module.exports = M3U8Processor;