# M3U8 Proxy Demo - iFlow 项目上下文

## 项目概述

这是一个功能完善的 **M3U8 流媒体代理服务器**，使用 Node.js 和 Express 框架构建。主要功能包括：

- **广告过滤**：智能识别并过滤 M3U8 播放列表中的广告片段
- **路径重写**：将相对路径转换为绝对 URL，确保播放器正确加载资源
- **缓存机制**：对 VOD（点播）内容进行缓存，提升性能和响应速度
- **安全增强**：包含 URL 验证、速率限制、CORS 控制等安全特性
- **结构化日志**：分级日志系统，便于调试和监控
- **健康检查**：提供系统状态监控接口

## 技术栈

- **运行环境**：Node.js
- **Web 框架**：Express.js v4.18.2
- **HTTP 客户端**：Axios v1.6.0
- **速率限制**：express-rate-limit v7.1.5
- **开发工具**：nodemon v3.0.2（开发模式热重载）

## 项目架构

### 核心模块

1. **server.js** - 主服务器文件
   - 配置 Express 应用和中间件
   - 定义所有 API 路由
   - 处理请求/响应逻辑
   - 实现优雅关闭机制

2. **m3u8-processor.js** - M3U8 处理器
   - 解析 M3U8 播放列表
   - 广告片段识别和过滤
   - 相对路径转换为绝对 URL
   - 处理全局标签和片段标签

3. **cache-manager.js** - 缓存管理器
   - 基于 Map 的内存缓存实现
   - TTL（生存时间）管理
   - LRU（最近最少使用）淘汰策略
   - 缓存统计信息

4. **logger.js** - 日志记录器
   - 分级日志（error/warn/info/debug）
   - 支持简单格式和 JSON 格式
   - 可配置日志级别
   - 元数据支持

5. **config.js** - 配置管理
   - 集中管理所有配置项
   - 支持环境变量覆盖
   - 包含服务器、安全、缓存、CORS 等配置

## 构建和运行

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
# 生产模式
npm start

# 开发模式（需要 nodemon，支持热重载）
npm run dev
```

### 环境变量

可通过以下环境变量自定义配置：

- `PORT` - 服务器端口（默认：3000）
- `CORS_ORIGIN` - CORS 允许的源（默认：*）
- `LOG_LEVEL` - 日志级别（error/warn/info/debug，默认：info）
- `NODE_ENV` - 运行环境（development/production）

示例：
```bash
PORT=8080 LOG_LEVEL=debug npm start
```

## API 接口

### 1. 代理服务
```
GET /proxy?url={m3u8_url}
```
核心代理接口，处理 M3U8 播放列表的获取、过滤和重写。

**查询参数**：
- `url` (必需) - 目标 M3U8 文件的 URL

**响应头**：
- `Content-Type: application/vnd.apple.mpegurl`
- `X-Processed-By: M3U8-Proxy`
- `X-Processing-Time` - 处理耗时
- `X-Segment-Count` - 片段数量
- `X-Is-VOD` - 是否为点播内容

**示例**：
```bash
curl "http://localhost:3000/proxy?url=http://example.com/stream.m3u8"
```

### 2. 健康检查
```
GET /health
```
返回系统健康状态、运行时间、内存使用、缓存统计等信息。

### 3. 缓存管理
```
GET /cache/stats   # 获取缓存统计
GET /cache/clear   # 清除所有缓存
```

### 4. 测试接口
```
GET /mock-stream.m3u8
```
返回包含模拟广告的测试 M3U8 播放列表，用于验证广告过滤功能。

### 5. 配置查看（仅开发环境）
```
GET /config
```
返回当前配置信息（不包含敏感数据），仅在非生产环境可用。

## 配置说明

编辑 `config.js` 文件进行详细配置：

### 服务器配置
```javascript
server: {
  port: 3000,        // 服务端口
  host: '127.0.0.1'  // 监听地址
}
```

### 广告过滤配置
```javascript
adFilter: {
  patterns: [        // 广告识别正则表达式
    /ad_/i,
    /promo/i,
    /shop/i,
    // ...更多模式
  ],
  enabled: true,     // 是否启用过滤
  logLevel: 'info'   // 日志级别
}
```

### 缓存配置
```javascript
cache: {
  enabled: true,     // 启用缓存
  ttl: 300000,       // 缓存有效期（5分钟）
  maxSize: 100       // 最大缓存条目数
}
```

### 安全配置
```javascript
security: {
  allowedProtocols: ['http:', 'https:'],  // 允许的协议
  maxM3u8Size: 10 * 1024 * 1024,          // 最大文件大小（10MB）
  rateLimit: {
    enabled: true,
    windowMs: 60000,  // 时间窗口（1分钟）
    max: 100          // 最大请求数
  }
}
```

## 开发约定

### 代码风格
- 使用 JSDoc 注释标注函数参数和返回值
- 模块化设计，每个文件负责单一职责
- 使用 ES6+ 语法（async/await、箭头函数等）
- 使用 `const` 和 `let`，避免 `var`

### 错误处理
- 所有异步操作使用 try-catch 包裹
- 返回详细的错误信息和适当的 HTTP 状态码
- 使用结构化日志记录错误详情

### 日志规范
- 使用 logger 模块而非直接 console.log
- 为重要操作添加元数据（如 URL、处理时间等）
- 根据严重程度选择合适的日志级别

### 安全实践
- 验证所有外部输入（URL、参数等）
- 限制请求大小和频率
- 不在日志中记录敏感信息
- 实现优雅关闭以避免数据丢失

## 测试和验证

### 测试广告过滤功能
```bash
# 使用内置测试流
curl "http://localhost:3000/proxy?url=http://localhost:3000/mock-stream.m3u8"

# 查看处理后的播放列表，广告片段应被过滤
```

### 检查系统状态
```bash
curl http://localhost:3000/health
```

### 验证缓存功能
```bash
# 首次请求
curl "http://localhost:3000/proxy?url=http://localhost:3000/mock-stream.m3u8"

# 查看缓存统计
curl http://localhost:3000/cache/stats

# 第二次请求应从缓存返回（查看响应头 X-Processing-Time）
```

## 常见问题和解决方案

### 性能优化
1. **调整缓存参数**：根据实际流量调整 `cache.ttl` 和 `cache.maxSize`
2. **优化日志级别**：生产环境使用 `info` 或 `warn` 级别
3. **配置反向代理**：使用 Nginx 或 Caddy 作为前端代理

### 安全加固
1. **限制 CORS 源**：生产环境设置具体的 `CORS_ORIGIN` 而非 `*`
2. **调整速率限制**：根据实际需求调整 `rateLimit.max`
3. **使用 HTTPS**：配合反向代理启用 SSL/TLS

### 调试技巧
1. **启用调试日志**：设置 `LOG_LEVEL=debug`
2. **查看配置**：访问 `/config` 接口（开发环境）
3. **监控健康状态**：定期检查 `/health` 接口

## Git 信息

- **当前分支**：master
- **HEAD SHA**：c16bf26d165db971501ff0c207365ee982417dd4
- **远程仓库**：未配置

## 扩展建议

如需扩展此项目，可考虑以下方向：

1. **持久化缓存**：使用 Redis 替代内存缓存
2. **多协议支持**：添加 HLS、DASH 等协议支持
3. **监控告警**：集成 Prometheus、Grafana 等监控工具
4. **容器化部署**：创建 Dockerfile 和 docker-compose.yml
5. **单元测试**：使用 Jest 或 Mocha 添加测试覆盖
6. **API 文档**：使用 Swagger/OpenAPI 生成交互式文档

## 许可证

MIT License
