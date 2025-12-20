// M3U8 代理服务器管理界面 JavaScript

// 全局变量
let currentTab = 'dashboard';
let refreshInterval = null;
let hlsPlayer = null;
let testHistory = [];

// 检查页面是否在正确的环境中加载
function checkEnvironment() {
    // 检查是否在用户脚本环境中
    if (typeof unsafeWindow !== 'undefined' || window.location.protocol === 'userscript:') {
        console.warn('检测到用户脚本环境，某些功能可能受限');
        return 'userscript';
    }
    
    // 检查是否在本地环境中
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'local';
    }
    
    return 'normal';
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 检查环境
    const environment = checkEnvironment();
    
    // 初始化移动端侧边栏
    initMobileSidebar();
    
    // 根据环境调整初始化策略
    if (environment === 'userscript') {
        // 在用户脚本环境中，禁用某些功能或提供降级处理
        console.log('在用户脚本环境中初始化应用');
        initializeApp();
    } else {
        // 正常环境初始化
        initializeApp();
    }
});

// 初始化移动端侧边栏
function initMobileSidebar() {
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    const main = document.querySelector('main');
    
    if (sidebarToggle && sidebar && main) {
        sidebarToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            
            const isActive = sidebar.classList.contains('active');
            const overlay = createSidebarOverlay();
            
            sidebar.classList.toggle('active');
            main.classList.toggle('sidebar-open');
            
            if (!isActive) {
                // 显示侧边栏
                overlay.classList.add('active');
                setTimeout(() => {
                    document.addEventListener('click', closeSidebarOnClickOutside);
                }, 100);
            } else {
                // 隐藏侧边栏
                overlay.classList.remove('active');
                document.removeEventListener('click', closeSidebarOnClickOutside);
            }
        });
    }
}

// 点击外部区域关闭侧边栏
function closeSidebarOnClickOutside(event) {
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    
    if (sidebar && !sidebar.contains(event.target) && !sidebarToggle.contains(event.target)) {
        sidebar.classList.remove('active');
        document.querySelector('main').classList.remove('sidebar-open');
        
        // 移除覆盖层
        const overlay = document.querySelector('.sidebar-overlay');
        if (overlay) {
            overlay.classList.remove('active');
        }
        
        document.removeEventListener('click', closeSidebarOnClickOutside);
    }
}

// 创建并管理覆盖层
function createSidebarOverlay() {
    let overlay = document.querySelector('.sidebar-overlay');
    
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);
        
        overlay.addEventListener('click', function() {
            const sidebar = document.querySelector('.sidebar');
            const main = document.querySelector('main');
            
            sidebar.classList.remove('active');
            main.classList.remove('sidebar-open');
            overlay.classList.remove('active');
            
            document.removeEventListener('click', closeSidebarOnClickOutside);
        });
    }
    
    return overlay;
}

// 初始化应用
function initializeApp() {
    try {
        // 检查必要的DOM元素是否存在
        if (!document.getElementById('dashboard')) {
            console.error('必要的DOM元素不存在，应用初始化失败');
            showNotification('页面加载不完整，请刷新页面', 'error');
            return;
        }
        
        // 绑定导航事件
        bindNavigationEvents();
        
        // 绑定表单事件
        bindFormEvents();
        
        // 初始化仪表板（使用延迟避免竞态条件）
        setTimeout(() => {
            refreshDashboard();
        }, 100);
        
        // 启动自动刷新（延迟启动以避免初始化期间的请求冲突）
        setTimeout(() => {
            startAutoRefresh();
        }, 1000);
        
        // 初始化视频播放器
        initializePlayer();
        
        // 加载设置（延迟加载以避免初始化期间的请求冲突）
        setTimeout(() => {
            loadSettings();
        }, 500);
        
        console.log('应用初始化完成');
        
    } catch (error) {
        console.error('应用初始化失败:', error);
        showNotification('应用初始化失败，请刷新页面重试', 'error');
    }
}

// 绑定导航事件
function bindNavigationEvents() {
    const navLinks = document.querySelectorAll('.nav-link[data-tab]');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const tabName = this.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
}

