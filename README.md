# 服务器状态监控系统

一个简单的前端应用，用于监控多个服务器的在线状态、内存使用和活跃会话数，并保存历史数据。

## 功能

- 显示服务器在线/离线状态
- 监控内存使用率和活跃会话数
- 自动每30秒刷新一次状态
- 保存并显示历史数据趋势图
- 支持不同时间范围的数据查看(1小时、3小时、12小时、1天、7天)
- 美观的用户界面

## 安装

1. 确保已安装 Node.js (建议使用 v14 或更高版本)
2. 克隆或下载此仓库
3. 在项目目录中运行以下命令安装依赖：

```bash
npm install
```

## 使用方法

1. 在 `servers.json` 文件中配置要监控的服务器：

```json
{
    "服务器名称1": "健康检查URL1",
    "服务器名称2": "健康检查URL2"
}
```

2. 启动服务器：

```bash
npm start
```

3. 在浏览器中访问 `http://localhost` 查看监控面板

## 生产环境部署

我们提供了几个管理脚本来方便地作为后台服务运行：

### 启动服务

```bash
./start.sh
```

服务将在后台启动，日志输出到 `logs/server.log`

### 停止服务

```bash
./stop.sh
```

### 重启服务

```bash
./restart.sh
```

### 查看服务状态

```bash
./status.sh
```

## 数据存储

- 所有历史数据存储在 `data/server_history.json` 文件中
- 服务器每分钟自动采集一次数据
- 默认保存最近1440个数据点（相当于24小时的数据）

### 数据格式示例

```json
{
  "status": "ok", 
  "timestamp": 1742568219.8343282, 
  "uptime_seconds": 3606.547018289566, 
  "system": {
    "cpu_percent": 0.0, 
    "memory_usage_mb": 42666.7421875, 
    "memory_percent": 22.319337414370093, 
    "threads_count": 185
  }, 
  "sessions": {
    "active": 0, 
    "max": 100
  }, 
  "requests": {
    "total": 769, 
    "last_request": "2025-03-21 14:43:39"
  }
}
```

## 开发

使用以下命令以开发模式启动服务器（文件变更时自动重启）：

```bash
npm run dev
``` 