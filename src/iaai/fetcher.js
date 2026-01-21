import axios from 'axios';
import { delay } from '../utils/delay.js';

export async function fetchHtml(url, options = {}) {
  const { maxRetries = 3 } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await axios.get(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: 60000, // 60 секунд таймаут
      });
      return res.data;
    } catch (error) {
      lastError = error;
      const errorMessage = String(error.message || '');
      const errorCode = error.code || '';
      const errorName = error.name || '';

      // Проверяем, является ли это сетевой ошибкой, которую стоит ретраить
      const isRetryableError =
        errorName === 'AxiosError' ||
        errorCode === 'ETIMEDOUT' ||
        errorCode === 'ECONNRESET' ||
        errorCode === 'ENOTFOUND' ||
        errorCode === 'ECONNREFUSED' ||
        errorCode === 'EAI_AGAIN' ||
        errorCode === 'ESOCKETTIMEDOUT' ||
        errorCode === 'EADDRNOTAVAIL' ||
        errorMessage.includes('ERR_INTERNET_DISCONNECTED') ||
        errorMessage.includes('ERR_NETWORK_CHANGED') ||
        errorMessage.includes('ERR_CONNECTION_REFUSED') ||
        errorMessage.includes('ERR_CONNECTION_RESET') ||
        errorMessage.includes('ERR_CONNECTION_TIMED_OUT') ||
        errorMessage.includes('ERR_NAME_NOT_RESOLVED') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('network') ||
        errorMessage.includes('connection') ||
        (error.response && error.response.status >= 500); // Серверные ошибки 5xx

      // Если это не ретраируемая ошибка или исчерпаны попытки, выбрасываем ошибку
      if (!isRetryableError || attempt >= maxRetries) {
        throw error;
      }

      console.warn(
        `[fetchHtml] Ошибка подключения (попытка ${attempt + 1}/${maxRetries + 1}): ${errorCode || errorName} - ${errorMessage}`,
      );

      // Экспоненциальная задержка перед повтором: 10, 20, 40 секунд
      const retryDelay = Math.min(10 * Math.pow(2, attempt), 60) * 1000;
      console.log(`[fetchHtml] Повтор через ${retryDelay / 1000} секунд...`);
      await delay(retryDelay);
    }
  }

  // Если дошли сюда, все попытки исчерпаны
  throw lastError || new Error('Не удалось подключиться к серверу после всех попыток');
}

