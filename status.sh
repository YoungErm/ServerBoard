#!/bin/bash

# 查找服务进程
PID=$(pgrep -f "node server.js")

if [ -z "$PID" ]; then
    echo "状态: 未运行"
    exit 1
fi

echo "状态: 运行中"
echo "PID: $PID"
echo "运行时间: $(ps -o etime= -p $PID)"
echo "内存使用: $(ps -o %mem= -p $PID)%"
echo "CPU使用: $(ps -o %cpu= -p $PID)%"

# 显示最新的10行日志
echo -e "\n最新日志:"
tail -n 10 logs/server.log 