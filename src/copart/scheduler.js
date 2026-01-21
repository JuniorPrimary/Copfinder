import cron from 'node-cron';
import { loadCopartConfig, loadCopartSecrets } from '../config/copartConfig.js';
import { loadSeen } from './seenStore.js';
import { TelegramNotifier } from '../iaai/notifier.js';
import { runCopartSearch } from './runner.js';
import { delay } from '../utils/delay.js';

export async function startCopartScheduler() {
  const config = loadCopartConfig();
  const { botToken, chatId } = loadCopartSecrets();
  // Загружаем данные из Redis (асинхронно)
  const sentLots = await loadSeen();
  const notifyWhenEmpty = config.notifyWhenEmpty ?? true;

  const fetchOptions = {
    headless: config.headless ?? true,
    maxScrollSteps: config.maxScrollSteps ?? 5,
    scrollPauseMs: config.scrollPauseMs ?? 1200,
    proxy: config.proxy || null,
  };

  if (!Array.isArray(config.searches) || config.searches.length === 0) {
    throw new Error('В copart.config.json необходимо указать хотя бы один search');
  }

  const timezone = config.timezone || 'UTC';
  console.log(`📅 Таймзона для кронов: ${timezone}`);

  // Задержка между запусками cron задач (в секундах)
  const cronDelayBetweenSearches = config.cronDelayBetweenSearches ?? 20; // 20 секунд по умолчанию

  for (let i = 0; i < config.searches.length; i++) {
    const search = config.searches[i];
    if (!search.label || !search.url || !search.cron) {
      throw new Error('Каждый search должен содержать label, url и cron');
    }

    const messageThreadId = search.messageThreadId ?? null;
    const notifier = new TelegramNotifier(botToken, chatId, messageThreadId);

    console.log(
      `📌 Зарегистрирован крон для [${search.label}]: ${search.cron} (таймзона: ${timezone})`,
    );

    cron.schedule(
      search.cron,
      async () => {
        try {
          // Добавляем задержку перед запуском, чтобы задачи не запускались все одновременно
          if (i > 0) {
            const delayMs = cronDelayBetweenSearches * i * 1000;
            console.log(
              `⏳ [${search.label}] Ожидание ${delayMs / 1000} секунд перед запуском (позиция ${i + 1}/${config.searches.length})...`,
            );
            await delay(delayMs);
          }

          const now = new Date().toLocaleString('ru-RU', { timeZone: timezone });
          console.log(
            `⏰ Крон ${search.cron} (${search.label}) сработал в ${now} (${timezone})`,
          );
          console.log(`🚀 [${search.label}] Начинаем выполнение поиска...`);
          
          const result = await runCopartSearch(search, {
            notifier,
            sentLots,
            notifyWhenEmpty,
            fetchOptions,
          });
          
          console.log(
            `✅ [${search.label}] Завершено: найдено ${result.total}, отправлено ${result.sent}`,
          );
        } catch (error) {
          const errorMessage = error?.message || String(error);
          const errorStack = error?.stack || '';
          console.error(`❌ [${search.label}] Ошибка при выполнении:`, errorMessage);
          if (errorStack) {
            console.error(`[${search.label}] Stack trace:`, errorStack);
          }
        }
      },
      {
        timezone,
      },
    );
  }

  if (config.runOnStartup) {
    console.log(`🚀 Запуск начальных поисков (${config.searches.length} шт.)...`);
    const startupDelay = config.startupDelayBetweenSearches ?? 15000; // 15 секунд между запросами по умолчанию
    
    for (let i = 0; i < config.searches.length; i++) {
      const search = config.searches[i];
      const messageThreadId = search.messageThreadId ?? null;
      const notifier = new TelegramNotifier(botToken, chatId, messageThreadId);
      
      // Добавляем задержку перед каждым запросом (кроме первого)
      if (i > 0) {
        console.log(`⏳ Ожидание ${startupDelay / 1000} секунд перед следующим запросом...`);
        await delay(startupDelay);
      }
      
      console.log(`🔍 Запуск поиска [${search.label}] (${i + 1}/${config.searches.length})...`);
      await runCopartSearch(search, {
        notifier,
        sentLots,
        notifyWhenEmpty,
        fetchOptions,
      }).catch((error) => {
        console.error(`[${search.label}] Ошибка:`, error.message || error);
        // Продолжаем выполнение следующих поисков даже при ошибке
      });
    }
    console.log('✅ Все начальные поиски завершены');
  }

  console.log('Copart scheduler запущен, ожидаю срабатывания крон-задач…');
}

