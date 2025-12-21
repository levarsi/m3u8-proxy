const tf = require('@tensorflow/tfjs');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

/**
 * 神经网络模型类 - 用于广告识别
 * 使用 TensorFlow.js 构建和训练模型
 */
class NeuralNetworkModel {
  constructor(options = {}) {
    this.model = null;
    this.isTrained = false;
    this.inputShape = options.inputShape || 20; // 默认输入特征数量
    this.outputShape = options.outputShape || 1; // 输出为广告概率
    this.modelPath = options.modelPath || path.join(__dirname, 'data', 'nn-model.json');
    this.checkpointPath = options.checkpointPath || path.join(__dirname, 'data', 'model-checkpoints');
    
    // 训练配置
    this.trainConfig = {
      epochs: options.epochs || 50,
      batchSize: options.batchSize || 32,
      learningRate: options.learningRate || 0.001,
      validationSplit: options.validationSplit || 0.2,
      callbacks: options.callbacks || []
    };
    
    // 模型统计信息
    this.stats = {
      totalTrainingSessions: 0,
      totalPredictions: 0,
      correctPredictions: 0,
      trainingTime: 0,
      predictionTime: 0,
      modelSize: 0
    };
    
    // 训练状态管理
    this.trainingStatus = {
      isTraining: false,
      currentEpoch: 0,
      totalEpochs: 0,
      loss: 0,
      accuracy: 0,
      valLoss: 0,
      valAccuracy: 0,
      startTime: null,
      endTime: null,
      status: 'idle' // idle, training, completed, failed
    };
    
    // 训练历史记录
    this.trainingHistory = [];
    
    // 初始化模型
    this.init();
  }
  
  /**
   * 初始化模型
   */
  async init() {
    // 检查模型文件是否存在，避免在首次启动时抛出错误
    if (fs.existsSync(this.modelPath)) {
      try {
        await this.loadModel();
      } catch (error) {
        logger.error('加载已有模型失败，将创建新模型', error);
        this.createModel();
      }
    } else {
      logger.info('未找到已保存的模型，将创建新模型');
      this.createModel();
    }
    
    // 确保检查点目录存在
    if (!fs.existsSync(this.checkpointPath)) {
      fs.mkdirSync(this.checkpointPath, { recursive: true });
    }
  }
  
  /**
   * 创建新的神经网络模型
   */
  createModel() {
    // 创建顺序模型
    this.model = tf.sequential();
    
    // 添加输入层和隐藏层
    this.model.add(tf.layers.dense({
      units: 64,
      inputShape: [this.inputShape],
      activation: 'relu',
      kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
    }));
    
    // 添加批归一化层
    this.model.add(tf.layers.batchNormalization());
    
    // 添加Dropout层防止过拟合
    this.model.add(tf.layers.dropout({
      rate: 0.3
    }));
    
    // 添加第二个隐藏层
    this.model.add(tf.layers.dense({
      units: 32,
      activation: 'relu',
      kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
    }));
    
    // 添加批归一化层
    this.model.add(tf.layers.batchNormalization());
    
    // 添加Dropout层
    this.model.add(tf.layers.dropout({
      rate: 0.2
    }));
    
    // 添加第三个隐藏层
    this.model.add(tf.layers.dense({
      units: 16,
      activation: 'relu',
      kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
    }));
    
    // 添加输出层
    this.model.add(tf.layers.dense({
      units: this.outputShape,
      activation: 'sigmoid' // 二分类问题，使用sigmoid激活函数
    }));
    
    // 编译模型
    const optimizer = tf.train.adam(this.trainConfig.learningRate);
    
    this.model.compile({
      optimizer: optimizer,
      loss: 'binaryCrossentropy',
      metrics: ['accuracy', 'precision']
    });
    
    logger.info('神经网络模型创建完成');
    this.logModelSummary();
  }
  
  /**
   * 记录模型摘要
   */
  logModelSummary() {
    if (this.model) {
      const summary = this.model.summary();
      logger.debug('模型摘要:', summary);
      
      // 估算模型大小
      const weights = this.model.getWeights();
      let totalSize = 0;
      weights.forEach(weight => {
        const shape = weight.shape;
        const size = shape.reduce((acc, dim) => acc * dim, 1);
        totalSize += size * 4; // 假设每个参数是4字节的浮点数
      });
      
      this.stats.modelSize = totalSize;
      logger.debug(`模型大小估算: ${(totalSize / 1024).toFixed(2)} KB`);
    }
  }
  
