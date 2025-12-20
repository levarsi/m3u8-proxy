const fs = require('fs').promises;
const path = require('path');
const config = require('./config');

/**
 * 增强的日志记录器
 * 支持日志轮转、文件输出和统计信息
 */
class Logger {
  constructor() {
    this.level = config.logging.level;
    this.format = config.logging.format;
    this.rotation = config.logging.rotation;
    this.console = config.logging.console;
    this.moduleLevels = config.logging.moduleLevels || {};
    
    // 日志统计
    this.stats = {
      total: 0,
      error: 0,
      warn: 0,
      info: 0,
      debug: 0,
      byModule: {},
      startTime: Date.now()
    };
    
    // 内存中的日志缓存（用于API接口）
    this.memoryLogs = [];
    this.maxMemoryLogs = 1000;
    
    // 初始化日志轮转
    if (this.rotation.enabled) {
      this.initRotation();
    }
  }

  /**
   * 初始化日志轮转
   */
  async initRotation() {
    try {
      // 确保日志目录存在
      const logDir = path.dirname(this.rotation.filePath);
      await fs.mkdir(logDir, { recursive: true });
      
      // 检查是否需要轮转
      await this.checkRotation();
      
      // 定期检查轮转
      this.rotationInterval = setInterval(
        () => this.checkRotation(),
        60000 // 每分钟检查一次
      );
      
    } catch (error) {
      console.error('日志轮转初始化失败:', error.message);
    }
  }

  /**
   * 检查并执行日志轮转
   */
  async checkRotation() {
    try {
      const stats = await fs.stat(this.rotation.filePath);
      const maxSize = this.parseSize(this.rotation.maxSize);
      
      if (stats.size >= maxSize) {
        await this.rotateLogs();
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('检查日志轮转失败:', error.message);
      }
    }
  }

  /**
   * 执行日志轮转
   */
  async rotateLogs() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedPath = this.rotation.filePath.replace('.log', `-${timestamp}.log`);
      
      // 重命名当前日志文件
      await fs.rename(this.rotation.filePath, rotatedPath);
      
      // 清理旧日志文件
      await this.cleanupOldLogs();
      
