#!/bin/bash
# Скрипт для развертывания на AWS ECS/Fargate

set -e

echo "🚀 Начало развертывания Copfinder на AWS ECS..."

# Проверяем наличие необходимых инструментов
command -v aws >/dev/null 2>&1 || { echo "❌ AWS CLI не установлен"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker не установлен"; exit 1; }

# Переменные (настройте под свои нужды)
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID}"
ECR_REPO_NAME="${ECR_REPO_NAME:-copfinder}"
ECS_CLUSTER_NAME="${ECS_CLUSTER_NAME:-copfinder-cluster}"
ECS_SERVICE_NAME="${ECS_SERVICE_NAME:-copfinder-service}"
ECS_TASK_DEFINITION="${ECS_TASK_DEFINITION:-aws/ecs-task-definition.json}"

if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo "❌ Установите переменную окружения AWS_ACCOUNT_ID"
    exit 1
fi

ECR_REPO_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_NAME"

echo "📍 Регион: $AWS_REGION"
echo "📍 ECR репозиторий: $ECR_REPO_URI"

# Создаем ECR репозиторий (если не существует)
echo "📦 Проверка ECR репозитория..."
aws ecr describe-repositories --repository-names "$ECR_REPO_NAME" --region "$AWS_REGION" 2>/dev/null || \
    aws ecr create-repository --repository-name "$ECR_REPO_NAME" --region "$AWS_REGION"

# Логинимся в ECR
echo "🔐 Авторизация в ECR..."
aws ecr get-login-password --region "$AWS_REGION" | \
    docker login --username AWS --password-stdin "$ECR_REPO_URI"

# Собираем Docker образ
echo "🔨 Сборка Docker образа..."
docker build -t "$ECR_REPO_NAME:latest" .

# Тегируем образ
docker tag "$ECR_REPO_NAME:latest" "$ECR_REPO_URI:latest"

# Пушим образ в ECR
echo "📤 Загрузка образа в ECR..."
docker push "$ECR_REPO_URI:latest"

# Обновляем task definition
echo "📝 Обновление task definition..."
# Заменяем плейсхолдеры в task definition
sed "s|YOUR_ECR_REPO_URI|$ECR_REPO_URI|g; s|YOUR_ACCOUNT_ID|$AWS_ACCOUNT_ID|g; s|REGION|$AWS_REGION|g" \
    "$ECS_TASK_DEFINITION" > /tmp/task-definition.json

# Регистрируем новую ревизию task definition
TASK_DEF_ARN=$(aws ecs register-task-definition \
    --cli-input-json file:///tmp/task-definition.json \
    --region "$AWS_REGION" \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text)

echo "✅ Новая ревизия task definition: $TASK_DEF_ARN"

# Обновляем сервис (если он существует)
if aws ecs describe-services \
    --cluster "$ECS_CLUSTER_NAME" \
    --services "$ECS_SERVICE_NAME" \
    --region "$AWS_REGION" \
    --query 'services[0].status' \
    --output text 2>/dev/null | grep -q "ACTIVE"; then
    
    echo "🔄 Обновление ECS сервиса..."
    aws ecs update-service \
        --cluster "$ECS_CLUSTER_NAME" \
        --service "$ECS_SERVICE_NAME" \
        --task-definition "$TASK_DEF_ARN" \
        --region "$AWS_REGION" \
        --force-new-deployment > /dev/null
    
    echo "✅ Сервис обновлен. Ожидание стабилизации..."
    aws ecs wait services-stable \
        --cluster "$ECS_CLUSTER_NAME" \
        --services "$ECS_SERVICE_NAME" \
        --region "$AWS_REGION"
else
    echo "⚠️  Сервис не найден. Создайте его вручную через консоль AWS или используйте terraform/cloudformation"
fi

echo "✅ Развертывание завершено!"

