const NeuralNetworkModel = require('../neural-network-model');
const logger = require('../logger');
const path = require('path');
const fs = require('fs');

// 设置日志级别
logger.setLevel('debug');

async function testSerialization() {
  console.log('=== 神经网络自定义序列化测试 ===\n');

  const testModelPath = path.join(__dirname, 'test-model-custom.json');
  
  // 清理旧文件
  if (fs.existsSync(testModelPath)) fs.unlinkSync(testModelPath);

  // 1. 初始化并训练模型
  console.log('1. 初始化并训练模型...');
  const nnModel = new NeuralNetworkModel({
    modelPath: testModelPath,
    epochs: 2,
    batchSize: 2
  });

  // 模拟数据
  const mockData = [
    {
      isAd: true,
      patternMatching: { confidence: 0.9 },
      structuralAnalysis: { confidence: 0.8 },
      durationAnalysis: { confidence: 0.7, duration: 15 },
      tsContentAnalysis: { confidence: 0.6, probability: 0.8 },
      networkAnalysis: { confidence: 0.9, features: { queryParamCount: 5 } },
      playlistContext: { confidence: 0.5 }
    },
    {
      isAd: false,
      patternMatching: { confidence: 0.1 },
      structuralAnalysis: { confidence: 0.2 },
      durationAnalysis: { confidence: 0.1, duration: 10 },
      tsContentAnalysis: { confidence: 0.1, probability: 0.1 },
      networkAnalysis: { confidence: 0.2, features: { queryParamCount: 1 } },
      playlistContext: { confidence: 0.1 }
    }
  ];

  await nnModel.train(mockData);
  console.log('   训练完成');

  // 2. 保存模型 (此处会调用新的 saveModel)
  console.log('2. 保存模型...');
  await nnModel.saveModel();
  
  if (fs.existsSync(testModelPath)) {
    console.log('   ✓ 文件已创建');
    const content = JSON.parse(fs.readFileSync(testModelPath));
    console.log(`   ✓ 格式验证: format=${content.format}`);
  } else {
    throw new Error('模型文件未创建');
  }

  // 3. 重新加载模型
  console.log('3. 重新加载模型...');
  const newModel = new NeuralNetworkModel({
    modelPath: testModelPath
  });
  
  // 此时 init() 会自动调用 loadModel()
  // 但为了确保加载完成，我们显式调用一次或者等待 init
  // 由于 constructor 中 init 是 async 且未 await，我们手动调一下 loadModel 模拟重启
  await newModel.loadModel();
  
  console.log('   模型加载成功');
  
  // 4. 验证预测功能
  console.log('4. 验证预测功能...');
  const prediction = await newModel.predict(mockData[0]);
  console.log(`   预测结果: ${prediction}`);
  
  if (typeof prediction === 'number' && prediction >= 0 && prediction <= 1) {
    console.log('   ✓ 预测功能正常');
  } else {
    throw new Error('预测结果无效');
  }

  console.log('\n=== 测试成功 ===');
  
  // 清理
  // fs.unlinkSync(testModelPath);
}

testSerialization().catch(console.error);
