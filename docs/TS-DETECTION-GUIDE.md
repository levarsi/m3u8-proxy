# TS切片级别广告检测功能指南

## 概述

本功能基于MPEG-TS元数据实现广告切片的智能识别，通过分析TS切片的技术特征来检测广告内容，比传统的URL模式匹配更加准确和可靠。

## 功能特性

### 1. 多维度检测

- **分辨率变化检测**: 检测视频分辨率突变（广告通常分辨率较低）
- **码率异常检测**: 识别码率异常片段（广告码率通常不同）
- **编码一致性检查**: 检测编码参数变化
- **时长异常分析**: 识别非常规时长片段
- **帧率变化监控**: 检测帧率突变
- **流结构分析**: 分析TS流结构异常
- **时间戳一致性**: 检查时间戳跳跃

### 2. 智能评分系统

- **概率计算**: 综合多个特征计算广告概率
- **置信度评估**: 评估检测结果的可信度
- **可配置阈值**: 支持自定义检测敏感度

### 3. 性能优化

- **缓存机制**: 避免重复分析相同内容
- **异步处理**: 不影响主流程的响应速度
- **选择性检测**: 可配置仅对可疑片段进行深度检测

## 配置说明

### 环境变量配置

```bash
# 启用TS检测功能
AD_FILTER_TS_DETECTION=true

# 并发检测限制
TS_DETECTION_CONCURRENCY_LIMIT=5

# 检测超时时间（毫秒）
TS_DETECTION_TIMEOUT=10000

# 仅检测可疑片段（性能优化）
TS_DETECTION_SUSPICIOUS_ONLY=true

# 置信度阈值
TS_DETECTION_CONFIDENCE_THRESHOLD=0.6

# 启用缓存
TS_DETECTION_CACHE=true

# 缓存大小限制
TS_DETECTION_CACHE_LIMIT=1000
```

### 代码配置

在 `config.js` 中的相关配置：

```javascript
adFilter: {
  enableTSDetection: true,
  tsDetection: {
    concurrencyLimit: 5,
    timeout: 10000,
    suspiciousOnly: false,
    confidenceThreshold: 0.6,
    enableCache: true,
    cacheSizeLimit: 1000
  }
}
```

### 检测阈值配置

```javascript
// 在 TSMetadataDetector 中的默认阈值
thresholds: {
  resolutionChangeThreshold: 100,    // 分辨率变化阈值（像素）
  bitrateAnomalyThreshold: 500,      // 码率异常阈值（kbps）
  durationAnomalyThreshold: 5,       // 时长异常阈值（秒）
  frameRateChangeThreshold: 2,       // 帧率变化阈值（fps）
  encodingMismatchWeight: 0.8        // 编码参数变化权重
}
```

## API接口

### 1. 获取TS检测统计

```http
GET /ts-detector/stats
```

返回检测器的统计信息和当前配置。

**响应示例：**
```json
{
  "detector": {
    "totalAnalyzed": 100,
    "adsDetected": 15,
    "analysisTime": 2500,
    "cacheHits": 20
  },
  "processor": {
    "totalAnalyzed": 100,
    "adsDetectedByTS": 15,
    "tsAnalysisTime": 2500
  },
  "config": {
    "enabled": true,
    "thresholds": { ... },
    "cacheSize": 850
  }
}
```

### 2. 清除检测缓存

```http
POST /ts-detector/clear-cache
```

清除TS检测的元数据缓存。

### 3. 重置检测统计

```http
POST /ts-detector/reset-stats
```

重置检测器的统计信息。

### 4. 获取检测配置

```http
GET /ts-detector/config
```

获取当前的检测配置和阈值。

### 5. 更新检测配置

```http
POST /ts-detector/config
Content-Type: application/json

{
  "thresholds": {
    "resolutionChangeThreshold": 120,
    "bitrateAnomalyThreshold": 600
  },
  "config": {
    "confidenceThreshold": 0.7
  }
}
```

## 使用示例

### 1. 基础使用

```javascript
const M3U8Processor = require('./m3u8-processor');

// 创建处理器实例
const processor = new M3U8Processor({
  tsDetector: {
    thresholds: {
      resolutionChangeThreshold: 150,
      bitrateAnomalyThreshold: 600
    }
  }
});

// 处理M3U8（自动启用TS检测）
const result = await processor.process(m3u8Content, sourceUrl);
console.log('检测到广告片段数:', result.filteredSegments.length);
```

### 2. 独立使用检测器

```javascript
const TSMetadataDetector = require('./ts-metadata-detector');

const detector = new TSMetadataDetector();

// 检测单个TS文件
const result = await detector.detectAdFeatures(tsUrl, {
  url: tsUrl,
  segmentIndex: 1
});

if (result.isAd) {
  console.log('检测到广告，置信度:', result.confidence);
  console.log('特征分析:', result.features);
}
```

