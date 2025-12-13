const express = require('express');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const M3U8Processor = require('./m3u8-processor');
const CacheManager = require('./cache-manager');
const logger = require('./logger');

const app = express();
const m3u8Processor = new M3U8Processor();
const cacheManager = new CacheManager();

// ==========================================
// 中间件配置
// ==========================================

// CORS中间件
if (config.cors.enabled) {
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', config.cors.origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
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
    headers: config.request.headers,
    maxContentLength: config.security.maxM3u8Size,
    responseType: 'text'
  };

  logger.info(`请求M3U8`, { url });
  
  try {
    const response = await axios.get(url, options);
    return response.data;
  } catch (error) {
    logger.error(`获取M3U8失败`, error, { url });
    
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
    
    // 处理M3U8
    const startTime = Date.now();
    const result = m3u8Processor.process(originalM3u8, targetUrl);
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
      'Content-Type': 'application/vnd.apple.mpegurl',
      'X-Processed-By': 'M3U8-Proxy',
      'X-Processing-Time': `${processingTime}ms`,
      'X-Segment-Count': result.segmentCount,
      'X-Is-VOD': result.isVod
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
    
    const statusCode = error.message.includes('超时') ? 504 :
                      error.message.includes('无法连接') ? 502 :
                      error.message.includes('返回错误') ? 502 : 500;
    
    res.status(statusCode).json({
      error: '代理错误',
      message: error.message,
      timestamp: new Date().toISOString()
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
// 5. 配置查看接口（仅开发环境）
// ==========================================
if (process.env.NODE_ENV !== 'production') {
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
      }
    };
    
    res.json(safeConfig);
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