import { fetchHtml } from './fetcher.js';
import { parseLots } from './parser.js';
import { loadSeen, saveSeen, hasSeen, addSeen } from './seenStore.js';
import { escapeHtml } from '../utils/html.js';
import { delay } from '../utils/delay.js';

import fs from 'node:fs';
import path from 'node:path';

/**
 * Нормализует lotId для корректного сравнения
 * Убирает пробелы, приводит к строке, убирает лишние символы
 */
function normalizeLotId(lotId) {
  if (!lotId) return '';
  // Приводим к строке, убираем пробелы и лишние символы
  return String(lotId).trim().replace(/\s+/g, '');
}

export async function runCopartSearch(search, ctx) {
  const { label, url } = search;
  const { notifier, sentLots, notifyWhenEmpty, fetchOptions } = ctx;

  // Загружаем данные из Redis перед каждым поиском для синхронизации
  // Это важно, чтобы видеть изменения, внесенные другими поисками или предыдущими запусками
  const rawSeenLots = await loadSeen();
  // Создаем нормализованный Set для сравнения
  const normalizedSeenLots = new Set();
  rawSeenLots.forEach((lotId) => {
    const normalized = normalizeLotId(lotId);
    if (normalized) {
      normalizedSeenLots.add(normalized);
    }
  });
  
  // Объединяем с существующим Set в памяти (на случай параллельных запусков)
  // Важно: нормализуем все lotId из памяти перед добавлением
  sentLots.forEach((lotId) => {
    const normalized = normalizeLotId(lotId);
    if (normalized) {
      normalizedSeenLots.add(normalized);
    }
  });
  
  // Также обновляем sentLots в памяти нормализованными значениями для консистентности
  sentLots.clear();
  normalizedSeenLots.forEach((normalized) => {
    sentLots.add(normalized);
  });

  let html;
  try {
    html = await fetchHtml(url, fetchOptions);
  } catch (error) {
    const errorMessage = String(error.message || '');
    const errorCode = error.code || '';
    console.error(
      `[${label}] Ошибка при загрузке страницы: ${errorCode || error.name || 'Unknown'} - ${errorMessage}`,
    );
    // Возвращаем пустой результат при ошибке загрузки
    return { total: 0, sent: 0 };
  }
  
  // Сохраняем HTML для отладки (опционально, можно закомментировать)
  try {
    const debugPath = path.resolve('artifacts/copart-debug.html');
    fs.writeFileSync(debugPath, html);
    console.log(`[${label}] HTML сохранён в ${debugPath} для отладки`);
  } catch (e) {
    // ignore
  }
  
  const lots = parseLots(html);
  
  // Логируем информацию о найденных лотах для отладки
  if (lots.length > 0) {
    console.log(`[${label}] Найдено лотов: ${lots.length}`);
    const firstLot = lots[0];
    console.log(`[${label}] Пример лота: lotId=${firstLot.lotId}, title=${firstLot.title}, buyNow=${firstLot.buyNow || 'не найдено'}, odometer=${firstLot.odometer || 'не найден'}`);
  }
  
  // Фильтруем по lotId (уникальный идентификатор) с нормализацией
  const newLots = lots.filter((lot) => {
    if (!lot.lotId) return false;
    const normalizedLotId = normalizeLotId(lot.lotId);
    const isNew = !normalizedSeenLots.has(normalizedLotId);
    if (!isNew) {
      console.log(`[${label}] Лот уже был отправлен (пропускаем): ${normalizedLotId} (оригинал: ${lot.lotId})`);
    } else {
      // Логируем для отладки, если лот новый
      console.log(`[${label}] Новый лот найден: ${normalizedLotId} (оригинал: ${lot.lotId}, всего в базе: ${normalizedSeenLots.size})`);
    }
    return isNew;
  });
  
  console.log(`[${label}] Всего лотов: ${lots.length}, уже отправлено: ${normalizedSeenLots.size}, новых: ${newLots.length}`);

  if (!newLots.length) {
    if (notifyWhenEmpty) {
      await notifier.sendText(`[${label}] Нових лотів поки немає 🙂`);
    }
    return { total: lots.length, sent: 0 };
  }

  for (const lot of newLots) {
    const caption = buildCaption(lot);

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
              `[${label}] Не удалось отправить изображение для лота ${lot.lotId}, отправляем только текст`,
            );
            await notifier.sendText(caption);
          } else {
            // Для других ошибок пробуем отправить текст как fallback
            console.warn(
              `[${label}] Ошибка при отправке фото для лота ${lot.lotId}: ${errorMessage}, пробуем отправить текст`,
            );
            try {
              await notifier.sendText(caption);
            } catch (textError) {
              console.error(
                `[${label}] Не удалось отправить сообщение для лота ${lot.lotId}: ${textError.message}`,
              );
              // Продолжаем со следующим лотом
              continue;
            }
          }
        }
      } else {
        await notifier.sendText(caption);
      }

      // Нормализуем lotId перед добавлением
      const normalizedLotId = normalizeLotId(lot.lotId);
      
      // Добавляем в Set только после успешной отправки
      normalizedSeenLots.add(normalizedLotId);
      sentLots.add(normalizedLotId);
      
      // Сохраняем в Redis напрямую (Redis автоматически установит TTL)
      await addSeen(normalizedLotId);
      console.log(`[${label}] Лот отправлен и сохранен в Redis: ${normalizedLotId} (оригинал: ${lot.lotId})`);
    } catch (error) {
      console.error(`[${label}] Ошибка при отправке лота ${lot.lotId}:`, error.message || error);
      // Не добавляем в Set при ошибке, чтобы можно было повторить попытку
      // Продолжаем со следующим лотом
    } finally {
      // Задержка 6 секунд между отправками (Telegram ~20 msg/мин в группу; при Copart+IAAI 6 сек безопаснее)
      await delay(6000);
    }
  }

  return { total: lots.length, sent: newLots.length };
}

function buildCaption(lot) {
  const lines = [];
  lines.push(`🚗 <b>${escapeHtml(lot.title || 'Без назви')}</b>`);
  if (lot.year) {
    lines.push(`Рік: <b>${escapeHtml(lot.year)}</b>`);
  }
  if (lot.odometer) {
    lines.push(`Пробіг: <b>${escapeHtml(lot.odometer)}</b>`);
  }
  if (lot.buyNow) {
    lines.push(`Buy Now: <b>${escapeHtml(lot.buyNow)}</b>`);
  } else {
    lines.push('Buy Now: <i>немає ціни</i>');
  }
  if (lot.url) {
    lines.push(`Лінк: <a href="${escapeHtml(lot.url)}">Відкрити лот</a>`);
  }
  lines.push('За детальним розрахунком авто в Україні/Польщі - @Valeriy0592');
  return lines.join('\n');
}

