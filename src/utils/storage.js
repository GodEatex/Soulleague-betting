// src/utils/storage.js
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = 'soulcasino';

let client = null;
let db = null;
const cache = new Map();

async function connect() {
  if (db) return db;
  client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db(DB_NAME);
  console.log('✅ Connected to MongoDB Atlas');
  return db;
}

function read(name) {
  return cache.get(name) ?? {};
}

async function write(name, data) {
  // Always update cache immediately so reads are instant
  cache.set(name, data);
  try {
    const database = await connect();
    const col = database.collection('storage');
    await col.updateOne(
      { _id: name },
      { $set: { _id: name, data } },
      { upsert: true }
    );
  } catch (err) {
    console.error(`[storage] Failed to write "${name}":`, err);
  }
}

async function loadAll() {
  try {
    const database = await connect();
    const col = database.collection('storage');
    const docs = await col.find({}).toArray();
    for (const doc of docs) {
      cache.set(doc._id, doc.data);
    }
    console.log(`✅ Loaded ${docs.length} storage entries from MongoDB`);
  } catch (err) {
    console.error('[storage] Failed to load from MongoDB:', err);
  }
}

module.exports = { read, write, loadAll };
