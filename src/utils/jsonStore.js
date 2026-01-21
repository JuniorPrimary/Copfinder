import fs from 'node:fs';
import path from 'node:path';

export function readJson(filePath, fallback) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    return fallback;
  }
  try {
    const raw = fs.readFileSync(resolved, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

