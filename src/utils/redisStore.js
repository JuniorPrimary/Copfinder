import { createClient } from 'redis';
// Загружаем переменные окружения
import '../config/env.js';

/**
 * Redis хранилище для отправленных лотов с TTL
 * Использует RDB/AOF для персистентности и автоматически удаляет записи через 7 дней
 */

// Конфигурация Redis из переменных окружения
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || null;
const REDIS_DB = parseInt(process.env.REDIS_DB || '0', 10);
const TTL_DAYS = parseInt(process.env.REDIS_TTL_DAYS || '7', 10);
const TTL_SECONDS = TTL_DAYS * 24 * 60 * 60; // 7 дней в секундах

// Создаем клиент Redis (глобальный singleton)
let redisClient = null;
let initPromise = null;

/**
 * Получает или создает клиент Redis
 */
async function getRedisClient() {
  // Если уже инициализируется, ждем завершения
  if (initPromise) {
    await initPromise;
  }
  
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }
  
  // Если клиент закрыт, переподключаемся
  if (redisClient && !redisClient.isOpen) {
    redisClient = null;
  }

  const client = createClient({
    socket: {
      host: REDIS_HOST,
      port: REDIS_PORT,
    },
    password: REDIS_PASSWORD || undefined,
    database: REDIS_DB,
  });

  client.on('error', (err) => {
    console.error('[Redis] Ошибка подключения:', err.message || err);
    // Не выбрасываем ошибку, чтобы приложение могло продолжить работу
  });

  client.on('connect', () => {
    console.log('[Redis] Подключение установлено');
  });

  client.on('ready', () => {
    console.log('[Redis] Клиент готов к работе');
  });

  client.on('reconnecting', () => {
    console.log('[Redis] Переподключение...');
  });

  try {
    await client.connect();
    redisClient = client;
    return client;
  } catch (error) {
    console.error('[Redis] Критическая ошибка подключения:', error.message || error);
    // Закрываем клиент при ошибке
    try {
      await client.quit();
    } catch {
      // ignore
    }
    throw error;
  }
}

/**
 * Инициализирует Redis клиент (глобально, один раз)
 */
export async function initRedis() {
  // Если уже инициализируется, возвращаем существующий промис
  if (initPromise) {
    return await initPromise;
  }
  
  // Если уже инициализирован, просто возвращаемся
  if (redisClient && redisClient.isOpen) {
    return;
  }
  
  // Создаем новый промис инициализации
  initPromise = (async () => {
    try {
      await getRedisClient();
      console.log(`[Redis] Инициализация завершена. TTL: ${TTL_DAYS} дней (${TTL_SECONDS} секунд)`);
      initPromise = null; // Очищаем промис после успешной инициализации
    } catch (error) {
      initPromise = null; // Очищаем промис при ошибке
      console.error('[Redis] Ошибка инициализации:', error);
      throw error;
    }
  })();
  
  return await initPromise;
}

/**
 * Закрывает соединение с Redis
 */
export async function closeRedis() {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    redisClient = null;
    console.log('[Redis] Соединение закрыто');
  }
}

/**
 * Проверяет, существует ли ключ в Redis
 */
export async function exists(key) {
  try {
    const client = await getRedisClient();
    const result = await client.exists(key);
    return result === 1;
  } catch (error) {
    console.error(`[Redis] Ошибка проверки существования ключа ${key}:`, error);
    return false;
  }
}

/**
 * Добавляет значение в Set с TTL
 */
export async function addToSet(setKey, value) {
  try {
    const client = await getRedisClient();
    // Добавляем значение в Set
    await client.sAdd(setKey, value);
    // Устанавливаем TTL для всего Set (если еще не установлен)
    const ttl = await client.ttl(setKey);
    if (ttl === -1) {
      // TTL не установлен, устанавливаем
      await client.expire(setKey, TTL_SECONDS);
    }
    return true;
  } catch (error) {
    console.error(`[Redis] Ошибка добавления в Set ${setKey}:`, error);
    return false;
  }
}

/**
 * Проверяет, содержится ли значение в Set
 */
export async function isInSet(setKey, value) {
  try {
    const client = await getRedisClient();
    const result = await client.sIsMember(setKey, value);
    return result;
  } catch (error) {
    console.error(`[Redis] Ошибка проверки членства в Set ${setKey}:`, error);
    return false;
  }
}

/**
 * Получает все значения из Set
 */
export async function getSetMembers(setKey) {
  try {
    const client = await getRedisClient();
    const members = await client.sMembers(setKey);
    return new Set(members);
  } catch (error) {
    console.error(`[Redis] Ошибка получения членов Set ${setKey}:`, error);
    return new Set();
  }
}

/**
 * Получает размер Set
 */
export async function getSetSize(setKey) {
  try {
    const client = await getRedisClient();
    const size = await client.sCard(setKey);
    return size;
  } catch (error) {
    console.error(`[Redis] Ошибка получения размера Set ${setKey}:`, error);
    return 0;
  }
}

/**
 * Удаляет значение из Set
 */
export async function removeFromSet(setKey, value) {
  try {
    const client = await getRedisClient();
    await client.sRem(setKey, value);
    return true;
  } catch (error) {
    console.error(`[Redis] Ошибка удаления из Set ${setKey}:`, error);
    return false;
  }
}

/**
 * Очищает весь Set
 */
export async function clearSet(setKey) {
  try {
    const client = await getRedisClient();
    await client.del(setKey);
    return true;
  } catch (error) {
    console.error(`[Redis] Ошибка очистки Set ${setKey}:`, error);
    return false;
  }
}

/**
 * Добавляет несколько значений в Set за один раз
 */
export async function addMultipleToSet(setKey, values) {
  try {
    const client = await getRedisClient();
    if (values.length === 0) return true;
    
    // Добавляем все значения в Set
    await client.sAdd(setKey, values);
    // Устанавливаем TTL для всего Set (если еще не установлен)
    const ttl = await client.ttl(setKey);
    if (ttl === -1) {
      await client.expire(setKey, TTL_SECONDS);
    }
    return true;
  } catch (error) {
    console.error(`[Redis] Ошибка массового добавления в Set ${setKey}:`, error);
    return false;
  }
}

