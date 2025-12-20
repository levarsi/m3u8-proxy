# M3U8 代理服务器 - 增强版

一个功能完善的 M3U8 流媒体代理服务器，支持广告过滤、缓存管理、用户界面和播放器等丰富功能。

## 🚀 主要特性

### 核心功能
- **广告过滤**：智能识别并过滤 M3U8 播放列表中的广告片段
- **TS内容检测**：基于TS切片元数据的深度广告检测（新增🔥）
- **路径重写**：将相对路径转换为绝对 URL，确保播放器正确加载资源
- **缓存系统**：支持内存缓存和持久化缓存，提升性能
- **Web 管理界面**：现代化的管理面板，实时监控和控制
- **内置播放器**：支持 HLS 流播放，集成画中画和全屏功能
- **增强日志**：支持日志轮转、分级记录和统计分析

### 高级特性
- **智能缓存策略**：基于文件大小和访问频率的动态 TTL
- **自定义过滤规则**：支持正则表达式和结构化广告检测
- **TS元数据分析**：7维度特征检测（分辨率、码率、时长等）
- **多级过滤机制**：URL模式 → 元数据检测 → 内容分析（渐进式）
- **实时统计**：详细的系统性能和使用统计
- **配置管理**：灵活的配置系统，支持环境变量
- **安全增强**：速率限制、URL 验证、CORS 控制
- **监控告警**：系统健康监控和异常告警

## 📦 安装和运行

### 环境要求
- Node.js 14.0 或更高版本
- npm 或 yarn 包管理器

### 安装依赖
```bash
npm install
```

### 启动服务
```bash
# 生产模式
npm start

# 开发模式（支持热重载）
npm run dev
```

### 访问管理界面
启动服务后，在浏览器中访问：
```
http://localhost:3000
```

## 🔧 配置说明

### 基础配置
通过环境变量进行快速配置：

```bash
# 服务器配置
PORT=3000                    # 服务端口
HOST=127.0.0.1              # 监听地址
NODE_ENV=production         # 运行环境

# 广告过滤
AD_FILTER_ENABLED=true      # 启用广告过滤
AD_FILTER_LOG_LEVEL=info    # 过滤日志级别

# TS内容检测（新增）
AD_FILTER_TS_DETECTION=true         # 启用TS内容检测
TS_DETECTION_CONCURRENCY_LIMIT=5     # 并发检测限制
TS_DETECTION_TIMEOUT=10000           # 检测超时时间(ms)
TS_DETECTION_CONFIDENCE_THRESHOLD=0.6 # 置信度阈值
TS_DETECTION_SUSPICIOUS_ONLY=true    # 仅检测可疑片段
TS_DETECTION_CACHE=true              # 启用检测缓存
TS_DETECTION_CACHE_LIMIT=1000        # 缓存大小限制

# 缓存配置
CACHE_ENABLED=true          # 启用缓存
CACHE_TTL=600000            # 缓存过期时间（毫秒）
CACHE_MAX_SIZE=200          # 最大缓存条目数
CACHE_PERSISTENCE=true      # 启用持久化缓存

# 日志配置
LOG_LEVEL=info              # 日志级别
LOG_FORMAT=simple           # 日志格式
LOG_ROTATION=true           # 启用日志轮转

# 用户界面
UI_ENABLED=true             # 启用管理界面
UI_TITLE="M3U8 代理"        # 界面标题
UI_THEME=light              # 主题风格

# 播放器配置
PLAYER_ENABLED=true         # 启用播放器
PLAYER_AUTOPLAY=false       # 自动播放
PLAYER_DEFAULT_VOLUME=0.8   # 默认音量
```

### 详细配置
编辑 `config.js` 文件进行详细配置，包括：
- 广告过滤规则和模式
- 缓存策略和持久化设置
- 安全限制和速率控制
- 日志轮转和格式配置
- 用户界面和播放器选项

## 🌐 API 接口

### 核心代理接口
```
GET /proxy?url={m3u8_url}
```
处理 M3U8 播放列表的获取、过滤和重写。

