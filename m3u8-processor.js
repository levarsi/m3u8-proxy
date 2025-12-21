const url = require('url');
const axios = require('axios');
const config = require('./config');
const logger = require('./logger');
const TSMetadataDetector = require('./ts-metadata-detector');
const MultiSourceFusion = require('./multi-source-fusion');
const NeuralNetworkModel = require('./neural-network-model');

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
    
    // 初始化多源数据融合引擎
    this.fusionEngine = new MultiSourceFusion(options.fusionEngine || {});
    
    // 调整融合引擎配置
    this.fusionEngine.updateFusionConfig({
      decisionThreshold: 0.4, // 降低决策阈值
      minSources: 1,         // 降低最小检测源数量要求
      enableHardRules: false // 禁用硬规则
    });
    
    // 调整检测源权重
    this.fusionEngine.updateSourceWeights({
      patternMatching: 0.6,  // 大幅增加模式匹配的权重
      structuralAnalysis: 0.1,
      durationAnalysis: 0.1,
      tsContentAnalysis: 0.0, // TS检测已禁用
      networkAnalysis: 0.1,
      playlistContext: 0.1
    });
    
    // 初始化神经网络模型
    this.nnModel = new NeuralNetworkModel(options.nnModel || {});
    
    // 配置是否启用神经网络检测
    this.enableNNDetection = config.adFilter.enableNNDetection !== false;
    
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
      },
      fusionStats: {
        totalDecisions: 0,
        adsDetected: 0,
        nonAdsDetected: 0,
        fusionTime: 0
      },
      nnDetectionStats: {
        totalPredictions: 0,
        avgPredictionTime: 0,
        nnAdsDetected: 0
      }
    };
  }

  /**
   * 检测是否为广告片段 - 增强版（集成多源数据融合）
   * @param {string} line - M3U8行内容
   * @param {number} currentDuration - 当前片段时长
   * @param {number} segmentIndex - 当前片段索引
   * @returns {Promise<object>} 广告检测结果
   */
  async isAdvertisement(line, currentDuration = null, segmentIndex = 0) {
    if (!this.isAdFilterEnabled) {
      return {
        isAd: false,
        confidence: 0,
        fusionResult: null
      };
    }
    
    // 收集各检测源的结果
    const detectionResults = {};
    
    // 1. 模式匹配检测
    let patternMatchResult = false;
    let matchedPattern = null;
    
    // 特别处理main-audio.m3u8，避免误判
    if (!line.toLowerCase().includes('main-audio')) {
      for (const pattern of this.adPatterns) {
        if (pattern.test(line)) {
          patternMatchResult = true;
          matchedPattern = pattern;
          break;
        }
      }
    }
    
    // 2. 广告关键词检测（直接检查，不依赖其他条件）
    const hasAdKeywords = this.containsAdKeywords(line);
    
    detectionResults.patternMatching = {
      isAd: patternMatchResult || hasAdKeywords,
      confidence: (patternMatchResult ? 0.8 : 0) + (hasAdKeywords ? 0.7 : 0),
      matchedPattern: matchedPattern ? matchedPattern.source : null,
      hasAdKeywords: hasAdKeywords
    };
    
    // 2. 结构化广告检测
    const structuralResult = this.isStructuralAd(line);
    detectionResults.structuralAnalysis = {
      isAd: structuralResult,
      confidence: structuralResult ? 0.7 : 0
    };
    
    // 3. 时长分析
    const durationResult = this.isDurationBasedAd(line, currentDuration);
    detectionResults.durationAnalysis = {
      isAd: durationResult,
      confidence: durationResult ? 0.6 : 0,
      duration: currentDuration
    };
    
    // 4. TS内容分析
    if (this.enableTSDetection) {
      // 漏斗策略：决定是否运行TS检测
      let shouldRunTS = true;
      
      // 1. 如果已经通过模式匹配高置信度确认为广告，跳过TS检测
      if (detectionResults.patternMatching.isAd && detectionResults.patternMatching.confidence > 0.8) {
        shouldRunTS = false;
      }
      
      // 2. 如果配置了仅检测可疑片段
      if (shouldRunTS && config.adFilter.tsDetection.suspiciousOnly) {
         // 可疑条件：
         // a. 常见广告时长 (5s, 10s, 15s, 30s)
         // b. 极短片段 (< 3s)
         // c. 在不连续点附近 (由 playlistContext 分析)
         
         const roundedDuration = currentDuration ? Math.round(currentDuration) : 0;
         const isSuspiciousDuration = [5, 10, 15, 30].includes(roundedDuration) || (currentDuration > 0 && currentDuration < 3);
         
         // 检查上下文是否提示可疑（例如在不连续点附近）
         const isContextSuspicious = detectionResults.playlistContext && detectionResults.playlistContext.confidence > 0.3;
         
         shouldRunTS = isSuspiciousDuration || isContextSuspicious;
      }

      if (shouldRunTS) {
        const tsAdResult = await this.isAdByTSContent(line);
        detectionResults.tsContentAnalysis = {
          isAd: tsAdResult.isAd,
          confidence: tsAdResult.confidence || 0,
          probability: tsAdResult.probability || 0,
          features: tsAdResult.features || {},
          metadata: tsAdResult.metadata || null
        };
      } else {
        // 跳过检测，记录为空结果
        detectionResults.tsContentAnalysis = { isAd: false, confidence: 0, skipped: true };
      }
    }
    
    // 5. 网络分析
    const networkResult = this.analyzeNetworkFeatures(line);
    detectionResults.networkAnalysis = {
      isAd: networkResult.isAd,
      confidence: networkResult.confidence,
      features: networkResult.features,
      patterns: networkResult.patterns
    };
    
    // 6. 播放列表上下文分析
    const playlistContextResult = this.analyzePlaylistContext(line, currentDuration, segmentIndex);
    detectionResults.playlistContext = {
      isAd: playlistContextResult.isAd,
      confidence: playlistContextResult.confidence,
      patterns: playlistContextResult.patterns
    };
    
    // 使用多源数据融合引擎融合结果
    const fusionResult = this.fusionEngine.fuse(detectionResults);
    
    // 更新融合统计信息
    this.stats.fusionStats = {
      totalDecisions: this.fusionEngine.getStats().totalDecisions,
      adsDetected: this.fusionEngine.getStats().adsDetected,
      nonAdsDetected: this.fusionEngine.getStats().nonAdsDetected,
      fusionTime: this.fusionEngine.getStats().fusionTime
    };
    
    // 神经网络模型检测
    let nnResult = {
      isAd: false,
      confidence: 0,
      probability: 0
    };
    
    if (this.enableNNDetection) {
      const nnStartTime = Date.now();
      
      try {
        // 使用神经网络模型进行预测
        const nnProbability = await this.nnModel.predict(detectionResults);
        nnResult = {
          isAd: nnProbability > 0.6,
          confidence: nnProbability,
          probability: nnProbability
        };
        
        // 更新神经网络统计信息
        this.stats.nnDetectionStats.totalPredictions++;
        this.stats.nnDetectionStats.avgPredictionTime = (
          (this.stats.nnDetectionStats.avgPredictionTime * (this.stats.nnDetectionStats.totalPredictions - 1)) +
          (Date.now() - nnStartTime)
        ) / this.stats.nnDetectionStats.totalPredictions;
        
        if (nnResult.isAd) {
          this.stats.nnDetectionStats.nnAdsDetected++;
        }
        
      } catch (error) {
        logger.error('神经网络预测失败', error);
      }
    }
    
    // 最终决策：结合多源融合和神经网络结果
    let finalResult = fusionResult;
    let finalIsAd = fusionResult.isAd;
    let finalConfidence = fusionResult.confidence;
    
    // 如果神经网络有较高置信度，调整最终结果
    if (nnResult.confidence > 0.8) {
      finalIsAd = nnResult.isAd;
      finalConfidence = (fusionResult.confidence * 0.6) + (nnResult.confidence * 0.4);
    } else if (nnResult.confidence > 0.5) {
      // 中等置信度，加权平均
      finalConfidence = (fusionResult.confidence * 0.7) + (nnResult.confidence * 0.3);
      finalIsAd = finalConfidence > 0.6;
    }
    
    // 记录过滤操作
    if (finalIsAd) {
      const sourceInfo = Object.entries(fusionResult.sources)
        .filter(([_, result]) => result.isAd)
        .map(([source, _]) => source)
        .join(',');
      
      const nnInfo = this.enableNNDetection ? `_NN_${nnResult.probability.toFixed(2)}` : '';
      
      this.logFilterAction(
        '多源融合+神经网络广告拦截', 
        line, 
        `FUSION${nnInfo}_${sourceInfo}_${finalConfidence.toFixed(2)}`
      );
    }
    
    return {
      isAd: finalIsAd,
      confidence: finalConfidence,
      fusionResult: fusionResult,
      nnResult: nnResult
    };
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
   * 分析URL的网络特征
   * @param {string} line - URL行
   * @returns {object} 网络特征分析结果
   */
  analyzeNetworkFeatures(line) {
    let result = {
      isAd: false,
      confidence: 0,
      features: {
        domain: '',
        path: '',
        hasQueryParams: false,
        queryParamCount: 0,
        hasAdKeywords: false,
        adDomainMatch: false,
        cdnDomain: false,
        isThirdParty: false
      },
      patterns: []
    };
    
    try {
      // 解析URL
      const urlObj = new URL(line.startsWith('http') ? line : this.baseUrl + line);
      result.features.domain = urlObj.hostname;
      result.features.path = urlObj.pathname;
      result.features.hasQueryParams = urlObj.search.length > 0;
      result.features.queryParamCount = urlObj.searchParams.size;
      
      // 检测广告域名
      const adDomains = [
        'doubleclick.net',
        'googlesyndication.com',
        'googleadservices.com',
        'adnxs.com',
        'adsystem.com',
        'advertising.com',
        'adsafeprotected.com',
        'moatads.com',
        'scorecardresearch.com'
      ];
      
      const adDomainMatch = adDomains.some(domain => urlObj.hostname.includes(domain));
      result.features.adDomainMatch = adDomainMatch;
      
      if (adDomainMatch) {
        result.patterns.push('AD_DOMAIN_MATCH');
        result.confidence += 0.8;
      }
      
      // 检测CDN域名
      const cdnDomains = [
        'cloudflare.net',
        'akamai.net',
        'fastly.net',
        'cloudfront.net',
        'cdn.jsdelivr.net',
        'jsdelivr.net'
      ];
      
      result.features.cdnDomain = cdnDomains.some(domain => urlObj.hostname.includes(domain));
      
      // 检测广告关键词
      const adKeywords = [
        'ad_', 'advertisement', 'commercial', 'adjump', 'adserver',
        'banner', 'promo', 'sponsor', 'marketing', 'affiliate',
        'ad-', 'ad_segment', 'ad-audio', 'ad-video'
      ];
      
      const urlLower = line.toLowerCase();
      
      // 特别处理main-audio.m3u8，避免误判
      if (urlLower.includes('main-audio')) {
        result.features.hasAdKeywords = false;
      } else {
        const hasAdKeywords = adKeywords.some(keyword => urlLower.includes(keyword));
        result.features.hasAdKeywords = hasAdKeywords;
        
        if (hasAdKeywords) {
          result.patterns.push('AD_KEYWORDS_IN_URL');
          result.confidence += 0.3;
        }
      }
      
      // 检测是否为第三方域名（与基础URL比较）
      if (this.baseUrl) {
        const baseUrlObj = new URL(this.baseUrl);
        const baseDomain = baseUrlObj.hostname.split('.').slice(-2).join('.');
        const currentDomain = urlObj.hostname.split('.').slice(-2).join('.');
        result.features.isThirdParty = baseDomain !== currentDomain;
        
        if (result.features.isThirdParty && hasAdKeywords) {
          result.patterns.push('THIRD_PARTY_WITH_AD_KEYWORDS');
          result.confidence += 0.2;
        }
      }
      
      // 检测异常长路径
      if (urlObj.pathname.length > 100) {
        result.patterns.push('UNUSUALLY_LONG_PATH');
        result.confidence += 0.1;
      }
      
      // 检测大量查询参数
      if (urlObj.searchParams.size > 5) {
        result.patterns.push('MANY_QUERY_PARAMS');
        result.confidence += 0.1;
      }
      
      // 计算最终结果
      result.confidence = Math.min(result.confidence, 1);
      result.isAd = result.confidence > 0.5;
      
    } catch (error) {
      logger.debug('网络特征分析失败', { error: error.message, url: line });
    }
    
    return result;
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
    // 检查广告关键词，确保能识别常见的广告URL格式
    const adKeywords = [
      'ad_', 'advertisement', 'commercial', 'adjump',
      'ad-', 'ad_segment', 'ad-audio', 'ad-video'
    ];
    
    const lowerLine = line.toLowerCase();
    
    // 特别处理main-audio.m3u8，避免误判
    if (lowerLine.includes('main-audio')) {
      return false;
    }
    
    // 检查是否包含广告关键词
    return adKeywords.some(keyword => lowerLine.includes(keyword));
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
           line.startsWith('#EXT-X-DISCONTINUITY') ||
           line.startsWith('#EXT-X-KEY');
  }

  /**
   * 初始化播放列表分析上下文
   */
  initPlaylistContext() {
    this.playlistContext = {
      // 播放列表类型：VOD 或 LIVE
      type: 'UNKNOWN',
      // 总时长
      totalDuration: 0,
      // 片段数量
      segmentCount: 0,
      // 平均片段时长
      avgSegmentDuration: 0,
      // 片段时长分布
      durationDistribution: {},
      // 最大片段时长
      maxSegmentDuration: 0,
      // 最小片段时长
      minSegmentDuration: Infinity,
      // 不连续点位置
      discontinuityPositions: [],
      // 当前片段索引
      currentSegmentIndex: 0,
      // 已分析的片段时长
      analyzedDurations: [],
      // 广告模式检测
      adPatternsDetected: [],
      // 最近的非广告片段时长
      recentNonAdDurations: []
    };
  }

  /**
   * 更新播放列表上下文
   * @param {string} m3u8Content - M3U8内容
   */
  updatePlaylistContext(m3u8Content) {
    this.initPlaylistContext();
    
    const lines = m3u8Content.split('\n');
    let currentDuration = null;
    let segmentIndex = 0;
    let totalDuration = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // 检测播放列表类型
      if (line.startsWith('#EXT-X-PLAYLIST-TYPE:')) {
        this.playlistContext.type = line.split(':')[1].trim();
      }
      
      // 检测EXTINF标签获取时长
      if (line.startsWith('#EXTINF:')) {
        const durationMatch = line.match(/#EXTINF:([\d.]+)/);
        if (durationMatch) {
          currentDuration = parseFloat(durationMatch[1]);
        }
      } 
      // 检测片段URL
      else if (!line.startsWith('#') && currentDuration) {
        // 更新片段统计
        this.playlistContext.segmentCount++;
        totalDuration += currentDuration;
        
        // 更新时长分布
        const roundedDuration = Math.round(currentDuration);
        this.playlistContext.durationDistribution[roundedDuration] = 
          (this.playlistContext.durationDistribution[roundedDuration] || 0) + 1;
        
        // 更新最大/最小时长
        this.playlistContext.maxSegmentDuration = Math.max(
          this.playlistContext.maxSegmentDuration, currentDuration
        );
        this.playlistContext.minSegmentDuration = Math.min(
          this.playlistContext.minSegmentDuration, currentDuration
        );
        
        // 保存分析的时长
        this.playlistContext.analyzedDurations.push(currentDuration);
        
        // 重置当前时长
        currentDuration = null;
        segmentIndex++;
      }
      
      // 检测不连续点
      if (line.startsWith('#EXT-X-DISCONTINUITY')) {
        this.playlistContext.discontinuityPositions.push(segmentIndex);
      }
    }
    
    // 计算平均片段时长
    this.playlistContext.avgSegmentDuration = totalDuration / this.playlistContext.segmentCount || 0;
    this.playlistContext.totalDuration = totalDuration;
    
    // 检测广告模式
    this.detectAdPatterns();
  }

  /**
   * 检测播放列表中的广告模式
   */
  detectAdPatterns() {
    const { durationDistribution, discontinuityPositions } = this.playlistContext;
    
    // 检测常见广告时长模式
    const commonAdDurations = [5, 10, 15, 30];
    const detectedDurations = commonAdDurations.filter(duration => 
      durationDistribution[duration] && durationDistribution[duration] > 1
    );
    
    if (detectedDurations.length > 0) {
      this.playlistContext.adPatternsDetected.push({
        type: 'COMMON_AD_DURATIONS',
        durations: detectedDurations,
        confidence: 0.7
      });
    }
    
    // 检测不连续点周围的异常时长
    if (discontinuityPositions.length > 0) {
      this.playlistContext.adPatternsDetected.push({
        type: 'DISCONTINUITY_PATTERN',
        positions: discontinuityPositions,
        count: discontinuityPositions.length,
        confidence: 0.6
      });
    }
    
    // 检测时长突变模式
    const durations = this.playlistContext.analyzedDurations;
    for (let i = 1; i < durations.length; i++) {
      const ratio = durations[i] / durations[i - 1];
      if (ratio > 2 || ratio < 0.5) {
        this.playlistContext.adPatternsDetected.push({
          type: 'DURATION_SPIKE',
          position: i,
          current: durations[i],
          previous: durations[i - 1],
          ratio: ratio,
          confidence: 0.5
        });
      }
    }
  }

  /**
   * 基于播放列表上下文分析片段
   * @param {string} line - 片段URL
   * @param {number} currentDuration - 当前片段时长
   * @param {number} segmentIndex - 当前片段索引
   * @returns {object} 上下文分析结果
   */
  analyzePlaylistContext(line, currentDuration, segmentIndex) {
    const { 
      avgSegmentDuration, 
      discontinuityPositions, 
      adPatternsDetected,
      durationDistribution
    } = this.playlistContext;
    
    // 初始化分析结果
    let result = {
      isAd: false,
      confidence: 0,
      patterns: []
    };
    
    // 检查是否在不连续点附近
    const nearDiscontinuity = discontinuityPositions.some(pos => 
      Math.abs(pos - segmentIndex) <= 1
    );
    
    if (nearDiscontinuity) {
      result.patterns.push('NEAR_DISCONTINUITY');
      result.confidence += 0.2;
    }
    
    // 检查是否为常见广告时长
    const roundedDuration = Math.round(currentDuration);
    const isCommonAdDuration = [5, 10, 15, 30].includes(roundedDuration);
    
    if (isCommonAdDuration) {
      const count = durationDistribution[roundedDuration] || 0;
      // 如果同时长片段出现多次，增加置信度
      if (count > 1) {
        result.patterns.push('COMMON_AD_DURATION');
        result.confidence += 0.3;
      }
    }
    
    // 检查与平均时长的偏差
    const durationDeviation = Math.abs(currentDuration - avgSegmentDuration) / avgSegmentDuration;
    
    if (avgSegmentDuration > 0 && durationDeviation > 0.5) {
      result.patterns.push('DURATION_DEVIATION');
      result.confidence += Math.min(durationDeviation * 0.2, 0.3);
    }
    
    // 检查广告模式检测结果
    const relevantPatterns = adPatternsDetected.filter(pattern => {
      if (pattern.type === 'DURATION_SPIKE') {
        return Math.abs(pattern.position - segmentIndex) <= 1;
      }
      return true;
    });
    
    if (relevantPatterns.length > 0) {
      result.patterns.push('AD_PATTERN_DETECTED');
      result.confidence += relevantPatterns.length * 0.1;
    }
    
    // 计算最终结果
    result.confidence = Math.min(result.confidence, 1);
    result.isAd = result.confidence > 0.5;
    
    return result;
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
    let isVod = false;
    
    // 更新播放列表上下文
    this.updatePlaylistContext(m3u8Content);

    // Pass 1: Identification & Grouping (识别与分组)
    const entries = [];
    let currentDuration = null;
    let segmentIndex = 0;
    let bufferTags = []; // 暂存与切片强绑定的标签 (EXTINF, BYTERANGE)

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith('#EXT-X-PLAYLIST-TYPE:VOD')) {
        isVod = true;
      }

      if (line.startsWith('#EXTINF:')) {
        const durationMatch = line.match(/#EXTINF:([\d.]+)/);
        if (durationMatch) {
          currentDuration = parseFloat(durationMatch[1]);
        }
        bufferTags.push(line);
      } else if (line.startsWith('#EXT-X-BYTERANGE:')) {
        bufferTags.push(line);
      } else if (line.startsWith('#')) {
        // 处理其他标签
        if (line.startsWith('#EXT-X-MEDIA:') || line.startsWith('#EXT-X-STREAM-INF:')) {
          // 包含URI的标签，可能需要检测
          const uriMatch = line.match(/URI=["']?([^"'\s,]+)["']?/i);
          if (uriMatch) {
            entries.push({
              type: 'tag_with_uri',
              line: line,
              uri: uriMatch[1],
              index: segmentIndex
            });
          } else {
            entries.push({ type: 'tag', line: line });
          }
        } else {
          // 其他全局或状态标签 (KEY, DISCONTINUITY等)，直接保留以防破坏状态
          entries.push({ type: 'tag', line: line });
        }
      } else {
        // 片段 URL
        entries.push({
          type: 'segment',
          line: line, // URL
          duration: currentDuration,
          index: segmentIndex++,
          buffer: bufferTags
        });
        bufferTags = [];
        currentDuration = null;
      }
    }
    
    // 清理残留的 bufferTags (理论上不应有，除非文件结尾错误)
    if (bufferTags.length > 0) {
        entries.push({ type: 'buffer_flush', buffer: bufferTags });
    }

    // Pass 2: Concurrent Processing (并发处理)
    // 筛选需要检测的项
    const itemsNeedDetection = entries.filter(e => e.type === 'segment' || e.type === 'tag_with_uri');
    const concurrencyLimit = config.adFilter.tsDetection.concurrencyLimit || 5;

    // 并发执行辅助函数
    const runConcurrent = async (items, limit) => {
        const results = new Map();
        let idx = 0;
        const worker = async () => {
            while (idx < items.length) {
                const item = items[idx++];
                const uri = item.type === 'segment' ? item.line : item.uri;
                try {
                    const result = await this.isAdvertisement(uri, item.duration, item.index);
                    results.set(item, result);
                } catch (e) {
                    logger.error('广告检测出错', e);
                    results.set(item, { isAd: false, confidence: 0 }); // 出错默认保留
                }
            }
        };
        await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
        return results;
    };

    const detectionResults = await runConcurrent(itemsNeedDetection, concurrencyLimit);

    // Pass 3: Reconstruction (重组)
    const processedLines = [];
    const filteredSegments = [];

    for (const entry of entries) {
        if (entry.type === 'tag') {
            processedLines.push(entry.line);
        } else if (entry.type === 'buffer_flush') {
            processedLines.push(...entry.buffer);
        } else if (entry.type === 'segment') {
            const result = detectionResults.get(entry);
            this.stats.totalProcessed++;

            if (result && result.isAd) {
                // 广告片段，记录并跳过 (连同绑定的 bufferTags 一起跳过)
                this.stats.adsFiltered++;
                filteredSegments.push({
                    url: entry.line,
                    duration: entry.duration,
                    reason: 'advertisement',
                    confidence: result.confidence,
                    fusionResult: result.fusionResult
                });
            } else {
                // 正常片段，保留 bufferTags 和 URL
                if (entry.buffer && entry.buffer.length > 0) {
                    processedLines.push(...entry.buffer);
                }
                
                // 路径重写
                const resolvedUrl = this.resolveUrl(entry.line);
                processedLines.push(resolvedUrl);
                this.stats.segmentsKept++;

                // 记录学习数据
                if (entry.duration) {
                    this.playlistContext.recentNonAdDurations.push(entry.duration);
                    if (this.playlistContext.recentNonAdDurations.length > 10) {
                        this.playlistContext.recentNonAdDurations.shift();
                    }
                }
            }
        } else if (entry.type === 'tag_with_uri') {
            const result = detectionResults.get(entry);
            this.stats.totalProcessed++;
            
            if (result && result.isAd) {
                this.stats.adsFiltered++;
                filteredSegments.push({
                    url: entry.uri,
                    reason: 'advertisement in tag',
                    confidence: result.confidence,
                    fusionResult: result.fusionResult
                });
            } else {
                processedLines.push(entry.line);
            }
        }
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
  
  /**
   * 提供广告检测反馈
   * @param {string} segmentUrl - 片段URL
   * @param {boolean} isAd - 实际是否为广告
   * @param {number} confidence - 反馈置信度（0-1）
   */
  provideFeedback(segmentUrl, isAd, confidence = 1) {
    return this.tsDetector.provideFeedback(segmentUrl, isAd, confidence);
  }
  
  /**
   * 获取学习模型信息
   * @returns {object} 学习模型数据
   */
  getLearningModel() {
    return this.tsDetector.getLearningModel();
  }
  
  /**
   * 获取智能学习统计信息
   * @returns {object} 学习统计数据
   */
  getLearningStats() {
    const stats = this.getStats();
    return {
      historyCount: stats.tsDetectorStats.learningStats.historyCount,
      feedbackCount: stats.tsDetectorStats.learningStats.feedbackCount,
      modelWeights: stats.tsDetectorStats.learningStats.modelWeights
    };
  }
  
  /**
   * 获取神经网络模型信息
   * @returns {object} 神经网络模型信息
   */
  getNNModelInfo() {
    if (!this.nnModel) {
      return null;
    }
    return this.nnModel.getModelInfo();
  }
  
  /**
   * 启动神经网络模型训练
   * @param {Array} trainingData - 训练数据
   * @returns {Promise<Object>} 训练结果
   */
  async trainNNModel(trainingData) {
    if (!this.nnModel) {
      throw new Error('神经网络模型未初始化');
    }
    return await this.nnModel.train(trainingData);
  }
  
  /**
   * 重置神经网络模型
   */
  resetNNModel() {
    if (this.nnModel) {
      this.nnModel.reset();
    }
  }
  
  /**
   * 获取神经网络模型权重
   * @returns {Array} 模型权重
   */
  getNNModelWeights() {
    if (!this.nnModel) {
      return null;
    }
    return this.nnModel.getWeights();
  }
  
  /**
   * 设置神经网络模型权重
   * @param {Array} weights - 权重数组
   */
  setNNModelWeights(weights) {
    if (this.nnModel) {
      this.nnModel.setWeights(weights);
    }
  }
};

module.exports = M3U8Processor;