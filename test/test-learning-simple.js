const M3U8Processor = require('../m3u8-processor');
const logger = require('../logger');

// 设置日志级别为信息模式
logger.setLevel('info');

async function testLearning() {
  console.log('=== 智能学习功能简化测试 ===\n');
  
  // 创建处理器实例
  const processor = new M3U8Processor({
    tsDetector: {
      // 配置智能学习参数
      learningRate: 0.2,  // 提高学习率，以便更快看到变化
      minSamples: 3       // 减少最小样本数
    }
  });
  
  // 测试1: 检查初始学习模型
  console.log('1. 初始学习模型:');
  const initialModel = processor.getLearningModel();
  console.log('   特征权重:', JSON.stringify(initialModel.featureWeights, null, 4));
  console.log('   历史记录数量:', initialModel.statistics.historySize);
  console.log('   反馈数据数量:', initialModel.statistics.feedbackSize);
  console.log('');
  
  // 测试2: 直接访问TS检测器并测试学习功能
  console.log('2. 智能学习模块测试:');
  
  // 获取TS检测器实例
  const tsDetector = processor.tsDetector;
  
  // 测试记录学习历史
  console.log('   记录模拟检测结果...');
  
  // 模拟多个检测结果，以便测试学习模型更新
  const simulatedResults = [
    {
      isAd: true,
      probability: 0.8,
      features: {
        resolutionChange: { detected: true, confidence: 0.9 },
        bitrateAnomaly: { detected: true, confidence: 0.8 },
        encodingMismatch: { detected: false, confidence: 0.2 },
        durationAnomaly: { detected: true, confidence: 0.7 }
      },
      metadata: {
        duration: 15,
        bitrate: 1200,
        size: 2000000,
        videoInfo: { width: 1920, height: 1080, frameRate: 25 }
      }
    },
    {
      isAd: false,
      probability: 0.2,
      features: {
        resolutionChange: { detected: false, confidence: 0.1 },
        bitrateAnomaly: { detected: false, confidence: 0.3 },
        encodingMismatch: { detected: false, confidence: 0.2 },
        durationAnomaly: { detected: false, confidence: 0.1 }
      },
      metadata: {
        duration: 10,
        bitrate: 2500,
        size: 4000000,
        videoInfo: { width: 1920, height: 1080, frameRate: 25 }
      }
    },
    {
      isAd: true,
      probability: 0.9,
      features: {
        resolutionChange: { detected: true, confidence: 0.95 },
        bitrateAnomaly: { detected: true, confidence: 0.85 },
        encodingMismatch: { detected: true, confidence: 0.75 },
        durationAnomaly: { detected: true, confidence: 0.8 }
      },
      metadata: {
        duration: 20,
        bitrate: 1000,
        size: 2500000,
        videoInfo: { width: 1280, height: 720, frameRate: 30 }
      }
    },
    {
      isAd: false,
      probability: 0.1,
      features: {
        resolutionChange: { detected: false, confidence: 0.05 },
        bitrateAnomaly: { detected: false, confidence: 0.1 },
        encodingMismatch: { detected: false, confidence: 0.05 },
        durationAnomaly: { detected: false, confidence: 0.1 }
      },
      metadata: {
        duration: 8,
        bitrate: 2800,
        size: 3500000,
        videoInfo: { width: 1920, height: 1080, frameRate: 25 }
      }
    }
  ];
  
  // 记录模拟结果到学习历史
  simulatedResults.forEach((result, index) => {
    tsDetector.recordToHistory(
      { isAd: result.isAd, probability: result.probability },
      result.features,
      result.metadata
    );
    console.log(`   记录结果 ${index + 1}: ${result.isAd ? '广告' : '正常'} (概率: ${result.probability})`);
  });
  
  console.log('');
  
  // 测试3: 提供反馈
  console.log('3. 提供反馈测试:');
  
  // 提供几个反馈示例
  const feedbackExamples = [
    { segmentUrl: 'http://example.com/ads/ad1.ts', isAd: true, confidence: 0.9 },
    { segmentUrl: 'http://example.com/video/seg1.ts', isAd: false, confidence: 0.8 }
  ];
  
  for (const feedback of feedbackExamples) {
    tsDetector.provideFeedback(feedback.segmentUrl, feedback.isAd, feedback.confidence);
    console.log(`   反馈: ${feedback.segmentUrl} -> ${feedback.isAd ? '广告' : '正常'} (置信度: ${feedback.confidence})`);
  }
  
  console.log('');
  
  // 测试4: 查看学习后的模型变化
  console.log('4. 学习后的模型:');
  
  // 手动保存学习数据
  tsDetector.saveLearningData();
  
  // 手动更新学习模型
  tsDetector.updateLearningModel();
  
  const updatedModel = processor.getLearningModel();
  console.log('   特征权重:', JSON.stringify(updatedModel.featureWeights, null, 4));
  console.log('   历史记录数量:', updatedModel.statistics.historySize);
  console.log('   反馈数据数量:', updatedModel.statistics.feedbackSize);
  
  console.log('');
  
  // 测试5: 查看学习统计信息
  console.log('5. 学习统计信息:');
  const learningStats = processor.getLearningStats();
  console.log('   历史记录总数:', learningStats.historyCount);
  console.log('   反馈数据总数:', learningStats.feedbackCount);
  console.log('');
  
  // 测试6: 数据持久化检查
  console.log('6. 数据持久化检查:');
  const fs = require('fs');
  const path = require('path');
  const dataPath = path.join(__dirname, 'data', 'learning-data.json');
  
  if (fs.existsSync(dataPath)) {
    console.log('   ✓ 学习数据文件已创建');
    const fileSize = fs.statSync(dataPath).size;
    console.log(`   ✓ 文件大小: ${fileSize} bytes`);
    
    // 读取部分数据内容
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    console.log('   ✓ 数据结构:', Object.keys(data));
    if (data.model && data.model.featureWeights) {
      console.log('   ✓ 特征权重已保存');
    }
    if (data.history && data.history.length > 0) {
      console.log('   ✓ 历史记录已保存');
    }
  } else {
    console.log('   ✗ 学习数据文件未创建');
  }
  
  console.log('');
  console.log('=== 测试完成 ===');
}

testLearning().catch(console.error);