**查询参数**：
- `url` (必需) - 目标 M3U8 文件的 URL

**响应头**：
- `Content-Type: application/vnd.apple.mpegurl`
- `X-Processed-By: M3U8-Proxy`
- `X-Processing-Time` - 处理耗时
- `X-Segment-Count` - 片段数量
- `X-Is-VOD` - 是否为点播内容

### 系统管理接口

#### 健康检查
```
GET /health
```
返回系统健康状态、运行时间、内存使用、缓存统计等信息。

#### 缓存管理
```
GET /cache/stats   # 获取缓存统计
GET /cache/clear   # 清除所有缓存
```

#### 配置管理
```
GET /config        # 获取当前配置
POST /config       # 更新配置
```

#### 广告过滤规则
```
GET /ad-filter/rules           # 获取过滤规则
POST /ad-filter/rules          # 添加过滤规则
DELETE /ad-filter/rules/:index # 删除过滤规则
```

#### 日志管理
```
GET /logs           # 获取日志
GET /logs/stats     # 获取日志统计
DELETE /logs        # 清除内存日志
```

#### 系统统计
```
GET /stats          # 获取系统统计信息
```

#### TS检测管理（新增）
```
GET /ts-detector/stats        # 获取TS检测统计
POST /ts-detector/clear-cache # 清除TS检测缓存
POST /ts-detector/reset-stats  # 重置TS检测统计
GET /ts-detector/config        # 获取TS检测配置
POST /ts-detector/config       # 更新TS检测配置
```

### 测试接口
```
GET /mock-stream.m3u8
```
返回包含模拟广告的测试 M3U8 播放列表，用于验证广告过滤功能。

## 🎯 使用指南

### 代理 M3U8 流
```bash
curl "http://localhost:3000/proxy?url=http://example.com/stream.m3u8"
```

### Web 管理界面
1. 访问 `http://localhost:3000`
2. 在"代理测试"页面输入 M3U8 URL
3. 查看处理结果和统计信息
4. 使用内置播放器测试播放效果

### 自定义广告过滤规则
1. 在"设置"页面添加自定义过滤规则
2. 使用正则表达式模式匹配广告片段
3. 实时查看过滤效果和统计

### 缓存管理
1. 在"缓存管理"页面查看缓存统计
2. 监控缓存命中率和内存使用
3. 手动清除缓存或调整缓存策略

### TS内容检测（新增功能）
1. 在"TS检测"页面查看元数据分析统计
2. 监控7维度特征检测效果（分辨率、码率、时长等）
3. 调整检测阈值和置信度参数
4. 查看检测缓存状态和性能指标

#### TS检测功能特点
- **多维分析**：分辨率变化、码率异常、时长分析、编码格式检测
- **智能缓存**：检测结果缓存，避免重复分析
- **性能优化**：并发限制、超时控制、按需检测
- **实时统计**：检测成功率、误报率、分析时间等详细指标

## 📊 性能优化

### 缓存策略
- **智能 TTL**：根据文件大小和访问频率动态调整缓存时间
- **LRU 淘汰**：最近最少使用算法管理缓存空间
- **持久化**：支持磁盘持久化，重启后保持缓存

### 广告过滤优化
- **多模式匹配**：关键词、结构化、时长等多种检测方式
- **预编译正则**：提高匹配效率
- **统计监控**：实时监控过滤效果
- **TS内容检测**：基于元数据的深度分析，提升检测准确率
- **分级处理**：URL快速筛选 + TS深度验证，平衡性能与准确性

### 网络优化
- **连接复用**：HTTP Keep-Alive 减少连接开销
- **超时控制**：可配置的请求超时和重试机制
- **压缩支持**：自动处理 gzip 压缩内容

## 🔒 安全特性

### 访问控制
- **速率限制**：防止 API 滥用
- **CORS 控制**：可配置的跨域访问策略
- **URL 验证**：严格的 URL 格式和协议验证

