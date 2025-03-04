#!/bin/bash

# 服务器部署脚本
# 使用方法: ./deploy.sh [环境]
# 例如: ./deploy.sh prod

# 设置错误时退出
set -e

# 获取当前目录
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# 环境参数
ENV=${1:-prod}
COMPOSE_FILE="docker-compose.${ENV}.yml"

# 检查docker-compose文件是否存在
if [ ! -f "$COMPOSE_FILE" ]; then
  echo "错误: $COMPOSE_FILE 不存在!"
  exit 1
fi

# 创建必要的目录
mkdir -p logs backups ssl

# 如果不存在SSL证书，创建自签名证书（仅用于测试）
if [ ! -f "ssl/cert.pem" ] || [ ! -f "ssl/key.pem" ]; then
  echo "生成自签名SSL证书 (仅用于测试环境，生产环境请使用正规证书)"
  mkdir -p ssl
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout ssl/key.pem -out ssl/cert.pem \
    -subj "/C=CN/ST=Beijing/L=Beijing/O=Excel Viewer/CN=localhost"
fi

# 拉取最新代码（如果是使用git管理）
# git pull origin main

# 构建并启动Docker容器
echo "开始部署应用 (环境: $ENV)..."
docker-compose -f "$COMPOSE_FILE" build
docker-compose -f "$COMPOSE_FILE" up -d

# 显示容器状态
echo "容器状态:"
docker-compose -f "$COMPOSE_FILE" ps

echo "部署完成!"
echo "前端访问: https://localhost (或您的域名)"
echo "后端API: https://localhost/api (或您的域名/api)"
echo ""
echo "日志检查: docker-compose -f $COMPOSE_FILE logs -f" 