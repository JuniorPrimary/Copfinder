import { chromium } from 'playwright';
import { applyStealth } from '../utils/stealth.js';
import { delay } from '../utils/delay.js';

export async function fetchHtml(url, options = {}) {
  const {
    headless = true,
    maxScrollSteps = 5,
    scrollPauseMs = 1200,
    proxy = null,
    maxRetries = 3,
  } = options;

  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const browser = await chromium.launch({ headless });
    const context = await browser.newContext({
      viewport: { width: 1366, height: 900 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      proxy: proxy ? { server: proxy } : undefined,
    });

    await applyStealth(context);

    const page = await context.newPage();

    try {
      // Сначала загружаем страницу с базовым ожиданием
      await page.goto(url, {
        waitUntil: 'domcontentloaded', // Ждём загрузки DOM
        timeout: 120000, // Увеличиваем таймаут до 120 секунд
      });

      // Принимаем cookies если есть баннер
      try {
        await page.waitForSelector('#onetrust-accept-btn-handler', { timeout: 5000 });
        await page.click('#onetrust-accept-btn-handler');
        await delay(1000);
      } catch {
        // banner not present
      }

      // Даём JS время на рендеринг Angular приложения
      try {
        await page.waitForTimeout(3000);
      } catch (err) {
        if (err.message && err.message.includes('Target page, context or browser has been closed')) {
          throw new Error('Page was closed before timeout');
        }
        throw err;
      }

      // Ждём появления таблицы с результатами или лотов (это более надёжно, чем networkidle)
      try {
        // Пробуем разные селекторы для таблицы результатов
        await page.waitForSelector(
          '.p-datatable-tbody, .search_table_main_container, a[href*="/lot/"], tr[data-lotnumber], .p-selectable-row',
          { timeout: 40000 },
        );
        console.log('Таблица результатов найдена');
      } catch (err) {
        console.log('Таблица результатов не найдена, продолжаем...');
        // selectors not found — всё равно продолжаем
      }

      // Дополнительное ожидание для загрузки данных через Angular
      try {
        await page.waitForTimeout(2000);
      } catch (err) {
        if (err.message && err.message.includes('Target page, context or browser has been closed')) {
          throw new Error('Page was closed during data loading');
        }
        throw err;
      }

      // Скроллим для подгрузки контента (lazy loading)
      for (let i = 0; i < maxScrollSteps; i += 1) {
        await page.evaluate(() =>
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }),
        );
        await delay(scrollPauseMs);
        
        // После каждого скролла ждём немного для подгрузки
        try {
          await page.waitForTimeout(500);
        } catch (err) {
          if (err.message && err.message.includes('Target page, context or browser has been closed')) {
            throw new Error('Page was closed during scrolling');
          }
          throw err;
        }
      }

      // Финальное ожидание после всех скроллов
      try {
        await page.waitForTimeout(2000);
      } catch (err) {
        if (err.message && err.message.includes('Target page, context or browser has been closed')) {
          throw new Error('Page was closed after scrolling');
        }
        throw err;
      }

      // Получаем финальный HTML
      const html = await page.content();
      
      await context.close();
      await browser.close();
      
      return html;
    } catch (error) {
      lastError = error;
      const errorMessage = String(error.message || '');
      const errorName = error.name || '';
      
      // Проверяем, является ли это сетевой ошибкой, которую стоит ретраить
      const isRetryableError =
        errorName === 'TimeoutError' ||
        errorMessage.includes('ERR_INTERNET_DISCONNECTED') ||
        errorMessage.includes('ERR_NETWORK_CHANGED') ||
        errorMessage.includes('ERR_CONNECTION_REFUSED') ||
        errorMessage.includes('ERR_CONNECTION_RESET') ||
        errorMessage.includes('ERR_CONNECTION_TIMED_OUT') ||
        errorMessage.includes('ERR_NAME_NOT_RESOLVED') ||
        errorMessage.includes('EADDRNOTAVAIL') ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('ENOTFOUND') ||
        errorMessage.includes('network') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('Target page, context or browser has been closed');

      if (!isRetryableError || attempt >= maxRetries) {
        await context.close().catch(() => {});
        await browser.close().catch(() => {});
        throw error;
      }

      console.warn(
        `[fetchHtml] Ошибка подключения (попытка ${attempt + 1}/${maxRetries + 1}): ${errorName} - ${errorMessage}`,
      );

      await context.close().catch(() => {});
      await browser.close().catch(() => {});

      // Экспоненциальная задержка перед повтором: 10, 20, 40 секунд
      // Увеличиваем задержки для таймаутов, чтобы дать серверу больше времени
      const retryDelay = Math.min(10 * Math.pow(2, attempt), 60) * 1000;
      console.log(`[fetchHtml] Повтор через ${retryDelay / 1000} секунд...`);
      await delay(retryDelay);
    }
  }

  // Если дошли сюда, все попытки исчерпаны
  throw lastError || new Error('Не удалось подключиться к серверу после всех попыток');
}

