#!/usr/bin/env node

/**
 * TS检测功能测试脚本
 * 用于验证TS元数据检测器的基本功能
 */

const TSMetadataDetector = require('../ts-metadata-detector');
const logger = require('../logger');

async function runTests() {
  console.log('开始TS检测功能测试...\n');
  
  const detector = new TSMetadataDetector();
  
  // 测试用例1：模拟广告TS片段
  console.log('测试1: 模拟广告TS片段');
  const adUrl = 'https://example.com/ad_promo_segment_001.ts';
  const result1 = await detector.detectAdFeatures(adUrl, { 
    url: adUrl,
    segmentIndex: 1 
  });
  
  console.log('结果1:', {
    isAd: result1.isAd,
    probability: result1.probability,
    confidence: result1.confidence,
    features: Object.keys(result1.features).filter(key => result1.features[key].detected)
  });
  console.log('---');
  
  // 测试用例2：模拟正常TS片段
  console.log('\n测试2: 模拟正常TS片段');
  const normalUrl = 'https://example.com/video_main_segment_001.ts';
  const result2 = await detector.detectAdFeatures(normalUrl, { 
    url: normalUrl,
    segmentIndex: 2 
  });
  
  console.log('结果2:', {
    isAd: result2.isAd,
    probability: result2.probability,
    confidence: result2.confidence,
    features: Object.keys(result2.features).filter(key => result2.features[key].detected)
  });
  console.log('---');
  
  // 测试用例3：检测连续片段的分辨率变化
  console.log('\n测试3: 检测分辨率变化');
  await detector.detectAdFeatures('https://example.com/video_1080p.ts', {});
  const result3 = await detector.detectAdFeatures('https://example.com/video_720p.ts', {});
  
  console.log('结果3:', {
    isAd: result3.isAd,
    probability: result3.probability,
    resolutionChange: result3.features.resolutionChange
  });
  console.log('---');
  
  // 测试用例4：检测码率异常
  console.log('\n测试4: 检测码率异常');
  await detector.detectAdFeatures('https://example.com/video_normal.ts', {});
  const result4 = await detector.detectAdFeatures('https://example.com/video_low_bitrate.ts', {});
  
  console.log('结果4:', {
    isAd: result4.isAd,
    probability: result4.probability,
    bitrateAnomaly: result4.features.bitrateAnomaly
  });
  console.log('---');
  
  // 获取统计信息
  console.log('\n检测统计:');
  console.log('总检测次数:', detector.stats.totalAnalyzed);
  console.log('检测到广告次数:', detector.stats.adsDetected);
  console.log('缓存命中次数:', detector.stats.cacheHits);
  console.log('总分析时间:', detector.stats.analysisTime + 'ms');
  console.log('平均分析时间:', detector.stats.totalAnalyzed > 0 ? 
    Math.round(detector.stats.analysisTime / detector.stats.totalAnalyzed) + 'ms' : 'N/A');
  
  // 测试配置阈值
  console.log('\n当前检测阈值:');
  console.log(JSON.stringify(detector.thresholds, null, 2));
  
  console.log('\nTS检测功能测试完成！');
}

// 如果直接运行此脚本
if (require.main === module) {
  runTests().catch(error => {
    console.error('测试执行失败:', error);
    process.exit(1);
  });
}

module.exports = { runTests };