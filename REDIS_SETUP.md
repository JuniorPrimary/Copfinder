# Настройка Redis для Copfinder

## Описание

Проект использует Redis для хранения отправленных лотов вместо JSON файлов. Это решает проблемы с дублированием отправок и обеспечивает:
- **Персистентность данных** через RDB/AOF
- **Автоматическое удаление** старых записей через TTL (7 дней)
- **Надежность** при параллельных запусках
- **Масштабируемость** для будущего расширения

## Установка Redis на сервере

### Amazon Linux 2023 / RHEL / CentOS

```bash
# Установка Redis
sudo yum install -y redis6

# Или через EPEL
sudo yum install -y epel-release
sudo yum install -y redis

# Запуск Redis
sudo systemctl start redis
sudo systemctl enable redis

# Проверка статуса
sudo systemctl status redis
```

### Ubuntu / Debian

```bash
# Установка Redis
sudo apt-get update
sudo apt-get install -y redis-server

# Запуск Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Проверка статуса
sudo systemctl status redis-server
```

## Настройка Redis

### 1. Настройка персистентности (RDB/AOF)

Отредактируйте `/etc/redis/redis.conf` или `/etc/redis.conf`:

```conf
# Включить RDB (snapshot)
save 900 1      # сохранить если изменился хотя бы 1 ключ за 900 секунд
save 300 10     # сохранить если изменилось 10+ ключей за 300 секунд
save 60 10000   # сохранить если изменилось 10000+ ключей за 60 секунд

# Включить AOF (append-only file)
appendonly yes
appendfsync everysec  # синхронизация каждую секунду

# Директория для файлов персистентности
dir /var/lib/redis
```

### 2. Перезапуск Redis

```bash
sudo systemctl restart redis
# или
sudo systemctl restart redis-server
```

### 3. Проверка работы

```bash
redis-cli ping
# Должен вернуть: PONG
```

## Настройка переменных окружения

Добавьте в файл `.env` на сервере:

```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_TTL_DAYS=7
```

Если Redis на другом сервере или использует пароль:

```env
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-password
REDIS_DB=0
REDIS_TTL_DAYS=7
```

## Миграция данных из JSON в Redis

Если у вас уже есть данные в JSON файлах, можно мигрировать их:

```bash
# На сервере
cd /opt/copfinder

# Запустить миграцию (скрипт будет создан)
node scripts/migrate-to-redis.js
```

Или вручную через redis-cli:

```bash
# Для Copart
redis-cli SADD copart:seen:lots "93477715" "93431485" ...
redis-cli EXPIRE copart:seen:lots 604800  # 7 дней в секундах

# Для IAAI
redis-cli SADD iaai:sent:lots "https://www.iaai.com/VehicleDetail/43830515~US" ...
redis-cli EXPIRE iaai:sent:lots 604800
```

## Проверка работы

### Проверить количество записей

```bash
redis-cli SCARD copart:seen:lots
redis-cli SCARD iaai:sent:lots
```

### Просмотреть все записи

```bash
redis-cli SMEMBERS copart:seen:lots
redis-cli SMEMBERS iaai:sent:lots
```

### Проверить TTL

```bash
redis-cli TTL copart:seen:lots
redis-cli TTL iaai:sent:lots
```

## Структура данных в Redis

- **Ключи:**
  - `copart:seen:lots` - Set с lotId для Copart
  - `iaai:sent:lots` - Set с URL для IAAI

- **TTL:** 7 дней (604800 секунд)
- **Тип данных:** Redis Set (SADD, SISMEMBER, SMEMBERS)

## Мониторинг

### Логи Redis

```bash
sudo tail -f /var/log/redis/redis-server.log
```

### Статистика

```bash
redis-cli INFO stats
redis-cli INFO memory
```

## Troubleshooting

### Redis не запускается

```bash
# Проверить логи
sudo journalctl -u redis -n 50
# или
sudo tail -f /var/log/redis/redis-server.log

# Проверить конфигурацию
redis-cli CONFIG GET "*"
```

### Ошибка подключения

1. Проверьте, что Redis запущен: `sudo systemctl status redis`
2. Проверьте порт: `netstat -tlnp | grep 6379`
3. Проверьте firewall: `sudo firewall-cmd --list-all`
4. Проверьте переменные окружения в `.env`

### Данные не сохраняются

1. Проверьте права на директорию: `ls -la /var/lib/redis`
2. Проверьте настройки RDB/AOF в конфиге
3. Проверьте логи Redis на ошибки

