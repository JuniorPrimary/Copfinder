import TelegramBot from 'node-telegram-bot-api';
import { delay } from '../utils/delay.js';

export class TelegramNotifier {
  constructor(botToken, chatId, messageThreadId = null) {
    this.chatId = chatId;
    this.messageThreadId = messageThreadId;
    this.bot = new TelegramBot(botToken, { polling: false });
  }

  getMessageOptions() {
    const options = { parse_mode: 'HTML' };
    if (this.messageThreadId !== null) {
      options.message_thread_id = this.messageThreadId;
    }
    return options;
  }

  async sendText(text) {
    return sendWithRetry(() =>
      this.bot.sendMessage(this.chatId, text, this.getMessageOptions()),
    );
  }

  async sendPhoto(photo, caption) {
    return sendWithRetry(() =>
      this.bot.sendPhoto(this.chatId, photo, {
        caption,
        ...this.getMessageOptions(),
      }),
    );
  }
}

// Общий cooldown после 429: следующий send ждёт, чтобы не бить по лимиту снова (Copart и IAAI в одном чате)
const COOLDOWN_KEY = '__telegramCooldownUntil';

async function sendWithRetry(sendFn, maxRetries = 5) {
  if (typeof globalThis[COOLDOWN_KEY] === 'number' && Date.now() < globalThis[COOLDOWN_KEY]) {
    const waitMs = globalThis[COOLDOWN_KEY] - Date.now();
    console.log(`[Telegram] Ожидание ${Math.ceil(waitMs / 1000)} сек после недавнего 429…`);
    await delay(waitMs);
  }

  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      return await sendFn();
    } catch (err) {
      const statusCode = err.response && err.response.statusCode;
      const errorCode = err.code || '';
      const errorMessage = String(err.message || '');

      // Проверяем, нужно ли ретраить эту ошибку
      const is429 =
        statusCode === 429 || errorMessage.includes('429 Too Many Requests');

      // Сетевые ошибки, которые стоит ретраить
      const isRetryableNetworkError =
        errorCode === 'EFATAL' ||
        errorCode === 'ETIMEDOUT' ||
        errorCode === 'ECONNRESET' ||
        errorCode === 'ENOTFOUND' ||
        errorCode === 'ECONNREFUSED' ||
        errorCode === 'EAI_AGAIN' ||
        errorCode === 'ESOCKETTIMEDOUT' ||
        errorCode === 'EADDRNOTAVAIL' ||
        errorMessage.includes('AggregateError') ||
        errorMessage.includes('socket hang up') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('network') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('ERR_INTERNET_DISCONNECTED') ||
        errorMessage.includes('ERR_NETWORK_CHANGED') ||
        errorMessage.includes('ERR_CONNECTION_REFUSED') ||
        errorMessage.includes('ERR_CONNECTION_RESET') ||
        errorMessage.includes('ERR_CONNECTION_TIMED_OUT') ||
        errorMessage.includes('ERR_NAME_NOT_RESOLVED');

      // Если это не ретраируемая ошибка, выбрасываем сразу
      if (!is429 && !isRetryableNetworkError) {
        console.error(
          `[Telegram] Не ретраируемая ошибка: ${errorCode} - ${errorMessage}`,
        );
        throw err;
      }

      // Логируем попытку ретрая
      const errorType = is429 ? '429 (Rate Limit)' : `Network (${errorCode})`;
      console.warn(
        `[Telegram] Ошибка ${errorType}, попытка ${attempt + 1}/${maxRetries}: ${errorMessage}`,
      );

      // Определяем задержку перед ретраем
      let retryAfter = 30; // По умолчанию 30 секунд

      if (is429) {
        // Для 429 используем retry_after из ответа Telegram (обязательно ждём указанное время)
        try {
          let body = err.response && err.response.body;
          if (typeof body === 'string') {
            try {
              body = JSON.parse(body);
            } catch {
              body = null;
            }
          }
          if (body && body.parameters && typeof body.parameters.retry_after === 'number') {
            retryAfter = body.parameters.retry_after;
          } else {
            const m = errorMessage.match(/retry after (\d+)/i);
            if (m) retryAfter = Number(m[1]);
          }
          // Буфер +2 сек, минимум 5. Не уменьшаем retry_after от Telegram.
          retryAfter = Math.max((retryAfter || 30) + 2, 5);
          // Cooldown для следующего send (общий для Copart/IAAI): retry_after + 30 сек
          globalThis[COOLDOWN_KEY] = Date.now() + (retryAfter + 30) * 1000;
        } catch {
          const m = String(err?.message || '').match(/retry after (\d+)/i);
          if (m) {
            retryAfter = Math.max(Number(m[1]) + 2, 5);
            globalThis[COOLDOWN_KEY] = Date.now() + (retryAfter + 30) * 1000;
          }
        }
      } else {
        // Для сетевых ошибок используем экспоненциальную задержку
        // 2^attempt секунд: 2, 4, 8, 16, 32 секунды
        retryAfter = Math.min(Math.pow(2, attempt + 1), 60);
      }

      attempt += 1;

      // Если это последняя попытка, выбрасываем ошибку
      if (attempt > maxRetries) {
        console.error(
          `[Telegram] Исчерпаны все попытки (${maxRetries}), последняя ошибка: ${errorCode} - ${errorMessage}`,
        );
        throw err;
      }

      // Ждем перед следующей попыткой
      console.log(`[Telegram] Повтор через ${retryAfter} секунд...`);
      await delay(retryAfter * 1000);
    }
  }
}

