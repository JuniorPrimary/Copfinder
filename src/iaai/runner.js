import { fetchHtml } from './fetcher.js';
import { parseLots } from './parser.js';
import { loadSentLots, saveSentLots, addSent } from './sentStore.js';
import { getDeliveryTotal } from '../services/easyhaul.js';
import { escapeHtml } from '../utils/html.js';
import { delay } from '../utils/delay.js';

/**
 * Извлекает номер лота из URL (например /VehicleDetail/43931728 → 43931728)
 */
function extractLotNumberFromUrl(url) {
  if (!url) return null;
  try {
    const pathname = new URL(url.trim()).pathname;
    const segments = pathname.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    const match = lastSegment && String(lastSegment).match(/\d+/);
    return match ? match[0] : null;
  } catch (e) {
    return null;
  }
}

/**
 * Нормализует URL для корректного сравнения
 * Убирает trailing slash, параметры запроса, фрагменты и приводит к единому формату
 */
function normalizeUrl(url) {
  if (!url) return '';
  try {
    // Создаем URL объект для парсинга
    const urlObj = new URL(url.trim());
    // Возвращаем базовый URL без параметров и фрагментов
    return urlObj.origin + urlObj.pathname;
  } catch (e) {
    // Если не удалось распарсить как URL, возвращаем как есть, но убираем пробелы
    return url.trim();
  }
}

export async function runIaaiSearch(search, ctx) {
  const { label, url } = search;
  const { notifier, sentLots, notifyWhenEmpty } = ctx;

  // Загружаем данные из Redis перед каждым поиском для синхронизации
  const rawSentLots = await loadSentLots();
  // Создаем нормализованный Set для сравнения
  const currentSentLots = new Set();
  rawSentLots.forEach((url) => {
    const normalized = normalizeUrl(url);
    if (normalized) {
      currentSentLots.add(normalized);
    }
  });
  
  // Объединяем с существующим Set в памяти (на случай параллельных запусков)
  sentLots.forEach((url) => {
    const normalized = normalizeUrl(url);
    if (normalized) {
      currentSentLots.add(normalized);
    }
  });

  let html;
  try {
    html = await fetchHtml(url);
  } catch (error) {
    const errorMessage = String(error.message || '');
    const errorCode = error.code || '';
    console.error(
      `[${label}] Ошибка при загрузке страницы: ${errorCode || error.name || 'Unknown'} - ${errorMessage}`,
    );
    // Возвращаем пустой результат при ошибке загрузки
    return { total: 0, sent: 0 };
  }

  const lots = parseLots(html);
  // Нормализуем URL каждого лота перед проверкой
  const newLots = lots.filter((lot) => {
    if (!lot.url) return false;
    const normalizedLotUrl = normalizeUrl(lot.url);
    const isNew = !currentSentLots.has(normalizedLotUrl);
    if (!isNew) {
      console.log(`[${label}] Лот уже был отправлен (пропускаем): ${normalizedLotUrl}`);
    }
    return isNew;
  });
  
  console.log(`[${label}] Всего лотов: ${lots.length}, уже отправлено: ${currentSentLots.size}, новых: ${newLots.length}`);

  if (!newLots.length) {
    if (notifyWhenEmpty) {
      await notifier.sendText(`[${label}] Нових лотів поки немає 🙂`);
    }
    return { total: lots.length, sent: 0 };
  }

  for (const lot of newLots) {
    const lotNumber = lot.lotNumber != null ? String(lot.lotNumber) : extractLotNumberFromUrl(lot.url);
    const deliveryTotal = lotNumber ? await getDeliveryTotal(lotNumber, 2) : null;
    const caption = buildCaption(lot, deliveryTotal);

    try {
      if (lot.imageUrl) {
        try {
          await notifier.sendPhoto(lot.imageUrl, caption);
        } catch (error) {
          const errorMessage = String(error.message || '');
          // Если Telegram не может загрузить изображение, отправляем только текст
          if (
            errorMessage.includes('failed to get HTTP URL content') ||
            errorMessage.includes('wrong type of the web page content') ||
            errorMessage.includes('Bad Request') ||
            errorMessage.includes('ETELEGRAM')
          ) {
            console.warn(
              `[${label}] Не удалось отправить изображение для лота ${lot.url}, отправляем только текст`,
            );
            await notifier.sendText(caption);
          } else {
            // Для других ошибок пробуем отправить текст как fallback
            console.warn(
              `[${label}] Ошибка при отправке фото для лота ${lot.url}: ${errorMessage}, пробуем отправить текст`,
            );
            try {
              await notifier.sendText(caption);
            } catch (textError) {
              console.error(
                `[${label}] Не удалось отправить сообщение для лота ${lot.url}: ${textError.message}`,
              );
              // Продолжаем со следующим лотом
              continue;
            }
          }
        }
      } else {
        await notifier.sendText(caption);
      }

      // Нормализуем URL перед добавлением
      const normalizedLotUrl = normalizeUrl(lot.url);
      
      // Добавляем в Set только после успешной отправки
      currentSentLots.add(normalizedLotUrl);
      sentLots.add(normalizedLotUrl);
      // Сохраняем в Redis напрямую (Redis автоматически установит TTL)
      await addSent(normalizedLotUrl);
      console.log(`[${label}] Лот отправлен и сохранен в Redis: ${normalizedLotUrl} (оригинал: ${lot.url})`);
      // Задержка 6 секунд между отправками (Telegram ~20 msg/мин в группу; при Copart+IAAI 6 сек безопаснее)
      await delay(6000);
    } catch (error) {
      console.error(`[${label}] Ошибка при отправке лота ${lot.url}:`, error.message || error);
      // Не добавляем в Set при ошибке, чтобы можно было повторить попытку
      // При ошибке (в т.ч. 429) ждём дольше перед следующим лотом
      await delay(15000);
    }
  }

  return { total: lots.length, sent: newLots.length };
}

function buildCaption(lot, deliveryTotal = null) {
  const lines = [];
  lines.push(`🚗 <b>${escapeHtml(lot.title || 'Без назви')}</b>`);
  if (lot.year) lines.push(`Рік: <b>${escapeHtml(lot.year)}</b>`);
  if (lot.odometer) {
    lines.push(`Пробіг: <b>${escapeHtml(lot.odometer)}</b>`);
  }
  lines.push(
    `Buy Now: ${
      lot.buyNow ? `<b>${escapeHtml(lot.buyNow)}</b>` : '<i>немає ціни</i>'
    }`,
  );
  if (lot.url) {
    lines.push(`Лінк: <a href="${escapeHtml(lot.url)}">Відкрити лот</a>`);
  }
  if (deliveryTotal != null) {
    lines.push(`Оріентовна ціна доставки до Клайпеди - <b>$${deliveryTotal}</b>`);
  }
  lines.push('За детальним розрахунком авто в Україні/Польщі - @Valeriy0592');
  return lines.join('\n');
}