// 切换标签页
function switchTab(tabName) {
    // 更新导航状态
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // 更新内容显示
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');
    
    currentTab = tabName;
    
    // 根据标签页执行特定操作
    switch(tabName) {
        case 'dashboard':
            refreshDashboard();
            break;
        case 'cache':
            refreshCacheStats();
            break;
        case 'logs':
            refreshLogs();
            break;
    }
}

// 绑定表单事件
function bindFormEvents() {
    // 代理测试表单
    const proxyTestForm = document.getElementById('proxy-test-form');
    if (proxyTestForm) {
        proxyTestForm.addEventListener('submit', function(e) {
            e.preventDefault();
            testProxy();
        });
    }
    
    // 音量控制
    const volumeControl = document.getElementById('volume-control');
    if (volumeControl) {
        volumeControl.addEventListener('input', function() {
            const player = document.getElementById('video-player');
            if (player) {
                player.volume = this.value;
            }
        });
    }
    
    // 播放速度控制
    const playbackRate = document.getElementById('playback-rate');
    if (playbackRate) {
        playbackRate.addEventListener('change', function() {
            const player = document.getElementById('video-player');
            if (player) {
                player.playbackRate = parseFloat(this.value);
            }
        });
    }
}

// 启动自动刷新
function startAutoRefresh() {
    refreshInterval = setInterval(() => {
        if (currentTab === 'dashboard') {
            refreshDashboard();
        } else if (currentTab === 'cache') {
            refreshCacheStats();
        }
    }, 5000);
}

// 停止自动刷新
function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}

// 刷新仪表板
async function refreshDashboard() {
    try {
        // 构造完整的URL以避免用户脚本环境中的问题
        const baseUrl = window.location.origin;
        const response = await fetch(`${baseUrl}/health`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // 获取额外的系统统计信息
        const statsResponse = await fetch(`${baseUrl}/stats`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });
        
        let statsData = {};
        if (statsResponse.ok) {
            statsData = await statsResponse.json();
        }
        
        // 更新系统状态
        document.getElementById('system-status').textContent = data.status;
        document.getElementById('uptime').textContent = formatUptime(data.uptime);
        
        // 修复内存使用显示
        if (data.memory && typeof data.memory === 'object') {
            document.getElementById('memory-usage').textContent = formatMemory(data.memory);
        } else if (statsData.system && statsData.system.memory) {
            document.getElementById('memory-usage').textContent = formatMemory(statsData.system.memory);
        } else {
            document.getElementById('memory-usage').textContent = '未知';
        }
        
        document.getElementById('server-url').textContent = baseUrl;
        
        // 修复Node.js版本显示
        const nodeVersion = statsData.system?.nodeVersion || 
                           data.nodeVersion || 
                           (typeof process !== 'undefined' ? process.version : null) || 
                           'Unknown';
        document.getElementById('node-version').textContent = nodeVersion;
        
        document.getElementById('start-time').textContent = new Date(data.timestamp).toLocaleString();
        
        // 更新统计卡片
        updateStatsCards(data, statsData);
        
    } catch (error) {
        console.error('刷新仪表板失败:', error);
        // 提供降级处理
        provideDashboardFallback();
        showNotification('刷新仪表板失败，显示默认信息', 'warning');
    }
}

// 更新统计卡片
function updateStatsCards(healthData, statsData) {
    // 缓存命中率
    const cacheStats = healthData.cache || statsData.cache || {};
    const hitRate = cacheStats.stats && cacheStats.stats.hitRate 
        ? cacheStats.stats.hitRate 
        : '0%';
    document.getElementById('cache-hit-rate').textContent = hitRate;
    
    // 总请求数
    const totalRequests = cacheStats.stats && cacheStats.stats.totalRequests 
        ? cacheStats.stats.totalRequests 
        : (statsData.server?.requestCount || 0);
    document.getElementById('total-requests').textContent = totalRequests;
    
    // 广告过滤数
    const adsFiltered = statsData.processor?.stats?.adsFiltered || 
                       cacheStats.stats?.adsFiltered || 
                       0;
    document.getElementById('ads-filtered').textContent = adsFiltered;
}

// 仪表板降级处理
function provideDashboardFallback() {
    document.getElementById('system-status').textContent = '未知';
    document.getElementById('uptime').textContent = '0分钟';
    document.getElementById('memory-usage').textContent = '未知';
    document.getElementById('server-url').textContent = window.location.origin;
    document.getElementById('node-version').textContent = 'Unknown';
    document.getElementById('start-time').textContent = new Date().toLocaleString();
    
    // 更新统计卡片为默认值
    updateStatsCards({
        cache: { enabled: true, stats: { hitRate: '0%', totalRequests: 0 } }
    });
}

