/**
 * 应用程序配置 - 个人优化版
 */
module.exports = {
  // 服务器配置
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '127.0.0.1',
    autoOpenBrowser: process.env.AUTO_OPEN_BROWSER === 'true' || false
  },
  
  // 广告过滤配置
  adFilter: {
    // 扩展的广告关键词正则表达式（不区分大小写）
    patterns: [
      /ad_/i,
      /promo/i,
      /shop/i,
      /advert/i,
      /commercial/i,
      /sponsor/i,
      /adjump/i,
      /_ad\./i,
      /\.ad\./i,
      /advertisement/i,
      /marketing/i,
      /campaign/i,
      /brand/i,
      /offer/i,
      /deal/i,
      /discount/i,
      /sale/i,
      /special/i,
      /popup/i,
      /banner/i,
      /interstitial/i,
      /pre-roll/i,
      /mid-roll/i,
      /post-roll/i
    ],
    
    // 是否启用广告过滤
    enabled: process.env.AD_FILTER_ENABLED !== 'false',
    
    // 广告过滤日志级别
    logLevel: process.env.AD_FILTER_LOG_LEVEL || 'info', // 'none', 'info', 'debug'
    
    // 自定义过滤规则（支持正则表达式数组）
    customPatterns: [],
    
    // 是否在日志中记录被过滤的片段
    logFilteredSegments: true,
    
    // 是否保留片段的原始顺序（移除广告后）
    maintainOrder: true,
    
    // TS内容检测配置（暂时禁用，避免误删正常内容）
    enableTSDetection: false, // process.env.AD_FILTER_TS_DETECTION !== 'false',
    tsDetection: {
      // 并发检测数量限制
      concurrencyLimit: parseInt(process.env.TS_DETECTION_CONCURRENCY_LIMIT) || 5,
      // 检测超时时间（毫秒）
      timeout: parseInt(process.env.TS_DETECTION_TIMEOUT) || 10000,
      // 仅对可疑片段进行TS检测（强制启用，减少误判）
      suspiciousOnly: true, // process.env.TS_DETECTION_SUSPICIOUS_ONLY !== 'false',
      // 置信度阈值
      confidenceThreshold: 0.9, // 提高到0.9，仅高置信度才判定为广告
      // 是否启用缓存
      enableCache: process.env.TS_DETECTION_CACHE !== 'false',
      // 缓存大小限制
      cacheSizeLimit: parseInt(process.env.TS_DETECTION_CACHE_LIMIT) || 1000
    }
  },
  
  // 请求配置
  request: {
    timeout: parseInt(process.env.REQUEST_TIMEOUT) || 15000, // 15秒超时
    maxRedirects: parseInt(process.env.MAX_REDIRECTS) || 5,
    retryAttempts: parseInt(process.env.RETRY_ATTEMPTS) || 2,
    retryDelay: parseInt(process.env.RETRY_DELAY) || 1000,
    headers: {
      'User-Agent': process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': process.env.ACCEPT_LANGUAGE || 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate',
      'Connection': 'keep-alive',
      'Referer': process.env.DEFAULT_REFERER || ''
    }
  },
  
  // 缓存配置
  cache: {
    enabled: process.env.CACHE_ENABLED !== 'false',
    ttl: parseInt(process.env.CACHE_TTL) || 600000, // 10分钟（毫秒）
    maxSize: parseInt(process.env.CACHE_MAX_SIZE) || 200, // 最大缓存条目数
    
    // 持久化缓存配置
    persistence: {
      enabled: process.env.CACHE_PERSISTENCE === 'true' || false,
      filePath: process.env.CACHE_FILE_PATH || './cache/data.json',
      autoSave: true,
      saveInterval: parseInt(process.env.CACHE_SAVE_INTERVAL) || 30000 // 30秒自动保存
    },
    
    // 智能缓存策略
    strategy: {
      enabled: true,
      // 基于文件大小的缓存策略
      sizeBased: {
        enabled: true,
        smallFileTtl: 300000,  // 小文件5分钟
        largeFileTtl: 900000   // 大文件15分钟
      },
      // 基于访问频率的缓存策略
      frequencyBased: {
        enabled: true,
        hitThreshold: 3,       // 访问次数阈值
        bonusMultiplier: 2     // 缓存时间倍数
      }
    }
  },
  
  // CORS配置
  cors: {
    enabled: process.env.CORS_ENABLED !== 'false',
    origin: process.env.CORS_ORIGIN || '*',
    credentials: process.env.CORS_CREDENTIALS === 'true' || false
  },
  
  // 安全配置
  security: {
    // 允许的URL协议
    allowedProtocols: ['http:', 'https:'],
    
    // 最大M3U8文件大小（字节）
    maxM3u8Size: parseInt(process.env.MAX_M3U8_SIZE) || 20 * 1024 * 1024, // 20MB
    
    // 请求速率限制（每分钟最大请求数）
    rateLimit: {
      enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 60000, // 1分钟
      max: parseInt(process.env.RATE_LIMIT_MAX) || 200, // 每分钟200个请求
      skipSuccessfulRequests: false,
      skipFailedRequests: false
    },
    
    // IP白名单（可选）
    ipWhitelist: process.env.IP_WHITELIST ? process.env.IP_WHITELIST.split(',') : [],
    
    // URL黑名单（可选）
    urlBlacklist: process.env.URL_BLACKLIST ? process.env.URL_BLACKLIST.split(',') : []
  },
  
  // 日志配置
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'simple', // 'simple', 'json'
    
    // 日志轮转配置
    rotation: {
      enabled: process.env.LOG_ROTATION === 'true' || false,
      maxSize: process.env.LOG_MAX_SIZE || '10m',
      maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5,
      filePath: process.env.LOG_FILE_PATH || './logs/app.log'
    },
    
    // 控制台输出配置
    console: {
      enabled: process.env.LOG_CONSOLE !== 'false',
      colorize: process.env.LOG_COLORIZE !== 'false'
    },
    
    // 特定模块的日志级别
    moduleLevels: {
      adFilter: process.env.LOG_AD_FILTER || 'info',
      cache: process.env.LOG_CACHE || 'info',
      proxy: process.env.LOG_PROXY || 'info'
    }
  },
  
  // 用户界面配置
  ui: {
    enabled: process.env.UI_ENABLED !== 'false',
    title: process.env.UI_TITLE || 'M3U8 代理服务器',
    theme: process.env.UI_THEME || 'light', // 'light', 'dark'
    language: process.env.UI_LANGUAGE || 'zh-CN', // 'zh-CN', 'en-US'
    showStats: process.env.UI_SHOW_STATS !== 'false',
    refreshInterval: parseInt(process.env.UI_REFRESH_INTERVAL) || 5000 // 5秒
  },
  
  // 播放器配置
  player: {
    enabled: process.env.PLAYER_ENABLED !== 'false',
    autoplay: process.env.PLAYER_AUTOPLAY === 'true' || false,
    defaultVolume: parseFloat(process.env.PLAYER_DEFAULT_VOLUME) || 0.8,
    controls: process.env.PLAYER_CONTROLS !== 'false',
    loop: process.env.PLAYER_LOOP === 'true' || false,
    playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
    skipAdButton: process.env.PLAYER_SKIP_AD === 'true' || true
  },
  
  // 统计和监控配置
  monitoring: {
    enabled: process.env.MONITORING_ENABLED !== 'false',
    collectMetrics: process.env.COLLECT_METRICS !== 'false',
    metricsRetention: parseInt(process.env.METRICS_RETENTION) || 86400000, // 24小时
    alerts: {
      enabled: process.env.ALERTS_ENABLED === 'true' || false,
      errorThreshold: parseInt(process.env.ERROR_THRESHOLD) || 10,
      responseTimeThreshold: parseInt(process.env.RESPONSE_TIME_THRESHOLD) || 5000
    }
  },
  
  // 开发和调试配置
  development: {
    enabled: process.env.NODE_ENV === 'development',
    debugMode: process.env.DEBUG_MODE === 'true' || false,
    mockData: process.env.MOCK_DATA === 'true' || false,
    verboseErrors: process.env.VERBOSE_ERRORS === 'true' || false
  }
};