### 3. 运行测试脚本

```bash
# 运行TS检测功能测试
node test-ts-detection.js
```

## 检测特征详解

### 1. 分辨率变化 (resolutionChange)

**检测逻辑**: 比较当前片段与前一片段的分辨率差异。

**广告特征**:
- 广告片段分辨率通常较低（如720p vs 1080p）
- 分辨率变化超过100像素时标记为可疑

**置信度计算**: `(widthChange + heightChange) / 200`

### 2. 码率异常 (bitrateAnomaly)

**检测逻辑**: 分析视频码率的异常情况。

**广告特征**:
- 广告码率通常在特定范围内（800-1800 kbps）
- 码率变化超过500kbps时标记为可疑

**置信度计算**: `min(bitrateChange / 1000, 1)`

### 3. 编码不一致 (encodingMismatch)

**检测逻辑**: 检测编码参数的变化。

**广告特征**:
- Profile级别变化（如从high到baseline）
- 帧率显著变化

**置信度计算**: 基于变化的权重累加

### 4. 时长异常 (durationAnomaly)

**检测逻辑**: 识别非常规时长片段。

**广告特征**:
- 常见广告时长：5, 10, 15, 20, 30秒
- 过短片段（<3秒）可能是占位符
- 过长片段（>60秒）不太像广告

### 5. 流结构异常 (streamStructureAnomaly)

**检测逻辑**: 分析TS流的组成结构。

**广告特征**:
- 缺少音频流
- 无效的视频流类型
- 异常的文件大小与时长比例

### 6. 时间戳异常 (timestampAnomaly)

**检测逻辑**: 检查PTS/DTS时间戳的连续性。

**广告特征**:
- 时间戳大幅跳跃（>10秒）
- 时间戳倒流

## 性能优化建议

### 1. 启用可疑片段检测

```javascript
const processor = new M3U8Processor({
  enableTSDetection: true,
  suspiciousOnly: true  // 仅对可疑片段进行TS检测
});
```

### 2. 调整并发限制

根据服务器性能调整并发检测数量：

```bash
TS_DETECTION_CONCURRENCY_LIMIT=3  # 低性能服务器
TS_DETECTION_CONCURRENCY_LIMIT=10 # 高性能服务器
```

### 3. 合理设置缓存

```bash
TS_DETECTION_CACHE=true
TS_DETECTION_CACHE_LIMIT=500  # 适当限制缓存大小
```

### 4. 调整置信度阈值

根据实际需求调整检测敏感度：

```bash
# 高灵敏度（可能误报增加）
TS_DETECTION_CONFIDENCE_THRESHOLD=0.4

# 低灵敏度（减少误报，可能漏检）
TS_DETECTION_CONFIDENCE_THRESHOLD=0.8
```

## 故障排除

### 1. 检测不生效

**检查配置**:
```javascript
console.log(config.adFilter.enableTSDetection);  // 应为 true
```

**检查日志**:
```bash
# 查看TS检测相关日志
grep "TS内容检测" logs/app.log
```

### 2. 性能问题

**优化措施**:
- 启用 `suspiciousOnly` 模式
- 降低 `concurrencyLimit`
- 增加 `timeout` 时间
- 启用缓存机制

### 3. 误报率过高

**调整阈值**:
- 增加 `confidenceThreshold`
- 调整具体的特征阈值
- 检查检测结果中的特征分布

## 监控指标

### 关键指标

- **总检测次数**: `detector.totalAnalyzed`
- **广告检测次数**: `detector.adsDetected`
- **缓存命中率**: `detector.cacheHits / detector.totalAnalyzed`
- **平均分析时间**: `detector.analysisTime / detector.totalAnalyzed`
- **检测准确率**: 通过人工验证或用户反馈收集

### 性能指标

- **内存使用**: 监控缓存大小
- **CPU使用**: 检测并发处理影响
- **网络延迟**: TS文件下载时间
- **响应时间**: 整体处理延迟

## 未来扩展

### 1. 机器学习增强

计划引入机器学习模型来提高检测准确率，包括：
- 视频内容特征分析
- 音频特征识别
- 水印检测
- 内容指纹匹配

### 2. 实时学习优化

基于用户反馈持续优化检测模型：
- 误报/漏报收集
- 自动阈值调整
- 在线学习机制

### 3. 多协议支持

扩展支持更多流媒体协议：
- DASH协议支持
- RTMP流支持
- WebRTC支持

---

**注意**: TS检测功能需要网络访问来下载TS文件，请确保服务器有足够的网络带宽和存储空间。