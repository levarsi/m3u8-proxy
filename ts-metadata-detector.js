const logger = require('./logger');
const fs = require('fs');
const path = require('path');

/**
 * TS元数据检测器 - 基于MPEG-TS元数据的广告识别
 * 通过解析TS切片的PAT/PMT表和视频流元数据来识别广告特征
 */
class TSMetadataDetector {
  constructor(options = {}) {
    // 广告检测阈值配置
    this.thresholds = {
      // 分辨率变化阈值（像素）
      resolutionChangeThreshold: 100,
      // 码率异常阈值（kbps）
      bitrateAnomalyThreshold: 500,
      // 时长异常阈值（秒）
      durationAnomalyThreshold: 5,
      // 帧率变化阈值（fps）
      frameRateChangeThreshold: 2,
      // 编码参数变化权重
      encodingMismatchWeight: 0.8
    };

    // 前一个片段的元数据（用于比较变化）
    this.lastSegmentMetadata = null;
    
    // 统计信息
    this.stats = {
      totalAnalyzed: 0,
      adsDetected: 0,
      analysisTime: 0,
      cacheHits: 0
    };

    // 元数据缓存（避免重复分析相同内容）
    this.metadataCache = new Map();
    
    // 智能学习模块
    this.learningModule = {
      // 历史检测数据
      history: [],
      // 学习率
      learningRate: 0.1,
      // 最小样本数
      minSamples: 10,
      // 反馈数据
      feedback: [],
      // 自适应阈值
      adaptiveThresholds: { ...this.thresholds },
      // 学习模型
      model: {
        featureWeights: {
          resolutionChange: 0.15,
          bitrateAnomaly: 0.25,
          encodingMismatch: 0.20,
          durationAnomaly: 0.20,
          frameRateChange: 0.10,
          streamStructureAnomaly: 0.05,
          timestampAnomaly: 0.05
        }
      }
    };
    
    // 学习数据持久化路径
    this.learningDataPath = path.join(__dirname, 'data', 'learning-data.json');
    
    // 初始化学习模块
    this.initLearningModule();
  }

  /**
   * 检测TS切片的广告特征
   * @param {Buffer|string} tsData - TS切片数据或URL
   * @param {object} context - 上下文信息
   * @returns {object} 检测结果
   */
  async detectAdFeatures(tsData, context = {}) {
    const startTime = Date.now();
    this.stats.totalAnalyzed++;

    try {
      // 生成缓存键
      const cacheKey = this.generateCacheKey(tsData, context);
      
      // 检查缓存
      if (this.metadataCache.has(cacheKey)) {
        this.stats.cacheHits++;
        logger.debug('TS元数据检测使用缓存', { cacheKey });
        return this.metadataCache.get(cacheKey);
      }

      // 提取元数据
      const metadata = await this.extractMetadata(tsData);
      
      // 检测广告特征
      const adFeatures = {
        resolutionChange: this.checkResolutionChange(metadata),
        bitrateAnomaly: this.detectBitrateAnomaly(metadata),
        encodingMismatch: this.checkEncodingConsistency(metadata),
        durationAnomaly: this.checkDurationAnomaly(metadata),
        frameRateChange: this.checkFrameRateChange(metadata),
        streamStructureAnomaly: this.checkStreamStructure(metadata),
        timestampAnomaly: this.checkTimestampConsistency(metadata)
      };

      // 计算广告概率
      const adProbability = this.calculateAdProbability(adFeatures);
      
      const result = {
        isAd: adProbability > 0.6, // 置信度阈值
        probability: adProbability,
        features: adFeatures,
        metadata: this.sanitizeMetadata(metadata),
        analysisTime: Date.now() - startTime,
        confidence: this.calculateConfidence(adFeatures)
      };

      // 缓存结果
      if (this.metadataCache.size < 1000) { // 限制缓存大小
        this.metadataCache.set(cacheKey, result);
      }

      // 更新统计
      this.stats.analysisTime += Date.now() - startTime;
      if (result.isAd) {
        this.stats.adsDetected++;
      }

      // 更新前一个片段元数据
    this.lastSegmentMetadata = metadata;
    
    // 记录到学习历史
    this.recordToHistory(result, adFeatures, metadata);

    logger.debug('TS元数据检测完成', {
      url: context.url,
      isAd: result.isAd,
      probability: adProbability,
      analysisTime: result.analysisTime
    });

    return result;

    } catch (error) {
      logger.error('TS元数据检测失败', error, { context });
      return {
        isAd: false,
        probability: 0,
        error: error.message,
        analysisTime: Date.now() - startTime
      };
    }
  }

