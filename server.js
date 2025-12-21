const express = require('express');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const path = require('path');
const config = require('./config');
const M3U8Processor = require('./m3u8-processor');
const CacheManager = require('./cache-manager');
const logger = require('./logger');

const app = express();
const m3u8Processor = new M3U8Processor();
const cacheManager = new CacheManager();

// 全局变量
global.requestCount = 0;
global.startTime = new Date().toISOString();

// ==========================================
// 中间件配置
// ==========================================

// 请求计数中间件
app.use((req, res, next) => {
  global.requestCount++;
  next();
});

// 解析JSON请求体
app.use(express.json());

// 静态文件服务
if (config.ui.enabled) {
  app.use(express.static('public'));
}

// CORS中间件
if (config.cors.enabled) {
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', config.cors.origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });
}

// 速率限制中间件
if (config.security.rateLimit.enabled) {
  const limiter = rateLimit({
    windowMs: config.security.rateLimit.windowMs,
    max: config.security.rateLimit.max,
    message: { error: '请求过于频繁，请稍后再试' },
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use('/proxy', limiter);
}

// ==========================================
// 工具函数
// ==========================================

/**
 * 验证URL是否合法
 * @param {string} urlString - 待验证的URL
 * @returns {object} 验证结果和解析后的URL对象
 */
function validateUrl(urlString) {
  try {
    const urlObj = new URL(urlString);
    
    // 检查协议
    if (!config.security.allowedProtocols.includes(urlObj.protocol)) {
      return { valid: false, error: `不支持的协议: ${urlObj.protocol}` };
    }
    
    // 检查是否为M3U8文件（可选）
    if (!urlString.toLowerCase().includes('.m3u8')) {
      logger.warn(`URL可能不是M3U8文件: ${urlString}`);
    }
    
    return { valid: true, urlObj };
  } catch (error) {
    return { valid: false, error: `无效的URL: ${error.message}` };
  }
}

/**
 * 获取M3U8内容
 * @param {string} url - 目标URL
 * @returns {Promise<string>} M3U8内容
 */
async function fetchM3u8(url) {
  const options = {
    timeout: config.request.timeout,
    maxRedirects: config.request.maxRedirects,
    headers: {
      ...config.request.headers,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/vnd.apple.mpegurl, application/x-mpegURL, application/vnd.apple.mpegurl.audio-only, video/mp2t, application/octet-stream, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': new URL(url).origin,
      'Origin': new URL(url).origin,
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    },
    maxContentLength: config.security.maxM3u8Size,
    responseType: 'text',
    validateStatus: function (status) {
      // 只接受200状态码，手动处理重定向
      return status === 200;
    }
  };

  logger.info(`请求M3U8`, { url });
  
  try {
    const response = await axios.get(url, options);
    
    // 验证响应内容
    if (!response.data) {
      throw new Error('响应内容为空');
    }
    
    // 检查内容类型
    const contentType = response.headers['content-type'] || '';
    const isHtmlContentType = contentType.includes('text/html') || contentType.includes('application/html');
    
    // 检查内容是否为HTML
    const content = response.data.trim();
    const isHtmlContent = content.toLowerCase().startsWith('<html') || content.toLowerCase().includes('<head>');
    
    // 如果返回HTML而不是M3U8，可能是被重定向或阻止
    if (isHtmlContentType || isHtmlContent) {
      logger.warn('服务器返回HTML内容而非M3U8', {
        url,
        contentType,
        contentLength: content.length,
        contentPreview: content.substring(0, 200)
      });
      
      // 尝试从HTML中提取重定向URL
      const redirectMatch = content.match(/window\.location\.href\s*=\s*["']([^"']+)["']/) ||
                           content.match(/location\.replace\s*\(\s*["']([^"']+)["']/) ||
                           content.match(/href\s*=\s*["']([^"']+\.m3u8[^"']*)["']/);
      
      if (redirectMatch && redirectMatch[1]) {
        const redirectUrl = redirectMatch[1];
        logger.info('检测到重定向URL，尝试获取', { redirectUrl });
        
        // 如果是相对URL，转换为绝对URL
        const absoluteUrl = redirectUrl.startsWith('http') ? redirectUrl : new URL(redirectUrl, url).href;
        
        // 递归获取重定向后的内容
        return await fetchM3u8(absoluteUrl);
      } else {
        throw new Error('服务器返回HTML内容，可能是访问被阻止或URL无效');
      }
    }
    
    // 验证是否为有效的M3U8内容
    if (!content.startsWith('#EXTM3U')) {
      logger.warn('内容不是有效的M3U8格式', {
        url,
        contentType,
        contentLength: content.length,
        contentPreview: content.substring(0, 100)
      });
      
      // 如果内容很短，可能是错误页面
      if (content.length < 100) {
        throw new Error('内容过短，可能不是有效的M3U8文件');
      }
      
      // 尝试查找M3U8内容
      const m3u8Match = content.match(/#EXTM3U[\s\S]*?(?=#EXT|$)/);
      if (m3u8Match) {
        logger.info('从响应中提取到M3U8内容', { url });
        return m3u8Match[0];
      } else {
        throw new Error('无法找到有效的M3U8内容');
      }
    }
    
    // 记录响应信息用于调试
    logger.debug('M3U8响应信息', {
      url,
      status: response.status,
      contentType,
      contentLength: content.length,
      isM3U8: true
    });
    
    return response.data;
  } catch (error) {
    logger.error(`获取M3U8失败`, error, { 
      url, 
      status: error.response?.status,
      statusText: error.response?.statusText 
    });
    
    if (error.code === 'ECONNABORTED') {
      throw new Error(`请求超时: ${config.request.timeout}ms`);
    } else if (error.response) {
      throw new Error(`源站返回错误: ${error.response.status} ${error.response.statusText}`);
    } else if (error.request) {
      throw new Error(`无法连接到源站: ${error.message}`);
    } else {
      throw new Error(`请求失败: ${error.message}`);
    }
  }
}

// ==========================================
// 1. 核心代理服务接口
// ==========================================
app.options('/proxy', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.status(200).end();
});

app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  
  if (!targetUrl) {
    logger.warn('缺少URL参数');
    return res.status(400).json({ 
      error: '缺少参数',
      message: '请提供url参数，例如: /proxy?url=http://example.com/stream.m3u8',
      example: `${req.protocol}://${req.get('host')}/proxy?url=http://localhost:${config.server.port}/mock-stream.m3u8`
    });
  }

  // 验证URL
  const validation = validateUrl(targetUrl);
  if (!validation.valid) {
    logger.warn('URL验证失败', { url: targetUrl, error: validation.error });
    return res.status(400).json({ 
      error: '无效的URL',
      message: validation.error
    });
  }

  try {
    // 检查缓存
    const cacheKey = cacheManager.generateKey(targetUrl);
    const cached = cacheManager.get(cacheKey);
    
    if (cached) {
      logger.info('从缓存返回M3U8', { url: targetUrl });
      res.set(cached.headers);
      return res.send(cached.content);
    }

    // 获取原始M3U8内容
    const originalM3u8 = await fetchM3u8(targetUrl);
    
    // 验证M3U8内容
    if (!originalM3u8 || !originalM3u8.trim().startsWith('#EXTM3U')) {
      logger.warn('获取到无效的M3U8内容', { 
        url: targetUrl, 
        contentLength: originalM3u8 ? originalM3u8.length : 0,
        contentPreview: originalM3u8 ? originalM3u8.substring(0, 100) : 'null'
      });
      
      // 如果内容无效，尝试直接返回原始内容
      if (originalM3u8 && originalM3u8.trim().length > 0) {
        res.set('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        res.set('Access-Control-Allow-Origin', '*');
        return res.send(originalM3u8);
      } else {
        throw new Error('获取到空的或无效的M3U8内容');
      }
    }
    
    // 处理M3U8（异步支持TS检测）
    const startTime = Date.now();
    const result = await m3u8Processor.process(originalM3u8, targetUrl);
    const processingTime = Date.now() - startTime;
    
    logger.info('M3U8处理完成', { 
      url: targetUrl, 
      processingTime: `${processingTime}ms`,
      originalLines: originalM3u8.split('\n').length,
      processedLines: result.content.split('\n').length,
      segments: result.segmentCount,
      isVod: result.isVod
    });

    // 准备响应头
    const headers = {
      'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'X-Processed-By': 'M3U8-Proxy',
      'X-Processing-Time': `${processingTime}ms`,
      'X-Segment-Count': result.segmentCount,
      'X-Is-VOD': result.isVOD
    };

    if (!result.isVod) {
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    } else if (config.cache.enabled) {
      headers['Cache-Control'] = `public, max-age=${Math.floor(config.cache.ttl / 1000)}`;
    }

    // 如果是VOD且缓存启用，则缓存结果
    if (result.isVod && config.cache.enabled) {
      cacheManager.set(cacheKey, {
        content: result.content,
        headers: headers,
        timestamp: Date.now()
      });
      logger.debug('已缓存VOD内容', { url: targetUrl });
    }

    // 发送响应
    res.set(headers);
    res.send(result.content);

  } catch (error) {
    logger.error('代理处理失败', error, { url: targetUrl });
    
    // 如果是HTML内容错误，尝试返回原始响应
    if (error.message.includes('HTML内容')) {
      res.status(400).json({
        error: '内容错误',
        message: '目标URL返回HTML内容而非M3U8，可能是访问被阻止或URL无效',
        url: targetUrl,
        timestamp: new Date().toISOString(),
        suggestion: '请检查URL是否正确，或尝试其他M3U8源'
      });
      return;
    }
    
    const statusCode = error.message.includes('超时') ? 504 :
                      error.message.includes('无法连接') ? 502 :
                      error.message.includes('返回错误') ? 502 : 500;
    
    res.status(statusCode).json({
      error: '代理错误',
      message: error.message,
      url: targetUrl,
      timestamp: new Date().toISOString(),
      suggestion: '请检查网络连接和URL有效性'
    });
  }
});

// ==========================================
// 2. 健康检查接口
// ==========================================
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cache: cacheManager.getStats(),
    config: {
      adFilterEnabled: config.adFilter.enabled,
      cacheEnabled: config.cache.enabled,
      corsEnabled: config.cors.enabled
    }
  };
  
  logger.debug('健康检查请求');
  res.json(health);
});

