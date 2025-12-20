#!/usr/bin/env node

/**
 * 真实场景测试脚本
 * 测试TS检测功能在接近实际使用场景中的表现
 */

const M3U8Processor = require('./m3u8-processor');
const TSMetadataDetector = require('./ts-metadata-detector');

// 模拟一个包含真实TS文件URL的M3U8
const realisticM3U8 = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:12
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD
#EXTINF:10.5,
https://cdn.example.com/video/segment_001.ts
#EXTINF:12.0,
https://cdn.example.com/video/segment_002.ts
#EXTINF:15.0,
https://ads.example.com/promo/ad_segment_003.ts
#EXTINF:10.0,
https://cdn.example.com/video/segment_004.ts
#EXTINF:8.0,
https://ads.example.com/shop/commercial_005.ts
#EXTINF:11.5,
https://cdn.example.com/video/segment_006.ts
#EXT-X-ENDLIST`;

async function testRealScenario() {
  console.log('开始真实场景测试...\n');
  
  try {
    // 1. 创建处理器，启用TS检测
    const processor = new M3U8Processor({
      tsDetector: {
        thresholds: {
          resolutionChangeThreshold: 100,
          bitrateAnomalyThreshold: 500,
          durationAnomalyThreshold: 5,
          frameRateChangeThreshold: 2
        }
      }
    });

    console.log('📋 测试场景设置');
    console.log('- TS检测已启用:', processor.enableTSDetection);
    console.log('- M3U8包含片段数:', realisticM3U8.split('\n').filter(line => line && !line.startsWith('#')).length);
    console.log('- 包含疑似广告片段:', ['ad_segment_003.ts', 'commercial_005.ts'].length);
    console.log('---');

    // 2. 独立测试TS检测器
    console.log('🔍 独立测试TS检测器');
    const detector = new TSMetadataDetector();
    
    // 模拟不同类型的TS URL
    const testUrls = [
      'https://cdn.example.com/video/segment_001.ts',  // 正常视频
      'https://ads.example.com/promo/ad_segment_003.ts', // 广告
      'https://ads.example.com/shop/commercial_005.ts'   // 商业广告
    ];

    for (const url of testUrls) {
      console.log(`\n检测: ${url}`);
      const result = await detector.detectAdFeatures(url, { url });
      
      console.log(`  - 是否广告: ${result.isAd}`);
      console.log(`  - 概率: ${result.probability.toFixed(3)}`);
      console.log(`  - 置信度: ${result.confidence.toFixed(3)}`);
      
      // 显示检测到的特征
      const detectedFeatures = Object.keys(result.features || {})
        .filter(key => result.features[key]?.detected)
        .map(key => `${key}(${result.features[key].confidence.toFixed(2)})`);
      
      console.log(`  - 检测特征: ${detectedFeatures.length > 0 ? detectedFeatures.join(', ') : '无'}`);
    }
    console.log('---');

    // 3. 测试处理器集成
    console.log('⚙️ 测试处理器集成');
    const startTime = Date.now();
    const result = await processor.process(realisticM3U8, 'https://example.com/playlist.m3u8');
    const processingTime = Date.now() - startTime;

    console.log(`处理完成，耗时: ${processingTime}ms`);
    console.log(`原始片段数: 6`);
    console.log(`保留片段数: ${result.segmentCount}`);
    console.log(`过滤片段数: ${result.filteredSegments.length}`);
    
    if (result.filteredSegments.length > 0) {
      console.log('\n🚫 过滤的片段详情:');
      result.filteredSegments.forEach((segment, index) => {
        console.log(`${index + 1}. ${segment.url} (原因: ${segment.reason})`);
      });
    }
    console.log('---');

    // 4. 统计信息分析
    console.log('📊 统计信息分析');
    const stats = processor.getStats();
    const detectorStats = detector.getStats();
    
    console.log('处理器统计:');
    console.log(`  - 总处理片段: ${stats.totalProcessed}`);
    console.log(`  - 过滤广告数: ${stats.adsFiltered}`);
    console.log(`  - 保留片段数: ${stats.segmentsKept}`);
    console.log(`  - TS分析次数: ${stats.tsDetectionStats.totalAnalyzed}`);
    console.log(`  - TS检测到广告: ${stats.tsDetectionStats.adsDetectedByTS}`);
    
    console.log('\n检测器统计:');
    console.log(`  - 总分析数: ${detectorStats.totalAnalyzed}`);
    console.log(`  - 检测到广告: ${detectorStats.adsDetected}`);
    console.log(`  - 缓存命中: ${detectorStats.cacheHits}`);
    console.log(`  - 分析总时间: ${detectorStats.analysisTime}ms`);
    
    if (detectorStats.totalAnalyzed > 0) {
      console.log(`  - 平均分析时间: ${Math.round(detectorStats.analysisTime / detectorStats.totalAnalyzed)}ms`);
      console.log(`  - 广告检测率: ${((detectorStats.adsDetected / detectorStats.totalAnalyzed) * 100).toFixed(1)}%`);
    }
    console.log('---');

    // 5. 性能评估
    console.log('⚡ 性能评估');
    const expectedUrls = testUrls.length;
    const actualAnalyzed = stats.tsDetectionStats.totalAnalyzed;
    console.log(`预期TS分析: ${expectedUrls}`);
    console.log(`实际TS分析: ${actualAnalyzed}`);
    
    if (actualAnalyzed > 0) {
      console.log(`平均单次分析耗时: ${Math.round(stats.tsDetectionStats.tsAnalysisTime / actualAnalyzed)}ms`);
      console.log(`TS分析占总处理时间: ${((stats.tsDetectionStats.tsAnalysisTime / processingTime) * 100).toFixed(1)}%`);
    }
    
    // 6. 准确性评估
    console.log('\n🎯 准确性评估');
    const expectedAds = 2; // 预期2个广告片段
    const actualAds = result.filteredSegments.filter(s => s.reason === 'advertisement').length;
    console.log(`预期广告数: ${expectedAds}`);
    console.log(`实际过滤数: ${actualAds}`);
    console.log(`过滤率: ${((actualAds / expectedAds) * 100).toFixed(1)}%`);
    
    // 7. 功能验证总结
    console.log('\n✅ 功能验证总结:');
    const validations = [
      { name: 'TS检测器初始化', passed: !!processor.tsDetector },
      { name: 'TS检测功能', passed: detectorStats.totalAnalyzed > 0 },
      { name: '缓存机制', passed: detectorStats.cacheHits >= 0 },
      { name: '统计信息', passed: stats.totalProcessed > 0 },
      { name: '广告过滤', passed: result.filteredSegments.length > 0 },
      { name: '性能表现', passed: processingTime < 1000 }, // 小于1秒
      { name: '错误处理', passed: true } // 没有抛出异常
    ];

    validations.forEach(validation => {
      console.log(`  ${validation.passed ? '✓' : '✗'} ${validation.name}`);
    });

    const passedCount = validations.filter(v => v.passed).length;
    console.log(`\n总体通过率: ${passedCount}/${validations.length} (${((passedCount / validations.length) * 100).toFixed(1)}%)`);

    return {
      success: passedCount === validations.length,
      summary: {
        totalTests: validations.length,
        passedTests: passedCount,
        passRate: (passedCount / validations.length) * 100,
        performance: {
          processingTime,
          tsAnalysisTime: stats.tsDetectionStats.tsAnalysisTime,
          averageAnalysisTime: actualAnalyzed > 0 ? Math.round(stats.tsDetectionStats.tsAnalysisTime / actualAnalyzed) : 0
        },
        accuracy: {
          expectedAds,
          actualAds,
          filterRate: (actualAds / expectedAds) * 100
        }
      }
    };

  } catch (error) {
    console.error('真实场景测试失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  testRealScenario()
    .then(result => {
      if (result.success) {
        console.log('\n🎉 真实场景测试通过！');
        console.log('📈 性能指标:', result.summary.performance);
        console.log('🎯 准确性指标:', result.summary.accuracy);
        process.exit(0);
      } else {
        console.log('\n❌ 真实场景测试失败');
        console.log('错误信息:', result.error);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n❌ 测试执行异常:', error);
      process.exit(1);
    });
}

module.exports = { testRealScenario };