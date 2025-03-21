const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 80;

// 保存服务器状态历史数据的文件路径
const DATA_DIR = path.join(__dirname, 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'server_history.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 历史数据结构
let historyData = {
    memory: {},
    sessions: {},
    timestamps: []
};

// 加载历史数据
loadHistoryData();

// 定义最大保留数据点数量
const MAX_DATA_POINTS = 1440; // 存储24小时的数据 (假设每分钟采集一次)

// 提供静态文件
app.use(express.static(path.join(__dirname, '.')));

// 健康检查代理API
app.get('/check', async (req, res) => {
    const url = req.query.url;
    
    if (!url) {
        return res.status(400).json({ error: '缺少URL参数' });
    }
    
    try {
        const response = await axios.get(url, {
            timeout: 5000,
            validateStatus: null // 不抛出HTTP错误
        });
        
        let responseData = response.data;
        let isValidJson = false;
        
        // 如果响应是字符串形式的JSON，尝试解析它
        if (typeof responseData === 'string') {
            try {
                responseData = JSON.parse(responseData);
                isValidJson = true;
            } catch (e) {
                console.warn('无法解析响应为JSON:', e.message);
                isValidJson = false;
            }
        } else if (typeof responseData === 'object') {
            isValidJson = true;
        }
        
        res.status(200).json({
            status: response.status,
            online: response.status >= 200 && response.status < 300,
            data: responseData,
            isValidJson
        });
    } catch (error) {
        console.error(`检查服务器 ${url} 失败:`, error.message);
        res.status(200).json({
            status: 'error',
            online: false,
            error: error.message
        });
    }
});

// 获取服务器历史数据的API
app.get('/api/history', (req, res) => {
    res.json(historyData);
});

// 清除历史数据的API
app.delete('/api/history', (req, res) => {
    historyData = {
        memory: {},
        sessions: {},
        timestamps: []
    };
    
    saveHistoryData();
    res.json({ success: true, message: '历史数据已清除' });
});

// 提供服务器配置
app.get('/servers.json', (req, res) => {
    fs.readFile(path.join(__dirname, 'servers.json'), 'utf8', (err, data) => {
        if (err) {
            console.error('读取servers.json失败:', err);
            return res.status(500).json({ error: '无法读取服务器配置' });
        }
        
        res.setHeader('Content-Type', 'application/json');
        res.send(data);
    });
});

// 默认路由提供主页
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 启动服务器
const server = app.listen(PORT, () => {
    console.log(`服务器状态监控运行在 http://localhost:${PORT}`);
    
    // 启动定时采集数据任务
    startDataCollection();
});

// 定时采集数据
async function startDataCollection() {
    try {
        // 读取服务器配置
        const serversConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'servers.json'), 'utf8'));
        
        // 初始化历史数据结构
        Object.keys(serversConfig).forEach(serverName => {
            if (!historyData.memory[serverName]) {
                historyData.memory[serverName] = [];
            }
            if (!historyData.sessions[serverName]) {
                historyData.sessions[serverName] = [];
            }
        });
        
        console.log('开始定时采集服务器状态数据');
        
        // 每分钟采集一次数据
        setInterval(async () => {
            await collectServerData(serversConfig);
        }, 60000); // 60秒
        
        // 立即采集一次数据
        await collectServerData(serversConfig);
        
    } catch (error) {
        console.error('启动数据采集任务失败:', error);
    }
}

// 采集服务器数据
async function collectServerData(serversConfig) {
    try {
        const now = new Date();
        historyData.timestamps.push(now.toISOString());
        
        // 限制时间戳数组大小
        if (historyData.timestamps.length > MAX_DATA_POINTS) {
            historyData.timestamps = historyData.timestamps.slice(-MAX_DATA_POINTS);
        }
        
        // 采集每个服务器的数据
        for (const [serverName, serverUrl] of Object.entries(serversConfig)) {
            try {
                const response = await axios.get(serverUrl, {
                    timeout: 5000,
                    validateStatus: null
                });
                
                let serverData = response.data;
                if (typeof serverData === 'string') {
                    try {
                        serverData = JSON.parse(serverData);
                    } catch (e) {
                        console.warn(`无法解析服务器 ${serverName} 的响应为JSON:`, e.message);
                        continue;
                    }
                }
                
                // 记录内存使用百分比
                if (serverData.system && typeof serverData.system.memory_percent === 'number') {
                    historyData.memory[serverName].push({
                        x: now.toISOString(),
                        y: serverData.system.memory_percent
                    });
                    
                    // 限制数据点数量
                    if (historyData.memory[serverName].length > MAX_DATA_POINTS) {
                        historyData.memory[serverName] = historyData.memory[serverName].slice(-MAX_DATA_POINTS);
                    }
                }
                
                // 记录活跃会话数
                if (serverData.sessions && typeof serverData.sessions.active === 'number') {
                    historyData.sessions[serverName].push({
                        x: now.toISOString(),
                        y: serverData.sessions.active
                    });
                    
                    // 限制数据点数量
                    if (historyData.sessions[serverName].length > MAX_DATA_POINTS) {
                        historyData.sessions[serverName] = historyData.sessions[serverName].slice(-MAX_DATA_POINTS);
                    }
                }
                
            } catch (error) {
                console.error(`采集服务器 ${serverName} 数据失败:`, error.message);
                
                // 记录空数据点，表示服务器不可达
                historyData.memory[serverName].push({
                    x: now.toISOString(),
                    y: null
                });
                historyData.sessions[serverName].push({
                    x: now.toISOString(),
                    y: null
                });
                
                // 限制数据点数量
                if (historyData.memory[serverName].length > MAX_DATA_POINTS) {
                    historyData.memory[serverName] = historyData.memory[serverName].slice(-MAX_DATA_POINTS);
                }
                if (historyData.sessions[serverName].length > MAX_DATA_POINTS) {
                    historyData.sessions[serverName] = historyData.sessions[serverName].slice(-MAX_DATA_POINTS);
                }
            }
        }
        
        // 保存历史数据到文件
        saveHistoryData();
        
        console.log(`${new Date().toISOString()} - 已采集服务器状态数据`);
    } catch (error) {
        console.error('采集服务器数据失败:', error);
    }
}

// 保存历史数据到文件
function saveHistoryData() {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(historyData), 'utf8');
    } catch (error) {
        console.error('保存历史数据失败:', error);
    }
}

// 从文件加载历史数据
function loadHistoryData() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = fs.readFileSync(HISTORY_FILE, 'utf8');
            historyData = JSON.parse(data);
            console.log(`已加载历史数据: ${historyData.timestamps.length} 个数据点`);
        }
    } catch (error) {
        console.error('加载历史数据失败:', error);
    }
} 