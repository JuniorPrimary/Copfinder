# Развертывание Copfinder на AWS

Этот документ описывает различные способы развертывания приложения Copfinder на инфраструктуре Amazon Web Services.

## 📚 Документация

### 🎯 Начните здесь:
- **[AWS_CONSOLE_SETUP.md](AWS_CONSOLE_SETUP.md)** — ⭐ **ГЛАВНАЯ ИНСТРУКЦИЯ** — Пошаговая настройка всех сервисов через AWS Console (веб-интерфейс) с детальными объяснениями каждого шага

### 📋 Вспомогательные материалы:
- **[CONSOLE_QUICK_REFERENCE.md](CONSOLE_QUICK_REFERENCE.md)** — Быстрая справка с прямыми ссылками и краткими командами
- **[SETUP_FLOW.md](SETUP_FLOW.md)** — Визуальная схема процесса настройки
- **[CHECKLIST.md](CHECKLIST.md)** — Чеклист для отслеживания прогресса настройки

### 🚀 Для опытных пользователей:
- **[QUICKSTART.md](QUICKSTART.md)** — Быстрый старт через командную строку (для тех, кто уже знаком с AWS)

## Варианты развертывания

### 1. AWS EC2 (Рекомендуется для начала)

Самый простой вариант, похож на локальное развертывание с PM2.

**Преимущества:**
- Простота настройки
- Полный контроль над сервером
- Низкая стоимость для небольших нагрузок

**Недостатки:**
- Требует управления сервером
- Нет автоматического масштабирования

#### Шаги развертывания:

1. **Создайте EC2 инстанс:**
   ```bash
   # Используйте Amazon Linux 2 или Ubuntu
   # Минимальные требования: t3.medium (2 vCPU, 4GB RAM)
   ```

2. **Настройте Security Group:**
   - Откройте SSH порт (22) для вашего IP
   - При необходимости откройте другие порты

3. **Подготовьте переменные окружения:**
   ```bash
   export AWS_INSTANCE_ID="i-xxxxxxxxxxxxx"
   export AWS_SSH_KEY="~/.ssh/aws-key.pem"
   export AWS_SSH_USER="ec2-user"  # или "ubuntu" для Ubuntu
   ```

4. **Запустите скрипт развертывания:**
   ```bash
   chmod +x aws/ec2-deploy.sh
   ./aws/ec2-deploy.sh
   ```

5. **Настройте .env файл на сервере:**
   ```bash
   ssh -i ~/.ssh/aws-key.pem ec2-user@YOUR_IP
   cd /opt/copfinder
   cp config/env.example .env
   nano .env  # Заполните токены и chat IDs
   ```

6. **Перезапустите приложение:**
   ```bash
   pm2 restart ecosystem.config.cjs
   ```

#### Управление на EC2:

```bash
# Проверка статуса
pm2 status

# Просмотр логов
pm2 logs

# Перезапуск
pm2 restart ecosystem.config.cjs

# Остановка
pm2 stop ecosystem.config.cjs
```

---

### 2. AWS ECS/Fargate (Рекомендуется для продакшена)

Контейнеризированное развертывание с автоматическим масштабированием.

**Преимущества:**
- Автоматическое масштабирование
- Управление через AWS консоль
- Интеграция с другими AWS сервисами
- Не нужно управлять серверами

**Недостатки:**
- Более сложная настройка
- Выше стоимость для небольших нагрузок

#### Предварительные требования:

1. **AWS CLI настроен:**
   ```bash
   aws configure
   ```

2. **Docker установлен локально**

3. **Создайте Secrets в AWS Secrets Manager:**
   ```bash
   aws secretsmanager create-secret \
     --name copfinder/copart-bot-token \
     --secret-string "your-token-here" \
     --region us-east-1
   
   aws secretsmanager create-secret \
     --name copfinder/copart-chat-id \
     --secret-string "your-chat-id-here" \
     --region us-east-1
   
   aws secretsmanager create-secret \
     --name copfinder/iaai-bot-token \
     --secret-string "your-token-here" \
     --region us-east-1
   
   aws secretsmanager create-secret \
     --name copfinder/iaai-chat-id \
     --secret-string "your-chat-id-here" \
     --region us-east-1
   ```

4. **Создайте CloudWatch Log Group:**
   ```bash
   aws logs create-log-group --log-group-name /ecs/copfinder --region us-east-1
   ```

