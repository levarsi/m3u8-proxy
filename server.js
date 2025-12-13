const express = require('express');
const axios = require('axios');
const url = require('url');

const app = express();
const PORT = 3000;

// ==========================================
// 配置区域
// ==========================================

// 定义广告关键词正则（不区分大小写）
// 如果文件名包含这些词，将被判定为广告
const AD_REGEX = /ad_|promo|shop|advert/i;

// ==========================================
// 1. 核心代理服务接口
// ==========================================
app.get('/proxy', async (req, res) => {
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).send('请提供 url 参数，例如: /proxy?url=http://...');
    }

    try {
        // 1. 请求源站 m3u8
        // 添加 User-Agent 防止被部分服务器拦截
        const response = await axios.get(targetUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });
        
        const originalM3u8 = response.data;
        // 获取 URL 的基础路径，用于将相对路径转为绝对路径
        const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);

        // 2. 逐行解析与清洗
        const lines = originalM3u8.split('\n');
        let processedLines = [];
        let bufferTags = []; // 暂存与切片相关的标签（如 #EXTINF）

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();

            if (!line) continue;

            // -----------------------------
            // A. 处理标签行 (以 # 开头)
            // -----------------------------
            if (line.startsWith('#')) {
                
                // [关键修复] 必须显式保留结束标签，否则播放器认为是直播，不显示进度条
                if (line.startsWith('#EXT-X-ENDLIST')) {
                    // 如果缓存里还有剩下的标签，先吐出来（虽然理论上结束前应该是文件）
                    if (bufferTags.length > 0) {
                        processedLines = processedLines.concat(bufferTags);
                        bufferTags = [];
                    }
                    processedLines.push(line);
                }
                // 顶级标签/全局配置标签 -> 直接写入，不缓存
                // 包含：文件头、版本、最大时长、序列号、播放列表类型等
                else if (
                    line.startsWith('#EXTM3U') || 
                    line.startsWith('#EXT-X-VERSION') || 
                    line.startsWith('#EXT-X-TARGETDURATION') || 
                    line.startsWith('#EXT-X-PLAYLIST-TYPE') ||
                    line.startsWith('#EXT-X-MEDIA-SEQUENCE') ||
                    line.startsWith('#EXT-X-ALLOW-CACHE')
                ) {
                    processedLines.push(line);
                } 
                // 切片相关标签 (#EXTINF, #EXT-X-KEY 等) -> 先缓存，等待判断下一行文件是否为广告
                else {
                    bufferTags.push(line);
                }
            } 
            // -----------------------------
            // B. 处理文件路径/URL行
            // -----------------------------
            else {
                // 检测是否为广告
                const isAd = AD_REGEX.test(line);

                if (isAd) {
                    console.log(`[拦截广告] ${line}`);
                    // 如果是广告，清空缓存的标签（删除了对应的 #EXTINF）
                    bufferTags = []; 
                } else {
                    // 如果是正片
                    // 1. 先写入之前缓存的标签
                    processedLines = processedLines.concat(bufferTags);
                    bufferTags = [];

                    // 2. 路径重写 (Relative Path -> Absolute Path)
                    // 如果是相对路径，必须补全为完整 URL，否则播放器找不到文件
                    if (!line.startsWith('http')) {
                        try {
                            line = new url.URL(line, baseUrl).href;
                        } catch (e) {
                            console.warn('URL解析失败，保留原样:', line);
                        }
                    }
                    processedLines.push(line);
                }
            }
        }

        // 循环结束后，如果缓存中还有残留（极少见），为了安全起见写入
        if (bufferTags.length > 0) {
            processedLines = processedLines.concat(bufferTags);
        }

        // 3. 返回结果
        res.set({
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Access-Control-Allow-Origin': '*', // 允许跨域
            'Cache-Control': 'no-cache' // 直播流不建议浏览器缓存
        });
        res.send(processedLines.join('\n'));

    } catch (error) {
        console.error('代理出错:', error.message);
        res.status(500).send('Error fetching m3u8');
    }
});

// ==========================================
// 2. 模拟源站 (用于测试进度条和去广告)
// ==========================================
app.get('/mock-stream.m3u8', (req, res) => {
    // 模拟一个包含广告的点播文件 (VOD)
    // 注意最后的 #EXT-X-ENDLIST，这是显示进度条的关键
    const mockM3u8 = `
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-PLAYLIST-TYPE:VOD
#EXTINF:10.0,
video_part_1.ts
#EXTINF:10.0,
video_part_2.ts
#EXTINF:15.0,
ad_promo_video.ts
#EXTINF:10.0,
video_part_3.ts
#EXTINF:5.0,
shop_advertisement.ts
#EXTINF:10.0,
video_part_4.ts
#EXT-X-ENDLIST
    `.trim();
    
    res.set('Content-Type', 'application/vnd.apple.mpegurl');
    res.send(mockM3u8);
});

// ==========================================
// 启动服务
// ==========================================
app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`服务已启动: http://localhost:${PORT}`);
    console.log(`-----------------------------------------`);
    console.log(`1. 验证去广告+进度条 (模拟源):`);
    console.log(`   http://localhost:${PORT}/proxy?url=http://localhost:${PORT}/mock-stream.m3u8`);
    console.log(`-----------------------------------------`);
    console.log(`2. 验证真实链接 (请替换 url=后面为真实地址):`);
    console.log(`   http://localhost:${PORT}/proxy?url=YOUR_REAL_M3U8_URL`);
    console.log(`=========================================`);
});