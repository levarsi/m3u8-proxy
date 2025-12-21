const logger = require('./logger');

/**
 * 多源数据融合引擎
 * 结合多个检测维度的数据，提高广告识别准确性
 */
class MultiSourceFusion {
  constructor(options = {}) {
    // 配置各检测源的权重
    this.sourceWeights = {
      patternMatching: 0.2,
      structuralAnalysis: 0.2,
      durationAnalysis: 0.1,
      tsContentAnalysis: 0.3,
      networkAnalysis: 0.1,
      playlistContext: 0.1
    };
    
    // 融合策略配置
    this.fusionConfig = {
      // 决策阈值：高于此值则判定为广告
      decisionThreshold: 0.6,
      // 最小检测源数量：需要至少N个源有检测结果才能做出决策
      minSources: 2,
      // 是否启用硬规则：如果某个源的置信度高于硬规则阈值，则直接判定
      enableHardRules: true,
      // 硬规则阈值
      hardRuleThreshold: 0.9
    };
    
    // 统计信息
    this.stats = {
      totalDecisions: 0,
      adsDetected: 0,
      nonAdsDetected: 0,
      fusionTime: 0,
      sourceUsage: {
        patternMatching: 0,
        structuralAnalysis: 0,
        durationAnalysis: 0,
        tsContentAnalysis: 0,
        networkAnalysis: 0,
        playlistContext: 0
      }
    };
  }
  
  /**
   * 融合多个检测源的结果
   * @param {object} detectionResults - 各检测源的结果
   * @returns {object} 融合结果
   */
  fuse(detectionResults) {
    const startTime = Date.now();
    this.stats.totalDecisions++;
    
    try {
      // 验证输入
      if (!detectionResults || typeof detectionResults !== 'object') {
        return {
          isAd: false,
          confidence: 0,
          sources: {},
          fusionMethod: 'invalid_input'
        };
      }
      
      // 统计各源使用情况
      Object.keys(detectionResults).forEach(source => {
        if (this.stats.sourceUsage[source] !== undefined) {
          this.stats.sourceUsage[source]++;
        }
      });
      
      // 应用硬规则
      if (this.fusionConfig.enableHardRules) {
        const hardRuleResult = this.applyHardRules(detectionResults);
        if (hardRuleResult) {
          return hardRuleResult;
        }
      }
      
      // 计算加权融合结果
      const weightedResult = this.calculateWeightedResult(detectionResults);
      
      // 更新统计信息
      if (weightedResult.isAd) {
        this.stats.adsDetected++;
      } else {
        this.stats.nonAdsDetected++;
      }
      
      // 计算融合时间
      weightedResult.fusionTime = Date.now() - startTime;
      this.stats.fusionTime += weightedResult.fusionTime;
      
      return weightedResult;
      
    } catch (error) {
      logger.error('多源数据融合失败', error);
      return {
        isAd: false,
        confidence: 0,
        sources: detectionResults,
        fusionMethod: 'error',
        error: error.message,
        fusionTime: Date.now() - startTime
      };
    }
  }
  
  /**
   * 应用硬规则
   * @param {object} detectionResults - 各检测源的结果
   * @returns {object|null} 如果应用了硬规则则返回结果，否则返回null
   */
  applyHardRules(detectionResults) {
    for (const [source, result] of Object.entries(detectionResults)) {
      if (result && typeof result === 'object' && result.confidence >= this.fusionConfig.hardRuleThreshold) {
        logger.debug('应用硬规则决策', { source, result });
        return {
          isAd: result.isAd,
          confidence: result.confidence,
          sources: detectionResults,
          fusionMethod: 'hard_rule',
          hardRuleSource: source
        };
      }
    }
    return null;
  }
  
  /**
   * 计算加权融合结果
   * @param {object} detectionResults - 各检测源的结果
   * @returns {object} 加权融合结果
   */
  calculateWeightedResult(detectionResults) {
    let totalWeight = 0;
    let weightedSum = 0;
    let validSources = 0;
    
    // 计算加权和
    for (const [source, result] of Object.entries(detectionResults)) {
      if (result && typeof result === 'object') {
        const weight = this.sourceWeights[source] || 0;
        if (weight > 0) {
          totalWeight += weight;
          weightedSum += (result.isAd ? 1 : 0) * result.confidence * weight;
          validSources++;
        }
      }
    }
    
    // 计算最终置信度
    let confidence = 0;
    if (totalWeight > 0) {
      confidence = weightedSum / totalWeight;
    }
    
    // 应用决策阈值
    const isAd = confidence >= this.fusionConfig.decisionThreshold && validSources >= this.fusionConfig.minSources;
    
    return {
      isAd: isAd,
      confidence: confidence,
      sources: detectionResults,
      fusionMethod: 'weighted_sum',
      validSources: validSources
    };
  }
  
  /**
   * 更新各检测源的权重
   * @param {object} newWeights - 新的权重配置
   */
  updateSourceWeights(newWeights) {
    this.sourceWeights = {
      ...this.sourceWeights,
      ...newWeights
    };
    
    // 确保权重总和为1
    const totalWeight = Object.values(this.sourceWeights).reduce((sum, weight) => sum + weight, 0);
    if (totalWeight !== 1) {
      Object.keys(this.sourceWeights).forEach(key => {
        this.sourceWeights[key] /= totalWeight;
      });
    }
    
    logger.info('更新检测源权重', { newWeights: this.sourceWeights });
  }
  
  /**
   * 更新融合策略配置
   * @param {object} newConfig - 新的配置
   */
  updateFusionConfig(newConfig) {
    this.fusionConfig = {
      ...this.fusionConfig,
      ...newConfig
    };
    logger.info('更新融合策略配置', { newConfig: this.fusionConfig });
  }
  
  /**
   * 添加新的检测源
   * @param {string} sourceName - 检测源名称
   * @param {number} weight - 权重
   */
  addDetectionSource(sourceName, weight = 0.1) {
    if (!this.sourceWeights[sourceName]) {
      this.sourceWeights[sourceName] = weight;
      this.stats.sourceUsage[sourceName] = 0;
      
      // 重新归一化权重
      this.updateSourceWeights({});
      
      logger.info('添加新的检测源', { sourceName, weight });
    }
  }
  
  /**
   * 获取统计信息
   * @returns {object} 统计数据
   */
  getStats() {
    return {
      ...this.stats,
      // 计算检测准确率（假设所有决策都是正确的，实际应通过反馈数据计算）
      accuracy: this.stats.totalDecisions > 0 ? 
        (this.stats.adsDetected + this.stats.nonAdsDetected) / this.stats.totalDecisions : 0,
      // 计算平均融合时间
      avgFusionTime: this.stats.totalDecisions > 0 ? 
        this.stats.fusionTime / this.stats.totalDecisions : 0
    };
  }
  
  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      totalDecisions: 0,
      adsDetected: 0,
      nonAdsDetected: 0,
      fusionTime: 0,
      sourceUsage: {
        patternMatching: 0,
        structuralAnalysis: 0,
        durationAnalysis: 0,
        tsContentAnalysis: 0,
        networkAnalysis: 0,
        playlistContext: 0
      }
    };
  }
  
  /**
   * 获取检测源权重配置
   * @returns {object} 权重配置
   */
  getSourceWeights() {
    return { ...this.sourceWeights };
  }
  
  /**
   * 获取融合策略配置
   * @returns {object} 融合策略配置
   */
  getFusionConfig() {
    return { ...this.fusionConfig };
  }
}

module.exports = MultiSourceFusion;