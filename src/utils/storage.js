// src/utils/storage.js
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const cache = new Map();
const writeLocks = new Map();

function getFilePath(name) { return path.join(DATA_DIR, `${name}.json`); }

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function read(name) {
  if (cache.has(name)) return cache.get(name);
  ensureDataDir();
  const filePath = getFilePath(name);
  if (!fs.existsSync(filePath)) { cache.set(name, {}); return {}; }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    cache.set(name, parsed);
    return parsed;
  } catch { cache.set(name, {}); return {}; }
}

async function write(name, data) {
  if (writeLocks.get(name)) await writeLocks.get(name);
  let resolveLock;
  const lock = new Promise(r => { resolveLock = r; });
  writeLocks.set(name, lock);
  try {
    ensureDataDir();
    cache.set(name, data);
    const filePath = getFilePath(name);
    const tmpPath = filePath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, filePath);
  } finally {
    resolveLock();
    writeLocks.delete(name);
  }
}

module.exports = { read, write };
