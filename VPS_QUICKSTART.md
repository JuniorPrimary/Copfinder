# 🚀 Быстрая миграция на VPS

Проект **полностью независим от AWS** и может работать на любом Linux VPS. Миграция займет **15-30 минут**.

## ✅ Что нужно на VPS

- **OS**: Ubuntu 20.04+ / Debian 11+ / CentOS 8+ / Amazon Linux 2
- **RAM**: Минимум 2GB (рекомендуется 4GB)
- **CPU**: 2 ядра (рекомендуется)
- **Storage**: 20GB+ SSD
- **Node.js**: 18+ (установится автоматически)

## 📋 Пошаговая инструкция

### Шаг 1: Подключитесь к VPS

```bash
ssh root@YOUR_VPS_IP
# или
ssh user@YOUR_VPS_IP
```

### Шаг 2: Установите зависимости

#### Для Ubuntu/Debian:
```bash
# Обновление системы
sudo apt-get update && sudo apt-get upgrade -y

# Установка Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Установка Git
sudo apt-get install -y git

# Установка зависимостей для Playwright
sudo apt-get install -y \
  libnss3 \
  libnspr4 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  libpango-1.0-0 \
  libcairo2 \
  libatspi2.0-0 \
  libxshmfence1
```

#### Для CentOS/RHEL/Amazon Linux:
```bash
# Обновление системы
sudo yum update -y

# Установка Node.js 20.x
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Установка Git
sudo yum install -y git

# Установка зависимостей для Playwright
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
  xorg-x11-server-Xvfb
```

### Шаг 3: Клонируйте проект и установите Redis

```bash
cd /opt

# Клонируйте репозиторий
git clone https://github.com/JuniorPrimary/Copfinder.git copfinder
cd copfinder

# Установите Redis
chmod +x scripts/setup-redis.sh
sudo ./scripts/setup-redis.sh
```

### Шаг 4: Настройте проект

```bash
cd /opt/copfinder

# Установите зависимости Node.js
npm install --production

# Установите браузеры для Playwright
npx playwright install --with-deps chromium

# Создайте файл .env
cp config/env.example .env
nano .env  # Заполните токены Telegram
```

### Шаг 5: Настройте .env файл

Откройте `.env` и заполните:

```env
COPART_TELEGRAM_BOT_TOKEN=your-copart-bot-token
COPART_TELEGRAM_CHAT_ID=your-copart-chat-id
TELEGRAM_BOT_TOKEN=your-iaai-bot-token
TELEGRAM_CHAT_ID=your-iaai-chat-id

# Redis (обычно уже настроен)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_TTL_DAYS=7
```

### Шаг 6: Запустите приложение

```bash
# Запустите через PM2
npm run pm2:start

# Проверьте статус
npm run pm2:status

# Просмотрите логи
npm run pm2:logs

# Сохраните конфигурацию PM2 (автозапуск при перезагрузке)
pm2 save
pm2 startup  # Следуйте инструкциям на экране
```

### Шаг 7: Настройте автозапуск PM2

```bash
# PM2 предложит команду, выполните её (пример):
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u your_user --hp /home/your_user
```

## 🔄 Миграция данных (если нужно)

Если у вас уже есть данные на AWS:

### Экспорт данных из Redis на AWS:
```bash
# На AWS сервере
redis-cli --rdb /tmp/dump.rdb
```

### Импорт данных на VPS:
```bash
# На VPS
scp user@aws-server:/tmp/dump.rdb /tmp/
sudo systemctl stop redis
sudo cp /tmp/dump.rdb /var/lib/redis/dump.rdb  # Путь может отличаться
sudo chown redis:redis /var/lib/redis/dump.rdb
sudo systemctl start redis
```

## ✅ Проверка работы

```bash
# Проверьте статус процессов
pm2 status

# Проверьте логи
pm2 logs

# Проверьте Redis
redis-cli ping  # Должно вернуть PONG
```

## 🛠️ Полезные команды

```bash
# Перезапуск приложения
npm run pm2:restart

# Остановка
npm run pm2:stop

# Просмотр логов
npm run pm2:logs

# Просмотр данных в Redis
node scripts/get-redis-data.js
```

## 📊 Мониторинг ресурсов

```bash
# Использование памяти
free -h

# Использование CPU
top

# Использование диска
df -h

# Логи PM2
pm2 logs --lines 100
```

## 🔒 Безопасность

1. **Настройте firewall:**
```bash
# Ubuntu/Debian
sudo ufw allow 22/tcp
sudo ufw enable

# CentOS/RHEL
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --reload
```

2. **Отключите парольную аутентификацию SSH** (используйте только ключи)

3. **Регулярно обновляйте систему:**
```bash
# Ubuntu/Debian
sudo apt-get update && sudo apt-get upgrade -y

# CentOS/RHEL
sudo yum update -y
```

## 💰 Стоимость

- **VPS с 4GB RAM, 2 CPU, 30GB SSD**: ~$10-15/месяц
- **VPS с 2GB RAM, 2 CPU, 30GB SSD**: ~$5-10/месяц (минимум)

## 🆘 Решение проблем

### Проблема: Playwright не работает
```bash
# Переустановите зависимости
npx playwright install --with-deps chromium
```

### Проблема: Недостаточно памяти
- Уменьшите `max_memory_restart` в `ecosystem.config.cjs` (например, до 512M)
- Или увеличьте RAM на VPS

### Проблема: Redis не запускается
```bash
# Проверьте статус
sudo systemctl status redis

# Проверьте логи
sudo journalctl -u redis -n 50
```

## 📝 Следующие шаги

1. ✅ Настройте мониторинг (опционально)
2. ✅ Настройте резервное копирование Redis
3. ✅ Настройте автоматические обновления системы
4. ✅ Настройте уведомления о проблемах

---

**Готово!** Ваше приложение теперь работает на VPS. 🎉