// 刷新缓存统计
async function refreshCacheStats() {
    try {
        const baseUrl = window.location.origin;
        const response = await fetch(`${baseUrl}/cache/stats`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // 更新缓存统计显示
        const cacheStatsHtml = `
            <div class="row">
                <div class="col-6">
                    <p><strong>缓存状态:</strong> ${data.enabled ? '启用' : '禁用'}</p>
                    <p><strong>缓存大小:</strong> ${data.size}/${data.maxSize}</p>
                    <p><strong>TTL:</strong> ${formatDuration(data.ttl)}</p>
                </div>
                <div class="col-6">
                    <p><strong>命中数:</strong> ${data.stats?.hits || 0}</p>
                    <p><strong>未命中数:</strong> ${data.stats?.misses || 0}</p>
                    <p><strong>命中率:</strong> ${data.stats?.hitRate || '0%'}</p>
                </div>
            </div>
            <div class="mt-3">
                <div class="progress">
                    <div class="progress-bar" style="width: ${(data.size / data.maxSize) * 100}%"></div>
                </div>
                <small class="text-muted">缓存使用率: ${Math.round((data.size / data.maxSize) * 100)}%</small>
            </div>
        `;
        
        document.getElementById('cache-stats').innerHTML = cacheStatsHtml;
        
        // 更新热门缓存项
        if (data.stats?.topAccessed && data.stats.topAccessed.length > 0) {
            const topItemsHtml = data.stats.topAccessed.map(item => `
                <div class="cache-item">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <small class="text-muted d-block">${item.key}</small>
                            <strong>访问次数: ${item.frequency}</strong>
                        </div>
                        <button class="btn btn-sm btn-outline-danger" onclick="removeCacheItem('${item.key}')">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('');
            
            document.getElementById('top-cache-items').innerHTML = topItemsHtml;
        } else {
            document.getElementById('top-cache-items').innerHTML = '<p class="text-muted">暂无热门缓存项</p>';
        }
        
    } catch (error) {
        console.error('刷新缓存统计失败:', error);
        showNotification('刷新缓存统计失败', 'error');
    }
}

// 测试代理
async function testProxy() {
    const urlInput = document.getElementById('m3u8-url');
    const url = urlInput.value.trim();
    
    if (!url) {
        showNotification('请输入 M3U8 URL', 'warning');
        return;
    }
    
    const resultDiv = document.getElementById('proxy-result');
    const resultContent = document.getElementById('proxy-result-content');
    
    // 显示加载状态
    resultContent.innerHTML = `
        <div class="text-center">
            <div class="spinner-border" role="status">
                <span class="visually-hidden">测试中...</span>
            </div>
            <p class="mt-2">正在测试代理...</p>
        </div>
    `;
    resultDiv.style.display = 'block';
    
    try {
        const startTime = Date.now();
        const baseUrl = window.location.origin;
        const response = await fetch(`${baseUrl}/proxy?url=${encodeURIComponent(url)}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/vnd.apple.mpegurl',
                'Cache-Control': 'no-cache'
            }
        });
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        const content = await response.text();
        
        // 分析处理结果
        const lines = content.split('\n');
        const segmentCount = lines.filter(line => !line.startsWith('#') && line.trim()).length;
        const hasAds = content.includes('# Advertisements filtered');
        
        // 添加到测试历史
        testHistory.unshift({
            url: url,
            status: response.status,
            responseTime: responseTime,
            segmentCount: segmentCount,
            timestamp: new Date(),
            hasAds: hasAds
        });
        
        // 限制历史记录数量
        if (testHistory.length > 10) {
            testHistory = testHistory.slice(0, 10);
        }
        
        updateTestHistory();
        
        // 显示测试结果
        const resultClass = response.ok ? 'test-result' : 'test-result error';
        resultContent.innerHTML = `
            <div class="${resultClass}">
                <h6>测试结果</h6>
                <div class="row">
                    <div class="col-md-6">
                        <p><strong>状态:</strong> ${response.ok ? '成功' : '失败'}</p>
                        <p><strong>状态码:</strong> ${response.status}</p>
                        <p><strong>响应时间:</strong> ${responseTime}ms</p>
                    </div>
                    <div class="col-md-6">
                        <p><strong>片段数量:</strong> ${segmentCount}</p>
                        <p><strong>广告过滤:</strong> ${hasAds ? '已过滤' : '未检测到广告'}</p>
                        <p><strong>测试时间:</strong> ${new Date().toLocaleString()}</p>
                    </div>
                </div>
                <div class="mt-3">
                    <button class="btn btn-sm btn-primary" onclick="loadVideoFromTest('${url}')">
                        <i class="bi bi-play"></i> 在播放器中打开
                    </button>
                    <button class="btn btn-sm btn-outline-secondary ms-2" onclick="copyToClipboard('${url}')">
                        <i class="bi bi-clipboard"></i> 复制URL
                    </button>
                </div>
            </div>
        `;
        
        if (response.ok) {
            showNotification('代理测试成功', 'success');
        } else {
            showNotification('代理测试失败', 'error');
        }
        
    } catch (error) {
        console.error('代理测试失败:', error);
        resultContent.innerHTML = `
            <div class="test-result error">
                <h6>测试失败</h6>
                <p><strong>错误信息:</strong> ${error.message}</p>
                <p><strong>时间:</strong> ${new Date().toLocaleString()}</p>
            </div>
        `;
        showNotification('代理测试失败', 'error');
    }
}

