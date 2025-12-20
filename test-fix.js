// 测试修复效果的快速脚本
const M3U8Processor = require('./m3u8-processor');
const config = require('./config');

async function testFix() {
  console.log('🧪 测试修复后的广告过滤效果...\n');
  
  // 创建处理器实例
  const processor = new M3U8Processor();
  
  // 测试用M3U8内容（包含正常片段和疑似广告片段）
  const testM3U8 = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:10.0,
segment001.ts
#EXTINF:5.0,
ad_segment_001.ts
#EXTINF:10.0,
segment002.ts
#EXTINF:30.0,
promo_segment.ts
#EXTINF:8.0,
segment003.ts
#EXTINF:15.0,
commercial_001.ts
#EXTINF:10.0,
segment004.ts
#EXTINF:2.0,
short_segment.ts
#EXTINF:10.0,
segment005.ts
#EXT-X-ENDLIST`;

  console.log('📋 配置状态：');
  console.log(`   - TS检测功能: ${config.adFilter.enableTSDetection ? '启用' : '禁用'}`);
  console.log(`   - 置信度阈值: ${config.adFilter.tsDetection.confidenceThreshold}`);
  console.log(`   - 仅检测可疑片段: ${config.adFilter.tsDetection.suspiciousOnly}\n`);

  // 处理M3U8
  const result = await processor.process(testM3U8, 'http://test.com/stream.m3u8');
  
  console.log('📊 处理结果：');
  console.log(`   - 处理的片段数: ${result.stats.totalProcessed}`);
  console.log(`   - 过滤的广告数: ${result.stats.adsFiltered}`);
  console.log(`   - 保留的片段数: ${result.stats.segmentsKept}`);
  console.log(`   - 保留的片段: ${result.filteredSegments.map(f => f.url.replace('.ts', '')).join(', ')}\n`);

  console.log('🔍 过滤详情：');
  const originalLines = testM3U8.split('\n');
  const filteredLines = result.content ? result.content.split('\n') : [];
  
  console.log('📝 处理后的M3U8内容：');
  console.log(result.content || '无内容');
  console.log('');
  
  originalLines.forEach((line, index) => {
    if (line.startsWith('#EXTINF')) {
      const nextLine = originalLines[index + 1];
      if (nextLine && nextLine.includes('.ts')) {
        // 检查处理后的内容中是否包含这个片段（可能是绝对URL）
        const isFiltered = !filteredLines.some(filteredLine => 
          filteredLine.includes(nextLine) || 
          filteredLine.includes(nextLine.replace('.ts', ''))
        );
        console.log(`   ${nextLine}: ${isFiltered ? '❌ 已过滤' : '✅ 保留'}`);
      }
    }
  });

  console.log('\n💡 建议：');
  const filteredCount = result.stats.adsFiltered;
  if (filteredCount === 0) {
    console.log('   ✅ 没有片段被过滤，可能是过于保守');
  } else if (filteredCount <= 2) {
    console.log('   ✅ 过滤效果合理，大部分正常内容保留');
  } else if (filteredCount <= 4) {
    console.log('   ⚠️  有一些片段被过滤，请检查是否合理');
  } else {
    console.log('   ❌ 过多片段被过滤，需要进一步调整阈值');
  }

  // 重置统计
  processor.resetStats();
}

testFix().catch(console.error);