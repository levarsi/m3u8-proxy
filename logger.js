const config = require('./config');

/**
 * 简单的日志记录器
 */
class Logger {
  constructor() {
    this.level = config.logging.level;
    this.format = config.logging.format;
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
   * @returns {boolean} 是否应该记录
   */
  shouldLog(level) {
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
    
    if (this.format === 'json') {
      return JSON.stringify({
        timestamp,
        level,
        message,
        ...meta
      });
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
   * 记录错误日志
   * @param {string} message - 错误消息
   * @param {Error|object} error - 错误对象
   * @param {object} meta - 元数据
   */
  error(message, error = null, meta = {}) {
    if (!this.shouldLog('error')) return;
    
    const errorMeta = { ...meta };
    if (error) {
      errorMeta.error = error.message;
      if (error.stack && this.level === 'debug') {
        errorMeta.stack = error.stack;
      }
    }
    
    console.error(this.formatMessage('error', message, errorMeta));
  }

  /**
   * 记录警告日志
   * @param {string} message - 警告消息
   * @param {object} meta - 元数据
   */
  warn(message, meta = {}) {
    if (!this.shouldLog('warn')) return;
    console.warn(this.formatMessage('warn', message, meta));
  }

  /**
   * 记录信息日志
   * @param {string} message - 信息消息
   * @param {object} meta - 元数据
   */
  info(message, meta = {}) {
    if (!this.shouldLog('info')) return;
    console.log(this.formatMessage('info', message, meta));
  }

  /**
   * 记录调试日志
   * @param {string} message - 调试消息
   * @param {object} meta - 元数据
   */
  debug(message, meta = {}) {
    if (!this.shouldLog('debug')) return;
    console.debug(this.formatMessage('debug', message, meta));
  }
}

module.exports = new Logger();