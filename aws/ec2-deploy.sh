#!/bin/bash
# Скрипт для развертывания на AWS EC2

set -e

echo "🚀 Начало развертывания Copfinder на AWS EC2..."

# Проверяем наличие необходимых инструментов
command -v ssh >/dev/null 2>&1 || { echo "❌ SSH не установлен"; exit 1; }
# AWS CLI не обязателен, если указан IP напрямую через AWS_PUBLIC_IP

# Переменные (настройте под свои нужды)
INSTANCE_ID="${AWS_INSTANCE_ID}"
PUBLIC_IP="${AWS_PUBLIC_IP}"  # Можно указать напрямую, если нет прав AWS CLI
SSH_KEY="${AWS_SSH_KEY:-~/.ssh/copfinder-key.pem}"
SSH_USER="${AWS_SSH_USER:-ec2-user}"
APP_DIR="/opt/copfinder"

# Если IP не указан напрямую, пытаемся получить через AWS CLI
if [ -z "$PUBLIC_IP" ]; then
    if [ -z "$INSTANCE_ID" ]; then
        echo "❌ Установите переменную окружения AWS_INSTANCE_ID или AWS_PUBLIC_IP"
        echo "   Пример: export AWS_PUBLIC_IP='54.235.6.145'"
        exit 1
    fi
    
    # Проверяем, доступен ли AWS CLI
    if ! command -v aws >/dev/null 2>&1; then
        echo "❌ AWS CLI не установлен. Укажите IP напрямую:"
        echo "   export AWS_PUBLIC_IP='54.235.6.145'"
        exit 1
    fi
    
    echo "🔍 Получение IP адреса через AWS CLI..."
    PUBLIC_IP=$(aws ec2 describe-instances \
        --instance-ids "$INSTANCE_ID" \
        --query 'Reservations[0].Instances[0].PublicIpAddress' \
        --output text 2>/dev/null)
    
    if [ "$?" -ne 0 ] || [ "$PUBLIC_IP" == "None" ] || [ -z "$PUBLIC_IP" ]; then
        echo "⚠️  Не удалось получить IP через AWS CLI (возможно, нет прав)"
        echo "💡 Решение: укажите IP адрес напрямую:"
        echo "   export AWS_PUBLIC_IP='54.235.6.145'  # Замените на ваш IP из AWS Console"
        echo ""
        echo "📖 Инструкция по добавлению прав: см. aws/IAM_PERMISSIONS_FIX.md"
        exit 1
    fi
fi

echo "📍 Подключение к инстансу: $PUBLIC_IP"

# Создаем архив проекта (исключая node_modules и другие ненужные файлы)
echo "📦 Создание архива проекта..."
# Используем COPYFILE_DISABLE для Mac, чтобы избежать предупреждений о xattr
COPYFILE_DISABLE=1 tar --exclude='node_modules' \
    --exclude='.git' \
    --exclude='logs' \
    --exclude='.pm2' \
    --exclude='artifacts' \
    --exclude='.DS_Store' \
    -czf /tmp/copfinder-deploy.tar.gz .

# Копируем архив на сервер
echo "📤 Загрузка проекта на сервер..."
scp -i "$SSH_KEY" /tmp/copfinder-deploy.tar.gz "$SSH_USER@$PUBLIC_IP:/tmp/"

