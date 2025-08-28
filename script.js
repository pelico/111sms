document.addEventListener('DOMContentLoaded', function() {
    
    // --- API Endpoints ---
    const NOTIFICATIONS_API = 'https://jy-api.111312.xyz/notifications';
    const MONITORING_PROXY_API = 'https://up-api.111312.xyz/';

    // --- 全局变量和状态 ---
    let monitorDataCache = [];
    let notificationsLoaded = false;
    // === 新增：为 NAS 图表声明变量 ===
    let nasCpuHistoryChart, nasNetworkHistoryChart;

    // --- [基础功能和选项卡逻辑保持不变] ---
    // ... (省略 updateTime, updateWeather, countSites, handleTabs 函数) ...
    
    // --- [我的通知功能保持不变] ---
    // ... (省略 showNotificationStatus, fetchNotifications 函数) ...

    // --- 4. 服务监控功能 (来自 index(2).html) ---
    const STATUS_MAP = {
        0: { text: '暂停中', class: 'status-warning', icon: 'fa-pause-circle' },
        1: { text: '未检查', class: 'status-warning', icon: 'fa-question-circle' },
        2: { text: '运行中', class: 'status-up', icon: 'fa-check-circle' },
        8: { text: '疑似故障', class: 'status-warning', icon: 'fa-exclamation-circle' },
        9: { text: '服务中断', class: 'status-down', icon: 'fa-times-circle' },
    };

    // === 修改：renderMonitoringPage 函数 ===
    function renderMonitoringPage(data) {
        if (!data) {
            showMonitoringError("未能从API获取到任何数据。");
            return;
        }
        
        const container = document.getElementById('monitoring-container');
        const nasSection = document.getElementById('nas-section-container');
        
        // --- 新增：处理 NAS 数据 ---
        if (data.nas_stats || data.nas_history) {
            nasSection.style.display = 'block';
            if (data.nas_stats) renderNasProgressBars(data.nas_stats);
            if (data.nas_history) renderNasHistoryCharts(data.nas_history);
        } else {
            nasSection.style.display = 'none';
        }

        // --- 处理 UptimeRobot 数据 ---
        if (data.monitors) {
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
            
            // 动态创建并追加 UptimeRobot 容器
            let uptimeContainer = document.getElementById('uptime-robot-container');
            if (!uptimeContainer) {
                uptimeContainer = document.createElement('div');
                uptimeContainer.id = 'uptime-robot-container';
                container.appendChild(uptimeContainer);
            }

            uptimeContainer.innerHTML = `
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

        } else if (!data.nas_stats && !data.nas_history) { // 如果 UptimeRobot 数据也没有
             showMonitoringError("没有找到任何网站监控服务。");
        }
    }

    // === 新增：渲染 NAS 进度条的函数 ===
    function renderNasProgressBars(stats) {
        document.getElementById('nas-boot-time').textContent = stats.system_time?.boot_time || 'N/A';
        document.getElementById('nas-uptime').textContent = stats.system_time?.uptime || 'N/A';
        const container = document.getElementById('nas-realtime-stats');
        let html = '';
        const items = [
            { icon: 'fa-microchip', label: 'CPU', data: stats.cpu },
            { icon: 'fa-memory', label: '内存', data: stats.memory },
            { icon: 'fa-compact-disc', label: '磁盘', data: stats.disk }
        ];
        items.forEach(item => {
            if (item.data) {
                 html += `<div class="nas-info-card">
                    <div class="progress-bar-info" style="width:100%"><span class="progress-bar-label"><i class="fas ${item.icon}"></i> ${item.label}</span><span>${item.data.percent}%</span></div>
                    <div class="progress-bar-bg" style="width:100%"><div class="progress-bar-fill" style="width: ${item.data.percent}%;"></div></div>
                 </div>`;
            }
        });
        container.innerHTML = html;
    }

    // === 新增：渲染 NAS 历史图表的函数 ===
    function renderNasHistoryCharts(history) {
        if (nasCpuHistoryChart) nasCpuHistoryChart.destroy();
        if (nasNetworkHistoryChart) nasNetworkHistoryChart.destroy();

        const cpuCtx = document.getElementById('nasCpuHistoryChart')?.getContext('2d');
        if (cpuCtx && history.cpu && history.cpu.length > 0) {
            nasCpuHistoryChart = new Chart(cpuCtx, { type: 'line', data: { datasets: [{ label: 'CPU Usage (%)', data: history.cpu.map(d => ({x: d.timestamp * 1000, y: d.usage})), borderColor: 'rgba(30, 136, 229, 0.7)', backgroundColor: 'rgba(30, 136, 229, 0.1)', borderWidth: 2, pointRadius: 0, tension: 0.4, fill: true }] }, options: { responsive: true, maintainAspectRatio: false, scales: { x: { type: 'time', time: { unit: 'day', tooltipFormat: 'yyyy-MM-dd HH:mm' } }, y: { beginAtZero: true, max: 100 } }, plugins: { legend: { display: false } } } });
        }

        const netCtx = document.getElementById('nasNetworkHistoryChart')?.getContext('2d');
        if (netCtx && history.network && history.network.length > 0) {
            const datasets = [
                { iface: 'eth0', recv: 'eth0_recv', sent: 'eth0_sent', color: 'rgba(76, 175, 80, 0.7)'},
                { iface: 'wlan0', recv: 'wlan0_recv', sent: 'wlan0_sent', color: 'rgba(255, 152, 0, 0.7)'},
                { iface: 'docker0', recv: 'docker0_recv', sent: 'docker0_sent', color: 'rgba(156, 39, 176, 0.7)'}
            ].map(config => ({
                label: `${config.iface} 总流量`,
                data: history.network.map(d => ({ x: d.timestamp * 1000, y: ((d[config.recv] || 0) + (d[config.sent] || 0)) / 1024**3 })),
                borderColor: config.color, borderWidth: 2, pointRadius: 0, tension: 0.4, fill: false
            })).filter(ds => ds.data.some(d => d.y > 0)); // Only show interfaces with data
            
            nasNetworkHistoryChart = new Chart(netCtx, { type: 'line', data: { datasets: datasets }, options: { responsive: true, maintainAspectRatio: false, scales: { x: { type: 'time', time: { unit: 'day', tooltipFormat: 'yyyy-MM-dd' } }, y: { beginAtZero: true, title: { display: true, text: 'GB' } } }, plugins: { legend: { position: 'bottom' } } } });
        }
    }

    // --- [其他监控函数和初始化逻辑保持不变] ---
    // ... (省略 toggleDetailChart, createDetailChart, renderOverviewCharts, fetchMonitoringData, showMonitoringError, initMonitoring, initialize) ...

});
