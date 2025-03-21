#!/bin/bash

echo "正在重启服务..."

# 先停止服务
./stop.sh

# 等待1秒
sleep 1

# 启动服务
./start.sh 