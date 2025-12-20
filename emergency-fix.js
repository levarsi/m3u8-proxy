// 紧急修复脚本 - 禁用过于激进的广告检测
const config = require('./config');

console.log('🚨 应用紧急修复配置...');

// 1. 暂时禁用TS检测，避免误删正常内容
config.adFilter.enableTSDetection = false;

// 2. 修改广告检测阈值，使其更加保守
config.adFilter.tsDetection = {
  ...config.adFilter.tsDetection,
  confidenceThreshold: 0.8, // 提高置信度阈值
  suspiciousOnly: true       // 仅检测明显可疑的片段
};

// 3. 修改广告过滤规则，移除过于激进的模式
config.adFilter.patterns = config.adFilter.patterns.filter(pattern => {
  // 保留保守的检测规则
  const conservativePatterns = [
    /ad_/i,
    /advertisement/i,
    /commercial/i
  ];
  
  return conservativePatterns.some(conservative => 
    pattern.toString() === conservative.toString()
  );
});

console.log('✅ 紧急修复配置已应用');
console.log('📋 修复内容：');
console.log('   - 已禁用TS检测功能');
console.log('   - 已提高置信度阈值至0.8');
console.log('   - 已启用仅检测可疑片段模式');
console.log('   - 已精简广告检测规则');

// 导出修复后的配置
module.exports = config;