#!/bin/bash
# Скрипт для диагностики подключения к AWS EC2

set -e

echo "🔍 Диагностика подключения к AWS EC2..."
echo ""

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Проверяем переменные окружения
echo "📋 Проверка переменных окружения:"
INSTANCE_ID="${AWS_INSTANCE_ID}"
PUBLIC_IP="${AWS_PUBLIC_IP}"
SSH_KEY="${AWS_SSH_KEY:-~/.ssh/copfinder-key.pem}"
SSH_USER="${AWS_SSH_USER:-ec2-user}"

# Расширяем ~ в пути
SSH_KEY="${SSH_KEY/#\~/$HOME}"

echo "  AWS_INSTANCE_ID: ${INSTANCE_ID:-❌ не установлен}"
echo "  AWS_PUBLIC_IP: ${PUBLIC_IP:-❌ не установлен}"
echo "  AWS_SSH_KEY: $SSH_KEY"
echo "  AWS_SSH_USER: $SSH_USER"
echo ""

# Проверка 1: Существует ли SSH ключ
echo "1️⃣  Проверка SSH ключа..."
if [ -f "$SSH_KEY" ]; then
    echo -e "   ${GREEN}✅ Файл ключа найден: $SSH_KEY${NC}"
    
    # Проверяем права доступа
    PERMS=$(stat -f "%OLp" "$SSH_KEY" 2>/dev/null || stat -c "%a" "$SSH_KEY" 2>/dev/null || echo "unknown")
    if [ "$PERMS" == "400" ] || [ "$PERMS" == "600" ]; then
        echo -e "   ${GREEN}✅ Права доступа правильные: $PERMS${NC}"
    else
        echo -e "   ${YELLOW}⚠️  Права доступа: $PERMS (рекомендуется 400)${NC}"
        echo "   💡 Исправление: chmod 400 $SSH_KEY"
    fi
else
    echo -e "   ${RED}❌ Файл ключа не найден: $SSH_KEY${NC}"
    echo "   💡 Решение:"
    echo "      1. Проверьте путь к ключу"
    echo "      2. Если ключ в Downloads, переместите его:"
    echo "         mv ~/Downloads/copfinder-key.pem ~/.ssh/copfinder-key.pem"
    echo "         chmod 400 ~/.ssh/copfinder-key.pem"
    exit 1
fi
echo ""

# Проверка 2: Получение IP адреса
echo "2️⃣  Получение IP адреса инстанса..."
if [ -z "$PUBLIC_IP" ]; then
    if [ -z "$INSTANCE_ID" ]; then
        echo -e "   ${RED}❌ Не указан ни AWS_INSTANCE_ID, ни AWS_PUBLIC_IP${NC}"
        echo "   💡 Решение:"
        echo "      export AWS_PUBLIC_IP='54.235.6.145'  # Замените на ваш IP"
        exit 1
    fi
    
    # Пытаемся получить IP через AWS CLI
    if command -v aws >/dev/null 2>&1; then
        echo "   🔍 Используем AWS CLI для получения IP..."
        PUBLIC_IP=$(aws ec2 describe-instances \
            --instance-ids "$INSTANCE_ID" \
            --query 'Reservations[0].Instances[0].PublicIpAddress' \
            --output text 2>/dev/null || echo "")
        
        if [ -z "$PUBLIC_IP" ] || [ "$PUBLIC_IP" == "None" ]; then
            echo -e "   ${YELLOW}⚠️  Не удалось получить IP через AWS CLI${NC}"
            echo "   💡 Решение: укажите IP напрямую:"
            echo "      export AWS_PUBLIC_IP='54.235.6.145'"
            exit 1
        else
            echo -e "   ${GREEN}✅ IP получен через AWS CLI: $PUBLIC_IP${NC}"
        fi
    else
        echo -e "   ${YELLOW}⚠️  AWS CLI не установлен${NC}"
        echo "   💡 Решение: укажите IP напрямую:"
        echo "      export AWS_PUBLIC_IP='54.235.6.145'"
        exit 1
    fi
