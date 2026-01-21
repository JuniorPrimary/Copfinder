import {
  initRedis,
  closeRedis,
  addToSet,
  isInSet,
  getSetMembers,
  getSetSize,
  removeFromSet,
  clearSet,
  addMultipleToSet,
} from '../utils/redisStore.js';

const SET_KEY = 'iaai:sent:lots';

// Инициализируем Redis при первом импорте
let redisInitialized = false;

async function ensureRedis() {
  if (!redisInitialized) {
    try {
      await initRedis();
      redisInitialized = true;
    } catch (error) {
      console.error('[sentStore] Ошибка инициализации Redis, продолжаем без Redis:', error.message || error);
      redisInitialized = true; // Помечаем как инициализированный, чтобы не пытаться снова
    }
  }
}

/**
 * Загружает все отправленные лоты из Redis
 * @returns {Promise<Set<string>>}
 */
export async function loadSentLots() {
  try {
    await ensureRedis();
    return await getSetMembers(SET_KEY);
  } catch (error) {
    console.error('[sentStore] Ошибка загрузки из Redis, возвращаем пустой Set:', error.message || error);
    return new Set();
  }
}

/**
 * Сохраняет Set отправленных лотов в Redis
 * @param {Set<string>} sentSet
 */
export async function saveSentLots(sentSet) {
  await ensureRedis();
  if (sentSet.size === 0) {
    await clearSet(SET_KEY);
    return;
  }
  await addMultipleToSet(SET_KEY, Array.from(sentSet));
}

/**
 * Проверяет, был ли лот уже отправлен
 * @param {string} url
 * @returns {Promise<boolean>}
 */
export async function hasSent(url) {
  await ensureRedis();
  return await isInSet(SET_KEY, url);
}

/**
 * Добавляет лот в список отправленных
 * @param {string} url
 */
export async function addSent(url) {
  try {
    await ensureRedis();
    await addToSet(SET_KEY, url);
  } catch (error) {
    console.error(`[sentStore] Ошибка добавления в Redis (${url}):`, error.message || error);
    // Не выбрасываем ошибку, чтобы приложение продолжало работу
  }
}

/**
 * Получает количество отправленных лотов
 * @returns {Promise<number>}
 */
export async function getSentCount() {
  await ensureRedis();
  return await getSetSize(SET_KEY);
}

/**
 * Очищает список отправленных лотов
 * @param {Set<string>} sentSet - не используется, оставлен для совместимости
 */
export async function resetSentLots(sentSet) {
  await ensureRedis();
  await clearSet(SET_KEY);
}

/**
 * Закрывает соединение с Redis (для graceful shutdown)
 */
export async function close() {
  await closeRedis();
  redisInitialized = false;
}
