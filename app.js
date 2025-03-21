document.addEventListener('DOMContentLoaded', async () => {
    const serversContainer = document.getElementById('servers-container');
    let servers = {};
    
    // 用于存储历史数据的对象
    const historyData = {
        memory: {},
        sessions: {},
        timestamps: []
    };
    
    // 从localStorage加载历史数据
    loadHistoryFromLocalStorage();
    
    // 存储图表对象的变量
    let memoryChart = null;
    let sessionsChart = null;
    
    // 当前选择的时间范围（默认为"1h"，表示1小时）
    let selectedTimeRange = "1h";
    
    try {
        // 获取服务器配置
        const response = await fetch('servers.json');
        if (!response.ok) {
            throw new Error('无法加载服务器配置');
        }
        
        servers = await response.json();
        renderServerCards(servers);
        
        // 尝试从服务器加载历史数据
        await loadHistoryFromServer();
        
        // 初始化图表
        initCharts(Object.keys(servers));
        
        // 监听窗口大小变化，调整图表布局
        window.addEventListener('resize', adjustChartsLayout);
        
        // 初始调整一次图表布局
        adjustChartsLayout();
        
        // 初始化时间范围选择器
        initTimeRangeSelector();
        
        // 根据当前选择的时间范围更新图表
        updateChartsWithTimeRange();
        
        // 首次检查服务器状态
        const initialData = await checkAllServers(servers);
        updateCharts(initialData);
        
        // 每30秒检查一次服务器状态
        setInterval(async () => {
            const data = await checkAllServers(servers);
            updateCharts(data);
        }, 30000);
        
        // 添加刷新按钮事件
        const refreshBtn = document.getElementById('refresh-btn');
        refreshBtn.addEventListener('click', async () => {
            refreshBtn.textContent = '刷新中...';
            refreshBtn.disabled = true;
            
            // 刷新时也重新加载历史数据
            await loadHistoryFromServer();
            updateChartsWithTimeRange();
            
            const data = await checkAllServers(servers);
            updateCharts(data);
            
            setTimeout(() => {
                refreshBtn.textContent = '刷新';
                refreshBtn.disabled = false;
            }, 1000);
        });
        
        // 添加清除历史数据按钮事件
        const clearStorageBtn = document.getElementById('clear-storage');
        clearStorageBtn.addEventListener('click', async () => {
            if (confirm('确定要清除所有历史数据吗？这将删除所有保存的监控记录。')) {
                try {
                    // 调用服务器API清除历史数据
                    const response = await fetch('/api/history', {
                        method: 'DELETE'
                    });
                    
                    if (response.ok) {
                        // 重置内存中的数据结构
                        historyData.timestamps = [];
                        Object.keys(historyData.memory).forEach(server => {
                            historyData.memory[server] = [];
                        });
                        Object.keys(historyData.sessions).forEach(server => {
                            historyData.sessions[server] = [];
                        });
                        
                        // 清除localStorage中的数据
                        localStorage.removeItem('serverMonitorHistory');
                        
                        // 更新图表
                        updateChartsWithTimeRange();
                        
                        // 更新存储状态
                        updateStorageStatus(true);
                    } else {
                        throw new Error('服务器返回错误');
                    }
                } catch (error) {
                    console.error('清除历史数据失败:', error);
                    alert(`清除历史数据失败: ${error.message}`);
                    
                    // 本地清除
                    localStorage.removeItem('serverMonitorHistory');
                    historyData.timestamps = [];
                    Object.keys(historyData.memory).forEach(server => {
                        historyData.memory[server] = [];
                    });
                    Object.keys(historyData.sessions).forEach(server => {
                        historyData.sessions[server] = [];
                    });
                    updateChartsWithTimeRange();
                    updateStorageStatus(true);
                }
            }
        });
        
        // 显示存储状态
        updateStorageStatus();
        
    } catch (error) {
        console.error('加载服务器信息失败:', error);
        serversContainer.innerHTML = `<div class="error">加载服务器信息失败: ${error.message}</div>`;
    }
    
    // 尝试从服务器加载历史数据
    async function loadHistoryFromServer() {
        try {
            const response = await fetch('/api/history');
            if (!response.ok) {
                throw new Error('获取历史数据失败');
            }
            
            const serverHistoryData = await response.json();
            
            // 处理时间戳数据
            if (serverHistoryData.timestamps && serverHistoryData.timestamps.length > 0) {
                // 将字符串日期转换为Date对象
                historyData.timestamps = serverHistoryData.timestamps.map(ts => new Date(ts));
                
                // 合并内存使用数据
                if (serverHistoryData.memory) {
                    Object.keys(serverHistoryData.memory).forEach(server => {
                        if (!historyData.memory[server]) {
                            historyData.memory[server] = [];
                        }
                        
                        historyData.memory[server] = serverHistoryData.memory[server].map(item => ({
                            x: new Date(item.x),
                            y: item.y
                        }));
                    });
                }
                
                // 合并会话数据
                if (serverHistoryData.sessions) {
                    Object.keys(serverHistoryData.sessions).forEach(server => {
                        if (!historyData.sessions[server]) {
                            historyData.sessions[server] = [];
                        }
                        
                        historyData.sessions[server] = serverHistoryData.sessions[server].map(item => ({
                            x: new Date(item.x),
                            y: item.y
                        }));
                    });
                }
                
                console.log(`从服务器加载了 ${historyData.timestamps.length} 个历史数据点`);
                
                // 更新存储状态信息
                updateStorageStatus();
                return true;
            }
            
            return false;
        } catch (error) {
            console.warn('从服务器加载历史数据失败，将使用本地存储:', error);
            return false;
        }
    }
    
    // 初始化时间范围选择器
    function initTimeRangeSelector() {
        const timeRangeSelector = document.getElementById('time-range-selector');
        timeRangeSelector.addEventListener('change', (e) => {
            selectedTimeRange = e.target.value;
            updateChartsWithTimeRange();
        });
    }
    
    // 从localStorage加载历史数据
    function loadHistoryFromLocalStorage() {
        try {
            const storedData = localStorage.getItem('serverMonitorHistory');
            if (storedData) {
                const parsedData = JSON.parse(storedData);
                
                // 将存储的字符串日期转换回Date对象
                if (parsedData.timestamps) {
                    parsedData.timestamps = parsedData.timestamps.map(ts => new Date(ts));
                    
                    // 转换内存和会话数据中的日期
                    Object.keys(parsedData.memory).forEach(server => {
                        parsedData.memory[server] = parsedData.memory[server].map(item => ({
                            x: new Date(item.x),
                            y: item.y
                        }));
                    });
                    
                    Object.keys(parsedData.sessions).forEach(server => {
                        parsedData.sessions[server] = parsedData.sessions[server].map(item => ({
                            x: new Date(item.x),
                            y: item.y
                        }));
                    });
                    
                    Object.assign(historyData, parsedData);
                }
            }
        } catch (error) {
            console.error('加载历史数据失败:', error);
            // 如果加载失败，使用空数据结构
        }
        
        // 更新存储状态
        updateStorageStatus();
    }
    
    // 将历史数据保存到localStorage
    function saveHistoryToLocalStorage() {
        try {
            localStorage.setItem('serverMonitorHistory', JSON.stringify(historyData));
            updateStorageStatus();
        } catch (error) {
            console.error('保存历史数据失败:', error);
            updateStorageStatus(false, error.message);
        }
    }
    
    // 根据当前选择的时间范围筛选数据并更新图表
    function updateChartsWithTimeRange() {
        if (!memoryChart || !sessionsChart) return;
        
        const now = new Date();
        let cutoffTime = new Date(now);
        
        // 根据选择的范围设置截止时间
        switch (selectedTimeRange) {
            case "1h":
                cutoffTime.setHours(now.getHours() - 1);
                break;
            case "3h":
                cutoffTime.setHours(now.getHours() - 3);
                break;
            case "12h":
                cutoffTime.setHours(now.getHours() - 12);
                break;
            case "1d":
                cutoffTime.setDate(now.getDate() - 1);
                break;
            case "7d":
                cutoffTime.setDate(now.getDate() - 7);
                break;
            case "all":
                // 使用所有数据
                cutoffTime = new Date(0); // 1970-01-01
                break;
            default:
                cutoffTime.setHours(now.getHours() - 1); // 默认1小时
        }
        
        // 筛选时间戳
        const filteredTimestamps = historyData.timestamps.filter(ts => ts >= cutoffTime);
        
        // 更新内存图表
        memoryChart.data.labels = filteredTimestamps;
        memoryChart.data.datasets.forEach((dataset) => {
            const serverName = dataset.label;
            if (historyData.memory[serverName]) {
                // 筛选该时间范围内的数据
                const filteredData = historyData.memory[serverName].filter(item => item.x >= cutoffTime);
                dataset.data = filteredData;
            }
        });
        memoryChart.update();
        
        // 更新会话图表
        sessionsChart.data.labels = filteredTimestamps;
        sessionsChart.data.datasets.forEach((dataset) => {
            const serverName = dataset.label;
            if (historyData.sessions[serverName]) {
                // 筛选该时间范围内的数据
                const filteredData = historyData.sessions[serverName].filter(item => item.x >= cutoffTime);
                dataset.data = filteredData;
            }
        });
        sessionsChart.update();
    }
    
    // 初始化图表
    function initCharts(serverNames) {
        // 设置不同服务器的颜色
        const colors = [
            'rgb(54, 162, 235)',
            'rgb(255, 99, 132)',
            'rgb(75, 192, 192)',
            'rgb(255, 159, 64)',
            'rgb(153, 102, 255)',
            'rgb(255, 205, 86)',
            'rgb(201, 203, 207)',
            'rgb(22, 160, 133)'
        ];
        
        // 为每个服务器分配颜色
        const datasets = serverNames.map((name, index) => {
            const colorIndex = index % colors.length;
            return {
                label: name,
                data: [],
                borderColor: colors[colorIndex],
                backgroundColor: colors[colorIndex] + '33', // 添加透明度
                fill: false,
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 2,
                pointHoverRadius: 4
            };
        });
        
        // 图表通用配置
        const chartConfig = {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 300
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'minute',
                        tooltipFormat: 'HH:mm:ss',
                        displayFormats: {
                            minute: 'HH:mm'
                        }
                    },
                    title: {
                        display: false
                    },
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 4,
                        font: {
                            size: 9
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: false
                    },
                    grid: {
                        borderDash: [2, 2],
                        drawBorder: false
                    },
                    ticks: {
                        precision: 0,
                        maxTicksLimit: 4,
                        font: {
                            size: 9
                        },
                        padding: 3
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        boxWidth: 10,
                        padding: 4,
                        font: {
                            size: 9
                        }
                    }
                }
            },
            layout: {
                padding: {
                    top: 2,
                    right: 5,
                    bottom: 2,
                    left: 5
                }
            }
        };
        
        // 内存使用图表
        const memoryCtx = document.getElementById('memoryChart').getContext('2d');
        memoryChart = new Chart(memoryCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: JSON.parse(JSON.stringify(datasets))
            },
            options: {
                ...JSON.parse(JSON.stringify(chartConfig)),
                scales: {
                    ...JSON.parse(JSON.stringify(chartConfig.scales)),
                    y: {
                        ...JSON.parse(JSON.stringify(chartConfig.scales.y)),
                        min: 0,
                        max: 100,
                        ticks: {
                            ...JSON.parse(JSON.stringify(chartConfig.scales.y.ticks)),
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                },
                plugins: {
                    ...JSON.parse(JSON.stringify(chartConfig.plugins)),
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}%`;
                            }
                        }
                    }
                }
            }
        });
        
        // 活跃会话图表
        const sessionsCtx = document.getElementById('sessionsChart').getContext('2d');
        sessionsChart = new Chart(sessionsCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: JSON.parse(JSON.stringify(datasets))
            },
            options: {
                ...JSON.parse(JSON.stringify(chartConfig)),
                plugins: {
                    ...JSON.parse(JSON.stringify(chartConfig.plugins)),
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y} 个会话`;
                            }
                        }
                    }
                }
            }
        });
        
        // 初始化历史数据结构
        serverNames.forEach(name => {
            if (!historyData.memory[name]) {
                historyData.memory[name] = [];
            }
            if (!historyData.sessions[name]) {
                historyData.sessions[name] = [];
            }
        });
        
        // 在图表初始化后调整一次布局
        setTimeout(() => {
            adjustChartsLayout();
            memoryChart.resize();
            sessionsChart.resize();
        }, 100);
    }
    
    // 更新图表数据
    function updateCharts(serversData) {
        if (!serversData || !serversData.length) return;
        
        const now = new Date();
        historyData.timestamps.push(now);
        
        // 最多保存1000个数据点，支持长时间历史数据
        if (historyData.timestamps.length > 1000) {
            historyData.timestamps.shift();
            Object.keys(historyData.memory).forEach(server => {
                if (historyData.memory[server].length > 1000) {
                    historyData.memory[server].shift();
                }
                if (historyData.sessions[server].length > 1000) {
                    historyData.sessions[server].shift();
                }
            });
        }
        
        // 更新数据
        serversData.forEach(serverData => {
            const { serverName, data, status } = serverData;
            
            if (status === 'online' && data) {
                // 添加内存数据 - 使用百分比而非MB
                if (data.system && typeof data.system.memory_percent === 'number') {
                    historyData.memory[serverName].push({
                        x: now,
                        y: data.system.memory_percent
                    });
                }
                
                // 添加会话数据
                if (data.sessions && typeof data.sessions.active === 'number') {
                    historyData.sessions[serverName].push({
                        x: now,
                        y: data.sessions.active
                    });
                }
            } else {
                // 如果服务器离线，添加null值
                historyData.memory[serverName].push({
                    x: now,
                    y: null
                });
                historyData.sessions[serverName].push({
                    x: now,
                    y: null
                });
            }
        });
        
        // 保存历史数据到localStorage
        saveHistoryToLocalStorage();
        
        // 根据当前选择的时间范围更新图表
        updateChartsWithTimeRange();
    }
    
    // 更新存储状态显示
    function updateStorageStatus(cleared = false, errorMsg = null) {
        const storageStatus = document.getElementById('storage-status');
        
        if (errorMsg) {
            storageStatus.textContent = `数据保存失败: ${errorMsg}`;
            storageStatus.style.color = '#e74c3c';
            return;
        }
        
        if (cleared) {
            storageStatus.textContent = '历史数据已清除';
            storageStatus.style.color = '#e67e22';
            return;
        }
        
        try {
            const localStorageSize = new Blob([localStorage.getItem('serverMonitorHistory') || '']).size;
            const localSizeMB = (localStorageSize / (1024 * 1024)).toFixed(2);
            
            const dataPoints = historyData.timestamps.length;
            let timeRangeText = '无数据';
            
            if (dataPoints > 0) {
                const oldestDate = new Date(historyData.timestamps[0]);
                const newestDate = new Date(historyData.timestamps[dataPoints-1]);
                
                // 计算数据覆盖的时间范围
                const diffTime = Math.abs(newestDate - oldestDate);
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const diffMinutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));
                
                if (diffDays > 0) {
                    timeRangeText = `${diffDays}天${diffHours}小时`;
                } else if (diffHours > 0) {
                    timeRangeText = `${diffHours}小时${diffMinutes}分钟`;
                } else {
                    timeRangeText = `${diffMinutes}分钟`;
                }
            }
            
            // 显示数据采集信息
            storageStatus.innerHTML = `
                <span>服务器采集: <strong>${dataPoints}</strong> 个数据点</span>
                <span>时间跨度: <strong>${timeRangeText}</strong></span>
                <span>本地存储大小: <strong>${localSizeMB} MB</strong></span>
            `;
            storageStatus.style.color = '#2ecc71';
        } catch (e) {
            storageStatus.textContent = '数据已保存，无法计算大小';
            storageStatus.style.color = '#2ecc71';
        }
    }
    
    // 调整图表布局
    function adjustChartsLayout() {
        const chartWrappers = document.querySelectorAll('.chart-wrapper');
        
        if (window.innerWidth < 768) {
            // 在小屏幕上强制垂直布局
            chartWrappers.forEach(wrapper => {
                wrapper.style.flex = '1 1 100%';
                wrapper.style.maxWidth = '100%';
            });
        } else {
            // 在大屏幕上允许水平布局
            chartWrappers.forEach(wrapper => {
                if (wrapper.classList.contains('full-width')) {
                    wrapper.style.flex = '1 1 100%';
                    wrapper.style.maxWidth = '100%';
                } else {
                    wrapper.style.flex = '1 1 300px';
                    wrapper.style.maxWidth = '';
                }
            });
        }
        
        // 如果图表已经初始化，则重新调整大小
        if (memoryChart && sessionsChart) {
            setTimeout(() => {
                memoryChart.resize();
                sessionsChart.resize();
            }, 50);
        }
    }
});

