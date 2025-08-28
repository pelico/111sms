document.addEventListener('DOMContentLoaded', function() {
    
    // --- API Endpoints ---
    const NOTIFICATIONS_API = 'https://jy-api.111312.xyz/notifications';
    const MONITORING_PROXY_API = 'https://up-api.111312.xyz/';

    // --- 全局变量和状态 ---
    let monitorDataCache = [];
    let notificationsLoaded = false;

    // --- 1. 基础功能 (来自原 index.html) ---
    function updateTime() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const day = now.getDate();
        const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        const weekday = weekdays[now.getDay()];
        
        document.getElementById('current-time').textContent = `${hours}:${minutes}:${seconds}`;
        document.getElementById('current-date').textContent = `${year}年${month}月${day}日 ${weekday}`;
    }

    function updateWeather() {
        const temps = [22, 23, 24, 25, 26, 27, 28, 29, 30];
        const weathers = ['晴', '多云', '小雨', '阴'];
        const cities = ['北京', '上海', '广州', '深圳', '杭州', '南京'];
        const temp = temps[Math.floor(Math.random() * temps.length)];
        const weather = weathers[Math.floor(Math.random() * weathers.length)];
        const city = cities[Math.floor(Math.random() * cities.length)];
        document.querySelector('.temp').textContent = `${temp}°C`;
        document.querySelector('.city').textContent = `${city} · ${weather}`;
        
        const icon = document.querySelector('.weather i');
        if (weather === '晴') { icon.className = 'fas fa-sun'; icon.style.color = '#ff9800'; } 
        else if (weather === '多云') { icon.className = 'fas fa-cloud'; icon.style.color = '#78909c'; }
        else if (weather === '小雨') { icon.className = 'fas fa-cloud-rain'; icon.style.color = '#2196f3'; }
        else { icon.className = 'fas fa-cloud'; icon.style.color = '#607d8b'; }
    }
    
    function countSites() {
        const sites = document.querySelectorAll('.nav-link');
        document.getElementById('site-count').textContent = sites.length;
    }

    // --- 2. 选项卡切换逻辑 ---
    function handleTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));

                button.classList.add('active');
                const tabId = button.getAttribute('data-tab');
                document.getElementById(tabId).classList.add('active');

                // 如果是第一次点击“我的通知”，则加载数据
                if (tabId === 'tab-notifications' && !notificationsLoaded) {
                    fetchNotifications();
                    notificationsLoaded = true;
                }
            });
        });
    }


    // --- 3. 我的通知功能 (来自 index(1).html) ---
    function showNotificationStatus(message, type = 'info') {
        const statusEl = document.getElementById('notifications-status-message');
        statusEl.innerHTML = `<div class="status-msg ${type}">${message}</div>`;
        if (type === 'success') {
            setTimeout(() => { statusEl.innerHTML = ''; }, 5000);
        }
    }

    async function fetchNotifications() {
        const listEl = document.getElementById('notifications-list');
        listEl.innerHTML = `<div class="loading-state"><div class="loading-spinner"></div><div>正在刷新...</div></div>`;

        try {
            const response = await fetch(NOTIFICATIONS_API);
            if (!response.ok) throw new Error(`HTTP错误! 状态码: ${response.status}`);
            
            const data = await response.json();
            
            if (data.success === false) { // 检查后端返回的业务错误
                throw new Error(`API返回错误: ${data.error || '未知错误'}`);
            }

            if (data.notifications && data.notifications.length > 0) {
                listEl.innerHTML = '';
                data.notifications.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'notification-item';
                    const date = new Date(item.timestamp);
                    div.innerHTML = `
                        <span class="notification-content">${item.content}</span>
                        <span class="notification-timestamp">${date.toLocaleString('zh-CN')}</span>
                    `;
                    listEl.appendChild(div);
                });
                showNotificationStatus(`成功加载 ${data.notifications.length} 条通知`, 'success');
            } else {
                listEl.innerHTML = `<div class="empty-state"><p>暂无通知或短信</p></div>`;
            }
        } catch (error) {
            console.error('获取通知失败:', error);
            listEl.innerHTML = `<div class="error-state"><p>加载失败: ${error.message}</p></div>`;
            showNotificationStatus(`加载失败: ${error.message}`, 'error');
        }
    }


    // --- 4. 服务监控功能 (来自 index(2).html) ---
    const STATUS_MAP = {
        0: { text: '暂停中', class: 'status-warning', icon: 'fa-pause-circle' },
        1: { text: '未检查', class: 'status-warning', icon: 'fa-question-circle' },
        2: { text: '运行中', class: 'status-up', icon: 'fa-check-circle' },
        8: { text: '疑似故障', class: 'status-warning', icon: 'fa-exclamation-circle' },
        9: { text: '服务中断', class: 'status-down', icon: 'fa-times-circle' },
    };

    function renderMonitoringPage(data) {
        if (!data || !data.monitors) {
            showMonitoringError("未能从API获取到有效的监控数据。");
            return;
        }
        
        const container = document.getElementById('monitoring-container');
        const monitors = data.monitors.filter(m => m.type === 1 || m.type === 2);
        monitorDataCache = monitors;
        
        let upCount = 0, downCount = 0, warningCount = 0, totalUptime = 0;
        
        monitors.forEach(m => {
            const statusClass = (STATUS_MAP[m.status] || {}).class;
            if (statusClass === 'status-up') upCount++;
            else if (statusClass === 'status-down') downCount++;
            else warningCount++;
            totalUptime += parseFloat(m.custom_uptime_ratios?.split('-')[0] || m.all_time_uptime_ratio || 0);
        });

        const servicesHTML = monitors.map(monitor => {
            const status = STATUS_MAP[monitor.status] || { text: '未知', class: 'status-warning', icon: 'fa-question-circle' };
            const uptimeRatio = parseFloat(monitor.custom_uptime_ratios?.split('-')[0] || monitor.all_time_uptime_ratio || 0);
            return `<div class="service-card" id="monitor-card-${monitor.id}">
                        <div class="service-card-header" onclick="toggleDetailChart(${monitor.id})">
                            <div class="service-header">
                                <div class="service-name">${monitor.friendly_name} <i class="fas fa-chevron-down"></i></div>
                                <div class="service-status ${status.class}"><i class="fas ${status.icon}"></i> ${status.text}</div>
                            </div>
                        </div>
                        <div class="service-details">
                           <div class="service-details-content">
                             <div class="detail-chart-container"><canvas id="detail-chart-${monitor.id}"></canvas></div>
                           </div>
                        </div>
                    </div>`;
        }).join('');

        container.innerHTML = `
            <header>
                <div class="logo"><i class="fas fa-heartbeat"></i><div class="logo-text">服务状态监控</div></div>
                <p class="subtitle">基于 UptimeRobot API 的实时监控仪表盘</p>
            </header>
            <div class="status-summary">
                <div class="summary-card status"><div class="card-icon"><i class="fas fa-check-circle"></i></div><div class="card-title">正常运行</div><div class="card-value">${upCount}</div></div>
                <div class="summary-card uptime"><div class="card-icon"><i class="fas fa-chart-line"></i></div><div class="card-title">平均运行率</div><div class="card-value">${monitors.length > 0 ? (totalUptime / monitors.length).toFixed(2) : '0'}%</div></div>
                <div class="summary-card incidents"><div class="card-icon"><i class="fas fa-times-circle"></i></div><div class="card-title">当前故障</div><div class="card-value">${downCount}</div></div>
            </div>
            <div class="services-grid">
                <div class="services-header"><span>网站监控列表 (点击展开图表)</span></div>
                <div id="services-list">${servicesHTML || '<p style="padding: 20px;">没有找到网站监控服务。</p>'}</div>
            </div>
            <div class="charts-section">
                <h2 class="section-title"><i class="fas fa-chart-bar"></i><span>网站状态总览</span></h2>
                <div class="charts-grid">
                    <div class="chart-container"><div class="chart-wrapper"><canvas id="statusChart"></canvas></div></div>
                    <div class="chart-container"><div class="chart-wrapper"><canvas id="responseTimeChart"></canvas></div></div>
                </div>
            </div>
        `;

        renderOverviewCharts(monitors, { up: upCount, down: downCount, warning: warningCount });
    }
    
    // Make this function accessible globally for the inline onclick
    window.toggleDetailChart = function(monitorId) {
        const card = document.getElementById(`monitor-card-${monitorId}`);
        if (!card) return;
        const isExpanded = card.classList.toggle('expanded');
        if (isExpanded) {
            const monitor = monitorDataCache.find(m => m.id === monitorId);
            if (monitor && monitor.response_times) {
                createDetailChart(monitor);
            }
        }
    }
    
    function createDetailChart(monitor) {
        const canvasId = `detail-chart-${monitor.id}`, ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) return;
        if (Chart.getChart(ctx)) Chart.getChart(ctx).destroy(); // Destroy previous chart instance
        const chartData = monitor.response_times.map(rt => ({ x: rt.datetime * 1000, y: rt.value })).reverse();
        new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: '响应时间 (ms)', data: chartData, borderColor: 'rgba(30, 136, 229, 0.5)', 
                    backgroundColor: 'rgba(30, 136, 229, 0.1)', borderWidth: 2, tension: 0.3, fill: true, pointRadius: 1.5
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { x: { type: 'time', time: { unit: 'hour' } }, y: { beginAtZero: true } }, plugins: { legend: { display: false } } }
        });
    }

    function renderOverviewCharts(monitors, counts) {
        const statusCtx = document.getElementById('statusChart')?.getContext('2d');
        if (statusCtx) {
            if (Chart.getChart(statusCtx)) Chart.getChart(statusCtx).destroy();
            new Chart(statusCtx, {
                type: 'doughnut',
                data: {
                    labels: ['正常', '警告', '故障'],
                    datasets: [{ data: [counts.up, counts.warning, counts.down], backgroundColor: [ 'rgba(76, 175, 80, 0.8)', 'rgba(255, 152, 0, 0.8)', 'rgba(244, 67, 54, 0.8)' ], borderWidth: 2 }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
            });
        }

        const rtCtx = document.getElementById('responseTimeChart')?.getContext('2d');
        if (rtCtx) {
            if (Chart.getChart(rtCtx)) Chart.getChart(rtCtx).destroy();
            new Chart(rtCtx, {
                type: 'bar',
                data: {
                    labels: monitors.map(m => m.friendly_name.substring(0, 12) + (m.friendly_name.length > 12 ? '...' : '')),
                    datasets: [{ label: '响应时间 (ms)', data: monitors.map(m => m.response_times?.[0]?.value || 0), backgroundColor: 'rgba(30, 136, 229, 0.7)' }]
                },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } }
            });
        }
    }

    async function fetchMonitoringData() {
        try {
            const response = await fetch(MONITORING_PROXY_API, { method: 'POST', cache: 'no-cache' });
            if (!response.ok) throw new Error(`API代理请求失败: ${response.status}`);
            const data = await response.json();
            if (!data || (data.stat !== 'ok' && !data.nas_stats)) throw new Error(`API 返回错误: ${(data.error || {}).message || '未知'}`);
            return data;
        } catch (error) {
            console.error('获取监控数据失败:', error);
            showMonitoringError(error.message);
            return null;
        }
    }

    function showMonitoringError(message) {
        document.getElementById('monitoring-container').innerHTML = `<div class="error-state"><h2>加载数据失败</h2><p>${message}</p></div>`;
    }

    async function initMonitoring() {
        const data = await fetchMonitoringData();
        if (data) {
            renderMonitoringPage(data);
        }
    }

    // --- 初始化函数 ---
    function initialize() {
        // 基础功能
        updateTime();
        setInterval(updateTime, 1000);
        updateWeather();
        setInterval(updateWeather, 600000); // 10分钟
        countSites();

        // 选项卡
        handleTabs();

        // 默认加载服务监控
        initMonitoring();

        // 通知刷新按钮
        document.getElementById('refresh-notifications-btn').addEventListener('click', fetchNotifications);
    }

    initialize();
});
