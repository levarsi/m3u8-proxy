
## 主要接口

### 代理服务
- **GET** `/proxy?url={m3u8_url}` - 核心代理接口

### 系统管理
- **GET** `/health` - 健康检查，返回系统状态
- **GET** `/cache/stats` - 缓存统计信息
- **GET** `/cache/clear` - 清除缓存

### 测试
- **GET** `/mock-stream.m3u8` - 测试用的模拟流（包含广告）

## 配置说明

编辑 `config.js` 文件进行配置：

```javascript
// 服务器配置
server: {
  port: 3000,           // 服务端口
  host: '0.0.0.0'       // 监听地址
},

// 广告过滤
adFilter: {
  patterns: [/ad_/i, /promo/i], // 广告匹配模式
  enabled: true,                 // 是否启用过滤
  logLevel: 'info'              // 日志级别
},

// 缓存配置
cache: {
  enabled: true,        // 启用缓存
  ttl: 300000,          // 缓存有效期（5分钟）
  maxSize: 100          // 最大缓存条目数
},

// 安全配置
security: {
  allowedProtocols: ['http:', 'https:'], // 允许的协议
  rateLimit: {                           // 速率限制
    enabled: true,
    windowMs: 60000,     // 1分钟窗口
    max: 100             // 每分钟最大请求数
  }
}
```

## 环境变量

- `PORT` - 服务器端口（默认：3000）
- `CORS_ORIGIN` - CORS允许的源（默认：*）
- `LOG_LEVEL` - 日志级别（error/warn/info/debug，默认：info）
- `NODE_ENV` - 运行环境（development/production）

## 使用示例

### 1. 过滤广告
```bash
# 使用测试流验证广告过滤
curl "http://localhost:3000/proxy?url=http://localhost:3000/mock-stream.m3u8"
```

### 2. 查看系统状态
```bash
curl http://localhost:3000/health
```

### 3. 查看缓存状态
```bash
curl http://localhost:3000/cache/stats
```

## 性能优化建议

1. **生产环境**：设置合适的CORS origin，而不是使用 `*`
2. **监控**：定期检查 `/health` 接口，监控系统状态
3. **缓存调优**：根据实际情况调整缓存TTL和大小
4. **负载均衡**：对于高流量场景，考虑使用多实例和负载均衡

## 错误处理

代理服务现在会返回更详细的错误信息：

- **400** - URL参数缺失或无效
- **500** - 服务器内部错误
- **502** - 源站连接错误
- **504** - 请求超时

所有错误响应都包含JSON格式的错误详情。

## 许可证

MIT