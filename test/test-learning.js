const M3U8Processor = require('../m3u8-processor');
const logger = require('../logger');

// 设置日志级别为调试模式
logger.setLevel('debug');

async function testLearning() {
  console.log('=== 智能学习功能测试 ===\n');
  
  // 创建处理器实例
  const processor = new M3U8Processor({
    tsDetector: {
      // 配置智能学习参数
      learningRate: 0.1,
      minSamples: 5
    }
  });
  
  // 测试1: 检查初始学习模型
  console.log('1. 初始学习模型:');
  const initialModel = processor.getLearningModel();
  console.log('   特征权重:', initialModel.featureWeights);
  console.log('   阈值设置:', initialModel.thresholds);
  console.log('');
  
  // 测试2: 模拟处理一些片段并提供反馈
  console.log('2. 模拟处理和反馈:');
  
  // 模拟一些广告片段
  const adSegments = [
    'http://example.com/ads/ad1.ts',
    'http://example.com/ads/ad2.ts',
    'http://example.com/ads/ad3.ts'
  ];
  
  // 模拟一些正常片段
  const normalSegments = [
    'http://example.com/video/segment1.ts',
    'http://example.com/video/segment2.ts',
    'http://example.com/video/segment3.ts'
  ];
  
  // 模拟处理片段（实际不会真正下载，因为我们使用的是模拟数据）
  for (const segment of adSegments) {
    console.log(`   处理广告片段: ${segment}`);
    try {
      const result = await processor.isAdByTSContent(segment);
      console.log(`   检测结果: ${result.isAd} (概率: ${result.probability.toFixed(2)})`);
      
      // 提供反馈：这确实是广告
      processor.provideFeedback(segment, true, 0.9);
    } catch (error) {
      console.log(`   处理错误: ${error.message}`);
    }
  }
  
  for (const segment of normalSegments) {
    console.log(`   处理正常片段: ${segment}`);
    try {
      const result = await processor.isAdByTSContent(segment);
      console.log(`   检测结果: ${result.isAd} (概率: ${result.probability.toFixed(2)})`);
      
      // 提供反馈：这不是广告
      processor.provideFeedback(segment, false, 0.9);
    } catch (error) {
      console.log(`   处理错误: ${error.message}`);
    }
  }
  
  console.log('');
  
  // 测试3: 检查更新后的学习模型
  console.log('3. 更新后的学习模型:');
  const updatedModel = processor.getLearningModel();
  console.log('   特征权重:', updatedModel.featureWeights);
  console.log('');
  
  // 测试4: 查看学习统计
  console.log('4. 学习统计信息:');
  const learningStats = processor.getLearningStats();
  console.log('   历史记录数量:', learningStats.historyCount);
  console.log('   反馈数量:', learningStats.feedbackCount);
  console.log('');
  
  console.log('=== 测试完成 ===');
}

testLearning().catch(console.error);