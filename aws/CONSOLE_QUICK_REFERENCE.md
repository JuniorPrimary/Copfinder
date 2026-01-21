# Быстрая справка по AWS Console

Краткая шпаргалка для быстрой настройки основных сервисов.

## 🔗 Прямые ссылки на сервисы

- **EC2**: https://console.aws.amazon.com/ec2/
- **ECS**: https://console.aws.amazon.com/ecs/
- **ECR**: https://console.aws.amazon.com/ecr/
- **Secrets Manager**: https://console.aws.amazon.com/secretsmanager/
- **CloudWatch**: https://console.aws.amazon.com/cloudwatch/
- **IAM**: https://console.aws.amazon.com/iam/

---

## 📋 Минимальные настройки для EC2

### 1. EC2 → Launch Instance
```
Name: copfinder-server
OS: Amazon Linux 2023
Type: t3.medium
Key pair: создать новый (copfinder-key)
Security Group: SSH (22) для My IP
Storage: 20 GB
```

### 2. Записать данные
- Instance ID: `i-xxxxxxxxxxxxx`
- Public IP: `54.xxx.xxx.xxx`
- SSH Key: `~/.ssh/copfinder-key.pem`

### 3. Подключиться и настроить
```bash
ssh -i ~/.ssh/copfinder-key.pem ec2-user@PUBLIC_IP
```

---

## 📋 Минимальные настройки для ECS

### 1. Secrets Manager → Store a new secret
```
Создать 4 секрета:
- copfinder/copart-bot-token
- copfinder/copart-chat-id
- copfinder/iaai-bot-token
- copfinder/iaai-chat-id
```

### 2. ECR → Create repository
```
Name: copfinder
Visibility: Private
Tag immutability: Enabled
Scan on push: Enabled
```

### 3. CloudWatch → Log groups → Create
```
Name: /ecs/copfinder
Retention: 7 days
```

### 4. ECS → Clusters → Create cluster
```
Name: copfinder-cluster
Infrastructure: AWS Fargate
```

### 5. IAM → Roles → Create role
```
Role 1: copfinder-ecs-task-execution-role
- Trust: ECS Task
- Policy: AmazonECSTaskExecutionRolePolicy
- Inline policy: доступ к Secrets Manager

Role 2: copfinder-ecs-task-role
- Trust: ECS Task
```

### 6. ECS → Task definitions → Create
```
Family: copfinder
Launch type: Fargate
CPU: 1 vCPU
Memory: 2 GB
Container: copfinder
Image: ECR_URI:latest
Secrets: 4 секрета из Secrets Manager
Logging: awslogs → /ecs/copfinder
Execution role: copfinder-ecs-task-execution-role
```

### 7. ECS → Clusters → copfinder-cluster → Services → Create
```
Service name: copfinder-service
Task definition: copfinder:1
Desired tasks: 1
VPC: default
Subnets: public subnet
Security group: copfinder-sg
Public IP: ENABLED
```

---

## 🔑 Важные ARN форматы

### Secrets Manager ARN
```
arn:aws:secretsmanager:REGION:ACCOUNT_ID:secret:copfinder/copart-bot-token-XXXXXX
```

### ECR Repository URI
```
ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/copfinder
```

### IAM Role ARN
```
arn:aws:iam::ACCOUNT_ID:role/copfinder-ecs-task-execution-role
```

---

## ✅ Быстрая проверка

### EC2
- [ ] Инстанс в статусе "Running"
- [ ] Могу подключиться по SSH
- [ ] Security Group открыт для моего IP

### ECS
- [ ] Task Definition создана
- [ ] Service запущена
- [ ] Task в статусе "Running"
- [ ] Логи доступны в CloudWatch

---

## 🆘 Частые проблемы

| Проблема | Решение |
|----------|---------|
| Не могу подключиться к EC2 | Проверить Security Group, порт 22, правильный IP |
| ECS задача не запускается | Проверить CloudWatch логи, Secrets Manager, IAM роли |
| Нет доступа к секретам | Проверить inline policy в execution role |
| Образ не найден | Проверить, что образ загружен в ECR |

---

## 📞 Полезные команды AWS CLI

```bash
# Проверка подключения
aws sts get-caller-identity

# Список EC2 инстансов
aws ec2 describe-instances --query 'Reservations[*].Instances[*].[InstanceId,PublicIpAddress,State.Name]' --output table

# Список ECS сервисов
aws ecs list-services --cluster copfinder-cluster

# Просмотр логов
aws logs tail /ecs/copfinder --follow
```

---

## 📖 Полная документация

- **Подробная инструкция**: [AWS_CONSOLE_SETUP.md](AWS_CONSOLE_SETUP.md)
- **Чеклист**: [CHECKLIST.md](CHECKLIST.md)
- **Быстрый старт**: [QUICKSTART.md](QUICKSTART.md)

