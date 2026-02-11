import axios from 'axios';
import { delay } from '../utils/delay.js';

const BASE_URL = 'https://www.easyhaul.com/data/v1';
const TIMEOUT_MS = 15000;
const DELIVERY_FEE = 250;
const MAX_RETRIES = 5;

/**
 * Fetches delivery quote total (quote.total + 250) for a lot from EasyHaul with retry logic.
 * @param {string|number} lotNumber - Lot number
 * @param {number} auction - 1 = Copart, 2 = IAAI
 * @returns {Promise<number|null>} Delivery total or null on any error
 */
export async function getDeliveryTotal(lotNumber, auction) {
  if (lotNumber == null || lotNumber === '') return null;
  const lot = String(lotNumber).trim();
  if (!lot) return null;

  const token = process.env.EASYHAUL_TOKEN || 'EHULCO';

  // Retry логика для vehicle-vin-stock запроса
  let stockRes = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      stockRes = await axios.get(`${BASE_URL}/vehicle-vin-stock/${encodeURIComponent(lot)}/all`, {
        timeout: TIMEOUT_MS,
        validateStatus: () => true,
      });

      // Если получили 429, ретраим
      if (stockRes.status === 429) {
        const retryAfter = getRetryDelay(attempt);
        console.warn(
          `[EasyHaul] vehicle-vin-stock: 429 Rate Limit, попытка ${attempt + 1}/${MAX_RETRIES + 1}, повтор через ${retryAfter}с`,
          { lot, auction },
        );
        if (attempt < MAX_RETRIES) {
          await delay(retryAfter * 1000);
          continue;
        }
      }

      // Если не 200 или нет данных, выходим
      if (stockRes.status !== 200 || !stockRes.data || !Array.isArray(stockRes.data.vehicles)) {
        console.warn('[EasyHaul] vehicle-vin-stock: bad response or no vehicles', {
          lot,
          auction,
          status: stockRes.status,
        });
        return null;
      }

      // Успешный ответ, выходим из цикла
      break;
    } catch (err) {
      // Сетевые ошибки тоже ретраим
      const isRetryable = isRetryableError(err);
      if (isRetryable && attempt < MAX_RETRIES) {
        const retryAfter = getRetryDelay(attempt);
        console.warn(
          `[EasyHaul] vehicle-vin-stock: сетевой сбой, попытка ${attempt + 1}/${MAX_RETRIES + 1}, повтор через ${retryAfter}с`,
          { lot, auction, error: err?.message },
        );
        await delay(retryAfter * 1000);
        continue;
      }
      console.warn('[EasyHaul] vehicle-vin-stock: request failed', { lot, auction, message: err?.message });
      return null;
    }
  }

  if (!stockRes || stockRes.status !== 200 || !stockRes.data || !Array.isArray(stockRes.data.vehicles)) {
    return null;
  }

  const vehicles = stockRes.data.vehicles;
  const vehicle = vehicles.find((v) => Number(v.auction) === Number(auction));
  const zip = vehicle?.location?.zip;
  if (!zip) {
    console.warn('[EasyHaul] no vehicle/zip for auction', { lot, auction });
    return null;
  }

  // Retry логика для quote запроса
  let quoteRes = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      quoteRes = await axios.get(`${BASE_URL}/quote`, {
        timeout: TIMEOUT_MS,
        validateStatus: () => true,
        params: {
          type: 'I',
          origin_zip: zip,
          drivable: 'true',
          auction: String(auction),
          lot_number: lot,
          destination_country: '123',
          token,
        },
      });

      // Если получили 429, ретраим
      if (quoteRes.status === 429) {
        const retryAfter = getRetryDelay(attempt);
        console.warn(
          `[EasyHaul] quote: 429 Rate Limit, попытка ${attempt + 1}/${MAX_RETRIES + 1}, повтор через ${retryAfter}с`,
          { lot, auction },
        );
        if (attempt < MAX_RETRIES) {
          await delay(retryAfter * 1000);
          continue;
        }
      }

      // Если не 200 или нет данных, выходим
      if (quoteRes.status !== 200 || !quoteRes.data?.quote) {
        console.warn('[EasyHaul] quote: bad response or no quote', { lot, auction, status: quoteRes.status });
        return null;
      }

      // Успешный ответ, выходим из цикла
      break;
    } catch (err) {
      // Сетевые ошибки тоже ретраим
      const isRetryable = isRetryableError(err);
      if (isRetryable && attempt < MAX_RETRIES) {
        const retryAfter = getRetryDelay(attempt);
        console.warn(
          `[EasyHaul] quote: сетевой сбой, попытка ${attempt + 1}/${MAX_RETRIES + 1}, повтор через ${retryAfter}с`,
          { lot, auction, error: err?.message },
        );
        await delay(retryAfter * 1000);
        continue;
      }
      console.warn('[EasyHaul] quote: request failed', { lot, auction, message: err?.message });
      return null;
    }
  }

  if (!quoteRes || quoteRes.status !== 200 || !quoteRes.data?.quote) {
    return null;
  }

  const total = quoteRes.data.quote.total;
  if (typeof total !== 'number') {
    console.warn('[EasyHaul] quote.total is not a number', { lot, auction });
    return null;
  }

  return total + DELIVERY_FEE;
}

/**
 * Определяет, можно ли ретраить ошибку
 */
function isRetryableError(err) {
  if (!err) return false;
  const code = err.code || '';
  const message = String(err.message || '').toLowerCase();

  return (
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ENOTFOUND' ||
    code === 'ECONNREFUSED' ||
    code === 'EAI_AGAIN' ||
    code === 'ESOCKETTIMEDOUT' ||
    message.includes('timeout') ||
    message.includes('network') ||
    message.includes('connection')
  );
}

/**
 * Вычисляет задержку перед ретраем (экспоненциальная с ограничением)
 */
function getRetryDelay(attempt) {
  // Экспоненциальная задержка: 2, 4, 8, 16, 32 секунды
  // Для 429 обычно нужно больше времени, поэтому начинаем с 5 секунд
  const baseDelay = 5;
  const delay = Math.min(baseDelay * Math.pow(2, attempt), 60);
  return delay;
}