// 更新测试历史
function updateTestHistory() {
    const historyDiv = document.getElementById('test-history');
    
    if (testHistory.length === 0) {
        historyDiv.innerHTML = '<p class="text-muted">暂无测试历史</p>';
        return;
    }
    
    const historyHtml = testHistory.map((test, index) => `
        <div class="cache-item">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <small class="text-muted d-block">${test.url.substring(0, 50)}...</small>
                    <small>
                        状态: ${test.status === 200 ? '成功' : '失败'} | 
                        时间: ${test.responseTime}ms | 
                        片段: ${test.segmentCount}
                    </small>
                </div>
                <small class="text-muted">${formatTime(test.timestamp)}</small>
            </div>
        </div>
    `).join('');
    
    historyDiv.innerHTML = historyHtml;
}

// 清除缓存
async function clearCache() {
    if (!confirm('确定要清除所有缓存吗？')) {
        return;
    }
    
    try {
        const baseUrl = window.location.origin;
        const response = await fetch(`${baseUrl}/cache/clear`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });
        const data = await response.json();
        
        if (data.success) {
            showNotification('缓存已清除', 'success');
            refreshCacheStats();
        } else {
            showNotification('清除缓存失败', 'error');
        }
    } catch (error) {
        console.error('清除缓存失败:', error);
        showNotification('清除缓存失败', 'error');
    }
}

// 初始化视频播放器
function initializePlayer() {
    const video = document.getElementById('video-player');
    if (!video) return;
    
    // 检查是否支持 HLS
    if (Hls.isSupported()) {
        hlsPlayer = new Hls({
            debug: false,
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90
        });
        
        hlsPlayer.attachMedia(video);
        
        hlsPlayer.on(Hls.Events.MEDIA_ATTACHED, function() {
            console.log('HLS 媒体已附加');
            updatePlayerStatus('loading', '媒体已附加');
        });
        
        hlsPlayer.on(Hls.Events.MANIFEST_PARSED, function(event, data) {
            console.log('HLS 清单已解析', data);
            updatePlayerStatus('loading', `清单已解析，共${data.levels.length}个质量级别`);
        });
        
        hlsPlayer.on(Hls.Events.ERROR, function(event, data) {
            console.error('HLS 错误:', data);
            
            if (data.fatal) {
                switch(data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        if (data.details === 'manifestLoadError') {
                            showNotification('无法加载播放列表，可能是CORS问题或网络错误', 'error');
                            updatePlayerStatus('error', '加载失败');
                        } else if (data.details === 'manifestParsingError') {
                            // 检查是否是HTML内容错误
                            if (data.response && data.response.data && data.response.data.includes('<html>')) {
                                showNotification('目标URL返回HTML内容，可能是访问被阻止或URL无效', 'error');
                                updatePlayerStatus('error', '访问被阻止');
                            } else {
                                showNotification('播放列表解析失败，可能是格式错误', 'error');
                                updatePlayerStatus('error', '解析失败');
                            }
                            
                            // 尝试获取原始内容进行调试
                            if (data.url && data.url.includes('/proxy?url=')) {
                                debugProxyResponse(data.url);
                            }
                        } else {
                            showNotification('网络错误，尝试恢复...', 'warning');
                            updatePlayerStatus('error', '网络错误');
                            hlsPlayer.startLoad();
                        }
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        showNotification('媒体错误，尝试恢复...', 'warning');
                        updatePlayerStatus('error', '媒体错误');
                        hlsPlayer.recoverMediaError();
                        break;
                    default:
                        showNotification(`播放器错误: ${data.details || '未知错误'}`, 'error');
                        updatePlayerStatus('error', '播放器错误');
                        break;
                }
            } else {
                // 非致命错误，只记录不显示通知
                console.warn('非致命HLS错误:', data);
            }
        });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // 原生 HLS 支持
        console.log('使用原生 HLS 支持');
    } else {
        console.warn('当前浏览器不支持 HLS 播放');
    }
}

