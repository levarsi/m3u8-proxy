const url = require('url');
const config = require('./config');

/**
 * M3U8处理器类
 * 负责解析、过滤和重写M3U8播放列表
 */
class M3U8Processor {
  constructor(options = {}) {
    this.adPatterns = options.adPatterns || config.adFilter.patterns;
    this.baseUrl = '';
    this.isAdFilterEnabled = config.adFilter.enabled;
  }

  /**
   * 检测是否为广告片段
   * @param {string} line - M3U8行内容
   * @returns {boolean} 是否为广告
   */
  isAdvertisement(line) {
    if (!this.isAdFilterEnabled) return false;
    
    for (const pattern of this.adPatterns) {
      if (pattern.test(line)) {
        this.logFilterAction('拦截广告', line);
        return true;
      }
    }
    return false;
  }

  /**
   * 记录过滤操作
   * @param {string} action - 操作类型
   * @param {string} content - 内容
   */
  logFilterAction(action, content) {
    if (config.adFilter.logLevel === 'info' || config.adFilter.logLevel === 'debug') {
      console.log(`[${action}] ${content}`);
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
   * 处理M3U8内容
   * @param {string} m3u8Content - 原始M3U8内容
   * @param {string} sourceUrl - 源URL
   * @returns {string} 处理后的M3U8内容
   */
  process(m3u8Content, sourceUrl) {
    // 设置基础URL用于路径解析
    this.baseUrl = sourceUrl.substring(0, sourceUrl.lastIndexOf('/') + 1);

    const lines = m3u8Content.split('\n');
    const processedLines = [];
    let bufferTags = []; // 暂存与切片相关的标签
    let isVod = false;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line) continue;

      // 检测是否为VOD类型
      if (line.startsWith('#EXT-X-PLAYLIST-TYPE:VOD')) {
        isVod = true;
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
        const isAd = this.isAdvertisement(line);

        if (isAd) {
          // 广告片段，清空缓存的标签
          bufferTags = [];
        } else {
          // 正常片段，先写入缓存的标签
          if (bufferTags.length > 0) {
            processedLines.push(...bufferTags);
            bufferTags = [];
          }

          // 路径重写
          const resolvedUrl = this.resolveUrl(line);
          processedLines.push(resolvedUrl);
        }
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
        processedLines.splice(2, 0, '# Advertisements filtered');
      }
    }

    return {
      content: processedLines.join('\n'),
      isVod: isVod,
      segmentCount: processedLines.filter(line => !line.startsWith('#')).length
    };
  }
}

module.exports = M3U8Processor;