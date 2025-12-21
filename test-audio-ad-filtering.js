// 测试音频广告过滤功能
const M3U8Processor = require('./m3u8-processor');
const fs = require('fs');
const path = require('path');

async function testAudioAdFiltering() {
  console.log('🔍 测试音频广告过滤功能...\n');
  
  // 读取测试M3U8文件
  const testM3U8Path = path.join(__dirname, 'test-ad-audio.m3u8');
  const testM3U8Content = fs.readFileSync(testM3U8Path, 'utf8');
  
  console.log('📄 原始测试M3U8内容：');
  console.log(testM3U8Content);
  console.log('---\n');
  
  // 创建处理器
  const processor = new M3U8Processor();
  
  // 处理M3U8
  console.log('🔄 处理M3U8...');
  const result = await processor.process(testM3U8Content, 'http://example.com/test.m3u8');
  
  console.log('📝 处理后M3U8内容：');
  console.log(result.content);
  console.log('---\n');
  
  // 统计处理结果
  const processedLines = result.content.split('\n');
  const processedSegments = processedLines.filter(line => 
    line.trim() && !line.startsWith('#')
  );
  
  console.log('📊 处理结果统计：');
  console.log(`   - 原始片段数: ${testM3U8Content.split('\n').filter(line => line.trim() && !line.startsWith('#')).length}`);
  console.log(`   - 处理后片段数: ${processedSegments.length}`);
  console.log(`   - 过滤的广告数: ${result.stats.adsFiltered}`);
  console.log(`   - 过滤片段详情: ${result.filteredSegments.map(f => f.url).join(', ')}\n`);
  
  // 验证广告过滤结果
  console.log('✅ 验证广告过滤结果：');
  
  // 检查是否过滤了带有广告标识的URL
  const adUrls = ['ad-audio.m3u8', 'ad-video.m3u8', 'ad_segment-1.mp4', 'ad_segment-2.mp4'];
  let allAdsFiltered = true;
  
  adUrls.forEach(adUrl => {
    const isFiltered = result.filteredSegments.some(f => f.url.includes(adUrl));
    const status = isFiltered ? '✅ 已过滤' : '❌ 未过滤';
    console.log(`   ${adUrl} - ${status}`);
    if (!isFiltered) {
      allAdsFiltered = false;
    }
  });
  
  // 检查是否保留了正常内容
  const normalUrls = ['main-audio.m3u8', 'main-video.m3u8', 'high-quality-video.m3u8', 'main-segment-1.ts', 'main-segment-2.ts', 'main-segment-3.ts'];
  let allNormalKept = true;
  
  normalUrls.forEach(normalUrl => {
    // 检查非注释行和注释行中的URI属性
    const isKept = processedLines.some(line => line.includes(normalUrl));
    const status = isKept ? '✅ 已保留' : '❌ 被错误过滤';
    console.log(`   ${normalUrl} - ${status}`);
    if (!isKept) {
      allNormalKept = false;
    }
  });
  
  console.log('\n📋 测试总结：');
  if (allAdsFiltered && allNormalKept) {
    console.log('🎉 所有测试通过！音频广告和视频广告都被正确过滤了！');
  } else {
    console.log('❌ 测试失败！部分广告未被过滤或正常内容被错误过滤。');
  }
}

testAudioAdFiltering().catch(console.error);