#!/usr/bin/env node

/**
 * 启用TS检测功能的服务启动脚本
 * 快速验证新功能的演示脚本
 */

const express = require('express');
const M3U8Processor = require('./m3u8-processor');
const CacheManager = require('./cache-manager');
const logger = require('./logger');
const config = require('./config');

// 创建应用实例
const app = express();
const processor = new M3U8Processor();
const cacheManager = new CacheManager();

// 基础中间件
app.use(express.json());
app.use(express.static('public'));

// 启用CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// 主要代理接口
app.get('/proxy', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({
      error: '缺少URL参数',
      example: '/proxy?url=https://example.com/stream.m3u8'
    });
  }

  try {
    // 简化的M3U8处理（实际应用中应该从源站获取）
    if (url.includes('mock')) {
      const mockM3U8 = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:12
#EXT-X-PLAYLIST-TYPE:VOD
#EXTINF:10.0,
video_normal_001.ts
#EXTINF:15.0,
ad_promo_segment.ts
#EXTINF:10.0,
video_normal_002.ts
#EXT-X-ENDLIST`;

      const result = await processor.process(mockM3U8, url);
      
      res.set({
        'Content-Type': 'application/vnd.apple.mpegurl',
        'X-Processed-By': 'M3U8-Proxy-TS-Detection',
        'X-TS-Detection-Enabled': 'true',
        'X-Ads-Filtered': result.filteredSegments.length
      });
      
      res.send(result.content);
    } else {
      res.status(400).json({
        error: '请使用mock URL进行测试',
        example: '/proxy?url=mock://test-stream.m3u8'
      });
    }
  } catch (error) {
    logger.error('代理处理失败', error);
    res.status(500).json({
      error: '处理失败',
      message: error.message
    });
  }
});

// TS检测专用接口
app.get('/ts-detector/demo', async (req, res) => {
  try {
    const testUrls = [
      { name: '正常视频片段', url: 'https://cdn.example.com/video/segment_001.ts' },
      { name: '广告片段', url: 'https://ads.example.com/promo/ad_segment.ts' },
      { name: '商业广告', url: 'https://shop.example.com/commercial.ts' }
    ];

    const results = [];
    for (const test of testUrls) {
      const result = await processor.tsDetector.detectAdFeatures(test.url, { url: test.url });
      results.push({
        name: test.name,
        url: test.url,
        isAd: result.isAd,
        probability: result.probability,
        confidence: result.confidence,
        detectedFeatures: Object.keys(result.features || {})
          .filter(key => result.features[key]?.detected)
      });
    }

    res.json({
      title: 'TS广告检测演示',
      description: '展示TS检测功能对不同类型片段的识别效果',
      results,
      summary: {
        totalTested: results.length,
        adsDetected: results.filter(r => r.isAd).length,
        averageConfidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length
      },
      config: {
        thresholds: processor.tsDetector.thresholds,
        enabled: processor.enableTSDetection
      }
    });
  } catch (error) {
    res.status(500).json({
      error: '演示失败',
      message: error.message
    });
  }
});

// 统计信息接口
app.get('/stats', (req, res) => {
  res.json({
    processor: processor.getStats(),
    tsDetector: processor.tsDetector.getStats(),
    cache: cacheManager.getStats(),
    system: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      tsDetectionEnabled: processor.enableTSDetection
    }
  });
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    features: {
      urlFiltering: true,
      tsDetection: processor.enableTSDetection,
      caching: config.cache.enabled
    },
    version: '1.0.0-ts-detection'
  });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';

app.listen(PORT, HOST, () => {
  console.log('\n🚀 M3U8代理服务器 (含TS检测功能) 已启动');
  console.log('=====================================');
  console.log(`📍 服务地址: http://${HOST}:${PORT}`);
  console.log('');
  console.log('🎯 主要接口:');
  console.log(`  - 代理测试: http://${HOST}:${PORT}/proxy?url=mock://test-stream.m3u8`);
  console.log(`  - TS检测演示: http://${HOST}:${PORT}/ts-detector/demo`);
  console.log(`  - 统计信息: http://${HOST}:${PORT}/stats`);
  console.log(`  - 健康检查: http://${HOST}:${PORT}/health`);
  console.log('');
  console.log('✨ 新功能特性:');
  console.log('  ✓ TS切片级别广告检测');
  console.log('  ✓ 多维度特征分析');
  console.log('  ✓ 智能评分系统');
  console.log('  ✓ 缓存优化机制');
  console.log('  ✓ 实时统计监控');
  console.log('');
  console.log('🔧 配置状态:');
  console.log(`  - TS检测已${processor.enableTSDetection ? '启用' : '禁用'}`);
  console.log(`  - 广告过滤已${config.adFilter.enabled ? '启用' : '禁用'}`);
  console.log(`  - 缓存系统已${config.cache.enabled ? '启用' : '禁用'}`);
  console.log('=====================================');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭服务...');
  processor.tsDetector.clearCache();
  console.log('TS检测缓存已清理');
  process.exit(0);
});

module.exports = app;