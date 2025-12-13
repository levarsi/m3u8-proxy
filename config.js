/**
 * 应用程序配置
 */
module.exports = {
  // 服务器配置
  server: {
    port: process.env.PORT || 3000,
    host: '127.0.0.1'
  },
  
  // 广告过滤配置
  adFilter: {
    // 广告关键词正则表达式（不区分大小写）
    patterns: [
      /ad_/i,
      /promo/i,
      /shop/i,
      /advert/i,
      /commercial/i,
      /sponsor/i,
      /_ad\./i,
      /\.ad\./i
    ],
    
    // 是否启用广告过滤
    enabled: true,
    
    // 广告过滤日志级别
    logLevel: 'info' // 'none', 'info', 'debug'
  },
  
  // 请求配置
  request: {
    timeout: 10000, // 10秒超时
    maxRedirects: 5,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
    }
  },
  
  // 缓存配置
  cache: {
    enabled: true,
    ttl: 300000, // 5分钟（毫秒）
    maxSize: 100 // 最大缓存条目数
  },
  
  // CORS配置
  cors: {
    enabled: true,
    origin: process.env.CORS_ORIGIN || '*'
  },
  
  // 安全配置
  security: {
    // 允许的URL协议
    allowedProtocols: ['http:', 'https:'],
    
    // 最大M3U8文件大小（字节）
    maxM3u8Size: 10 * 1024 * 1024, // 10MB
    
    // 请求速率限制（每分钟最大请求数）
    rateLimit: {
      enabled: true,
      windowMs: 60000, // 1分钟
      max: 100 // 每分钟100个请求
    }
  },
  
  // 日志配置
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'simple' // 'simple', 'json'
  }
};