function renderServerCards(servers) {
    const serversContainer = document.getElementById('servers-container');
    serversContainer.innerHTML = '';
    
    Object.entries(servers).forEach(([name, url]) => {
        // 从服务器健康检查URL提取主机和端口，用于构建跳转链接
        let serverLink = '';
        try {
            const urlObj = new URL(url);
            // 构建 host:port/index.html 形式的链接
            serverLink = `${urlObj.protocol}//${urlObj.hostname}:${urlObj.port}/index.html`;
        } catch (e) {
            console.error("无法解析服务器URL:", e);
            // 如果解析失败，直接使用原URL的host部分
            serverLink = url.replace('/health', '/index.html');
        }
        
        const card = document.createElement('div');
        card.className = 'server-card';
        card.id = `server-${name}`;
        
        card.innerHTML = `
            <div class="server-header">
                <div class="server-name">${name}</div>
                <a href="${serverLink}" target="_blank" class="server-link" title="访问服务器管理页面">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                </a>
            </div>
            <div class="server-url">${url}</div>
            <div class="status">
                <div class="status-indicator checking"></div>
                <span class="status-text">检查中...</span>
            </div>
            <div class="server-details">
                <div class="details-section">
                    <h3>系统信息</h3>
                    <div class="details-grid">
                        <div class="detail-item">
                            <span class="detail-label">CPU:</span>
                            <span class="detail-value" id="${name}-cpu">-</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">内存:</span>
                            <span class="detail-value" id="${name}-memory">-</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">线程数:</span>
                            <span class="detail-value" id="${name}-threads">-</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">运行时间:</span>
                            <span class="detail-value" id="${name}-uptime">-</span>
                        </div>
                    </div>
                </div>
                <div class="details-section">
                    <h3>请求信息</h3>
                    <div class="details-grid">
                        <div class="detail-item">
                            <span class="detail-label">总请求数:</span>
                            <span class="detail-value" id="${name}-requests">-</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">最后请求:</span>
                            <span class="detail-value" id="${name}-last-request">-</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">活跃会话:</span>
                            <span class="detail-value" id="${name}-sessions">-</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">最大会话数:</span>
                            <span class="detail-value" id="${name}-max-sessions">-</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="last-checked" style="font-size: 0.8rem; margin-top: 10px; color: #95a5a6;"></div>
        `;
        
        serversContainer.appendChild(card);
    });
}