# Выполняем команды на сервере
echo "🔧 Установка и настройка на сервере..."
ssh -i "$SSH_KEY" "$SSH_USER@$PUBLIC_IP" << EOF
    set -e
    
    # Определяем тип системы
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=\$ID
    elif [ -f /etc/redhat-release ]; then
        OS="rhel"
    else
        OS="unknown"
    fi
    
    echo "🔍 Обнаружена система: \$OS"
    
    # Создаем директорию приложения
    sudo mkdir -p $APP_DIR
    sudo chown $SSH_USER:$SSH_USER $APP_DIR
    
    # Распаковываем проект
    cd $APP_DIR
    tar -xzf /tmp/copfinder-deploy.tar.gz
    rm /tmp/copfinder-deploy.tar.gz
    
    # Устанавливаем Node.js (если еще не установлен)
    if ! command -v node &> /dev/null; then
        echo "📥 Установка Node.js..."
        if [[ "\$OS" == "amzn" ]] || [[ "\$OS" == "rhel" ]] || [[ "\$OS" == "centos" ]]; then
            # Amazon Linux / RHEL / CentOS
            curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
            sudo yum install -y nodejs
        elif [[ "\$OS" == "ubuntu" ]] || [[ "\$OS" == "debian" ]]; then
            # Ubuntu / Debian
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
        else
            echo "⚠️  Неизвестная система. Попытка установки через nvm..."
            curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
            export NVM_DIR="\$HOME/.nvm"
            [ -s "\$NVM_DIR/nvm.sh" ] && . "\$NVM_DIR/nvm.sh"
            nvm install 20
            nvm use 20
        fi
    fi
    
    # Устанавливаем PM2 глобально (если еще не установлен)
    if ! command -v pm2 &> /dev/null; then
        echo "📥 Установка PM2..."
        sudo npm install -g pm2
    fi
    
    # Устанавливаем Redis (если еще не установлен)
    if ! command -v redis-cli &> /dev/null; then
        echo "📥 Установка Redis..."
        if [[ "\$OS" == "amzn" ]] || [[ "\$OS" == "rhel" ]] || [[ "\$OS" == "centos" ]]; then
            sudo yum install -y redis6 || sudo yum install -y redis || echo "⚠️  Redis недоступен через yum, установите вручную"
            sudo systemctl start redis || sudo systemctl start redis6 || true
            sudo systemctl enable redis || sudo systemctl enable redis6 || true
        elif [[ "\$OS" == "ubuntu" ]] || [[ "\$OS" == "debian" ]]; then
            sudo apt-get update
            sudo apt-get install -y redis-server
            sudo systemctl start redis-server
            sudo systemctl enable redis-server
        fi
    fi
    
    # Устанавливаем зависимости
    echo "📦 Установка зависимостей..."
    npm ci --only=production
    
    # Устанавливаем браузеры для Playwright
    echo "🌐 Установка браузеров Playwright..."
    # Для Amazon Linux устанавливаем зависимости вручную, так как --with-deps использует apt-get
    if [[ "\$OS" == "amzn" ]] || [[ "\$OS" == "rhel" ]] || [[ "\$OS" == "centos" ]]; then
        echo "📦 Установка системных зависимостей для Playwright (Amazon Linux)..."
        # Устанавливаем основные пакеты (те, что точно доступны)
        sudo yum install -y \
            nss \
            atk \
            at-spi2-atk \
            cups-libs \
            gtk3 \
            libXcomposite \
            libXcursor \
            libXdamage \
            libXext \
            libXi \
            libXrandr \
            libXScrnSaver \
            libXtst \
            pango \
            2>/dev/null || true
        
        # Пытаемся установить дополнительные пакеты (могут быть недоступны)
        sudo yum install -y \
            alsa-lib \
            libdrm \
            libxkbcommon \
            libxshmfence \
            mesa-libgbm \
            xorg-x11-server-Xvfb \
            2>/dev/null || echo "⚠️  Некоторые дополнительные пакеты недоступны, продолжаем..."
        
        # Устанавливаем браузеры БЕЗ --with-deps, так как зависимости уже установлены
        echo "🌐 Установка браузеров Chromium..."
        npx playwright install chromium || {
            echo "⚠️  Ошибка установки браузеров, пробуем без зависимостей..."
            PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=0 npx playwright install chromium
        }
    elif [[ "\$OS" == "ubuntu" ]] || [[ "\$OS" == "debian" ]]; then
        # Для Ubuntu/Debian используем стандартный метод
        npx playwright install --with-deps chromium
    else
        # Для других систем пробуем без зависимостей
        echo "⚠️  Неизвестная система, устанавливаем браузеры без системных зависимостей..."
        npx playwright install chromium
    fi
    
    # Создаем необходимые директории
    mkdir -p logs data artifacts
    
    # Настраиваем PM2 для автозапуска
    echo "⚙️  Настройка PM2 для автозапуска..."
    # PM2 требует выполнить команду с sudo и правильным PATH
    sudo env PATH=\$PATH:/usr/bin pm2 startup systemd -u $SSH_USER --hp /home/$SSH_USER
    pm2 save
    
    echo "✅ Установка завершена!"
EOF

# Запускаем приложение
echo "▶️  Запуск приложения..."
ssh -i "$SSH_KEY" "$SSH_USER@$PUBLIC_IP" << EOF
    cd $APP_DIR
    pm2 restart ecosystem.config.cjs || pm2 start ecosystem.config.cjs
    pm2 save
    pm2 status
EOF

echo "✅ Развертывание завершено!"
echo "📍 Приложение доступно на: $PUBLIC_IP"
echo "📊 Проверьте статус: ssh -i $SSH_KEY $SSH_USER@$PUBLIC_IP 'cd $APP_DIR && pm2 status'"
echo "📋 Просмотр логов: ssh -i $SSH_KEY $SSH_USER@$PUBLIC_IP 'cd $APP_DIR && pm2 logs'"

