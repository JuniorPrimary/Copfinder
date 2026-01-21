# Пошаговая настройка в AWS Console

Это руководство поможет настроить все необходимые сервисы AWS через веб-консоль для развертывания Copfinder.

## 🎯 Выбор варианта развертывания

**Для EC2 (рекомендуется для начала):** См. [EC2_SETUP.md](EC2_SETUP.md) — упрощенная инструкция только для EC2

**Для ECS/Fargate:** Следуйте разделам 3-9 ниже (разделы 1-2 также нужны для базовой настройки)

---

## Содержание
1. [Создание EC2 инстанса](#1-создание-ec2-инстанса) ← **Для EC2**
2. [Настройка Security Groups](#2-настройка-security-groups) ← **Для EC2**
3. [Настройка Secrets Manager](#3-настройка-secrets-manager) ← **Для ECS**
4. [Создание ECR репозитория](#4-создание-ecr-репозитория) ← **Для ECS**
5. [Настройка CloudWatch Logs](#5-настройка-cloudwatch-logs) ← **Для ECS**
6. [Создание ECS Cluster](#6-создание-ecs-cluster) ← **Для ECS**
7. [Настройка IAM ролей](#7-настройка-iam-ролей) ← **Для ECS**
8. [Создание ECS Task Definition](#8-создание-ecs-task-definition) ← **Для ECS**
9. [Создание ECS Service](#9-создание-ecs-service) ← **Для ECS**

---

## 1. Создание EC2 инстанса

### Шаг 1.1: Переход в EC2
1. Войдите в [AWS Console](https://console.aws.amazon.com)
2. В поиске введите "EC2" и выберите **EC2**
3. В левом меню выберите **Instances**

### Шаг 1.2: Запуск инстанса
1. Нажмите кнопку **Launch Instance**
2. Заполните форму:

   **Name and tags:**
   - Name: `copfinder-server`

   **Application and OS Images:**
   - Выберите **Amazon Linux 2023** или **Ubuntu Server 22.04 LTS**
   - Оставьте версию по умолчанию

   **Instance type:**
   - Выберите **t3.medium** (2 vCPU, 4 GB RAM)
   - Минимально: **t3.small** (2 vCPU, 2 GB RAM)

   **Key pair:**
   - Если у вас нет ключа, нажмите **Create new key pair**
   - Name: `copfinder-key`
   - Key pair type: **RSA**
   - Private key file format: **.pem**
   - Нажмите **Create key pair** (файл скачается автоматически)
   - **Куда сохранить файл (для Mac):**
     - Файл `copfinder-key.pem` скачается в папку **Загрузки** (Downloads)
     - Откройте **Terminal** (найдите через Spotlight: `Cmd + Space`, введите "Terminal")
     - Выполните следующие команды:
     ```bash
     # Создать папку .ssh, если её нет
     mkdir -p ~/.ssh
     
     # Переместить файл из Загрузок в .ssh
     mv ~/Downloads/copfinder-key.pem ~/.ssh/copfinder-key.pem
     
     # Установить правильные права доступа (важно для безопасности!)
     chmod 400 ~/.ssh/copfinder-key.pem
     ```
     - Готово! Файл теперь находится в `/Users/ваше_имя/.ssh/copfinder-key.pem`
     - `~` означает вашу домашнюю директорию (на Mac это `/Users/ваше_имя/`)

   **Network settings:**
   - VPC: оставьте по умолчанию
   - Subnet: оставьте по умолчанию
   - Auto-assign Public IP: **Enable**
   - Firewall (security groups): **Create security group**
   - Security group name: `copfinder-sg`
   - Description: `Security group for Copfinder application`
   - Inbound rules:
     - Type: **SSH**, Port: **22**, Source: **My IP** (или ваш IP адрес)
     - Нажмите **Add security group rule** для добавления других правил при необходимости

   **Configure storage:**
   - Size: **20 GB** (минимум)
   - Volume type: **gp3**

3. Нажмите **Launch Instance**

### Шаг 1.3: Получение информации об инстансе
1. После создания инстанса нажмите **View all instances**
2. Дождитесь, пока статус изменится на **Running**
3. Запишите:
   - **Instance ID** (например: `i-0123456789abcdef0`)
   - **Public IPv4 address** (например: `54.123.45.67`)

---

## 2. Настройка Security Groups

### Шаг 2.1: Редактирование Security Group
1. В EC2 Console выберите **Security Groups** в левом меню
2. Найдите `copfinder-sg` и выберите его
3. Перейдите на вкладку **Inbound rules**
4. Нажмите **Edit inbound rules**

### Шаг 2.2: Добавление правил (если нужно)
- **SSH (22)**: уже должен быть добавлен
- Для доступа к приложению через веб (если планируете):
  - Type: **Custom TCP**
  - Port: **3000** (или другой порт)
  - Source: **My IP**

5. Нажмите **Save rules**

---

## 3. Настройка Secrets Manager

### Шаг 3.1: Переход в Secrets Manager
1. В поиске AWS Console введите "Secrets Manager"
2. Выберите **Secrets Manager**

### Шаг 3.2: Создание секрета для Copart Bot Token
1. Нажмите **Store a new secret**
2. Выберите **Other type of secret**
3. В поле **Key/value**:
   - Key: `COPART_TELEGRAM_BOT_TOKEN`
   - Value: ваш токен бота Telegram для Copart
4. Нажмите **Next**
5. **Secret name**: `copfinder/copart-bot-token`
6. **Description**: `Telegram bot token for Copart notifications`
7. Нажмите **Next**
8. Оставьте настройки по умолчанию
9. Нажмите **Next**, затем **Store**

### Шаг 3.3: Создание остальных секретов
Повторите шаг 3.2 для создания следующих секретов:

**Секрет 2:**
- Key: `COPART_TELEGRAM_CHAT_ID`
- Value: ваш Chat ID для Copart
- Secret name: `copfinder/copart-chat-id`

**Секрет 3:**
- Key: `TELEGRAM_BOT_TOKEN`
- Value: ваш токен бота Telegram для IAAI
- Secret name: `copfinder/iaai-bot-token`

**Секрет 4:**
- Key: `TELEGRAM_CHAT_ID`
- Value: ваш Chat ID для IAAI
- Secret name: `copfinder/iaai-chat-id`

### Шаг 3.4: Запись ARN секретов
1. Для каждого секрета откройте его
2. Скопируйте **ARN** (например: `arn:aws:secretsmanager:us-east-1:123456789012:secret:copfinder/copart-bot-token-abc123`)
3. Сохраните ARN для использования в task definition

---

## 4. Создание ECR репозитория

> ⚠️ Этот шаг нужен только если вы используете ECS/Fargate

### Шаг 4.1: Переход в ECR
1. В поиске AWS Console введите "ECR"
2. Выберите **Elastic Container Registry**

### Шаг 4.2: Создание репозитория
1. Убедитесь, что выбран правильный регион (например, `us-east-1`)
2. Нажмите **Create repository**
3. **Visibility settings**: **Private**
4. **Repository name**: `copfinder`
5. **Tag immutability**: **Enabled** (рекомендуется)
6. **Scan on push**: **Enable** (для безопасности)
7. **Encryption**: оставьте по умолчанию
8. Нажмите **Create repository**

### Шаг 4.3: Получение URI репозитория
1. После создания откройте репозиторий `copfinder`
2. Скопируйте **URI** (например: `123456789012.dkr.ecr.us-east-1.amazonaws.com/copfinder`)
3. Сохраните URI для использования в скрипте развертывания

---

## 5. Настройка CloudWatch Logs

### Шаг 5.1: Переход в CloudWatch
1. В поиске AWS Console введите "CloudWatch"
2. Выберите **CloudWatch**

### Шаг 5.2: Создание Log Group
1. В левом меню выберите **Log groups**
2. Нажмите **Create log group**
3. **Log group name**: `/ecs/copfinder`
4. **Retention**: **7 days** (или выберите нужный период)
5. Нажмите **Create**

---

## 6. Создание ECS Cluster

> ⚠️ Этот шаг нужен только если вы используете ECS/Fargate

### Шаг 6.1: Переход в ECS
1. В поиске AWS Console введите "ECS"
2. Выберите **Elastic Container Service**

### Шаг 6.2: Создание кластера
1. В левом меню выберите **Clusters**
2. Нажмите **Create cluster**
3. **Cluster name**: `copfinder-cluster`
4. **Infrastructure**: **AWS Fargate (serverless)**
5. Нажмите **Create**

---

## 7. Настройка IAM ролей

> ⚠️ Этот шаг нужен только если вы используете ECS/Fargate

### Шаг 7.1: Создание роли для Task Execution
1. В поиске AWS Console введите "IAM"
2. Выберите **IAM**
3. В левом меню выберите **Roles**
4. Нажмите **Create role**

5. **Trusted entity type**: **AWS service**
6. **Use case**: **Elastic Container Service**
7. Выберите **Elastic Container Service Task**
8. Нажмите **Next**

9. **Permissions**: найдите и выберите:
   - `AmazonECSTaskExecutionRolePolicy`
   - Нажмите **Next**

10. **Role name**: `copfinder-ecs-task-execution-role`
11. **Description**: `Execution role for Copfinder ECS tasks`
12. Нажмите **Create role**

### Шаг 7.2: Добавление доступа к Secrets Manager
1. Откройте созданную роль `copfinder-ecs-task-execution-role`
2. Перейдите на вкладку **Permissions**
3. Нажмите **Add permissions** → **Create inline policy**
4. Выберите **JSON** и вставьте:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": [
        "arn:aws:secretsmanager:*:*:secret:copfinder/*"
      ]
    }
  ]
}
```

5. Нажмите **Next**
6. **Policy name**: `CopfinderSecretsAccess`
7. Нажмите **Create policy**

### Шаг 7.3: Создание роли для Task
1. В IAM → Roles нажмите **Create role**
2. **Trusted entity type**: **AWS service**
3. **Use case**: **Elastic Container Service**
4. Выберите **Elastic Container Service Task**
5. Нажмите **Next**
6. **Permissions**: оставьте пустым (или добавьте нужные политики)
7. Нажмите **Next**
8. **Role name**: `copfinder-ecs-task-role`
9. **Description**: `Task role for Copfinder ECS tasks`
10. Нажмите **Create role**

---

## 8. Создание ECS Task Definition

> ⚠️ Этот шаг нужен только если вы используете ECS/Fargate

### Шаг 8.1: Переход в Task Definitions
1. В ECS Console в левом меню выберите **Task definitions**
2. Нажмите **Create new task definition**

### Шаг 8.2: Настройка задачи
1. **Task definition family**: `copfinder`
2. **Launch type**: **Fargate**
3. **Operating system/Architecture**: **Linux/X86_64**
4. **Task size**:
   - **CPU**: `1 vCPU` (1024)
   - **Memory**: `2 GB` (2048)

### Шаг 8.3: Настройка контейнера
1. Прокрутите вниз до **Container details**
2. Нажмите **Add container**

3. Заполните:
   - **Container name**: `copfinder`
   - **Image URI**: вставьте URI из шага 4.3 (например: `123456789012.dkr.ecr.us-east-1.amazonaws.com/copfinder:latest`)
   - **Essential container**: ✅ (отмечено)

4. **Environment variables**:
   - Key: `NODE_ENV`
   - Value: `production`
   - Нажмите **Add environment variable**

5. **Secrets** (добавьте 4 секрета):
   - Secret name: выберите `copfinder/copart-bot-token`
   - Value to retrieve from: выберите `COPART_TELEGRAM_BOT_TOKEN`
   - Нажмите **Add secret**
   
   Повторите для:
   - `copfinder/copart-chat-id` → `COPART_TELEGRAM_CHAT_ID`
   - `copfinder/iaai-bot-token` → `TELEGRAM_BOT_TOKEN`
   - `copfinder/iaai-chat-id` → `TELEGRAM_CHAT_ID`

6. **Logging**:
   - **Log driver**: **awslogs**
   - **Log group**: `/ecs/copfinder`
   - **Region**: выберите ваш регион
   - **Log stream prefix**: `ecs`

7. Нажмите **Add**

### Шаг 8.4: Настройка Execution role
1. Прокрутите вверх до **Task execution role**
2. Выберите: `copfinder-ecs-task-execution-role`

3. **Task role** (опционально):
   - Выберите: `copfinder-ecs-task-role`

4. Нажмите **Create**

---

## 9. Создание ECS Service

> ⚠️ Этот шаг нужен только если вы используете ECS/Fargate

### Шаг 9.1: Создание сервиса
1. В ECS Console откройте кластер `copfinder-cluster`
2. Перейдите на вкладку **Services**
3. Нажмите **Create**

### Шаг 9.2: Настройка сервиса
1. **Compute configuration**:
   - **Launch type**: **Fargate**
   - **Operating system/Architecture**: **Linux/X86_64**
   - **Task definition**:
     - **Family**: `copfinder`
     - **Revision**: `1` (latest)
   - **Service name**: `copfinder-service`
   - **Desired tasks**: `1`

2. **Networking**:
   - **VPC**: выберите вашу VPC (обычно default)
   - **Subnets**: выберите публичную подсеть (subnet с `Public IPv4 address`)
   - **Security groups**: выберите `copfinder-sg` (или создайте новую)
   - **Auto-assign public IP**: **ENABLED**

3. **Load balancing** (опционально):
   - Оставьте **None** (не требуется для этого приложения)

4. **Container health** (опционально):
   - Можно настроить health checks позже

5. Нажмите **Create**

### Шаг 9.3: Ожидание запуска
1. После создания сервиса дождитесь, пока статус станет **Running**
2. Это может занять 2-5 минут
3. Проверьте логи в CloudWatch, если что-то пошло не так

---

## Проверка развертывания

### Для EC2:
```bash
# Подключитесь к серверу (на Mac)
# Замените YOUR_PUBLIC_IP на IP адрес вашего инстанса из EC2 Console
ssh -i ~/.ssh/copfinder-key.pem ec2-user@YOUR_PUBLIC_IP

# Если используете Ubuntu вместо Amazon Linux, замените ec2-user на ubuntu:
# ssh -i ~/.ssh/copfinder-key.pem ubuntu@YOUR_PUBLIC_IP

# Проверьте статус
cd /opt/copfinder
pm2 status
pm2 logs
```

### Для ECS:
1. В ECS Console откройте кластер `copfinder-cluster`
2. Перейдите на вкладку **Tasks**
3. Откройте задачу
4. Перейдите на вкладку **Logs** для просмотра логов
5. Или в CloudWatch → Log groups → `/ecs/copfinder`

---

## Полезные ссылки

- [EC2 Console](https://console.aws.amazon.com/ec2/)
- [ECS Console](https://console.aws.amazon.com/ecs/)
- [Secrets Manager Console](https://console.aws.amazon.com/secretsmanager/)
- [CloudWatch Console](https://console.aws.amazon.com/cloudwatch/)
- [IAM Console](https://console.aws.amazon.com/iam/)

---

## Troubleshooting

### Проблема: Не могу подключиться к EC2
- **На Mac:** Убедитесь, что файл ключа находится в `~/.ssh/` и имеет правильные права:
  ```bash
  ls -la ~/.ssh/copfinder-key.pem  # Должен показать права -r--------
  chmod 400 ~/.ssh/copfinder-key.pem  # Если права неправильные
  ```
- Проверьте Security Group: должен быть открыт порт 22 для вашего IP
- Проверьте, что инстанс в статусе "Running"
- Убедитесь, что используете правильный ключ и правильный пользователь:
  - `ec2-user` для Amazon Linux
  - `ubuntu` для Ubuntu Server
- Проверьте правильность IP адреса в EC2 Console

### Проблема: ECS задача не запускается
- Проверьте CloudWatch логи
- Убедитесь, что секреты созданы в Secrets Manager
- Проверьте IAM роли и политики
- Убедитесь, что образ загружен в ECR

### Проблема: Недостаточно прав для доступа к секретам
- Проверьте, что роль `copfinder-ecs-task-execution-role` имеет политику доступа к Secrets Manager
- Убедитесь, что ARN секретов указаны правильно в task definition

---

## Следующие шаги

После настройки всех сервисов:

1. **Для EC2**: Используйте скрипт `aws/ec2-deploy.sh`
2. **Для ECS**: Используйте скрипт `aws/ecs-deploy.sh`
3. Настройте мониторинг и алерты в CloudWatch
4. Настройте автоматическое резервное копирование данных (если нужно)