  /**
   * 准备训练数据
   * @param {Array} trainingData - 训练数据
   * @returns {Object} 格式化的训练数据
   */
  prepareTrainingData(trainingData) {
    // 将数据转换为张量
    const features = trainingData.map(item => this.extractFeatures(item));
    const labels = trainingData.map(item => [item.isAd ? 1 : 0]);
    
    return {
      features: tf.tensor2d(features),
      labels: tf.tensor2d(labels)
    };
  }
  
  /**
   * 从检测结果中提取特征
   * @param {Object} detectionResult - 检测结果
   * @returns {Array} 提取的特征向量
   */
  extractFeatures(detectionResult) {
    // 提取特征向量
    const features = [];
    
    // 1. 模式匹配特征
    features.push(detectionResult.patternMatching?.confidence || 0);
    
    // 2. 结构化分析特征
    features.push(detectionResult.structuralAnalysis?.confidence || 0);
    
    // 3. 时长分析特征
    features.push(detectionResult.durationAnalysis?.confidence || 0);
    features.push(detectionResult.durationAnalysis?.duration || 0);
    
    // 4. TS内容分析特征
    features.push(detectionResult.tsContentAnalysis?.confidence || 0);
    features.push(detectionResult.tsContentAnalysis?.probability || 0);
    
    // 5. 网络分析特征
    features.push(detectionResult.networkAnalysis?.confidence || 0);
    features.push(detectionResult.networkAnalysis?.features?.queryParamCount || 0);
    features.push(detectionResult.networkAnalysis?.features?.adDomainMatch ? 1 : 0);
    features.push(detectionResult.networkAnalysis?.features?.hasAdKeywords ? 1 : 0);
    features.push(detectionResult.networkAnalysis?.features?.isThirdParty ? 1 : 0);
    features.push(detectionResult.networkAnalysis?.features?.cdnDomain ? 1 : 0);
    
    // 6. 播放列表上下文特征
    features.push(detectionResult.playlistContext?.confidence || 0);
    features.push(detectionResult.playlistContext?.patterns?.length || 0);
    
    // 7. 额外特征（填充到固定长度）
    while (features.length < this.inputShape) {
      features.push(0);
    }
    
    return features.slice(0, this.inputShape); // 确保特征长度一致
  }
  
  /**
   * 训练模型
   * @param {Array} trainingData - 训练数据
   * @returns {Promise<Object>} 训练结果
   */
  async train(trainingData) {
    if (!this.model) {
      throw new Error('模型未初始化');
    }
    
    const startTime = Date.now();
    this.stats.totalTrainingSessions++;
    
    // 初始化训练状态
    this.trainingStatus = {
      isTraining: true,
      currentEpoch: 0,
      totalEpochs: this.trainConfig.epochs,
      loss: 0,
      accuracy: 0,
      valLoss: 0,
      valAccuracy: 0,
      startTime: startTime,
      endTime: null,
      status: 'training' // idle, training, completed, failed
    };
    
    try {
      // 准备训练数据
      const { features, labels } = this.prepareTrainingData(trainingData);
      
      // 添加训练回调
      const callbacks = [
        tf.callbacks.earlyStopping({
          monitor: 'val_loss',
          patience: 5,
          minDelta: 0.001
        }),
        tf.callbacks.ModelCheckpoint({
          filepath: `${this.checkpointPath}/model-{epoch:02d}-{val_accuracy:.4f}`,
          monitor: 'val_accuracy',
          saveBestOnly: true,
          saveWeightsOnly: false
        }),
        {
          onEpochEnd: (epoch, logs) => {
            // 更新训练状态
            this.trainingStatus = {
              ...this.trainingStatus,
              currentEpoch: epoch + 1,
              loss: logs.loss || 0,
              accuracy: logs.accuracy || 0,
              valLoss: logs.val_loss || 0,
              valAccuracy: logs.val_accuracy || 0
            };
            logger.info(`模型训练进度`, {
              epoch: epoch + 1,
              totalEpochs: this.trainConfig.epochs,
              loss: logs.loss,
              accuracy: logs.accuracy,
              valLoss: logs.val_loss,
              valAccuracy: logs.val_accuracy
            });
          }
        },
        ...this.trainConfig.callbacks
      ];
      
      // 训练模型
      const history = await this.model.fit(features, labels, {
        epochs: this.trainConfig.epochs,
        batchSize: this.trainConfig.batchSize,
        validationSplit: this.trainConfig.validationSplit,
        callbacks: callbacks,
        shuffle: true
      });
      
      // 更新统计信息
      this.stats.trainingTime += Date.now() - startTime;
      this.isTrained = true;
      
      // 更新训练状态
      const endTime = Date.now();
      this.trainingStatus = {
        ...this.trainingStatus,
        isTraining: false,
        endTime: endTime,
        status: 'completed'
      };
      
      // 保存训练历史
      const trainingResult = {
        id: Date.now().toString(),
        startTime: this.trainingStatus.startTime,
        endTime: endTime,
        duration: endTime - this.trainingStatus.startTime,
        epochs: history.epochs.length,
        finalLoss: history.history.loss[history.history.loss.length - 1],
        finalAccuracy: history.history.accuracy[history.history.accuracy.length - 1],
        finalValLoss: history.history.val_loss[history.history.val_loss.length - 1],
        finalValAccuracy: history.history.val_accuracy[history.history.val_accuracy.length - 1],
        history: history.history
      };
      this.trainingHistory.push(trainingResult);
      
      logger.info('模型训练完成', {
        epochs: history.epochs.length,
        finalLoss: trainingResult.finalLoss,
        finalAccuracy: trainingResult.finalAccuracy,
        finalValLoss: trainingResult.finalValLoss,
        finalValAccuracy: trainingResult.finalValAccuracy,
        trainingTime: trainingResult.duration
      });
      
      // 保存模型
      await this.saveModel();
      
      return {
        success: true,
        history: history,
        trainingTime: trainingResult.duration,
        result: trainingResult
      };
      
    } catch (error) {
      logger.error('模型训练失败', error);
      
      // 更新训练状态为失败
      this.trainingStatus = {
        ...this.trainingStatus,
        isTraining: false,
        endTime: Date.now(),
        status: 'failed'
      };
      
      return {
        success: false,
        error: error.message,
        trainingTime: Date.now() - startTime
      };
    }
  }
  
