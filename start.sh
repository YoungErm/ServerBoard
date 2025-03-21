#!/bin/bash

# 创建日志目录
mkdir -p logs

# 检查是否已有进程在运行
PID=$(pgrep -f "node server.js")
if [ ! -z "$PID" ]; then
    echo "服务已在运行，PID: $PID"
    echo "如需重启，请先运行 ./stop.sh"
    exit 1
fi

# 启动服务并将输出重定向到日志文件
nohup node server.js > logs/server.log 2>&1 &
NEW_PID=$!

# 等待1秒检查进程是否存在
sleep 1
if ps -p $NEW_PID > /dev/null; then
    echo "服务已成功启动，PID: $NEW_PID"
    echo "可通过 http://$(hostname -I | awk '{print $1}') 访问"
    echo "日志文件: logs/server.log"
    echo "$(date): 服务启动，PID: $NEW_PID" >> logs/service.log
else
    echo "服务启动失败，请检查日志文件 logs/server.log"
    exit 1
fi 