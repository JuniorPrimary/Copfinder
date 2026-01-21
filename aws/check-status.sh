#!/bin/bash
# Скрипт для проверки статуса приложения на AWS EC2

set -e

PUBLIC_IP="${AWS_PUBLIC_IP:-54.235.6.145}"
SSH_KEY="${AWS_SSH_KEY:-~/.ssh/copfinder-key.pem}"
SSH_USER="${AWS_SSH_USER:-ec2-user}"
APP_DIR="/opt/copfinder"

# Расширяем ~ в пути
SSH_KEY="${SSH_KEY/#\~/$HOME}"

echo "🔍 Проверка статуса приложения на $PUBLIC_IP..."
echo ""

# Проверка 1: Статус PM2
echo "1️⃣  Статус PM2 процессов:"
ssh -i "$SSH_KEY" "$SSH_USER@$PUBLIC_IP" "cd $APP_DIR && pm2 status" 2>&1 || echo "❌ Не удалось получить статус PM2"
echo ""

# Проверка 2: Логи PM2 (последние 20 строк)
echo "2️⃣  Последние логи PM2:"
ssh -i "$SSH_KEY" "$SSH_USER@$PUBLIC_IP" "cd $APP_DIR && pm2 logs --lines 20 --nostream" 2>&1 | tail -30 || echo "❌ Не удалось получить логи"
echo ""

# Проверка 3: Логи ошибок
echo "3️⃣  Последние ошибки (copart):"
ssh -i "$SSH_KEY" "$SSH_USER@$PUBLIC_IP" "tail -30 $APP_DIR/logs/pm2-copart-error.log 2>/dev/null || echo 'Файл логов не найден'" 2>&1
echo ""

echo "4️⃣  Последние ошибки (iaai):"
ssh -i "$SSH_KEY" "$SSH_USER@$PUBLIC_IP" "tail -30 $APP_DIR/logs/pm2-iaai-error.log 2>/dev/null || echo 'Файл логов не найден'" 2>&1
echo ""

# Проверка 5: Использование ресурсов
echo "5️⃣  Использование ресурсов:"
ssh -i "$SSH_KEY" "$SSH_USER@$PUBLIC_IP" "cd $APP_DIR && pm2 monit --no-interaction" 2>&1 | head -20 || ssh -i "$SSH_KEY" "$SSH_USER@$PUBLIC_IP" "free -h && df -h /" 2>&1
echo ""

# Проверка 6: Проверка .env файла
echo "6️⃣  Проверка конфигурации (.env):"
ssh -i "$SSH_KEY" "$SSH_USER@$PUBLIC_IP" "cd $APP_DIR && if [ -f .env ]; then echo '✅ .env файл существует'; grep -E '^[A-Z_]+=' .env | sed 's/=.*/=***/' | head -5; else echo '❌ .env файл не найден'; fi" 2>&1
echo ""

echo "✅ Проверка завершена!"
echo ""
echo "📝 Полезные команды:"
echo "   Подключение: ssh -i $SSH_KEY $SSH_USER@$PUBLIC_IP"
echo "   PM2 статус: ssh -i $SSH_KEY $SSH_USER@$PUBLIC_IP 'cd $APP_DIR && pm2 status'"
echo "   PM2 логи: ssh -i $SSH_KEY $SSH_USER@$PUBLIC_IP 'cd $APP_DIR && pm2 logs'"
echo "   Перезапуск: ssh -i $SSH_KEY $SSH_USER@$PUBLIC_IP 'cd $APP_DIR && pm2 restart ecosystem.config.cjs'"

