# Быстрый старт с Redis

## Установка на сервере

```bash
# Подключитесь к серверу
ssh -i ~/.ssh/copfinder-key.pem ec2-user@54.235.6.145

# Установите Redis
sudo yum install -y redis6 || sudo yum install -y redis
sudo systemctl start redis
sudo systemctl enable redis

# Проверьте работу
redis-cli ping
# Должен вернуть: PONG
```

## Настройка .env

Добавьте в файл `.env` на сервере:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_TTL_DAYS=7
```

## Миграция данных (опционально)

Если у вас уже есть данные в JSON файлах:

```bash
cd /opt/copfinder
node scripts/migrate-to-redis.js
```

## Проверка работы

```bash
# Проверить количество записей
redis-cli SCARD copart:seen:lots
redis-cli SCARD iaai:sent:lots

# Просмотреть записи
redis-cli SMEMBERS copart:seen:lots | head -10
redis-cli SMEMBERS iaai:sent:lots | head -10

# Проверить TTL
redis-cli TTL copart:seen:lots
redis-cli TTL iaai:sent:lots
```

## Перезапуск приложения

```bash
cd /opt/copfinder
npm ci --only=production
pm2 restart ecosystem.config.cjs
```

## Настройка персистентности Redis

Redis автоматически сохраняет данные через RDB и AOF. Настройки находятся в `/etc/redis.conf` или `/etc/redis/redis.conf`.

Рекомендуемые настройки:
- RDB: включен по умолчанию
- AOF: `appendonly yes` и `appendfsync everysec`

