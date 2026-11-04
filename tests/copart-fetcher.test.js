import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Подменяем браузер и ожидания, чтобы проверить очередь без сети и Chromium.
const source = readFileSync(new URL('../src/copart/fetcher.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '')
  .replace('export function fetchHtml', 'function fetchHtml');

function createFetcher({ failContext = false, crashOnce = false } = {}) {
  const stats = { active: 0, peak: 0, launches: 0, closed: 0 };
  const sandbox = {
    console: { log() {}, warn() {} },
    delay: async () => {},
    applyStealth: async () => {},
    chromium: {
      async launch() {
        stats.launches++;
        stats.active++;
        stats.peak = Math.max(stats.peak, stats.active);
        return {
          async newContext() {
            if (failContext) {
              failContext = false;
              throw new Error('context setup failed');
            }
            return {
              async close() {},
              async newPage() {
                return {
                  async goto() { await new Promise(resolve => setImmediate(resolve)); },
                  async waitForSelector() {},
                  async click() {},
                  async waitForTimeout() {},
                  async evaluate() {
                    if (crashOnce) {
                      crashOnce = false;
                      throw new Error('page.evaluate: Target crashed');
                    }
                  },
                  async content() { return '<html>ok</html>'; },
                };
              },
            };
          },
          async close() { stats.active--; stats.closed++; },
        };
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(`${source}\nthis.fetchHtml = fetchHtml;`, sandbox);
  return { fetchHtml: sandbox.fetchHtml, stats };
}

test('parallel searches use only one browser and close all browsers', async () => {
  const { fetchHtml, stats } = createFetcher();
  const results = await Promise.all(Array.from({ length: 5 }, () => fetchHtml('https://example.test')));
  assert.equal(results.length, 5);
  assert.equal(stats.peak, 1);
  assert.equal(stats.closed, 5);
  assert.equal(stats.active, 0);
});

test('setup failure closes browser and does not block the next search', async () => {
  const { fetchHtml, stats } = createFetcher({ failContext: true });
  const results = await Promise.allSettled([fetchHtml('first'), fetchHtml('second')]);
  assert.equal(results[0].status, 'rejected');
  assert.equal(results[1].status, 'fulfilled');
  assert.equal(stats.peak, 1);
  assert.equal(stats.closed, 2);
});

test('crashed page retries without overlapping the queued search', async () => {
  const { fetchHtml, stats } = createFetcher({ crashOnce: true });
  await Promise.all([fetchHtml('first'), fetchHtml('second')]);
  assert.equal(stats.launches, 3);
  assert.equal(stats.closed, 3);
  assert.equal(stats.peak, 1);
});
