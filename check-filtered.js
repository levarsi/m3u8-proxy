// 检查被过滤的片段是否合理
const M3U8Processor = require('./m3u8-processor');
const axios = require('axios');

async function checkFilteredSegments() {
  console.log('🔍 检查被过滤片段的合理性...\n');
  
  const m3u8Url = 'https://s1.fengbao9.com/video/lirenchuqiao3/ec00f32d8203/index.m3u8';
  
  try {
    // 获取原始M3U8
    const response = await axios.get(m3u8Url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    
    const originalM3U8 = response.data;
    const processor = new M3U8Processor();
    const result = await processor.process(originalM3U8, m3u8Url);
    
    console.log(`📊 过滤统计：`);
    console.log(`   - 总片段: ${result.stats.totalProcessed}`);
    console.log(`   - 保留: ${result.stats.segmentsKept}`);
    console.log(`   - 过滤: ${result.stats.adsFiltered}`);
    console.log(`   - 保留率: ${((result.stats.segmentsKept / result.stats.totalProcessed) * 100).toFixed(2)}%\n`);
    
    // 分析被过滤的片段
    console.log('📋 被过滤片段的时长分析：');
    const filteredSegments = result.filteredSegments;
    
    // 按时长分组统计
    const durationGroups = {};
    filteredSegments.forEach(segment => {
      const duration = segment.duration;
      const group = duration < 0.3 ? '<0.3s' : 
                   duration < 0.4 ? '0.3-0.4s' : 
                   duration < 0.5 ? '0.4-0.5s' : '>=0.5s';
      
      durationGroups[group] = (durationGroups[group] || 0) + 1;
    });
    
    Object.entries(durationGroups).sort((a, b) => a[0].localeCompare(b[0])).forEach(([group, count]) => {
      console.log(`   ${group}: ${count}个片段`);
    });
    
    // 显示前20个被过滤的片段
    console.log('\n📝 前20个被过滤的片段详情：');
    filteredSegments.slice(0, 20).forEach((segment, index) => {
      console.log(`   ${index + 1}. ${segment.url} - ${segment.duration}秒`);
    });
    
    // 检查是否有大于0.5秒的片段被错误过滤
    const longFiltered = filteredSegments.filter(s => s.duration >= 0.5);
    console.log(`\n⚠️  被过滤的长片段（>=0.5秒）：${longFiltered.length}个`);
    if (longFiltered.length > 0 && longFiltered.length <= 10) {
      longFiltered.forEach((segment, index) => {
        console.log(`   ${index + 1}. ${segment.url} - ${segment.duration}秒`);
      });
    }
    
    // 检查保留片段的时长分布
    console.log('\n📊 保留片段的时长分布：');
    const processedLines = result.content.split('\n');
    const segmentsWithDurations = [];
    
    // 解析保留片段的时长
    for (let i = 0; i < processedLines.length; i++) {
      const line = processedLines[i];
      if (line.startsWith('#EXTINF:')) {
        const durationMatch = line.match(/#EXTINF:([\d.]+)/);
        if (durationMatch) {
          const duration = parseFloat(durationMatch[1]);
          segmentsWithDurations.push(duration);
        }
      }
    }
    
    // 时长分组
    const keptDurationGroups = {};
    segmentsWithDurations.forEach(duration => {
      const group = duration < 0.5 ? '<0.5s' : 
                   duration < 1.0 ? '0.5-1.0s' : 
                   duration < 1.5 ? '1.0-1.5s' : 
                   duration < 2.0 ? '1.5-2.0s' : '>=2.0s';
      
      keptDurationGroups[group] = (keptDurationGroups[group] || 0) + 1;
    });
    
    Object.entries(keptDurationGroups).sort((a, b) => a[0].localeCompare(b[0])).forEach(([group, count]) => {
      console.log(`   ${group}: ${count}个片段`);
    });
    
    // 给出建议
    console.log('\n💡 分析结论：');
    if (longFiltered.length === 0) {
      console.log('   ✅ 被过滤的都是超短片段（<0.5秒），过滤合理');
      console.log('   ✅ 保留了绝大部分正常片段');
      console.log('   ✅ 修复效果良好');
    } else {
      console.log('   ⚠️  有部分较长片段被过滤，可能需要调整阈值');
      console.log(`   📊 建议调整阈值到 ${Math.max(0.6, ...longFiltered.map(s => s.duration))}秒`);
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
  }
}

checkFilteredSegments().catch(console.error);