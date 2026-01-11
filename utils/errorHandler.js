/**
 * 集中式错误处理
 * 提供统一的错误类和错误处理中间件
 */

/**
 * 自定义应用错误基类
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true; // 标记为可操作的错误（非系统错误）
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp
    };
  }
}

/**
 * 验证错误 (400)
 */
class ValidationError extends AppError {
  constructor(message) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

/**
 * 未找到错误 (404)
 */
class NotFoundError extends AppError {
  constructor(message = '资源未找到') {
    super(message, 404, 'NOT_FOUND');
  }
}

/**
 * 未授权错误 (401)
 */
class UnauthorizedError extends AppError {
  constructor(message = '未授权访问') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

/**
 * 禁止访问错误 (403)
 */
class ForbiddenError extends AppError {
  constructor(message = '禁止访问') {
    super(message, 403, 'FORBIDDEN');
  }
}

/**
 * 请求超时错误 (504)
 */
class TimeoutError extends AppError {
  constructor(message = '请求超时') {
    super(message, 504, 'TIMEOUT');
  }
}

/**
 * 网络错误 (502)
 */
class NetworkError extends AppError {
  constructor(message = '网络连接失败') {
    super(message, 502, 'NETWORK_ERROR');
  }
}

/**
 * 代理错误 (502)
 */
class ProxyError extends AppError {
  constructor(message = '代理请求失败') {
    super(message, 502, 'PROXY_ERROR');
  }
}

/**
 * 缓存错误
 */
class CacheError extends AppError {
  constructor(message = '缓存操作失败') {
    super(message, 500, 'CACHE_ERROR');
  }
}

/**
 * 解析错误
 */
class ParseError extends AppError {
  constructor(message = '数据解析失败') {
    super(message, 400, 'PARSE_ERROR');
  }
}

/**
 * 配置错误
 */
class ConfigError extends AppError {
  constructor(message = '配置错误') {
    super(message, 500, 'CONFIG_ERROR');
  }
}

/**
 * 错误处理中间件
 * @param {Error} err - 错误对象
 * @param {Request} req - 请求对象
 * @param {Response} res - 响应对象
 * @param {Function} next - 下一个中间件
 */
function errorHandler(err, req, res, next) {
  const logger = require('../logger');

  // 记录错误
  logger.error('未处理的错误', err, {
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // 如果是自定义应用错误
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  // 处理其他类型的错误
  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  let message = '服务器内部错误';

  // 根据错误类型设置状态码和消息
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = err.message;
  } else if (err.name === 'CastError') {
    statusCode = 400;
    errorCode = 'INVALID_ID';
    message = '无效的ID格式';
  } else if (err.code === 'ENOENT') {
    statusCode = 404;
    errorCode = 'NOT_FOUND';
    message = '文件或资源未找到';
  } else if (err.code === 'ECONNREFUSED') {
    statusCode = 502;
    errorCode = 'CONNECTION_REFUSED';
    message = '连接被拒绝';
  } else if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
    statusCode = 504;
    errorCode = 'TIMEOUT';
    message = '请求超时';
  }

  // 开发环境返回详细错误信息
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(statusCode).json({
    error: errorCode,
    message: isDevelopment ? err.message : message,
    statusCode,
    timestamp: new Date().toISOString(),
    ...(isDevelopment && { stack: err.stack })
  });
}

/**
 * 404 处理中间件
 */
function notFoundHandler(req, res, next) {
  const error = new NotFoundError(`路径 ${req.originalUrl} 不存在`);
  next(error);
}

/**
 * 异步错误包装器
 * 用于包装异步路由处理器，自动捕获和传递错误
 * @param {Function} fn - 异步函数
 * @returns {Function} 包装后的函数
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  TimeoutError,
  NetworkError,
  ProxyError,
  CacheError,
  ParseError,
  ConfigError,
  errorHandler,
  notFoundHandler,
  asyncHandler
};