  /**
   * 获取当前训练状态
   * @returns {Object} 训练状态信息
   */
  getTrainingStatus() {
    return this.trainingStatus;
  }
  
  /**
   * 获取训练历史记录
   * @returns {Array} 训练历史记录
   */
  getTrainingHistory() {
    return this.trainingHistory;
  }
  
  /**
   * 评估模型
   * @param {Array} testData - 测试数据
   * @returns {Promise<Object>} 评估结果
   */
  async evaluate(testData) {
    if (!this.model || !this.isTrained) {
      throw new Error('模型未训练');
    }
    
    try {
      // 准备测试数据
      const { features, labels } = this.prepareTrainingData(testData);
      
      // 评估模型
      const result = await this.model.evaluate(features, labels, {
        batchSize: this.trainConfig.batchSize
      });
      
      const [loss, accuracy, precision, recall] = result;
      
      logger.info('模型评估结果', {
        loss: loss.dataSync()[0],
        accuracy: accuracy.dataSync()[0],
        precision: precision.dataSync()[0],
        recall: recall.dataSync()[0]
      });
      
      return {
        loss: loss.dataSync()[0],
        accuracy: accuracy.dataSync()[0],
        precision: precision.dataSync()[0],
        recall: recall.dataSync()[0]
      };
      
    } catch (error) {
      logger.error('模型评估失败', error);
      throw error;
    }
  }
  
  /**
   * 预测广告概率
   * @param {Object} detectionResult - 检测结果
   * @returns {Promise<number>} 广告概率
   */
  async predict(detectionResult) {
    if (!this.model) {
      throw new Error('模型未初始化');
    }
    
    const startTime = Date.now();
    this.stats.totalPredictions++;
    
    try {
      // 提取特征
      const features = this.extractFeatures(detectionResult);
      const inputTensor = tf.tensor2d([features]);
      
      // 进行预测
      const prediction = await this.model.predict(inputTensor);
      const probability = prediction.dataSync()[0];
      
      // 更新统计信息
      this.stats.predictionTime += Date.now() - startTime;
      
      logger.debug('模型预测结果', {
        probability: probability,
        inputFeatures: features,
        predictionTime: Date.now() - startTime
      });
      
      return probability;
      
    } catch (error) {
      logger.error('模型预测失败', error);
      // 预测失败时返回默认值
      return 0.0;
    }
  }
  
  /**
   * 批量预测
   * @param {Array} detectionResults - 检测结果数组
   * @returns {Promise<Array>} 预测结果数组
   */
  async predictBatch(detectionResults) {
    if (!this.model) {
      throw new Error('模型未初始化');
    }
    
    const startTime = Date.now();
    this.stats.totalPredictions += detectionResults.length;
    
    try {
      // 提取特征
      const features = detectionResults.map(result => this.extractFeatures(result));
      const inputTensor = tf.tensor2d(features);
      
      // 进行批量预测
      const predictions = await this.model.predict(inputTensor);
      const probabilities = Array.from(predictions.dataSync());
      
      // 更新统计信息
      this.stats.predictionTime += Date.now() - startTime;
      
      logger.debug('模型批量预测结果', {
        count: probabilities.length,
        averageProbability: probabilities.reduce((sum, p) => sum + p, 0) / probabilities.length,
        predictionTime: Date.now() - startTime,
        avgTimePerPrediction: (Date.now() - startTime) / probabilities.length
      });
      
      return probabilities;
      
    } catch (error) {
      logger.error('模型批量预测失败', error);
      // 预测失败时返回默认值数组
      return Array(detectionResults.length).fill(0.0);
    }
  }
  