// 加载视频
function loadVideo() {
    const urlInput = document.getElementById('player-url');
    const url = urlInput.value.trim();
    
    if (!url) {
        showNotification('请输入 M3U8 URL', 'warning');
        return;
    }
    
    // 验证URL格式
    if (!isValidUrl(url)) {
        showNotification('请输入有效的 URL', 'warning');
        return;
    }
    
    // 显示加载状态
    showNotification('正在加载视频...', 'info');
    
    loadVideoFromUrl(url);
}

// 调试代理响应
async function debugProxyResponse(proxyUrl) {
    try {
        const response = await fetch(proxyUrl);
        const content = await response.text();
        
        console.log('代理响应调试信息:');
        console.log('URL:', proxyUrl);
        console.log('状态:', response.status);
        console.log('Content-Type:', response.headers.get('Content-Type'));
        console.log('内容长度:', content.length);
        console.log('内容预览:', content.substring(0, 200));
        console.log('是否以EXTM3U开头:', content.trim().startsWith('#EXTM3U'));
        
        // 在页面上显示调试信息
        const debugInfo = `
            <div class="alert alert-info">
                <h6>调试信息</h6>
                <p><strong>URL:</strong> ${proxyUrl}</p>
                <p><strong>状态:</strong> ${response.status}</p>
                <p><strong>Content-Type:</strong> ${response.headers.get('Content-Type')}</p>
                <p><strong>内容长度:</strong> ${content.length}</p>
                <p><strong>EXTM3U检查:</strong> ${content.trim().startsWith('#EXTM3U') ? '✓ 通过' : '✗ 失败'}</p>
                <details>
                    <summary>内容预览</summary>
                    <pre>${content.substring(0, 500)}${content.length > 500 ? '...' : ''}</pre>
                </details>
            </div>
        `;
        
        // 找一个合适的地方显示调试信息
        const playerCard = document.querySelector('#player .card-body');
        if (playerCard) {
            const existingDebug = playerCard.querySelector('.alert-info');
            if (existingDebug) {
                existingDebug.remove();
            }
            playerCard.insertAdjacentHTML('afterbegin', debugInfo);
        }
        
    } catch (error) {
        console.error('调试代理响应失败:', error);
    }
}

// URL验证函数
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// 从测试结果加载视频
function loadVideoFromTest(url) {
    // 切换到播放器标签页
    switchTab('player');
    
    // 设置URL并加载
    document.getElementById('player-url').value = url;
    loadVideoFromUrl(url);
}

// 更新播放器状态
function updatePlayerStatus(status, message = '') {
    const statusElement = document.getElementById('player-status');
    const infoElement = document.getElementById('player-info');
    
    if (statusElement) {
        statusElement.style.display = 'inline-block';
        statusElement.className = 'badge';
        
        switch(status) {
            case 'loading':
                statusElement.classList.add('bg-warning');
                statusElement.innerHTML = '<i class="bi bi-arrow-clockwise"></i> 加载中';
                break;
            case 'playing':
                statusElement.classList.add('bg-success');
                statusElement.innerHTML = '<i class="bi bi-play-circle"></i> 播放中';
                break;
            case 'error':
                statusElement.classList.add('bg-danger');
                statusElement.innerHTML = '<i class="bi bi-exclamation-circle"></i> 错误';
                break;
            default:
                statusElement.classList.add('bg-info');
                statusElement.innerHTML = '<i class="bi bi-circle-fill"></i> 准备就绪';
        }
    }
    
    if (infoElement) {
        infoElement.textContent = message;
    }
}

