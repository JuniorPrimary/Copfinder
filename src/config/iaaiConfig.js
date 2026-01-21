import fs from 'node:fs';
import path from 'node:path';
import './env.js';
import { readJson } from '../utils/jsonStore.js';

const DEFAULT_PATH = path.resolve('config/iaai.config.json');

export function loadIaaiConfig(configPath = DEFAULT_PATH) {
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Не найден файл конфигурации IAAI по пути ${configPath}. Создайте его на основе config/iaai.config.json`,
    );
  }
  return readJson(configPath, {});
}

export function loadIaaiSecrets() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    throw new Error('Укажите TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в файле .env');
  }

  return { botToken, chatId };
}