async function checkAllServers(servers) {
    const promises = Object.entries(servers).map(([name, url]) => {
        return checkServerStatus(name, url);
    });
    
    return Promise.all(promises);
}

async function checkServerStatus(serverName, serverUrl) {
    const serverCard = document.getElementById(`server-${serverName}`);
    const statusIndicator = serverCard.querySelector('.status-indicator');
    const statusText = serverCard.querySelector('.status-text');
    const lastCheckedElement = serverCard.querySelector('.last-checked');
    
    // 设置为检查中状态
    statusIndicator.className = 'status-indicator checking';
    statusText.textContent = '检查中...';
    
    try {
        // 使用代理API解决CORS问题
        const proxyUrl = `/check?url=${encodeURIComponent(serverUrl)}`;
        
        const response = await fetchWithTimeout(proxyUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            },
            timeout: 5000
        });
        
        const data = await response.json();
        
        if (data.online) {
            statusIndicator.className = 'status-indicator online';
            statusText.textContent = '在线';
            
            // 更新服务器详细信息
            updateServerDetails(serverName, data.data);
        } else {
            statusIndicator.className = 'status-indicator offline';
            statusText.textContent = '离线';
            clearServerDetails(serverName);
        }
        
        // 更新最后检查时间
        const now = new Date();
        lastCheckedElement.textContent = `最后检查: ${now.toLocaleTimeString()}`;
        
        return { serverName, status: data.online ? 'online' : 'offline', data: data.data };
    } catch (error) {
        console.error(`检查服务器 ${serverName} 状态失败:`, error);
        statusIndicator.className = 'status-indicator offline';
        statusText.textContent = '离线 (检查失败)';
        
        // 清空服务器详细信息
        clearServerDetails(serverName);
        
        // 更新最后检查时间
        const now = new Date();
        lastCheckedElement.textContent = `最后检查: ${now.toLocaleTimeString()} - 失败: ${error.message}`;
        
        return { serverName, status: 'error', error: error.message };
    }
}

