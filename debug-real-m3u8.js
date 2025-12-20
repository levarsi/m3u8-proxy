// 调试真实M3U8的广告过滤问题
const M3U8Processor = require('./m3u8-processor');
const axios = require('axios');

async function debugRealM3U8() {
  console.log('🔍 分析真实M3U8流...\n');
  
  const m3u8Url = 'https://s1.fengbao9.com/video/lirenchuqiao3/ec00f32d8203/index.m3u8';
  
  try {
    // 获取原始M3U8内容
    console.log('📥 获取原始M3U8...');
    const response = await axios.get(m3u8Url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const originalM3U8 = response.data;
    console.log('📄 原始M3U8内容（前1000字符）：');
    console.log(originalM3U8.substring(0, 1000));
    console.log('...\n');
    
    // 统计原始片段
    const originalLines = originalM3U8.split('\n');
    const originalSegments = originalLines.filter(line => 
      line.trim() && !line.startsWith('#') && line.includes('.ts')
    );
    console.log(`📊 原始统计：`);
    console.log(`   - 总行数: ${originalLines.length}`);
    console.log(`   - TS片段数: ${originalSegments.length}`);
    console.log(`   - 前5个片段: ${originalSegments.slice(0, 5).join(', ')}\n`);
    
    // 创建处理器
    const processor = new M3U8Processor();
    
    // 处理M3U8
    console.log('🔄 处理M3U8...');
    const result = await processor.process(originalM3U8, m3u8Url);
    
    console.log('📝 处理后M3U8内容（前1000字符）：');
    console.log(result.content.substring(0, 1000));
    console.log('...\n');
    
    // 统计处理结果
    const processedLines = result.content.split('\n');
    const processedSegments = processedLines.filter(line => 
      line.trim() && !line.startsWith('#') && line.includes('.ts')
    );
    
    console.log('📊 处理结果统计：');
    console.log(`   - 原始片段数: ${originalSegments.length}`);
    console.log(`   - 处理后片段数: ${processedSegments.length}`);
    console.log(`   - 过滤的广告数: ${result.stats.adsFiltered}`);
    console.log(`   - 处理器统计adsFiltered: ${result.stats.adsFiltered}`);
    console.log(`   - 过滤片段详情: ${result.filteredSegments.map(f => f.url).join(', ')}\n`);
    
    // 详细对比每个片段
    console.log('🔍 逐片段分析：');
    originalSegments.forEach((segment, index) => {
      const isKept = processedSegments.some(p => p.includes(segment));
      const status = isKept ? '✅ 保留' : '❌ 过滤';
      console.log(`   ${index + 1}. ${segment} - ${status}`);
      
      // 分析被过滤的原因
      if (!isKept) {
        const filteredSegment = result.filteredSegments.find(f => f.url === segment);
        if (filteredSegment) {
          console.log(`      原因: ${filteredSegment.reason}`);
          console.log(`      时长: ${filteredSegment.duration}秒`);
        }
      }
    });
    
    // 检查广告检测配置
    console.log('\n⚙️  广告检测配置：');
    console.log(`   - 广告过滤启用: ${processor.isAdFilterEnabled}`);
    console.log(`   - TS检测启用: ${processor.enableTSDetection}`);
    console.log(`   - 广告模式数量: ${processor.adPatterns.length}`);
    console.log(`   - 前3个模式: ${processor.adPatterns.slice(0, 3).map(p => p.source).join(', ')}`);
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
  }
}

debugRealM3U8().catch(console.error);