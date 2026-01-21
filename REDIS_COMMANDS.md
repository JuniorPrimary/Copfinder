# Команды для работы с Redis

## Быстрый доступ через redis-cli

### Подключение к Redis на сервере
```bash
ssh -i ~/.ssh/copfinder-key.pem ec2-user@54.235.6.145
/usr/bin/redis6-cli
```

### Получить количество лотов

**Copart:**
```bash
/usr/bin/redis6-cli SCARD copart:seen:lots
```

**IAAI:**
```bash
/usr/bin/redis6-cli SCARD iaai:sent:lots
```

### Получить все лоты

**Copart (все лоты):**
```bash
/usr/bin/redis6-cli SMEMBERS copart:seen:lots
```

**IAAI (все лоты):**
```bash
/usr/bin/redis6-cli SMEMBERS iaai:sent:lots
```

### Сохранить в файл

**Copart:**
```bash
/usr/bin/redis6-cli SMEMBERS copart:seen:lots > copart-lots.txt
```

**IAAI:**
```bash
/usr/bin/redis6-cli SMEMBERS iaai:sent:lots > iaai-lots.txt
```

### Проверить наличие конкретного лота

**Copart (проверить lotId):**
```bash
/usr/bin/redis6-cli SISMEMBER copart:seen:lots "93477715"
# Вернет 1 если есть, 0 если нет
```

**IAAI (проверить URL):**
```bash
/usr/bin/redis6-cli SISMEMBER iaai:sent:lots "https://www.iaai.com/VehicleDetail/43830515~US"
# Вернет 1 если есть, 0 если нет
```

### Получить TTL (время жизни данных)

**Copart:**
```bash
/usr/bin/redis6-cli TTL copart:seen:lots
# Вернет количество секунд до удаления (или -1 если TTL не установлен)
```

**IAAI:**
```bash
/usr/bin/redis6-cli TTL iaai:sent:lots
```

### Получить случайный лот (для проверки)

**Copart:**
```bash
/usr/bin/redis6-cli SRANDMEMBER copart:seen:lots
```

**IAAI:**
```bash
/usr/bin/redis6-cli SRANDMEMBER iaai:sent:lots
```

### Получить первые N лотов

**Copart (первые 10):**
```bash
/usr/bin/redis6-cli SMEMBERS copart:seen:lots | head -10
```

**IAAI (первые 10):**
```bash
/usr/bin/redis6-cli SMEMBERS iaai:sent:lots | head -10
```

### Поиск по частичному совпадению

**Copart (найти все лоты содержащие "934"):**
```bash
/usr/bin/redis6-cli SMEMBERS copart:seen:lots | grep "934"
```

**IAAI (найти все URL содержащие "43830515"):**
```bash
/usr/bin/redis6-cli SMEMBERS iaai:sent:lots | grep "43830515"
```

## Использование скрипта get-redis-data.js

### На сервере:

```bash
cd /opt/copfinder
node scripts/get-redis-data.js
```

### Опции скрипта:

**Показать только Copart:**
```bash
node scripts/get-redis-data.js --copart
```

**Показать только IAAI:**
```bash
node scripts/get-redis-data.js --iaai
```

**Вывод в JSON формате:**
```bash
node scripts/get-redis-data.js --json
```

**Поиск по тексту:**
```bash
node scripts/get-redis-data.js --search=93477715
```

**Экспорт в файл:**
```bash
node scripts/get-redis-data.js --export=redis-data.json
```

**Комбинация опций:**
```bash
node scripts/get-redis-data.js --copart --search=934 --export=copart-filtered.json
```

## Полезные команды для мониторинга

### Проверить статус Redis
```bash
/usr/bin/redis6-cli PING
# Должен вернуть PONG
```

### Получить информацию о Redis
```bash
/usr/bin/redis6-cli INFO
```

### Получить список всех ключей
```bash
/usr/bin/redis6-cli KEYS "*"
```

### Получить размер базы данных
```bash
/usr/bin/redis6-cli DBSIZE
```