else
    echo -e "   ${GREEN}✅ IP указан напрямую: $PUBLIC_IP${NC}"
fi
echo ""

# Проверка 3: Проверка доступности порта 22
echo "3️⃣  Проверка доступности SSH порта (22)..."
if command -v nc >/dev/null 2>&1; then
    if nc -z -w 5 "$PUBLIC_IP" 22 2>/dev/null; then
        echo -e "   ${GREEN}✅ Порт 22 доступен${NC}"
    else
        echo -e "   ${RED}❌ Порт 22 недоступен${NC}"
        echo "   💡 Возможные причины:"
        echo "      - Security Group не открыт для вашего IP"
        echo "      - Инстанс не запущен"
        echo "      - Неправильный IP адрес"
    fi
elif command -v timeout >/dev/null 2>&1 && command -v bash >/dev/null 2>&1; then
    # Альтернативная проверка через timeout
    if timeout 5 bash -c "echo > /dev/tcp/$PUBLIC_IP/22" 2>/dev/null; then
        echo -e "   ${GREEN}✅ Порт 22 доступен${NC}"
    else
        echo -e "   ${YELLOW}⚠️  Не удалось проверить порт (nc не установлен)${NC}"
    fi
else
    echo -e "   ${YELLOW}⚠️  Не удалось проверить порт (nc не установлен)${NC}"
fi
echo ""

# Проверка 4: Тестовое SSH подключение
echo "4️⃣  Тестовое SSH подключение..."
echo "   Попытка подключения: ssh -i $SSH_KEY $SSH_USER@$PUBLIC_IP"
echo ""

# Пробуем подключиться с коротким таймаутом
if ssh -i "$SSH_KEY" \
    -o ConnectTimeout=10 \
    -o StrictHostKeyChecking=no \
    -o BatchMode=yes \
    "$SSH_USER@$PUBLIC_IP" \
    "echo '✅ Подключение успешно!'" 2>&1; then
    echo ""
    echo -e "${GREEN}✅✅✅ ПОДКЛЮЧЕНИЕ УСПЕШНО! ✅✅✅${NC}"
    echo ""
    echo "📝 Полезные команды:"
    echo "   Подключение: ssh -i $SSH_KEY $SSH_USER@$PUBLIC_IP"
    echo "   Развертывание: ./aws/ec2-deploy.sh"
else
    SSH_EXIT_CODE=$?
    echo ""
    echo -e "${RED}❌❌❌ ПОДКЛЮЧЕНИЕ НЕУДАЧНО ❌❌❌${NC}"
    echo ""
    echo "🔧 Диагностика ошибки (код: $SSH_EXIT_CODE):"
    
    case $SSH_EXIT_CODE in
        255)
            echo "   Проблема с подключением или аутентификацией"
            echo "   💡 Проверьте:"
            echo "      - Правильность IP адреса"
            echo "      - Security Group открыт для вашего IP"
            echo "      - Инстанс в статусе 'Running'"
            echo "      - Правильность SSH ключа"
            echo "      - Правильность пользователя ($SSH_USER)"
            ;;
        1)
            echo "   Ошибка аутентификации"
            echo "   💡 Проверьте:"
            echo "      - Правильность SSH ключа"
            echo "      - Права доступа к ключу (должны быть 400)"
            ;;
        *)
            echo "   Неизвестная ошибка"
            ;;
    esac
    
    echo ""
    echo "📋 Пошаговая проверка:"
    echo "   1. Проверьте статус инстанса в AWS Console"
    echo "   2. Проверьте Security Group (порт 22 для вашего IP)"
    echo "   3. Проверьте правильность IP: $PUBLIC_IP"
    echo "   4. Проверьте пользователя: $SSH_USER (ec2-user для Amazon Linux, ubuntu для Ubuntu)"
    echo "   5. Попробуйте подключиться вручную:"
    echo "      ssh -i $SSH_KEY $SSH_USER@$PUBLIC_IP"
    
    exit 1
fi

