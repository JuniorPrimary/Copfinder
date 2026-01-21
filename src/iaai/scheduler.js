import cron from 'node-cron';
import { loadIaaiConfig, loadIaaiSecrets } from '../config/iaaiConfig.js';
import { loadSentLots, resetSentLots } from './sentStore.js';
import { TelegramNotifier } from './notifier.js';
import { runIaaiSearch } from './runner.js';
import { delay } from '../utils/delay.js';

export async function startIaaiScheduler() {
  const config = loadIaaiConfig();
  const { botToken, chatId } = loadIaaiSecrets();
  // Загружаем данные из Redis (асинхронно)
  const sentLots = await loadSentLots();
  const notifyWhenEmpty = config.notifyWhenEmpty ?? true;

  if (!Array.isArray(config.searches) || config.searches.length === 0) {
    throw new Error('В iaai.config.json необходимо указать хотя бы один search');
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
          
          const result = await runIaaiSearch(search, {
            notifier,
            sentLots,
            notifyWhenEmpty,
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
    for (const search of config.searches) {
      const messageThreadId = search.messageThreadId ?? null;
      const notifier = new TelegramNotifier(botToken, chatId, messageThreadId);
      await runIaaiSearch(search, {
        notifier,
        sentLots,
        notifyWhenEmpty,
      }).catch((error) => console.error(`[${search.label}] Ошибка:`, error));
    }
  }

  if (config.cleanupCron) {
    cron.schedule(
      config.cleanupCron,
      async () => {
        try {
          await resetSentLots();
          console.log(
            `🧹 История отправленных лотов очищена по крону ${config.cleanupCron}`,
          );
        } catch (error) {
          console.error('Ошибка при очистке Redis:', error);
        }
      },
      {
        timezone: config.timezone || 'UTC',
      },
    );
  }

  console.log('IAAI scheduler запущен, ожидаю срабатывания крон-задач…');
}

