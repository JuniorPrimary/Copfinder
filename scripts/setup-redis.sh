#!/bin/bash
# Скрипт для установки и настройки Redis на сервере

set -e

echo "🔧 Установка и настройка Redis..."

# Определяем тип системы
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
elif [ -f /etc/redhat-release ]; then
    OS="rhel"
else
    OS="unknown"
fi

echo "🔍 Обнаружена система: $OS"

# Установка Redis
if [[ "$OS" == "amzn" ]] || [[ "$OS" == "rhel" ]] || [[ "$OS" == "centos" ]]; then
    # Amazon Linux / RHEL / CentOS
    echo "📦 Установка Redis для Amazon Linux/RHEL/CentOS..."
    sudo yum install -y redis6 || sudo yum install -y redis
    
    # Настройка Redis
    REDIS_CONF="/etc/redis.conf"
    if [ ! -f "$REDIS_CONF" ]; then
        REDIS_CONF="/etc/redis/redis.conf"
    fi
    
elif [[ "$OS" == "ubuntu" ]] || [[ "$OS" == "debian" ]]; then
    # Ubuntu / Debian
    echo "📦 Установка Redis для Ubuntu/Debian..."
    sudo apt-get update
    sudo apt-get install -y redis-server
    
    # Настройка Redis
    REDIS_CONF="/etc/redis/redis.conf"
    
else
    echo "⚠️  Неизвестная система. Пожалуйста, установите Redis вручную."
    exit 1
fi

# Настройка персистентности (RDB/AOF)
if [ -f "$REDIS_CONF" ]; then
    echo "⚙️  Настройка персистентности Redis..."
    
    # Резервная копия конфига
    sudo cp "$REDIS_CONF" "${REDIS_CONF}.backup"
    
    # Настройка RDB
    sudo sed -i 's/^# save /save /g' "$REDIS_CONF" 2>/dev/null || true
    sudo sed -i 's/^save 900 1/save 900 1/' "$REDIS_CONF" 2>/dev/null || true
    sudo sed -i 's/^save 300 10/save 300 10/' "$REDIS_CONF" 2>/dev/null || true
    sudo sed -i 's/^save 60 10000/save 60 10000/' "$REDIS_CONF" 2>/dev/null || true
    
    # Включение AOF
    sudo sed -i 's/^appendonly no/appendonly yes/' "$REDIS_CONF" 2>/dev/null || true
    sudo sed -i 's/^# appendonly yes/appendonly yes/' "$REDIS_CONF" 2>/dev/null || true
    sudo sed -i 's/^appendfsync everysec/appendfsync everysec/' "$REDIS_CONF" 2>/dev/null || true
    
    echo "✅ Конфигурация Redis обновлена"
else
    echo "⚠️  Файл конфигурации Redis не найден: $REDIS_CONF"
fi

# Запуск Redis
echo "🚀 Запуск Redis..."
if [[ "$OS" == "amzn" ]] || [[ "$OS" == "rhel" ]] || [[ "$OS" == "centos" ]]; then
    sudo systemctl start redis
    sudo systemctl enable redis
elif [[ "$OS" == "ubuntu" ]] || [[ "$OS" == "debian" ]]; then
    sudo systemctl start redis-server
    sudo systemctl enable redis-server
fi

# Проверка работы
echo "🔍 Проверка работы Redis..."
sleep 2
if redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis успешно установлен и запущен!"
    echo "📊 Статус:"
    redis-cli INFO server | grep redis_version || true
else
    echo "❌ Ошибка: Redis не отвечает на запросы"
    exit 1
fi

echo "✅ Установка Redis завершена!"
echo ""
echo "📝 Следующие шаги:"
echo "1. Добавьте настройки Redis в файл .env:"
echo "   REDIS_HOST=localhost"
echo "   REDIS_PORT=6379"
echo "   REDIS_PASSWORD="
echo "   REDIS_DB=0"
echo "   REDIS_TTL_DAYS=7"
echo ""
echo "2. Перезапустите приложение: pm2 restart ecosystem.config.cjs"