// ==========================================
// 系统统计信息接口
// ==========================================
app.get('/stats', (req, res) => {
  const stats = {
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      uptime: process.uptime(),
      pid: process.pid
    },
    server: {
      requestCount: global.requestCount || 0,
      startTime: global.startTime || new Date().toISOString(),
      version: '2.0.0'
    },
    cache: cacheManager.getStats(),
    processor: {
      enabled: m3u8Processor.isAdFilterEnabled || false,
      stats: m3u8Processor.getStats ? m3u8Processor.getStats() : {
        processedCount: 0,
        adsFiltered: 0,
        processingTime: 0
      }
    },
    logger: logger.getStats ? logger.getStats() : {
      totalLogs: 0,
      errorCount: 0
    }
  };
  
  res.json(stats);
});

// ==========================================
// 3. 缓存管理接口
// ==========================================
app.get('/cache/clear', (req, res) => {
  cacheManager.clear();
  logger.info('缓存已清除');
  res.json({ 
    success: true, 
    message: '缓存已清除',
    timestamp: new Date().toISOString()
  });
});

app.get('/cache/stats', (req, res) => {
  res.json(cacheManager.getStats());
});

// ==========================================
// 4. 模拟源站 (用于测试)
// ==========================================
app.get('/mock-stream.m3u8', (req, res) => {
  const mockM3u8 = `
#EXTM3U
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
#EXT-X-ENDLIST
  `.trim();
  
  res.set('Content-Type', 'application/vnd.apple.mpegurl');
  res.send(mockM3u8);
});

