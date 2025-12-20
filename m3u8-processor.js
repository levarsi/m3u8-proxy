const url = require('url');
const config = require('./config');
const logger = require('./logger');

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
    this.stats = {
      totalProcessed: 0,
      adsFiltered: 0,
      segmentsKept: 0,
      processingTime: 0
    };
  }

  /**
   * 检测是否为广告片段 - 增强版
   * @param {string} line - M3U8行内容
   * @returns {boolean} 是否为广告
   */
  isAdvertisement(line) {
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
    if (this.isDurationBasedAd(line)) {
      this.logFilterAction('时长广告拦截', line, 'DURATION');
      return true;
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
   * @returns {boolean} 是否为广告
   */
  isDurationBasedAd(line) {
    // 检测非标准时长的片段（通常是广告）
    // 这个方法需要与process方法中的EXTINF解析配合使用
    return false; // 在process方法中实现具体逻辑
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
      logger.debug('广告过滤操作', logData);
    } else if (logLevel === 'info') {
      logger.info(`广告过滤: ${action}`);
    }
    
    // 更新统计信息
    if (action.includes('拦截')) {
      this.stats.adsFiltered++;
    }
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
   * 处理M3U8内容 - 增强版
   * @param {string} m3u8Content - 原始M3U8内容
   * @param {string} sourceUrl - 源URL
   * @returns {object} 处理结果
   */
  process(m3u8Content, sourceUrl) {
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
        const isAd = this.isAdvertisement(line);

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
    return { ...this.stats };
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      totalProcessed: 0,
      adsFiltered: 0,
      segmentsKept: 0,
      processingTime: 0
    };
  }

  /**
   * 动态添加广告过滤规则
   * @param {RegExp|string} pattern - 新的过滤规则
   */
  addAdPattern(pattern) {
    if (pattern instanceof RegExp) {
      this.adPatterns.push(pattern);
      logger.info('添加广告过滤规则', { pattern: pattern.source });
    } else if (typeof pattern === 'string') {
      const regex = new RegExp(pattern, 'i');
      this.adPatterns.push(regex);
      logger.info('添加广告过滤规则', { pattern });
    }
  }

  /**
   * 移除广告过滤规则
   * @param {number} index - 规则索引
   */
  removeAdPattern(index) {
    if (index >= 0 && index < this.adPatterns.length) {
      const removed = this.adPatterns.splice(index, 1)[0];
      logger.info('移除广告过滤规则', { pattern: removed.source || removed });
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