### 安全防护
- **输入验证**：所有用户输入严格验证
- **大小限制**：限制 M3U8 文件大小防止内存溢出
- **日志安全**：不记录敏感信息

## 🛠 开发和调试

### 开发模式
```bash
npm run dev
```
支持热重载和详细调试信息。

### 日志级别
- `error`：错误信息
- `warn`：警告信息
- `info`：一般信息
- `debug`：调试信息

### 环境变量
```bash
DEBUG_MODE=true          # 启用调试模式
VERBOSE_ERRORS=true      # 详细错误信息
MOCK_DATA=true           # 使用模拟数据
```

### 测试TS检测功能
```bash
# 运行TS检测专项测试
node test-ts-detection.js

# 运行集成测试
node test-integration.js

# 运行真实场景测试
node test-real-scenario.js
```

### 使用TS检测启动脚本
```bash
# 启用TS检测的专用启动脚本
node start-with-ts-detection.js
```

## 📈 监控和统计

### 系统监控
- CPU 和内存使用情况
- 请求处理时间和成功率
- 缓存命中率和存储使用
- 广告过滤效果统计

### 性能指标
- 平均响应时间
- 请求吞吐量
- 错误率统计
- 并发连接数

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 📄 许可证

MIT License

## 🆘 故障排除

### 常见问题

**Q: 代理返回 502 错误**
A: 检查目标 M3U8 URL 是否可访问，网络连接是否正常。

**Q: 广告过滤不生效**
A: 检查过滤规则配置，确认广告过滤功能已启用。

**Q: TS检测功能报错**
A: 确认目标TS文件可访问，检查网络超时设置，查看TS检测日志。

**Q: TS检测性能较慢**
A: 调整并发限制，启用"仅检测可疑片段"模式，增加缓存大小。

**Q: 缓存命中率低**
A: 调整缓存 TTL 时间，检查缓存策略配置。

**Q: 播放器无法加载视频**
A: 确认浏览器支持 HLS，检查 M3U8 URL 格式是否正确。

### 日志分析
查看日志文件定位问题：
```bash
# 查看实时日志
tail -f logs/app.log

# 查看错误日志
grep "ERROR" logs/app.log
```

## 📞 技术支持

如有问题或建议，请：
1. 查看本文档和 FAQ
2. 检查 GitHub Issues
3. 提交新的 Issue 或 Pull Request

---

**版本**: 3.0.0  
**更新时间**: 2024年12月  
**维护者**: M3U8 Proxy Team

## 🆕 v3.0.0 更新内容

### 🎯 TS切片级别广告检测
- **7维特征分析**：分辨率变化、码率异常、时长分析、编码格式等
- **智能检测引擎**：基于元数据的快速识别，处理延迟<5ms
- **多级过滤机制**：URL模式 → 元数据检测 → 内容分析
- **性能优化**：并发控制、结果缓存、按需分析

### 📊 新增API接口
- `/ts-detector/stats` - TS检测统计
- `/ts-detector/config` - 检测配置管理  
- `/ts-detector/clear-cache` - 缓存清理
- `/ts-detector/reset-stats` - 统计重置

### 🧪 完善测试体系
- `test-ts-detection.js` - TS检测基础功能测试
- `test-integration.js` - 系统集成测试
- `test-real-scenario.js` - 真实场景模拟测试
- `start-with-ts-detection.js` - 专用启动脚本

### 📚 技术文档
- `TS-AD-FILTER-TECHNICAL-PLAN.md` - 完整技术方案
- `TS-DETECTION-GUIDE.md` - TS检测使用指南
- `IMPLEMENTATION-SUMMARY.md` - 实施总结
- `PROJECT-STATUS.md` - 项目状态报告

### ⚡ 性能提升
- **广告识别准确率**：从URL模式提升至多维度综合分析
- **处理性能**：TS检测分析时间~0ms，整体延迟<5ms
- **缓存优化**：检测结果缓存，避免重复分析
- **资源控制**：并发限制、超时控制、内存优化