  /**
   * 保存模型到文件
   */
  async saveModel() {
    if (!this.model) {
      throw new Error('模型未初始化');
    }
    
    try {
      // 确保模型目录存在
      const modelDir = path.dirname(this.modelPath);
      if (!fs.existsSync(modelDir)) {
        fs.mkdirSync(modelDir, { recursive: true });
      }
      
      // 保存模型
      await this.model.save(`file://${this.modelPath}`);
      logger.info(`模型已保存到: ${this.modelPath}`);
      
    } catch (error) {
      logger.error('模型保存失败', error);
      throw error;
    }
  }
  
  /**
   * 从文件加载模型
   */
  async loadModel() {
    try {
      // 检查模型文件是否存在
      if (fs.existsSync(this.modelPath)) {
        this.model = await tf.loadLayersModel(`file://${this.modelPath}`);
        
        // 特征版本控制：检查输入维度
        const loadedInputShape = this.model.inputs[0].shape[1];
        if (loadedInputShape !== this.inputShape) {
          logger.warn(`模型输入维度 (${loadedInputShape}) 与当前配置 (${this.inputShape}) 不匹配，重置模型。`);
          
          // 备份旧模型
          try {
            const modelDir = path.dirname(this.modelPath);
            const modelName = path.basename(this.modelPath);
            const backupPath = path.join(modelDir, `${modelName}.bak.${Date.now()}`);
            
            // 简单复制主文件，如果是 SavedModel 格式可能需要复制文件夹，
            // 但这里 tfjs-node 保存的是 JSON + weights.bin，通常都在同一目录下。
            // 为了简化，我们只重命名主 JSON 文件，weights 文件让它们留着（可能会有冗余，但安全）。
            if (fs.existsSync(this.modelPath)) {
                fs.copyFileSync(this.modelPath, backupPath);
                logger.info(`旧模型配置已备份至: ${backupPath}`);
            }
          } catch (e) {
            logger.error('备份旧模型失败', e);
          }

          this.model.dispose(); // 释放旧模型
          this.createModel(); // 创建新模型
          return;
        }

        this.isTrained = true;
        logger.info(`模型已从 ${this.modelPath} 加载`);
        this.logModelSummary();
      } else {
        throw new Error('模型文件不存在');
      }
    } catch (error) {
      logger.error('模型加载失败', error);
      throw error;
    }
  }
  
  /**
   * 重置模型
   */
  reset() {
    if (this.model) {
      this.model.dispose();
      this.model = null;
      this.isTrained = false;
      logger.info('模型已重置');
    }
    this.createModel();
  }
  
  /**
   * 获取模型信息
   * @returns {Object} 模型信息
   */
  getModelInfo() {
    return {
      isTrained: this.isTrained,
      inputShape: this.inputShape,
      outputShape: this.outputShape,
      modelPath: this.modelPath,
      stats: this.stats,
      trainConfig: this.trainConfig,
      trainingStatus: this.trainingStatus,
      trainingHistory: this.trainingHistory
    };
  }
  
  /**
   * 获取模型权重
   * @returns {Array} 模型权重
   */
  getWeights() {
    if (!this.model) {
      return null;
    }
    
    const weights = this.model.getWeights();
    return weights.map(weight => weight.dataSync());
  }
  
  /**
   * 设置模型权重
   * @param {Array} weights - 权重数组
   */
  setWeights(weights) {
    if (!this.model || !weights) {
      return;
    }
    
    this.model.setWeights(weights);
    logger.info('模型权重已更新');
  }
  
  /**
   * 获取训练状态
   * @returns {Object} 训练状态
   */
  getTrainingStatus() {
    return {
      ...this.trainingStatus
    };
  }
  
  /**
   * 获取训练历史记录
   * @returns {Array} 训练历史
   */
  getTrainingHistory() {
    return [...this.trainingHistory];
  }
  
  /**
   * 清除训练历史记录
   */
  clearTrainingHistory() {
    this.trainingHistory = [];
    logger.info('训练历史已清除');
  }
  
  /**
   * 更新训练状态
   * @param {Object} updates - 训练状态更新
   */
  updateTrainingStatus(updates) {
    this.trainingStatus = {
      ...this.trainingStatus,
      ...updates
    };
  }
};

module.exports = NeuralNetworkModel;