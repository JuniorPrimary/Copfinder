# Схема процесса настройки AWS

Визуальное представление шагов настройки для разных вариантов развертывания.

## Вариант 1: EC2 (Простой)

```
┌─────────────────────────────────────────────────────────────┐
│                    AWS Console                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  1. EC2 → Launch Instance        │
        │     - Amazon Linux 2023          │
        │     - t3.medium                  │
        │     - Создать SSH ключ           │
        │     - Security Group (SSH:22)    │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  2. Записать данные:             │
        │     - Instance ID                │
        │     - Public IP                  │
        │     - SSH Key путь               │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  3. Локально:                     │
        │     export AWS_INSTANCE_ID=...    │
        │     export AWS_SSH_KEY=...        │
        │     ./aws/ec2-deploy.sh           │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  4. На сервере:                   │
        │     ssh -i key.pem ec2-user@IP    │
        │     cd /opt/copfinder             │
        │     cp config/env.example .env    │
        │     nano .env                     │
        │     pm2 restart ecosystem.config  │
        └───────────────────────────────────┘
                            │
                            ▼
                    ✅ Готово!
```

---

## Вариант 2: ECS/Fargate (Продакшен)

```
┌─────────────────────────────────────────────────────────────┐
│                    AWS Console                              │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ 1. Secrets    │  │ 2. ECR        │  │ 3. CloudWatch │
│    Manager    │  │    Repository │  │    Log Group  │
│               │  │               │  │               │
│ - copart-bot  │  │ - copfinder   │  │ - /ecs/       │
│ - copart-chat │  │ - Private     │  │   copfinder  │
│ - iaai-bot    │  │ - Scan: ON    │  │ - 7 days     │
│ - iaai-chat   │  │               │  │               │
└───────────────┘  └───────────────┘  └───────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  4. IAM Roles                     │
        │     - Task Execution Role         │
        │       + ECSTaskExecutionPolicy    │
        │       + Secrets Manager Access    │
        │     - Task Role                  │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  5. ECS Cluster                   │
        │     - copfinder-cluster           │
        │     - Fargate                    │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  6. ECS Task Definition           │
        │     - Family: copfinder           │
        │     - Fargate (1 vCPU, 2GB)      │
        │     - Container: ECR image        │
        │     - Secrets: 4 из Secrets Mgr  │
        │     - Logs: CloudWatch           │
        │     - Execution Role             │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  7. Локально:                     │
        │     docker build -t copfinder .   │
        │     ./aws/ecs-deploy.sh           │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  8. ECS Service                   │
        │     - copfinder-service           │
        │     - Task: copfinder:1          │
        │     - Desired: 1                  │
        │     - VPC + Public Subnet        │
        │     - Security Group             │
        │     - Public IP: ENABLED         │
        └───────────────────────────────────┘
                            │
                            ▼
                    ✅ Готово!
```

---

## Последовательность действий

### Для новичков (EC2):
```
1. AWS Console → EC2 → Launch Instance
2. Записать Instance ID и IP
3. Запустить ./aws/ec2-deploy.sh
4. Настроить .env на сервере
5. Готово!
```

### Для опытных (ECS):
```
1. Secrets Manager (4 секрета)
2. ECR (репозиторий)
3. CloudWatch (log group)
4. IAM (2 роли)
5. ECS (cluster)
6. ECS (task definition)
7. Docker build + push
8. ECS (service)
9. Готово!
```

---

## Временные затраты

| Вариант | Время настройки | Сложность |
|---------|----------------|-----------|
| EC2     | 15-30 минут    | ⭐ Легко  |
| ECS     | 45-60 минут    | ⭐⭐ Средне |

---

## Зависимости между сервисами

```
EC2:
  └─ Security Group
      └─ SSH доступ

ECS:
  └─ Task Definition
      ├─ ECR (образ)
      ├─ Secrets Manager (секреты)
      ├─ CloudWatch (логи)
      └─ IAM (роли)
  └─ Service
      ├─ Task Definition
      ├─ VPC/Subnet
      └─ Security Group
```

---

## Порядок создания (ECS)

```
1. Secrets Manager    ← Сначала (нужны для Task Definition)
2. ECR                ← Сначала (нужен образ)
3. CloudWatch         ← Сначала (нужен для Task Definition)
4. IAM Roles          ← Сначала (нужны для Task Definition)
5. ECS Cluster        ← Можно параллельно
6. Task Definition    ← После 1-4
7. Docker build/push  ← После 2
8. ECS Service        ← После 5, 6, 7
```

---

## Проверка готовности

### EC2 готов, если:
- ✅ Инстанс в статусе "Running"
- ✅ Могу подключиться по SSH
- ✅ Приложение запущено через PM2
- ✅ Логи показывают работу

### ECS готов, если:
- ✅ Service в статусе "Active"
- ✅ Task в статусе "Running"
- ✅ Логи в CloudWatch доступны
- ✅ Нет ошибок в логах

---

## Следующие шаги после настройки

1. **Мониторинг**
   - Настроить CloudWatch Dashboard
   - Создать алерты

2. **Безопасность**
   - Проверить Security Groups
   - Обновить IAM политики при необходимости

3. **Оптимизация**
   - Настроить автоперезапуск
   - Настроить масштабирование (для ECS)

4. **Резервное копирование**
   - Настроить бэкапы данных
   - Документировать процесс восстановления

---

## Полезные ссылки

- [AWS_CONSOLE_SETUP.md](AWS_CONSOLE_SETUP.md) - Подробная инструкция
- [CHECKLIST.md](CHECKLIST.md) - Чеклист
- [CONSOLE_QUICK_REFERENCE.md](CONSOLE_QUICK_REFERENCE.md) - Быстрая справка