      console.log(`日志已轮转到: ${rotatedPath}`);
    } catch (error) {
      console.error('日志轮转失败:', error.message);
    }
  }

  /**
   * 清理旧日志文件
   */
  async cleanupOldLogs() {
    try {
      const logDir = path.dirname(this.rotation.filePath);
      const files = await fs.readdir(logDir);
      const logFiles = files
        .filter(file => file.startsWith(path.basename(this.rotation.filePath, '.log')))
        .map(file => ({
          name: file,
          path: path.join(logDir, file),
          mtime: fs.stat(path.join(logDir, file)).then(stats => stats.mtime)
        }));
      
      // 按修改时间排序
      const sortedFiles = await Promise.all(
        logFiles.map(async file => ({
          ...file,
          mtime: await file.mtime
        }))
      );
      
      sortedFiles.sort((a, b) => b.mtime - a.mtime);
      
      // 删除超过限制的文件
      if (sortedFiles.length > this.rotation.maxFiles) {
        const filesToDelete = sortedFiles.slice(this.rotation.maxFiles);
        for (const file of filesToDelete) {
          await fs.unlink(file.path);
          console.log(`已删除旧日志文件: ${file.name}`);
        }
      }
    } catch (error) {
      console.error('清理旧日志失败:', error.message);
    }
  }

  /**
   * 解析文件大小字符串
   * @param {string} sizeStr - 大小字符串 (如 '10m', '1g')
   * @returns {number} 字节数
   */
  parseSize(sizeStr) {
    const units = { b: 1, k: 1024, m: 1024 * 1024, g: 1024 * 1024 * 1024 };
    const match = sizeStr.toLowerCase().match(/^(\d+)([bkmg]?)$/);
    if (!match) return 10 * 1024 * 1024; // 默认 10MB
    
    const [, size, unit] = match;
    return parseInt(size) * (units[unit] || 1);
  }

  /**
   * 获取日志级别权重
   * @param {string} level - 日志级别
   * @returns {number} 权重值
   */
  getLevelWeight(level) {
    const levels = {
      error: 4,
      warn: 3,
      info: 2,
      debug: 1
    };
    return levels[level] || 2;
  }

  /**
   * 检查是否应该记录该级别的日志
   * @param {string} level - 日志级别
   * @param {string} module - 模块名称
   * @returns {boolean} 是否应该记录
   */
  shouldLog(level, module = null) {
    // 检查模块特定的日志级别
    if (module && this.moduleLevels[module]) {
      const moduleLevel = this.moduleLevels[module];
      return this.getLevelWeight(level) >= this.getLevelWeight(moduleLevel);
    }
    
    return this.getLevelWeight(level) >= this.getLevelWeight(this.level);
  }

  /**
   * 格式化日志消息
   * @param {string} level - 日志级别
   * @param {string} message - 日志消息
   * @param {object} meta - 元数据
   * @returns {string} 格式化后的日志
   */
  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...meta
    };
    
    if (this.format === 'json') {
      return JSON.stringify(logEntry);
    } else {
      // 简单格式
      let log = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
      if (Object.keys(meta).length > 0) {
        log += ` ${JSON.stringify(meta)}`;
      }
      return log;
    }
  }

  /**
   * 写入日志到文件
   * @param {string} level - 日志级别
   * @param {string} formattedMessage - 格式化后的消息
   */
  async writeToFile(level, formattedMessage) {
    if (!this.rotation.enabled) return;
    
    try {
      await fs.appendFile(this.rotation.filePath, formattedMessage + '\n');
    } catch (error) {
      console.error('写入日志文件失败:', error.message);
    }
  }

  /**
   * 更新统计信息
   * @param {string} level - 日志级别
   * @param {string} module - 模块名称
   */
  updateStats(level, module = null) {
    this.stats.total++;
    this.stats[level]++;
    
    if (module) {
      if (!this.stats.byModule[module]) {
        this.stats.byModule[module] = { total: 0, error: 0, warn: 0, info: 0, debug: 0 };
      }
      this.stats.byModule[module].total++;
      this.stats.byModule[module][level]++;
    }
  }

  /**
   * 添加到内存日志缓存
   * @param {object} logEntry - 日志条目
   */
  addToMemoryCache(logEntry) {
    this.memoryLogs.push(logEntry);
    
    // 限制内存缓存大小
    if (this.memoryLogs.length > this.maxMemoryLogs) {
      this.memoryLogs = this.memoryLogs.slice(-this.maxMemoryLogs);
    }
  }

  /**
   * 通用日志记录方法
   * @param {string} level - 日志级别
   * @param {string} message - 日志消息
   * @param {object} meta - 元数据
   */
  async log(level, message, meta = {}) {
    const module = meta.module || 'default';
    
    if (!this.shouldLog(level, module)) return;
    
    const formattedMessage = this.formatMessage(level, message, meta);
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      module,
      ...meta
    };
    
    // 更新统计
    this.updateStats(level, module);
    
    // 添加到内存缓存
    this.addToMemoryCache(logEntry);
    
    // 输出到控制台
    if (this.console.enabled) {
      const colorized = this.console.colorize ? this.colorizeMessage(level, formattedMessage) : formattedMessage;
      console.log(colorized);
    }
    
    // 写入文件
    await this.writeToFile(level, formattedMessage);
  }

  /**
   * 着色消息（用于控制台输出）
   * @param {string} level - 日志级别
   * @param {string} message - 消息
   * @returns {string} 着色后的消息
   */
  colorizeMessage(level, message) {
    const colors = {
      error: '\x1b[31m', // 红色
      warn: '\x1b[33m',  // 黄色
      info: '\x1b[36m',  // 青色
      debug: '\x1b[37m'  // 白色
    };
    const reset = '\x1b[0m';
    
    return `${colors[level] || ''}${message}${reset}`;
  }

  /**
   * 记录错误日志
   * @param {string} message - 错误消息
   * @param {Error|object} error - 错误对象
   * @param {object} meta - 元数据
   */
  async error(message, error = null, meta = {}) {
    const errorMeta = { ...meta };
    if (error) {
      errorMeta.error = error.message;
      if (error.stack && this.level === 'debug') {
        errorMeta.stack = error.stack;
      }
    }
    
    await this.log('error', message, errorMeta);
  }

  /**
   * 记录警告日志
   * @param {string} message - 警告消息
   * @param {object} meta - 元数据
   */
  async warn(message, meta = {}) {
    await this.log('warn', message, meta);
  }

  /**
   * 记录信息日志
   * @param {string} message - 信息消息
   * @param {object} meta - 元数据
   */
  async info(message, meta = {}) {
    await this.log('info', message, meta);
  }

  /**
   * 记录调试日志
   * @param {string} message - 调试消息
   * @param {object} meta - 元数据
   */
  async debug(message, meta = {}) {
    await this.log('debug', message, meta);
  }

  /**
   * 获取日志统计信息
   * @returns {object} 统计信息
   */
  getStats() {
    const uptime = Date.now() - this.stats.startTime;
    const avgPerMinute = (this.stats.total / (uptime / 60000)).toFixed(2);
    
    return {
      ...this.stats,
      uptime,
      avgPerMinute: parseFloat(avgPerMinute),
      memoryLogsCount: this.memoryLogs.length,
      rotationEnabled: this.rotation.enabled
    };
  }

  /**
   * 获取内存中的日志
   * @param {object} options - 查询选项
   * @returns {Array} 日志数组
   */
  getMemoryLogs(options = {}) {
    let logs = [...this.memoryLogs];
    
    // 按级别过滤
    if (options.level) {
      logs = logs.filter(log => log.level === options.level);
    }
    
    // 按模块过滤
    if (options.module) {
      logs = logs.filter(log => log.module === options.module);
    }
    
    // 按时间范围过滤
    if (options.since) {
      const since = new Date(options.since);
      logs = logs.filter(log => new Date(log.timestamp) >= since);
    }
    
    // 限制数量
    if (options.limit) {
      logs = logs.slice(-options.limit);
    }
    
    // 倒序排列（最新的在前）
    return logs.reverse();
  }

  /**
   * 清除内存日志缓存
   */
  clearMemoryLogs() {
    this.memoryLogs = [];
  }

  /**
   * 设置日志级别
   * @param {string} level - 新的日志级别
   */
  setLevel(level) {
    this.level = level;
  }

  /**
   * 设置模块日志级别
   * @param {string} module - 模块名称
   * @param {string} level - 日志级别
   */
  setModuleLevel(module, level) {
    this.moduleLevels[module] = level;
  }

  /**
   * 关闭日志系统
   */
  async close() {
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
    }
    
    // 清理资源
    this.clearMemoryLogs();
  }
}

// 创建并导出单例实例
const loggerInstance = new Logger();
module.exports = loggerInstance;

// 同时导出Logger类以供扩展使用
module.exports.Logger = Logger;