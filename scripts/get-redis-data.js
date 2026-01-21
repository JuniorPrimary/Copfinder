#!/usr/bin/env node

/**
 * Скрипт для получения данных из Redis
 * Показывает все лоты из Redis с возможностью фильтрации и экспорта
 */

import { initRedis, getSetMembers, getSetSize, closeRedis } from '../src/utils/redisStore.js';
import '../src/config/env.js';

const COPART_KEY = 'copart:seen:lots';
const IAAI_KEY = 'iaai:sent:lots';

async function getCopartData() {
  try {
    await initRedis();
    const size = await getSetSize(COPART_KEY);
    const members = await getSetMembers(COPART_KEY);
    
    return {
      key: COPART_KEY,
      size,
      members: Array.from(members).sort(),
    };
  } catch (error) {
    console.error('Ошибка при получении данных Copart:', error.message || error);
    return null;
  }
}

async function getIaaiData() {
  try {
    await initRedis();
    const size = await getSetSize(IAAI_KEY);
    const members = await getSetMembers(IAAI_KEY);
    
    return {
      key: IAAI_KEY,
      size,
      members: Array.from(members).sort(),
    };
  } catch (error) {
    console.error('Ошибка при получении данных IAAI:', error.message || error);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const format = args.includes('--json') ? 'json' : 'text';
  const source = args.includes('--iaai') ? 'iaai' : args.includes('--copart') ? 'copart' : 'all';
  const search = args.find(arg => arg.startsWith('--search='))?.split('=')[1];
  const exportFile = args.find(arg => arg.startsWith('--export='))?.split('=')[1];

  console.log('📊 Получение данных из Redis...\n');

  let copartData = null;
  let iaaiData = null;

  if (source === 'all' || source === 'copart') {
    copartData = await getCopartData();
  }

  if (source === 'all' || source === 'iaai') {
    iaaiData = await getIaaiData();
  }

  // Фильтрация по поисковому запросу
  if (search) {
    const filter = (item) => item.toLowerCase().includes(search.toLowerCase());
    if (copartData) {
      copartData.members = copartData.members.filter(filter);
      copartData.size = copartData.members.length;
    }
    if (iaaiData) {
      iaaiData.members = iaaiData.members.filter(filter);
      iaaiData.size = iaaiData.members.length;
    }
  }

  // Форматирование вывода
  let output;
  if (format === 'json') {
    output = JSON.stringify({ copart: copartData, iaai: iaaiData }, null, 2);
  } else {
    output = [];
    if (copartData) {
      output.push(`📦 Copart (${copartData.size} лотов):`);
      output.push(`   Ключ: ${copartData.key}`);
      if (copartData.size > 0) {
        output.push(`   Примеры (первые 10):`);
        copartData.members.slice(0, 10).forEach((lot, i) => {
          output.push(`     ${i + 1}. ${lot}`);
        });
        if (copartData.size > 10) {
          output.push(`   ... и еще ${copartData.size - 10} лотов`);
        }
      }
      output.push('');
    }
    if (iaaiData) {
      output.push(`🚗 IAAI (${iaaiData.size} лотов):`);
      output.push(`   Ключ: ${iaaiData.key}`);
      if (iaaiData.size > 0) {
        output.push(`   Примеры (первые 10):`);
        iaaiData.members.slice(0, 10).forEach((url, i) => {
          output.push(`     ${i + 1}. ${url}`);
        });
        if (iaaiData.size > 10) {
          output.push(`   ... и еще ${iaaiData.size - 10} лотов`);
        }
      }
      output.push('');
    }
    output = output.join('\n');
  }

  // Экспорт в файл или вывод в консоль
  if (exportFile) {
    const fs = await import('fs');
    fs.writeFileSync(exportFile, format === 'json' ? output : JSON.stringify({ copart: copartData, iaai: iaaiData }, null, 2));
    console.log(`✅ Данные экспортированы в ${exportFile}`);
  } else {
    console.log(output);
  }

  // Статистика
  if (format !== 'json') {
    const total = (copartData?.size || 0) + (iaaiData?.size || 0);
    console.log(`\n📈 Всего лотов в Redis: ${total}`);
  }

  await closeRedis();
}

main().catch((error) => {
  console.error('Ошибка:', error.message || error);
  process.exit(1);
});