5. **Создайте ECS Cluster:**
   ```bash
   aws ecs create-cluster --cluster-name copfinder-cluster --region us-east-1
   ```

#### Шаги развертывания:

1. **Настройте переменные окружения:**
   ```bash
   export AWS_REGION="us-east-1"
   export AWS_ACCOUNT_ID="123456789012"
   export ECR_REPO_NAME="copfinder"
   export ECS_CLUSTER_NAME="copfinder-cluster"
   export ECS_SERVICE_NAME="copfinder-service"
   ```

2. **Обновите task definition:**
   - Откройте `aws/ecs-task-definition.json`
   - Замените `YOUR_ACCOUNT_ID` на ваш AWS Account ID
   - Замените `REGION` на ваш регион
   - Обновите ARN секретов в Secrets Manager

3. **Запустите скрипт развертывания:**
   ```bash
   chmod +x aws/ecs-deploy.sh
   ./aws/ecs-deploy.sh
   ```

4. **Создайте ECS Service (вручную или через консоль):**
   ```bash
   aws ecs create-service \
     --cluster copfinder-cluster \
     --service-name copfinder-service \
     --task-definition copfinder \
     --desired-count 1 \
     --launch-type FARGATE \
     --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" \
     --region us-east-1
   ```

#### Управление на ECS:

```bash
# Просмотр статуса сервиса
aws ecs describe-services \
  --cluster copfinder-cluster \
  --services copfinder-service \
  --region us-east-1

# Просмотр логов
aws logs tail /ecs/copfinder --follow --region us-east-1

# Обновление сервиса (после изменения task definition)
aws ecs update-service \
  --cluster copfinder-cluster \
  --service copfinder-service \
  --force-new-deployment \
  --region us-east-1
```

---

### 3. Docker Compose на EC2

Альтернативный вариант - использовать Docker Compose на EC2 инстансе.

1. **Установите Docker и Docker Compose на EC2:**
   ```bash
   sudo yum install -y docker
   sudo systemctl start docker
   sudo usermod -a -G docker ec2-user
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

2. **Скопируйте проект на сервер и запустите:**
   ```bash
   docker-compose up -d
   ```

---

## Хранение данных

### Вариант 1: Локальное хранение (EC2)
Данные хранятся в директориях `data/`, `logs/`, `artifacts/` на сервере.

### Вариант 2: EFS (для ECS)
Для ECS можно использовать Amazon EFS для персистентного хранения:

1. Создайте EFS файловую систему
2. Добавьте mount point в task definition
3. Обновите volumes в task definition

### Вариант 3: S3 (для логов и артефактов)
Можно настроить синхронизацию логов и артефактов в S3 через cron или AWS DataSync.

---

## Мониторинг

### CloudWatch Logs
- Настройте интеграцию с CloudWatch для централизованного логирования
- Создайте алармы на основе логов

### PM2 Monitoring (для EC2)
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

---

## Безопасность

1. **Используйте AWS Secrets Manager** для хранения токенов и паролей
2. **Настройте Security Groups** - открывайте только необходимые порты
3. **Используйте IAM роли** вместо статических ключей где возможно
4. **Регулярно обновляйте** зависимости и систему
5. **Настройте VPC** для изоляции ресурсов

---

## Стоимость

### EC2 (t3.medium):
- ~$30-50/месяц

### ECS Fargate (1 vCPU, 2GB RAM):
- ~$30-40/месяц + ECR storage + CloudWatch logs

### Дополнительные сервисы:
- Secrets Manager: ~$0.40/секрет/месяц
- CloudWatch Logs: ~$0.50/GB
- EFS (если используется): ~$0.30/GB-месяц

---

## Troubleshooting

### Проблемы с Playwright на EC2:
```bash
# Установите дополнительные зависимости
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

### Проблемы с памятью:
- Увеличьте размер инстанса
- Настройте swap файл
- Оптимизируйте использование памяти в PM2

### Проблемы с сетью:
- Проверьте Security Groups
- Убедитесь, что инстанс имеет доступ к интернету
- Проверьте NAT Gateway для приватных подсетей

---

## Дополнительные ресурсы

- [AWS EC2 Documentation](https://docs.aws.amazon.com/ec2/)
- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [PM2 Documentation](https://pm2.keymetrics.io/)
- [Playwright Documentation](https://playwright.dev/)

