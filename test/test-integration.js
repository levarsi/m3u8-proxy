#!/usr/bin/env node

/**
 * 集成测试脚本
 * 测试M3U8处理器的TS检测功能
 */

const M3U8Processor = require('../m3u8-processor');
const logger = require('../logger');

// 模拟M3U8内容
const mockM3U8 = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-PLAYLIST-TYPE:VOD
#EXTINF:10.0,
video_part_1.ts
#EXTINF:10.0,
video_part_2.ts
#EXTINF:15.0,
ad_promo_video.ts
#EXTINF:10.0,
video_part_3.ts
#EXTINF:5.0,
shop_advertisement.ts
#EXTINF:10.0,
video_part_4.ts
#EXT-X-ENDLIST`;

async function runIntegrationTest() {
  console.log('开始集成测试...\n');
  
  try {
    // 创建处理器实例
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

    console.log('1. 测试基础配置');
    console.log('TS检测已启用:', processor.enableTSDetection);
    console.log('检测器实例存在:', !!processor.tsDetector);
    console.log('---');

    console.log('2. 处理M3U8内容（包含模拟广告片段）');
    const sourceUrl = 'https://example.com/test.m3u8';
    
    const startTime = Date.now();
    const result = await processor.process(mockM3U8, sourceUrl);
    const processingTime = Date.now() - startTime;

    console.log('处理完成，耗时:', processingTime + 'ms');
    console.log('原始片段数:', mockM3U8.split('\n').filter(line => line && !line.startsWith('#')).length);
    console.log('处理后片段数:', result.segmentCount);
    console.log('过滤的广告片段:', result.filteredSegments.length);
    console.log('过滤的片段:', result.filteredSegments.map(s => s.url));
    console.log('---');

    console.log('3. 查看处理结果内容');
    console.log('处理后的M3U8前500字符:');
    console.log(result.content.substring(0, 500) + '...');
    console.log('---');

    console.log('4. 获取统计信息');
    const stats = processor.getStats();
    console.log('总体统计:');
    console.log('- 总处理片段:', stats.totalProcessed);
    console.log('- 过滤的广告:', stats.adsFiltered);
    console.log('- 保留的片段:', stats.segmentsKept);
    console.log('- 处理时间:', stats.processingTime + 'ms');
    console.log('TS检测统计:');
    console.log('- TS分析次数:', stats.tsDetectionStats.totalAnalyzed);
    console.log('- TS检测到广告:', stats.tsDetectionStats.adsDetectedByTS);
    console.log('- TS分析时间:', stats.tsDetectionStats.tsAnalysisTime + 'ms');
    console.log('TS检测器统计:');
    console.log('- 总分析:', stats.tsDetectorStats.totalAnalyzed);
    console.log('- 检测到广告:', stats.tsDetectorStats.adsDetected);
    console.log('- 缓存命中:', stats.tsDetectorStats.cacheHits);
    console.log('---');

    console.log('5. 测试广告规则管理');
    console.log('当前广告规则数:', processor.getAdPatterns().length);
    
    // 添加自定义规则
    processor.addAdPattern(/test_ad/i);
    console.log('添加规则后:', processor.getAdPatterns().length);
    
    // 移除规则
    processor.removeAdPattern(processor.getAdPatterns().length - 1);
    console.log('移除规则后:', processor.getAdPatterns().length);
    console.log('---');

    console.log('6. 测试配置访问');
    console.log('TS检测阈值:', processor.tsDetector.thresholds);
    console.log('缓存大小:', processor.tsDetector.metadataCache.size);
    console.log('---');

    console.log('集成测试完成！');

    // 返回测试结果摘要
    return {
      success: true,
      stats: {
        totalProcessed: stats.totalProcessed,
        adsFiltered: stats.adsFiltered,
        processingTime: processingTime,
        tsDetectionEnabled: processor.enableTSDetection,
        tsAnalyzed: stats.tsDetectionStats.totalAnalyzed
      }
    };

  } catch (error) {
    console.error('集成测试失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  runIntegrationTest()
    .then(result => {
      if (result.success) {
        console.log('\n✅ 测试通过');
        process.exit(0);
      } else {
        console.log('\n❌ 测试失败');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n❌ 测试执行异常:', error);
      process.exit(1);
    });
}

module.exports = { runIntegrationTest };