// ==========================================
// 5. 用户界面重定向
// ==========================================
if (config.ui.enabled) {
  app.get('/', (req, res) => {
    res.redirect('/index.html');
  });
}

// ==========================================
// 6. 配置查看接口（仅开发环境）
// ==========================================
app.get('/config', (req, res) => {
  // 返回安全的配置信息（不包含敏感数据）
  const safeConfig = {
    server: config.server,
    adFilter: {
      enabled: config.adFilter.enabled,
      patternCount: config.adFilter.patterns.length,
      logLevel: config.adFilter.logLevel
    },
    cache: config.cache,
    cors: config.cors,
    request: {
      timeout: config.request.timeout,
      hasHeaders: !!config.request.headers
    },
    security: {
      allowedProtocols: config.security.allowedProtocols,
      rateLimit: config.security.rateLimit
    },
    ui: config.ui,
    player: config.player,
    monitoring: config.monitoring
  };
  
  res.json(safeConfig);
});

// ==========================================
// 7. 设置更新接口
// ==========================================
app.post('/config', express.json(), (req, res) => {
  try {
    const updates = req.body;
    
    // 这里可以实现配置更新逻辑
    // 注意：实际应用中应该验证和过滤输入
    
    logger.info('配置已更新', { updates });
    
    res.json({
      success: true,
      message: '配置更新成功',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('配置更新失败', error);
    res.status(400).json({
      success: false,
      message: '配置更新失败',
      error: error.message
    });
  }
});

// ==========================================
// 8. 广告过滤规则管理接口
// ==========================================
app.get('/ad-filter/rules', (req, res) => {
  res.json({
    rules: m3u8Processor.getAdPatterns(),
    enabled: config.adFilter.enabled
  });
});

app.post('/ad-filter/rules', express.json(), (req, res) => {
  try {
    const { pattern } = req.body;
    
    if (pattern) {
      m3u8Processor.addAdPattern(pattern);
      res.json({
        success: true,
        message: '规则添加成功',
        rules: m3u8Processor.getAdPatterns()
      });
    } else {
      res.status(400).json({
        success: false,
        message: '缺少模式参数'
      });
    }
  } catch (error) {
    logger.error('添加广告过滤规则失败', error);
    res.status(400).json({
      success: false,
      message: '添加规则失败',
      error: error.message
    });
  }
});

app.delete('/ad-filter/rules/:index', (req, res) => {
  try {
    const index = parseInt(req.params.index);
    m3u8Processor.removeAdPattern(index);
    
    res.json({
      success: true,
      message: '规则删除成功',
      rules: m3u8Processor.getAdPatterns()
    });
  } catch (error) {
    logger.error('删除广告过滤规则失败', error);
    res.status(400).json({
      success: false,
      message: '删除规则失败',
      error: error.message
    });
  }
});

// ==========================================
// 9. 系统统计接口
// ==========================================
app.get('/stats', (req, res) => {
  const stats = {
    system: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      platform: process.platform,
      nodeVersion: process.version
    },
    cache: cacheManager.getStats(),
    processor: m3u8Processor.getStats(),
    server: {
      startTime: new Date(Date.now() - process.uptime() * 1000).toISOString(),
      requestCount: req.app.get('requestCount') || 0
    }
  };
  
  res.json(stats);
});

// ==========================================
// 10. 日志接口
// ==========================================
app.get('/logs', (req, res) => {
  try {
    const { level, module, since, limit } = req.query;
    const options = {};
    
    if (level) options.level = level;
    if (module) options.module = module;
    if (since) options.since = since;
    if (limit) options.limit = parseInt(limit);
    
    const logs = logger.getMemoryLogs(options);
    const stats = logger.getStats();
    
    res.json({
      logs,
      total: logs.length,
      stats,
      filters: options
    });
  } catch (error) {
    logger.error('获取日志失败', error, { module: 'api' });
    res.status(500).json({
      error: '获取日志失败',
      message: error.message
    });
  }
});

// ==========================================
// 11. 日志统计接口
// ==========================================
app.get('/logs/stats', (req, res) => {
  try {
    const stats = logger.getStats();
    res.json(stats);
  } catch (error) {
    logger.error('获取日志统计失败', error, { module: 'api' });
    res.status(500).json({
      error: '获取日志统计失败',
      message: error.message
    });
  }
});

// ==========================================
// 12. TS检测管理接口
// ==========================================
app.get('/ts-detector/stats', (req, res) => {
  try {
    const stats = m3u8Processor.tsDetector.getStats();
    const tsDetectionStats = m3u8Processor.getStats().tsDetectionStats;
    
    res.json({
      detector: stats,
      processor: tsDetectionStats,
      config: {
        enabled: config.adFilter.enableTSDetection,
        thresholds: m3u8Processor.tsDetector.thresholds,
        cacheSize: m3u8Processor.tsDetector.metadataCache.size
      }
    });
  } catch (error) {
    logger.error('获取TS检测统计失败', error);
    res.status(500).json({
      error: '获取TS检测统计失败',
      message: error.message
    });
  }
});

app.post('/ts-detector/clear-cache', (req, res) => {
  try {
    m3u8Processor.tsDetector.clearCache();
    res.json({
      success: true,
      message: 'TS检测缓存已清除',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('清除TS检测缓存失败', error);
    res.status(500).json({
      error: '清除缓存失败',
      message: error.message
    });
  }
});

app.post('/ts-detector/reset-stats', (req, res) => {
  try {
    m3u8Processor.tsDetector.resetStats();
    res.json({
      success: true,
      message: 'TS检测统计已重置',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('重置TS检测统计失败', error);
    res.status(500).json({
      error: '重置统计失败',
      message: error.message
    });
  }
});

app.get('/ts-detector/config', (req, res) => {
  try {
    res.json({
      thresholds: m3u8Processor.tsDetector.thresholds,
      config: config.adFilter.tsDetection,
      enabled: config.adFilter.enableTSDetection
    });
  } catch (error) {
    logger.error('获取TS检测配置失败', error);
    res.status(500).json({
      error: '获取配置失败',
      message: error.message
    });
  }
});

app.post('/ts-detector/config', express.json(), (req, res) => {
  try {
    const updates = req.body;
    
    // 更新阈值配置
    if (updates.thresholds) {
      Object.assign(m3u8Processor.tsDetector.thresholds, updates.thresholds);
    }
    
    // 更新配置
    if (updates.config) {
      Object.assign(config.adFilter.tsDetection, updates.config);
    }
    
    logger.info('TS检测配置已更新', { updates });
    
    res.json({
      success: true,
      message: 'TS检测配置更新成功',
      timestamp: new Date().toISOString(),
      currentConfig: {
        thresholds: m3u8Processor.tsDetector.thresholds,
        config: config.adFilter.tsDetection
      }
    });
  } catch (error) {
    logger.error('更新TS检测配置失败', error);
    res.status(400).json({
      error: '配置更新失败',
      message: error.message
    });
  }
});

// ==========================================
// 14. 神经网络模型管理接口
// ==========================================
app.get('/nn-model/stats', (req, res) => {
  try {
    // 检查 M3U8Processor 是否有 nnModel 属性
    if (!m3u8Processor.nnModel) {
      return res.json({
        enabled: false,
        error: '神经网络模型未初始化'
      });
    }
    
    const modelInfo = m3u8Processor.nnModel.getModelInfo();
    const processorStats = m3u8Processor.stats.nnDetectionStats || {};
    
    res.json({
      enabled: config.adFilter.enableNNDetection !== false,
      model: modelInfo,
      stats: {
        processor: processorStats,
        model: modelInfo.stats
      },
      config: modelInfo.trainConfig
    });
  } catch (error) {
    logger.error('获取神经网络模型统计失败', error);
    res.status(500).json({
      error: '获取神经网络模型统计失败',
      message: error.message
    });
  }
});

app.get('/nn-model/config', (req, res) => {
  res.json({
    enabled: config.adFilter.enableNNDetection !== false
  });
});

app.post('/nn-model/config', express.json(), (req, res) => {
  try {
    const newConfig = req.body;
    if (newConfig.enabled !== undefined) {
      config.adFilter.enableNNDetection = newConfig.enabled;
    }
    
    logger.info('更新神经网络模型配置', { newConfig });
    
    res.json({
      success: true,
      message: '配置已更新',
      config: {
        enabled: config.adFilter.enableNNDetection
      }
    });
  } catch (error) {
    logger.error('更新神经网络模型配置失败', error);
    res.status(400).json({
      error: '配置更新失败',
      message: error.message
    });
  }
});

// 启动模型训练
app.post('/nn-model/train', express.json(), async (req, res) => {
  try {
    // 检查 M3U8Processor 是否有 nnModel 属性
    if (!m3u8Processor.nnModel) {
      return res.status(500).json({
        error: '神经网络模型未初始化'
      });
    }
    
    const trainingData = req.body.trainingData || [];
    
    if (!Array.isArray(trainingData) || trainingData.length === 0) {
      return res.status(400).json({
        error: '训练数据不能为空'
      });
    }
    
    logger.info('开始模型训练', { dataLength: trainingData.length });
    
    // 启动模型训练
    const result = await m3u8Processor.nnModel.train(trainingData);
    
    logger.info('模型训练完成', { result });
    
    res.json({
      success: result.success,
      message: result.success ? '模型训练成功' : '模型训练失败',
      result: result
    });
  } catch (error) {
    logger.error('模型训练失败', error);
    res.status(500).json({
      error: '模型训练失败',
      message: error.message
    });
  }
});

// 获取训练状态
app.get('/nn-model/train/status', (req, res) => {
  try {
    // 检查 M3U8Processor 是否有 nnModel 属性
    if (!m3u8Processor.nnModel) {
      return res.json({
        enabled: false,
        error: '神经网络模型未初始化'
      });
    }
    
    const modelInfo = m3u8Processor.nnModel.getModelInfo();
    const trainingStatus = m3u8Processor.nnModel.getTrainingStatus();
    
    res.json({
      isTrained: modelInfo.isTrained,
      stats: modelInfo.stats,
      trainConfig: modelInfo.trainConfig,
      trainingStatus: trainingStatus
    });
  } catch (error) {
    logger.error('获取训练状态失败', error);
    res.status(500).json({
      error: '获取训练状态失败',
      message: error.message
    });
  }
});

// 获取训练历史记录
app.get('/nn-model/train/history', (req, res) => {
  try {
    // 检查 M3U8Processor 是否有 nnModel 属性
    if (!m3u8Processor.nnModel) {
      return res.json({
        enabled: false,
        error: '神经网络模型未初始化'
      });
    }
    
    const trainingHistory = m3u8Processor.nnModel.getTrainingHistory();
    
    res.json({
      success: true,
      history: trainingHistory
    });
  } catch (error) {
    logger.error('获取训练历史记录失败', error);
    res.status(500).json({
      error: '获取训练历史记录失败',
      message: error.message
    });
  }
});

// 重置模型
app.post('/nn-model/reset', (req, res) => {
  try {
    // 检查 M3U8Processor 是否有 nnModel 属性
    if (!m3u8Processor.nnModel) {
      return res.status(500).json({
        error: '神经网络模型未初始化'
      });
    }
    
    m3u8Processor.nnModel.reset();
    
    logger.info('模型已重置');
    
    res.json({
      success: true,
      message: '模型已重置'
    });
  } catch (error) {
    logger.error('重置模型失败', error);
    res.status(500).json({
      error: '重置模型失败',
      message: error.message
    });
  }
});

// 训练数据管理
const TRAINING_DATA_PATH = path.join(__dirname, 'data', 'nn-training-data.json');
let trainingDataStore = [];

// 加载训练数据
function loadTrainingData() {
  try {
    if (fs.existsSync(TRAINING_DATA_PATH)) {
      const data = fs.readFileSync(TRAINING_DATA_PATH, 'utf8');
      trainingDataStore = JSON.parse(data);
      logger.info(`已加载 ${trainingDataStore.length} 条训练数据`);
    }
  } catch (error) {
    logger.error('加载训练数据失败', error);
  }
}

// 保存训练数据
function saveTrainingData() {
  try {
    const dir = path.dirname(TRAINING_DATA_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(TRAINING_DATA_PATH, JSON.stringify(trainingDataStore, null, 2));
    logger.info('训练数据已保存');
  } catch (error) {
    logger.error('保存训练数据失败', error);
  }
}

// 初始化加载
loadTrainingData();

// 获取训练数据列表
app.get('/nn-model/training-data', (req, res) => {
  try {
    res.json({
      success: true,
      data: trainingDataStore
    });
  } catch (error) {
    logger.error('获取训练数据失败', error);
    res.status(500).json({
      error: '获取训练数据失败',
      message: error.message
    });
  }
});

// 添加训练数据
app.post('/nn-model/training-data', express.json(), (req, res) => {
  try {
    const data = req.body;
    
    if (!data || typeof data !== 'object') {
      return res.status(400).json({
        error: '无效的训练数据'
      });
    }
    
    // 生成唯一ID
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    const newData = { id, ...data, createdAt: new Date().toISOString() };
    
    trainingDataStore.push(newData);
    saveTrainingData(); // 保存数据
    
    logger.info('添加训练数据', { id });
    
    res.json({
      success: true,
      message: '训练数据添加成功',
      data: newData
    });
  } catch (error) {
    logger.error('添加训练数据失败', error);
    res.status(500).json({
      error: '添加训练数据失败',
      message: error.message
    });
  }
});

// 反馈接口 (自动收集)
app.post('/nn-model/feedback', express.json(), (req, res) => {
  try {
    const { url, isAd, features, metadata } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // 尝试构建训练数据
    // 如果前端传来了 features，直接使用；否则仅保存 metadata 待后续处理
    
    const feedbackData = {
        url,
        isAd: !!isAd,
        features: features || [], 
        metadata: metadata || {},
        source: 'feedback'
    };

    // 生成唯一ID
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    const newData = { id, ...feedbackData, createdAt: new Date().toISOString() };
    
    trainingDataStore.push(newData);
    saveTrainingData();

    logger.info('收到用户反馈', { url, isAd });
    
    res.json({
      success: true,
      message: '反馈已接收',
      data: newData
    });

  } catch (error) {
    logger.error('处理反馈失败', error);
    res.status(500).json({ error: error.message });
  }
});

// 更新训练数据
app.put('/nn-model/training-data/:id', express.json(), (req, res) => {
  try {
    const id = req.params.id;
    const updates = req.body;
    
    const index = trainingDataStore.findIndex(item => item.id === id);
    
    if (index === -1) {
      return res.status(404).json({
        error: '训练数据不存在'
      });
    }
    
    trainingDataStore[index] = { ...trainingDataStore[index], ...updates, updatedAt: new Date().toISOString() };
    saveTrainingData(); // 保存数据
    
    logger.info('更新训练数据', { id });
    
    res.json({
      success: true,
      message: '训练数据更新成功',
      data: trainingDataStore[index]
    });
  } catch (error) {
    logger.error('更新训练数据失败', error);
    res.status(500).json({
      error: '更新训练数据失败',
      message: error.message
    });
  }
});

// 删除训练数据
app.delete('/nn-model/training-data/:id', (req, res) => {
  try {
    const id = req.params.id;
    
    const index = trainingDataStore.findIndex(item => item.id === id);
    
    if (index === -1) {
      return res.status(404).json({
        error: '训练数据不存在'
      });
    }
    
    trainingDataStore.splice(index, 1);
    saveTrainingData(); // 保存数据
    
    logger.info('删除训练数据', { id });
    
    res.json({
      success: true,
      message: '训练数据删除成功'
    });
  } catch (error) {
    logger.error('删除训练数据失败', error);
    res.status(500).json({
      error: '删除训练数据失败',
      message: error.message
    });
  }
});

// 批量删除训练数据
app.delete('/nn-model/training-data/batch', express.json(), (req, res) => {
  try {
    const ids = req.body.ids || [];
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        error: '请提供要删除的训练数据ID列表'
      });
    }
    
    trainingDataStore = trainingDataStore.filter(item => !ids.includes(item.id));
    saveTrainingData(); // 保存数据
    
    logger.info('批量删除训练数据', { count: ids.length });
    
    res.json({
      success: true,
      message: `成功删除 ${ids.length} 条训练数据`
    });
  } catch (error) {
    logger.error('批量删除训练数据失败', error);
    res.status(500).json({
      error: '批量删除训练数据失败',
      message: error.message
    });
  }
});

// ==========================================
// 13. 清除日志接口
// ==========================================
app.delete('/logs', (req, res) => {
  try {
    logger.clearMemoryLogs();
    logger.info('内存日志已清除', { module: 'api' });
    res.json({
      success: true,
      message: '内存日志已清除'
    });
  } catch (error) {
    logger.error('清除日志失败', error, { module: 'api' });
    res.status(500).json({
      error: '清除日志失败',
      message: error.message
    });
  }
});

// SPA 路由回退（支持前端 History 路由刷新/直达）
if (config.ui.enabled) {
  app.get('*', (req, res, next) => {
    const accept = req.headers.accept || '';
    if (typeof accept === 'string' && accept.includes('text/html')) {
      return res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
    next();
  });
}

// ==========================================
// 启动服务
// ==========================================
const server = app.listen(config.server.port, config.server.host, () => {
  logger.info(`=========================================`);
  logger.info(`M3U8代理服务已启动`);
  logger.info(`地址: http://${config.server.host}:${config.server.port}`);
  logger.info(`-----------------------------------------`);
  logger.info(`主要接口:`);
  logger.info(`1. 代理服务: /proxy?url=您的M3U8地址`);
  logger.info(`2. 健康检查: /health`);
  logger.info(`3. 缓存状态: /cache/stats`);
  logger.info(`4. 测试流: /mock-stream.m3u8`);
  logger.info(`-----------------------------------------`);
  logger.info(`配置摘要:`);
  logger.info(`- 广告过滤: ${config.adFilter.enabled ? '已启用' : '已禁用'}`);
  logger.info(`- 缓存: ${config.cache.enabled ? '已启用' : '已禁用'}`);
  logger.info(`- CORS: ${config.cors.enabled ? '已启用' : '已禁用'}`);
  logger.info(`- 速率限制: ${config.security.rateLimit.enabled ? '已启用' : '已禁用'}`);
  logger.info(`=========================================`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('收到SIGTERM信号，正在关闭服务...');
  server.close(() => {
    logger.info('服务已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('收到SIGINT信号，正在关闭服务...');
  server.close(() => {
    logger.info('服务已关闭');
    process.exit(0);
  });
});

module.exports = app;