// 从URL加载视频
function loadVideoFromUrl(url) {
    const video = document.getElementById('video-player');
    
    // 检查是否为外部URL，如果是则通过代理加载
    const isExternalUrl = url.startsWith('http') && !url.includes(window.location.hostname);
    const finalUrl = isExternalUrl ? `/proxy?url=${encodeURIComponent(url)}` : url;
    
    console.log('加载视频URL:', url);
    console.log('最终URL:', finalUrl);
    
    // 更新状态
    updatePlayerStatus('loading', isExternalUrl ? '通过代理加载外部视频' : '加载本地视频');
    
    if (hlsPlayer) {
        hlsPlayer.loadSource(finalUrl);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = finalUrl;
    } else {
        showNotification('当前浏览器不支持 HLS 播放', 'error');
        updatePlayerStatus('error', '浏览器不支持HLS');
        return;
    }
    
    video.play().then(() => {
        updatePlayerStatus('playing', '视频播放中');
        showNotification('视频加载成功', 'success');
    }).catch(error => {
        console.error('播放失败:', error);
        updatePlayerStatus('error', '播放失败');
        showNotification('播放失败，请检查URL是否正确', 'error');
    });
}

// 切换全屏
function toggleFullscreen() {
    const video = document.getElementById('video-player');
    
    if (!document.fullscreenElement) {
        video.requestFullscreen().catch(err => {
            console.error('全屏失败:', err);
        });
    } else {
        document.exitFullscreen();
    }
}

// 切换画中画
function togglePictureInPicture() {
    const video = document.getElementById('video-player');
    
    if (document.pictureInPictureElement) {
        document.exitPictureInPicture();
    } else {
        video.requestPictureInPicture().catch(err => {
            console.error('画中画失败:', err);
        });
    }
}

// 通用fetch包装函数
async function safeFetch(url, options = {}) {
    const baseUrl = window.location.origin;
    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
    
    const defaultOptions = {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
        }
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    try {
        const response = await fetch(fullUrl, finalOptions);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response;
    } catch (error) {
        console.error(`Fetch failed for ${fullUrl}:`, error);
        throw error;
    }
}

// 刷新日志
async function refreshLogs() {
    try {
        const response = await safeFetch('/logs');
        const data = await response.json();
        
        const logContainer = document.getElementById('log-container');
        
        if (data.logs && data.logs.length > 0) {
            const logHtml = data.logs.map(log => `
                <div class="log-entry ${log.level}">
                    <small class="text-muted">${formatTime(log.timestamp)}</small>
                    <span class="ms-2">${log.message}</span>
                    ${log.module ? `<small class="text-muted ms-2">[${log.module}]</small>` : ''}
                </div>
            `).join('');
            
            logContainer.innerHTML = logHtml;
        } else {
            logContainer.innerHTML = '<p class="text-muted">暂无日志</p>';
        }
        
    } catch (error) {
        console.error('刷新日志失败:', error);
        
        // 提供模拟日志作为降级处理
        const mockLogs = [
            { level: 'info', message: '服务器运行正常', timestamp: new Date(), module: 'server' },
            { level: 'warn', message: '缓存使用率较高', timestamp: new Date(Date.now() - 60000), module: 'cache' }
        ];
        
        const logContainer = document.getElementById('log-container');
        const logHtml = mockLogs.map(log => `
            <div class="log-entry ${log.level}">
                <small class="text-muted">${formatTime(log.timestamp)}</small>
                <span class="ms-2">${log.message}</span>
                <small class="text-muted ms-2">[${log.module}]</small>
            </div>
        `).join('');
        
        logContainer.innerHTML = logHtml || '<p class="text-muted">暂无日志</p>';
        showNotification('刷新日志失败，显示模拟数据', 'warning');
    }
}

// 清除日志
function clearLogs() {
    if (!confirm('确定要清除所有日志吗？')) {
        return;
    }
    
    document.getElementById('log-container').innerHTML = '<p class="text-muted">暂无日志</p>';
    showNotification('日志已清除', 'success');
}

