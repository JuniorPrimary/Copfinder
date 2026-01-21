#!/bin/bash
# Скрипт для быстрого обновления проекта на сервере

set -e

PUBLIC_IP="${AWS_PUBLIC_IP:-54.235.6.145}"
SSH_KEY="${AWS_SSH_KEY:-~/.ssh/copfinder-key.pem}"
SSH_USER="${AWS_SSH_USER:-ec2-user}"
APP_DIR="/opt/copfinder"

echo "🚀 Обновление Copfinder на сервере..."

# Создаем архив
echo "📦 Создание архива..."
COPYFILE_DISABLE=1 tar --exclude='node_modules' \
    --exclude='.git' \
    --exclude='logs' \
    --exclude='.pm2' \
    --exclude='artifacts' \
    --exclude='.DS_Store' \
    -czf /tmp/copfinder-update.tar.gz .

# Загружаем на сервер
echo "📤 Загрузка на сервер..."
scp -i "$SSH_KEY" /tmp/copfinder-update.tar.gz "$SSH_USER@$PUBLIC_IP:/tmp/"

# Обновляем на сервере
echo "🔄 Обновление на сервере..."
ssh -i "$SSH_KEY" "$SSH_USER@$PUBLIC_IP" << EOF
    set -e
    cd $APP_DIR
    
    # Распаковываем
    tar -xzf /tmp/copfinder-update.tar.gz
    rm /tmp/copfinder-update.tar.gz
    
    # Устанавливаем зависимости (если нужно)
    if [ -f package.json ]; then
        npm ci --only=production
    fi
    
    # Перезапускаем
    pm2 restart ecosystem.config.cjs
    pm2 save
    
    echo "✅ Обновление завершено!"
EOF

echo "✅ Готово! Проверьте логи: ssh -i $SSH_KEY $SSH_USER@$PUBLIC_IP 'cd $APP_DIR && pm2 logs'"