function updateServerDetails(serverName, data) {
    if (!data) return;
    
    // 更新系统信息
    if (data.system) {
        document.getElementById(`${serverName}-cpu`).textContent = `${data.system.cpu_percent.toFixed(1)}%`;
        document.getElementById(`${serverName}-memory`).textContent = `${data.system.memory_usage_mb.toFixed(0)} MB (${data.system.memory_percent.toFixed(1)}%)`;
        document.getElementById(`${serverName}-threads`).textContent = data.system.threads_count;
    }
    
    // 更新运行时间
    if (data.uptime_seconds) {
        const uptime = formatUptime(data.uptime_seconds);
        document.getElementById(`${serverName}-uptime`).textContent = uptime;
    }
    
    // 更新请求信息
    if (data.requests) {
        document.getElementById(`${serverName}-requests`).textContent = data.requests.total;
        document.getElementById(`${serverName}-last-request`).textContent = data.requests.last_request || '-';
    }
    
    // 更新会话信息
    if (data.sessions) {
        document.getElementById(`${serverName}-sessions`).textContent = data.sessions.active;
        document.getElementById(`${serverName}-max-sessions`).textContent = data.sessions.max;
    }
}

function clearServerDetails(serverName) {
    // 清空系统信息
    document.getElementById(`${serverName}-cpu`).textContent = '-';
    document.getElementById(`${serverName}-memory`).textContent = '-';
    document.getElementById(`${serverName}-threads`).textContent = '-';
    document.getElementById(`${serverName}-uptime`).textContent = '-';
    
    // 清空请求信息
    document.getElementById(`${serverName}-requests`).textContent = '-';
    document.getElementById(`${serverName}-last-request`).textContent = '-';
    
    // 清空会话信息
    document.getElementById(`${serverName}-sessions`).textContent = '-';
    document.getElementById(`${serverName}-max-sessions`).textContent = '-';
}

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    let result = '';
    
    if (days > 0) {
        result += `${days}天 `;
    }
    
    if (hours > 0 || days > 0) {
        result += `${hours}小时 `;
    }
    
    if (minutes > 0 || hours > 0 || days > 0) {
        result += `${minutes}分钟 `;
    }
    
    result += `${remainingSeconds}秒`;
    
    return result;
}

// 添加超时功能给fetch
function fetchWithTimeout(url, options = {}) {
    const { timeout = 5000 } = options;
    
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error('请求超时')), timeout)
        )
    ]);
} 