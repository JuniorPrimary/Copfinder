# Чеклист настройки AWS

Используйте этот чеклист для отслеживания прогресса настройки AWS инфраструктуры.

## Общая информация
- [ ] AWS Account создан и настроен
- [ ] AWS CLI установлен и настроен (`aws configure`)
- [ ] Выбран регион для развертывания: _______________

## Вариант 1: EC2 развертывание

### EC2 Инстанс
- [ ] EC2 инстанс создан
- [ ] Instance ID записан: _______________
- [ ] Public IP записан: _______________
- [ ] SSH ключ сохранен и защищен (`chmod 400`)
- [ ] Путь к ключу: _______________

### Security Group
- [ ] Security Group создан: `copfinder-sg`
- [ ] SSH порт (22) открыт для вашего IP
- [ ] Дополнительные порты настроены (если нужно)

### Переменные окружения
- [ ] `.env` файл создан на сервере
- [ ] `COPART_TELEGRAM_BOT_TOKEN` заполнен
- [ ] `COPART_TELEGRAM_CHAT_ID` заполнен
- [ ] `TELEGRAM_BOT_TOKEN` заполнен
- [ ] `TELEGRAM_CHAT_ID` заполнен

### Развертывание
- [ ] Скрипт `ec2-deploy.sh` выполнен успешно
- [ ] Приложение запущено через PM2
- [ ] PM2 настроен на автозапуск (`pm2 startup`)
- [ ] Логи проверены, ошибок нет

---

## Вариант 2: ECS/Fargate развертывание

### ECR (Elastic Container Registry)
- [ ] ECR репозиторий создан: `copfinder`
- [ ] URI репозитория записан: _______________
- [ ] Docker образ собран и загружен в ECR

### Secrets Manager
- [ ] Секрет `copfinder/copart-bot-token` создан
- [ ] ARN секрета записан: _______________
- [ ] Секрет `copfinder/copart-chat-id` создан
- [ ] ARN секрета записан: _______________
- [ ] Секрет `copfinder/iaai-bot-token` создан
- [ ] ARN секрета записан: _______________
- [ ] Секрет `copfinder/iaai-chat-id` создан
- [ ] ARN секрета записан: _______________

### CloudWatch Logs
- [ ] Log Group `/ecs/copfinder` создан
- [ ] Retention period настроен: _______________

### ECS Cluster
- [ ] ECS Cluster создан: `copfinder-cluster`
- [ ] Infrastructure: Fargate

### IAM Roles
- [ ] Роль `copfinder-ecs-task-execution-role` создана
- [ ] Политика `AmazonECSTaskExecutionRolePolicy` прикреплена
- [ ] Inline политика для Secrets Manager создана
- [ ] Роль `copfinder-ecs-task-role` создана

### ECS Task Definition
- [ ] Task Definition создана: `copfinder`
- [ ] Launch type: Fargate
- [ ] CPU: 1 vCPU (1024)
- [ ] Memory: 2 GB (2048)
- [ ] Container image указан правильно
- [ ] Environment variables настроены
- [ ] Secrets настроены (4 секрета)
- [ ] Logging настроен (awslogs)
- [ ] Execution role указана
- [ ] Task role указана

### ECS Service
- [ ] ECS Service создана: `copfinder-service`
- [ ] Desired tasks: 1
- [ ] VPC и Subnets настроены
- [ ] Security Group назначена
- [ ] Public IP включен
- [ ] Service запущена и работает

### Проверка
- [ ] Задача в статусе "Running"
- [ ] Логи доступны в CloudWatch
- [ ] Ошибок в логах нет

---

## Общие настройки (для обоих вариантов)

### Мониторинг
- [ ] CloudWatch Dashboard создан (опционально)
- [ ] CloudWatch Alarms настроены (опционально)
- [ ] Уведомления настроены (опционально)

### Безопасность
- [ ] Security Groups настроены правильно
- [ ] IAM принцип наименьших привилегий соблюден
- [ ] Секреты хранятся в Secrets Manager (для ECS)
- [ ] Регулярные обновления запланированы

### Резервное копирование
- [ ] Стратегия резервного копирования определена
- [ ] Автоматические бэкапы настроены (если нужно)
- [ ] Тестирование восстановления выполнено

### Документация
- [ ] Все учетные данные записаны в безопасном месте
- [ ] Документация по развертыванию изучена
- [ ] Команды для управления записаны

---

## Полезные команды для проверки

### EC2
```bash
# Проверка подключения
ssh -i ~/.ssh/copfinder-key.pem ec2-user@YOUR_IP

# Проверка статуса приложения
pm2 status
pm2 logs

# Проверка использования ресурсов
df -h
free -h
```

### ECS
```bash
# Проверка статуса сервиса
aws ecs describe-services \
  --cluster copfinder-cluster \
  --services copfinder-service \
  --region us-east-1

# Просмотр логов
aws logs tail /ecs/copfinder --follow --region us-east-1

# Список задач
aws ecs list-tasks \
  --cluster copfinder-cluster \
  --region us-east-1
```

---

## Контакты и поддержка

- AWS Support: https://console.aws.amazon.com/support/
- AWS Documentation: https://docs.aws.amazon.com/
- Copfinder Documentation: `aws/README.md`

---

## Заметки

_Используйте это поле для записи важных заметок:_




