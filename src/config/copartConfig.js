import fs from 'node:fs';
import path from 'node:path';
import './env.js';
import { readJson } from '../utils/jsonStore.js';

const DEFAULT_CONFIG_PATH = path.resolve('config/copart.config.json');

export function loadCopartConfig(configPath = DEFAULT_CONFIG_PATH) {
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Не найден файл конфигурации Copart по пути ${configPath}. Создайте его на основе config/copart.config.json`,
    );
  }
  return readJson(configPath, {});
}

export function loadCopartSecrets() {
  const botToken = process.env.COPART_TELEGRAM_BOT_TOKEN;
  const chatId = process.env.COPART_TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    throw new Error('Укажите COPART_TELEGRAM_BOT_TOKEN и COPART_TELEGRAM_CHAT_ID в файле .env');
  }

  return { botToken, chatId };
}

