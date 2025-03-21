#!/bin/bash

# 查找运行中的服务进程
PID=$(pgrep -f "node server.js")

if [ -z "$PID" ]; then
    echo "没有发现运行中的服务进程"
    exit 0
fi

echo "正在停止服务，PID: $PID"

# 尝试正常终止进程
kill $PID

# 等待5秒
echo "等待进程终止..."
sleep 5

# 检查进程是否仍然存在
if ps -p $PID > /dev/null; then
    echo "进程未能正常终止，强制停止..."
    kill -9 $PID
    sleep 1
fi

# 再次检查
if ps -p $PID > /dev/null; then
    echo "无法停止进程，请手动终止 PID: $PID"
    exit 1
else
    echo "服务已停止"
    echo "$(date): 服务停止，PID: $PID" >> logs/service.log
fi 