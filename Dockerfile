# Используем официальный образ Node.js
FROM node:20-slim

# Устанавливаем зависимости для Playwright
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    libu2f-udev \
    libvulkan1 \
    && rm -rf /var/lib/apt/lists/*

# Устанавливаем PM2 глобально
RUN npm install -g pm2

# Создаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production

# Устанавливаем браузеры для Playwright
RUN npx playwright install --with-deps chromium

# Копируем исходный код
COPY . .

# Создаем необходимые директории
RUN mkdir -p logs data artifacts

# Устанавливаем переменные окружения по умолчанию
ENV NODE_ENV=production

# Запускаем приложение через PM2
CMD ["pm2-runtime", "start", "ecosystem.config.cjs", "--no-daemon"]