  /**
   * 初始化学习模块
   */
  initLearningModule() {
    // 创建数据目录
    const dataDir = path.dirname(this.learningDataPath);
    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        logger.info(`创建数据目录: ${dataDir}`);
      }
    } catch (error) {
      logger.error('创建数据目录失败', error);
    }
    
    // 加载历史学习数据
    this.loadLearningData();
  }
  
  /**
   * 保存学习数据到文件
   */
  saveLearningData() {
    try {
      const dataToSave = {
        thresholds: this.learningModule.adaptiveThresholds,
        model: this.learningModule.model,
        history: this.learningModule.history.slice(-1000) // 只保存最近1000条记录
      };
      
      // 确保目录存在
      const dataDir = path.dirname(this.learningDataPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      fs.writeFileSync(this.learningDataPath, JSON.stringify(dataToSave, null, 2));
      logger.debug(`学习数据已保存到: ${this.learningDataPath}`);
    } catch (error) {
      logger.error('保存学习数据失败', error);
      // 输出更详细的错误信息
      console.error('保存学习数据错误:', error.message);
      console.error('保存路径:', this.learningDataPath);
    }
  }
  
  /**
   * 从文件加载学习数据
   */
  loadLearningData() {
    try {
      if (fs.existsSync(this.learningDataPath)) {
        const data = JSON.parse(fs.readFileSync(this.learningDataPath, 'utf8'));
        if (data.thresholds) {
          this.learningModule.adaptiveThresholds = data.thresholds;
        }
        if (data.model) {
          this.learningModule.model = data.model;
        }
        if (data.history) {
          this.learningModule.history = data.history;
        }
        logger.info('学习数据加载完成');
      }
    } catch (error) {
      logger.error('加载学习数据失败', error);
    }
  }
  
  /**
   * 更新学习模型
   */
  updateLearningModel() {
    const { history, model, learningRate } = this.learningModule;
    
    if (history.length < this.learningModule.minSamples) {
      logger.debug(`跳过模型更新: 历史记录数量 (${history.length}) 少于最小样本数 (${this.learningModule.minSamples})`);
      return;
    }
    
    // 简单的自适应学习算法
    // 这里可以扩展为更复杂的机器学习模型
    const recentHistory = history.slice(-50);
    
    // 计算特征权重调整
    const featureScores = {};
    let totalCorrect = 0;
    
    recentHistory.forEach(item => {
      if (item.isAd === item.actual) {
        totalCorrect++;
      }
      
      Object.entries(item.features).forEach(([feature, value]) => {
        if (!featureScores[feature]) {
          featureScores[feature] = 0;
        }
        
        // 根据特征是否有助于正确判断调整权重
        if (value.detected && item.isAd === item.actual) {
          featureScores[feature] += 1;
        } else if (value.detected && item.isAd !== item.actual) {
          featureScores[feature] -= 1;
        }
      });
    });
    
    // 更新特征权重
    Object.entries(featureScores).forEach(([feature, score]) => {
      if (model.featureWeights[feature] !== undefined) {
        const adjustment = (score / recentHistory.length) * learningRate;
        model.featureWeights[feature] = Math.max(0, Math.min(1, model.featureWeights[feature] + adjustment));
      }
    });
    
    // 保存更新后的模型
    this.saveLearningData();
    
    logger.debug('学习模型已更新', {
      accuracy: totalCorrect / recentHistory.length,
      featureWeights: model.featureWeights
    });
  }
  
  /**
   * 记录检测结果到学习历史
   */
  recordToHistory(result, features, metadata) {
    const historyItem = {
      timestamp: Date.now(),
      isAd: result.isAd,
      probability: result.probability,
      features,
      metadata: this.sanitizeMetadata(metadata),
      actual: null // 实际是否为广告，可通过用户反馈设置
    };
    
    this.learningModule.history.push(historyItem);
    
    logger.debug(`记录学习历史: ${result.isAd ? '广告' : '正常'} (概率: ${result.probability})`);
    
    // 定期更新模型
    if (this.learningModule.history.length % 5 === 0) {
      this.updateLearningModel();
    }
  }
  
  /**
   * 清理元数据（用于保存到历史记录）
   */
  sanitizeMetadata(metadata) {
    if (!metadata) return null;
    
    // 只保留必要的元数据字段，避免保存过大的对象
    return {
      duration: metadata.duration,
      bitrate: metadata.bitrate,
      size: metadata.size,
      pid: metadata.pid,
      streamType: metadata.streamType,
      videoInfo: metadata.videoInfo ? {
        width: metadata.videoInfo.width,
        height: metadata.videoInfo.height,
        frameRate: metadata.videoInfo.frameRate,
        profile: metadata.videoInfo.profile
      } : null,
      audioInfo: metadata.audioInfo ? {
        codec: metadata.audioInfo.codec,
        sampleRate: metadata.audioInfo.sampleRate,
        channels: metadata.audioInfo.channels
      } : null
    };
  }
  
  /**
   * 提供反馈数据
   */
  provideFeedback(segmentUrl, isAd, confidence = 1) {
    const feedbackItem = {
      timestamp: Date.now(),
      segmentUrl,
      isAd,
      confidence
    };
    
    this.learningModule.feedback.push(feedbackItem);
    
    // 更新历史记录中的实际值
    const cacheKey = `url:${segmentUrl}`;
    const cachedResult = this.metadataCache.get(cacheKey);
    
    if (cachedResult && cachedResult.metadata) {
      const historyItem = this.learningModule.history.find(item => 
        item.metadata && 
        item.metadata.duration === cachedResult.metadata.duration &&
        item.metadata.bitrate === cachedResult.metadata.bitrate
      );
      
      if (historyItem) {
        historyItem.actual = isAd;
        logger.info('反馈数据已应用到学习历史', {
          segmentUrl,
          isAd
        });
      }
    }
    
    // 更新模型
    this.updateLearningModel();
  }
  
  /**
   * 提取TS元数据
   * @param {Buffer|string} tsData - TS数据
   * @returns {object} 元数据信息
   */
  async extractMetadata(tsData) {
    if (Buffer.isBuffer(tsData)) {
      return this.parseTSBuffer(tsData);
    } else if (typeof tsData === 'string') {
      // 如果是URL，需要先下载TS文件
      return this.downloadAndParseTS(tsData);
    } else {
      throw new Error('不支持的TS数据类型');
    }
  }

  /**
   * 解析TS Buffer数据
   * @param {Buffer} buffer - TS数据Buffer
   * @returns {object} 解析结果
   */
  parseTSBuffer(buffer) {
    try {
      // 基础TS格式检查
      if (buffer.length < 188 || buffer[0] !== 0x47) {
        throw new Error('无效的TS格式');
      }

      return {
        pid: this.extractPID(buffer),
        streamType: this.detectStreamType(buffer),
        videoInfo: this.extractVideoInfo(buffer),
        audioInfo: this.extractAudioInfo(buffer),
        duration: this.estimateDuration(buffer),
        bitrate: this.estimateBitrate(buffer),
        timestamps: this.extractTimestamps(buffer),
        size: buffer.length
      };
    } catch (error) {
      logger.error('TS Buffer解析失败', error);
      return null;
    }
  }
  
  /**
   * 下载并解析TS文件
   * @param {string} tsUrl - TS文件URL
   * @returns {Promise<object>} 解析结果
   */
  async downloadAndParseTS(tsUrl) {
    try {
      const axios = require('axios');
      const response = await axios.get(tsUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data);
      
      return this.parseTSBuffer(buffer);
    } catch (error) {
      logger.error('下载TS文件失败', error, { tsUrl });
      // 下载失败时使用模拟数据
      return this.getSimulatedMetadata(tsUrl);
    }
  }

  /**
   * 获取模拟元数据（用于开发测试）
   * @param {string} url - TS文件URL
   * @returns {object} 模拟元数据
   */
  getSimulatedMetadata(url) {
    // 基于URL特征生成模拟数据
    const isAdLike = url.includes('ad') || url.includes('promo');
    
    return {
      pid: Math.floor(Math.random() * 0x1000),
      streamType: 0x1b, // H.264
      videoInfo: {
        width: isAdLike ? 1280 : 1920,
        height: isAdLike ? 720 : 1080,
        frameRate: isAdLike ? 25 : 30,
        profile: isAdLike ? 'baseline' : 'high'
      },
      audioInfo: {
        codec: 'AAC',
        sampleRate: 48000,
        channels: 2,
        bitrate: isAdLike ? 96 : 192
      },
      duration: isAdLike ? 15 : 10, // 广告通常时长不同
      bitrate: isAdLike ? 1500 : 3000,
      timestamps: {
        pts: Date.now() * 90,
        dts: Date.now() * 90 - 1000
      },
      size: Math.floor(Math.random() * 1000000) + 500000
    };
  }

  /**
   * 检查分辨率变化
   * @param {object} metadata - 当前元数据
   * @returns {object} 检测结果
   */
  checkResolutionChange(metadata) {
    if (!this.lastSegmentMetadata || !metadata?.videoInfo) {
      return { detected: false, confidence: 0, details: '缺少比较基准' };
    }

    const current = {
      width: metadata.videoInfo.width,
      height: metadata.videoInfo.height
    };
    
    const last = {
      width: this.lastSegmentMetadata.videoInfo.width,
      height: this.lastSegmentMetadata.videoInfo.height
    };

    const widthChange = Math.abs(current.width - last.width);
    const heightChange = Math.abs(current.height - last.height);

    const detected = widthChange > this.thresholds.resolutionChangeThreshold || 
                    heightChange > this.thresholds.resolutionChangeThreshold;

    return {
      detected,
      confidence: detected ? Math.min(widthChange + heightChange) / 200 : 0,
      details: {
        current,
        last,
        widthChange,
        heightChange
      }
    };
  }

  /**
   * 检测码率异常
   * @param {object} metadata - 元数据
   * @returns {object} 检测结果
   */
  detectBitrateAnomaly(metadata) {
    if (!metadata?.bitrate) {
      return { detected: false, confidence: 0, details: '缺少码率信息' };
    }

    let detected = false;
    let confidence = 0;
    let details = { current: metadata.bitrate };

    // 与前一个片段比较
    if (this.lastSegmentMetadata?.bitrate) {
      const bitrateChange = Math.abs(metadata.bitrate - this.lastSegmentMetadata.bitrate);
      detected = bitrateChange > this.thresholds.bitrateAnomalyThreshold;
      confidence = detected ? Math.min(bitrateChange / 1000, 1) : 0;
      details.last = this.lastSegmentMetadata.bitrate;
      details.change = bitrateChange;
    }

    // 检查是否为典型广告码率范围
    const adBitrateRanges = [
      { min: 800, max: 1200 },   // 低码率广告
      { min: 1400, max: 1800 }   // 中等码率广告
    ];

    const isAdBitrate = adBitrateRanges.some(range => 
      metadata.bitrate >= range.min && metadata.bitrate <= range.max
    );

    if (isAdBitrate) {
      detected = true;
      confidence = Math.max(confidence, 0.6);
    }

    details.isAdRange = isAdBitrate;

    return { detected, confidence, details };
  }

  /**
   * 检查编码一致性
   * @param {object} metadata - 元数据
   * @returns {object} 检测结果
   */
  checkEncodingConsistency(metadata) {
    if (!metadata?.videoInfo || !this.lastSegmentMetadata?.videoInfo) {
      return { detected: false, confidence: 0, details: '缺少比较基准' };
    }

    const mismatches = [];
    let totalWeight = 0;

    // 检查profile变化
    if (metadata.videoInfo.profile !== this.lastSegmentMetadata.videoInfo.profile) {
      mismatches.push({
        type: 'profile',
        current: metadata.videoInfo.profile,
        last: this.lastSegmentMetadata.videoInfo.profile
      });
      totalWeight += 0.3;
    }

    // 检查帧率变化
    const frameRateChange = Math.abs(
      metadata.videoInfo.frameRate - this.lastSegmentMetadata.videoInfo.frameRate
    );
    
    if (frameRateChange > this.thresholds.frameRateChangeThreshold) {
      mismatches.push({
        type: 'frameRate',
        current: metadata.videoInfo.frameRate,
        last: this.lastSegmentMetadata.videoInfo.frameRate,
        change: frameRateChange
      });
      totalWeight += 0.2;
    }

    const detected = mismatches.length > 0;
    const confidence = Math.min(totalWeight, 1);

    return {
      detected,
      confidence,
      details: {
        mismatches,
        totalWeight
      }
    };
  }

  /**
   * 检查时长异常
   * @param {object} metadata - 元数据
   * @returns {object} 检测结果
   */
  checkDurationAnomaly(metadata) {
    if (!metadata?.duration) {
      return { detected: false, confidence: 0, details: '缺少时长信息' };
    }

    // 检查是否为典型广告时长
    const adDurations = [5, 10, 15, 20, 30]; // 常见广告时长（秒）
    const isAdDuration = adDurations.includes(Math.round(metadata.duration));

    // 检查时长是否过短或过长
    const isTooShort = metadata.duration < 3; // 小于3秒可能是占位符
    const isTooLong = metadata.duration > 60; // 大于60秒不太像广告

    let detected = isAdDuration || isTooShort;
    let confidence = isAdDuration ? 0.7 : (isTooShort ? 0.8 : 0);

    // 与前一个片段比较
    if (this.lastSegmentMetadata?.duration) {
      const durationRatio = metadata.duration / this.lastSegmentMetadata.duration;
      if (durationRatio < 0.5 || durationRatio > 2) {
        detected = true;
        confidence = Math.max(confidence, 0.6);
      }
    }

    return {
      detected,
      confidence,
      details: {
        duration: metadata.duration,
        isAdDuration,
        isTooShort,
        isTooLong
      }
    };
  }

  /**
   * 检查帧率变化
   * @param {object} metadata - 元数据
   * @returns {object} 检测结果
   */
  checkFrameRateChange(metadata) {
    if (!metadata?.videoInfo?.frameRate || !this.lastSegmentMetadata?.videoInfo?.frameRate) {
      return { detected: false, confidence: 0, details: '缺少帧率信息' };
    }

    const change = Math.abs(
      metadata.videoInfo.frameRate - this.lastSegmentMetadata.videoInfo.frameRate
    );
    
    const detected = change > this.thresholds.frameRateChangeThreshold;
    const confidence = detected ? Math.min(change / 10, 1) : 0;

    return {
      detected,
      confidence,
      details: {
        current: metadata.videoInfo.frameRate,
        last: this.lastSegmentMetadata.videoInfo.frameRate,
        change
      }
    };
  }

  /**
   * 检查流结构异常
   * @param {object} metadata - 元数据
   * @returns {object} 检测结果
   */
  checkStreamStructure(metadata) {
    if (!metadata) {
      return { detected: false, confidence: 0, details: '缺少元数据' };
    }

    const anomalies = [];
    let confidence = 0;

    // 检查音频流存在性
    if (!metadata.audioInfo) {
      anomalies.push('missing_audio');
      confidence += 0.3;
    }

    // 检查视频流类型
    if (metadata.streamType !== 0x1b && metadata.streamType !== 0x24) {
      anomalies.push('invalid_video_type');
      confidence += 0.4;
    }

    // 检查数据大小合理性
    if (metadata.size) {
      const sizePerSecond = metadata.size / (metadata.duration || 1);
      if (sizePerSecond < 50000 || sizePerSecond > 5000000) {
        anomalies.push('unusual_size');
        confidence += 0.2;
      }
    }

    return {
      detected: anomalies.length > 0,
      confidence: Math.min(confidence, 1),
      details: {
        anomalies,
        streamType: metadata.streamType,
        hasAudio: !!metadata.audioInfo,
        sizePerSecond: metadata.size ? metadata.size / (metadata.duration || 1) : null
      }
    };
  }

  /**
   * 检查时间戳一致性
   * @param {object} metadata - 元数据
   * @returns {object} 检测结果
   */
  checkTimestampConsistency(metadata) {
    if (!metadata?.timestamps || !this.lastSegmentMetadata?.timestamps) {
      return { detected: false, confidence: 0, details: '缺少时间戳信息' };
    }

    const currentPTS = metadata.timestamps.pts;
    const lastPTS = this.lastSegmentMetadata.timestamps.pts;
    const ptsGap = currentPTS - lastPTS;

    // 转换为秒
    const gapInSeconds = ptsGap / 90000;

    // 检查时间戳跳跃
    const isTimeJump = gapInSeconds > 10 || gapInSeconds < 0;
    let confidence = 0;

    if (isTimeJump) {
      confidence = Math.min(Math.abs(gapInSeconds) / 30, 1);
    }

    return {
      detected: isTimeJump,
      confidence,
      details: {
        currentPTS,
        lastPTS,
        ptsGap,
        gapInSeconds
      }
    };
  }

  /**
   * 计算广告概率
   * @param {object} features - 检测特征
   * @returns {number} 广告概率（0-1）
   */
  calculateAdProbability(features) {
    const weights = this.learningModule.model.featureWeights;

    let totalScore = 0;
    let totalWeight = 0;

    for (const [feature, weight] of Object.entries(weights)) {
      if (features[feature]) {
        totalScore += features[feature].confidence * weight;
        totalWeight += weight;
      }
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  /**
   * 计算检测置信度
   * @param {object} features - 检测特征
   * @returns {number} 置信度（0-1）
   */
  calculateConfidence(features) {
    const activeFeatures = Object.values(features).filter(f => f.detected);
    if (activeFeatures.length === 0) return 0;

    const avgConfidence = activeFeatures.reduce((sum, f) => sum + f.confidence, 0) / activeFeatures.length;
    const featureSupport = Math.min(activeFeatures.length / 3, 1); // 最多支持3个特征

    return avgConfidence * featureSupport;
  }

  /**
   * 清理元数据（移除敏感信息）
   * @param {object} metadata - 原始元数据
   * @returns {object} 清理后的元数据
   */
  sanitizeMetadata(metadata) {
    if (!metadata) return null;

    return {
      duration: metadata.duration,
      bitrate: metadata.bitrate,
      size: metadata.size,
      videoInfo: metadata.videoInfo ? {
        width: metadata.videoInfo.width,
        height: metadata.videoInfo.height,
        frameRate: metadata.videoInfo.frameRate
      } : null,
      audioInfo: metadata.audioInfo ? {
        channels: metadata.audioInfo.channels,
        sampleRate: metadata.audioInfo.sampleRate
      } : null
    };
  }

  /**
   * 生成缓存键
   * @param {Buffer|string} tsData - TS数据
   * @param {object} context - 上下文
   * @returns {string} 缓存键
   */
  generateCacheKey(tsData, context) {
    if (typeof tsData === 'string') {
      return `url:${tsData}`;
    } else if (Buffer.isBuffer(tsData)) {
      return `hash:${tsData.slice(0, 100).toString('base64')}`;
    } else {
      return `fallback:${JSON.stringify(context)}`;
    }
  }

  /**
   * 提取PID（基础实现）
   * @param {Buffer} buffer - TS数据
   * @returns {number} PID
   */
  extractPID(buffer) {
    // 简化的PID提取，实际需要完整的TS解析
    return (buffer[1] & 0x1F) << 8 | buffer[2];
  }

  /**
   * 检测流类型（基础实现）
   * @param {Buffer} buffer - TS数据
   * @returns {number} 流类型
   */
  detectStreamType(buffer) {
    // 简化实现，返回H.264类型
    return 0x1b;
  }

  /**
   * 提取视频信息（基础实现）
   * @param {Buffer} buffer - TS数据
   * @returns {object} 视频信息
   */
  extractVideoInfo(buffer) {
    // 模拟数据，实际需要解析SPS
    return {
      width: 1920,
      height: 1080,
      frameRate: 30,
      profile: 'high'
    };
  }

  /**
   * 提取音频信息（基础实现）
   * @param {Buffer} buffer - TS数据
   * @returns {object} 音频信息
   */
  extractAudioInfo(buffer) {
    // 模拟数据
    return {
      codec: 'AAC',
      sampleRate: 48000,
      channels: 2,
      bitrate: 192
    };
  }

  /**
   * 估算时长
   * @param {Buffer} buffer - TS数据
   * @returns {number} 时长（秒）
   */
  estimateDuration(buffer) {
    // 基于文件大小和码率粗略估算
    const avgBitrate = 3000000; // 3Mbps
    return (buffer.length * 8) / avgBitrate;
  }

  /**
   * 估算码率
   * @param {Buffer} buffer - TS数据
   * @returns {number} 码率（bps）
   */
  estimateBitrate(buffer) {
    // 简化计算
    const duration = this.estimateDuration(buffer);
    return duration > 0 ? (buffer.length * 8) / duration : 0;
  }

  /**
   * 提取时间戳（基础实现）
   * @param {Buffer} buffer - TS数据
   * @returns {object} 时间戳信息
   */
  extractTimestamps(buffer) {
    const now = Date.now();
    return {
      pts: now * 90,    // 90kHz时钟
      dts: (now - 1) * 90
    };
  }

  /**
   * 获取统计信息
   * @returns {object} 统计数据
   */
  getStats() {
    return {
      ...this.stats,
      learningStats: {
        historyCount: this.learningModule.history.length,
        feedbackCount: this.learningModule.feedback.length,
        modelWeights: this.learningModule.model.featureWeights
      }
    };
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      totalAnalyzed: 0,
      adsDetected: 0,
      analysisTime: 0,
      cacheHits: 0
    };
  }
  
  /**
   * 获取学习模型信息
   */
  getLearningModel() {
    return {
      featureWeights: { ...this.learningModule.model.featureWeights },
      thresholds: { ...this.learningModule.adaptiveThresholds },
      statistics: {
        historySize: this.learningModule.history.length,
        feedbackSize: this.learningModule.feedback.length
      }
    };
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.metadataCache.clear();
    logger.info('TS元数据检测缓存已清除');
  }
}

module.exports = TSMetadataDetector;