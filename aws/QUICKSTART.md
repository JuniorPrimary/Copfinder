# Быстрый старт развертывания на AWS

## Вариант 1: EC2 (Самый простой)

### Шаг 1: Подготовка
1. Создайте EC2 инстанс (Amazon Linux 2 или Ubuntu)
   - Рекомендуемый размер: **t3.medium** (2 vCPU, 4GB RAM)
   - Security Group: откройте SSH (порт 22) для вашего IP

2. Сохраните SSH ключ в безопасном месте

### Шаг 2: Развертывание
```bash
# Установите переменные окружения
export AWS_INSTANCE_ID="i-xxxxxxxxxxxxx"  # ID вашего инстанса
export AWS_SSH_KEY="~/.ssh/aws-key.pem"   # Путь к SSH ключу
export AWS_SSH_USER="ec2-user"            # или "ubuntu" для Ubuntu

# Запустите скрипт
./aws/ec2-deploy.sh
```

### Шаг 3: Настройка
```bash
# Подключитесь к серверу
ssh -i ~/.ssh/aws-key.pem ec2-user@YOUR_IP

# Настройте переменные окружения
cd /opt/copfinder
cp config/env.example .env
nano .env  # Заполните токены Telegram

# Перезапустите приложение
pm2 restart ecosystem.config.cjs
pm2 save
```

### Шаг 4: Проверка
```bash
# Проверьте статус
pm2 status

# Просмотрите логи
pm2 logs
```

---

## Вариант 2: ECS/Fargate (Для продакшена)

### Шаг 1: Предварительная настройка
```bash
# Настройте AWS CLI
aws configure

# Создайте секреты в AWS Secrets Manager
aws secretsmanager create-secret \
  --name copfinder/copart-bot-token \
  --secret-string "your-token" \
  --region us-east-1

aws secretsmanager create-secret \
  --name copfinder/copart-chat-id \
  --secret-string "your-chat-id" \
  --region us-east-1

aws secretsmanager create-secret \
  --name copfinder/iaai-bot-token \
  --secret-string "your-token" \
  --region us-east-1

aws secretsmanager create-secret \
  --name copfinder/iaai-chat-id \
  --secret-string "your-chat-id" \
  --region us-east-1

# Создайте CloudWatch Log Group
aws logs create-log-group --log-group-name /ecs/copfinder --region us-east-1

# Создайте ECS Cluster
aws ecs create-cluster --cluster-name copfinder-cluster --region us-east-1
```

### Шаг 2: Настройка task definition
Откройте `aws/ecs-task-definition.json` и обновите:
- `YOUR_ACCOUNT_ID` → ваш AWS Account ID
- `REGION` → ваш регион (например, `us-east-1`)
- ARN секретов в Secrets Manager

### Шаг 3: Развертывание
```bash
# Установите переменные
export AWS_REGION="us-east-1"
export AWS_ACCOUNT_ID="123456789012"  # Ваш Account ID
export ECR_REPO_NAME="copfinder"
export ECS_CLUSTER_NAME="copfinder-cluster"
export ECS_SERVICE_NAME="copfinder-service"

# Запустите скрипт
./aws/ecs-deploy.sh
```

### Шаг 4: Создание ECS Service
```bash
# Получите ID подсети и Security Group
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --query "Vpcs[0].VpcId" --output text)
SUBNET_ID=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query "Subnets[0].SubnetId" --output text)
SG_ID=$(aws ec2 create-security-group --group-name copfinder-sg --description "Copfinder ECS" --vpc-id $VPC_ID --query "GroupId" --output text)

# Создайте сервис
aws ecs create-service \
  --cluster copfinder-cluster \
  --service-name copfinder-service \
  --task-definition copfinder \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_ID],securityGroups=[$SG_ID],assignPublicIp=ENABLED}" \
  --region us-east-1
```

### Шаг 5: Проверка
```bash
# Проверьте статус сервиса
aws ecs describe-services \
  --cluster copfinder-cluster \
  --services copfinder-service \
  --region us-east-1

# Просмотрите логи
aws logs tail /ecs/copfinder --follow --region us-east-1
```

---

## Вариант 3: Terraform (Infrastructure as Code)

### Шаг 1: Установка Terraform
```bash
# macOS
brew install terraform

# Linux
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/
```

### Шаг 2: Настройка
```bash
cd aws/terraform

# Создайте файл terraform.tfvars (опционально)
cat > terraform.tfvars << EOF
aws_region = "us-east-1"
ecs_cluster_name = "copfinder-cluster"
ecs_service_name = "copfinder-service"
task_cpu = 1024
task_memory = 2048
desired_count = 1
EOF
```

### Шаг 3: Развертывание
```bash
# Инициализация
terraform init

# Просмотр плана
terraform plan

# Применение
terraform apply
```

### Шаг 4: Настройка секретов
После создания инфраструктуры, добавьте значения в Secrets Manager:
```bash
aws secretsmanager put-secret-value \
  --secret-id copfinder/copart-bot-token \
  --secret-string "your-token" \
  --region us-east-1
```

---

## Полезные команды

### EC2
```bash
# Просмотр логов
ssh -i ~/.ssh/aws-key.pem ec2-user@IP 'cd /opt/copfinder && pm2 logs'

# Перезапуск
ssh -i ~/.ssh/aws-key.pem ec2-user@IP 'cd /opt/copfinder && pm2 restart ecosystem.config.cjs'

# Обновление кода
./aws/ec2-deploy.sh
```

### ECS
```bash
# Обновление сервиса
./aws/ecs-deploy.sh

# Просмотр логов
aws logs tail /ecs/copfinder --follow --region us-east-1

# Масштабирование
aws ecs update-service \
  --cluster copfinder-cluster \
  --service copfinder-service \
  --desired-count 2 \
  --region us-east-1
```

---

## Troubleshooting

### Проблема: Playwright не работает на EC2
```bash
# Установите дополнительные зависимости
sudo yum install -y nss atk at-spi2-atk cups-libs gtk3 libXcomposite libXcursor
```

### Проблема: Недостаточно памяти
- Увеличьте размер инстанса
- Или настройте swap файл

### Проблема: ECS задача не запускается
- Проверьте CloudWatch логи
- Убедитесь, что секреты созданы в Secrets Manager
- Проверьте IAM роли и политики

---

## Стоимость (примерная)

- **EC2 t3.medium**: ~$30-50/месяц
- **ECS Fargate (1 vCPU, 2GB)**: ~$30-40/месяц
- **Дополнительно**: Secrets Manager (~$0.40/секрет), CloudWatch Logs (~$0.50/GB)

---

## Дополнительная информация

Полная документация: [`aws/README.md`](README.md)