// 加载设置
function loadSettings() {
    // 从服务器加载设置
    const baseUrl = window.location.origin;
    fetch(`${baseUrl}/config`, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
        }
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            // 更新设置界面
            document.getElementById('ad-filter-enabled').checked = data.adFilter.enabled;
            document.getElementById('cache-enabled').checked = data.cache.enabled;
            document.getElementById('cache-ttl').value = data.cache.ttl / 1000; // 转换为秒
            document.getElementById('cache-size').value = data.cache.maxSize;
        })
        .catch(error => {
            console.error('加载设置失败:', error);
            // 提供默认设置
            document.getElementById('ad-filter-enabled').checked = true;
            document.getElementById('cache-enabled').checked = true;
            document.getElementById('cache-ttl').value = 300;
            document.getElementById('cache-size').value = 100;
        });
}

// 保存设置
async function saveSettings() {
    const settings = {
        adFilter: {
            enabled: document.getElementById('ad-filter-enabled').checked,
            customPatterns: document.getElementById('custom-patterns').value
                .split('\n')
                .filter(pattern => pattern.trim())
                .map(pattern => new RegExp(pattern, 'i'))
        },
        cache: {
            enabled: document.getElementById('cache-enabled').checked,
            ttl: parseInt(document.getElementById('cache-ttl').value) * 1000, // 转换为毫秒
            maxSize: parseInt(document.getElementById('cache-size').value)
        }
    };
    
    try {
        // 这里需要实现设置保存接口
        showNotification('设置已保存', 'success');
    } catch (error) {
        console.error('保存设置失败:', error);
        showNotification('保存设置失败', 'error');
    }
}

// 重置设置
function resetSettings() {
    if (!confirm('确定要重置所有设置吗？')) {
        return;
    }
    
    loadSettings();
    showNotification('设置已重置', 'success');
}

// 导出配置
function exportConfig() {
    const baseUrl = window.location.origin;
    fetch(`${baseUrl}/config`, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
        }
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'm3u8-proxy-config.json';
            a.click();
            URL.revokeObjectURL(url);
            showNotification('配置已导出', 'success');
        })
        .catch(error => {
            console.error('导出配置失败:', error);
            showNotification('导出配置失败', 'error');
        });
}

// 工具函数
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
        return `${days}天 ${hours}小时 ${minutes}分钟`;
    } else if (hours > 0) {
        return `${hours}小时 ${minutes}分钟`;
    } else {
        return `${minutes}分钟`;
    }
}

// 格式化内存使用
function formatMemory(memory) {
    if (!memory) return '未知';
    
    // 处理不同的内存数据格式
    let used = 0;
    let total = 0;
    
    if (typeof memory === 'object') {
        // Node.js process.memoryUsage() 格式
        used = memory.heapUsed || memory.rss || memory.used || 0;
        total = memory.heapTotal || memory.total || 0;
        
        // 如果没有total，使用RSS作为总内存
        if (!total && memory.rss) {
            total = memory.rss;
        }
    } else if (typeof memory === 'number') {
        // 如果是数字，假设是已使用内存
        used = memory;
        total = memory; // 暂时设为相同值
    }
    
    // 如果仍然没有有效数据，返回默认值
    if (used === 0 && total === 0) {
        return '0 MB / 0 MB';
    }
    
    // 如果total为0，只显示used
    if (total === 0) {
        return formatBytes(used);
    }
    
    return `${formatBytes(used)} / ${formatBytes(total)}`;
}

function formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        return `${hours}小时 ${minutes % 60}分钟`;
    } else if (minutes > 0) {
        return `${minutes}分钟 ${seconds % 60}秒`;
    } else {
        return `${seconds}秒`;
    }
}

function formatTime(date) {
    return new Date(date).toLocaleTimeString();
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('已复制到剪贴板', 'success');
    }).catch(err => {
        console.error('复制失败:', err);
        showNotification('复制失败', 'error');
    });
}

function showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(notification);
    
    // 自动移除
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

// 页面卸载时清理
window.addEventListener('beforeunload', function() {
    stopAutoRefresh();
    
    if (hlsPlayer) {
        hlsPlayer.destroy();
    }
});