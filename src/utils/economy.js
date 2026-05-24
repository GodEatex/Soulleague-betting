// src/utils/economy.js
const storage = require('./storage');

const DEFAULT_BALANCE = 1000;

function getEconomyKey(guildId) { return `economy_${guildId}`; }
function getEconomy(guildId) { return storage.read(getEconomyKey(guildId)); }

function getBalance(guildId, userId) {
  const economy = getEconomy(guildId);
  if (economy[userId] === undefined) economy[userId] = DEFAULT_BALANCE;
  return economy[userId];
}

async function setBalance(guildId, userId, amount) {
  const economy = getEconomy(guildId);
  economy[userId] = Math.max(0, Math.floor(amount));
  await storage.write(getEconomyKey(guildId), economy);
  return economy[userId];
}

async function addBalance(guildId, userId, amount) {
  const economy = getEconomy(guildId);
  if (economy[userId] === undefined) economy[userId] = DEFAULT_BALANCE;
  economy[userId] = Math.floor(economy[userId] + amount);
  await storage.write(getEconomyKey(guildId), economy);
  return economy[userId];
}

async function removeBalance(guildId, userId, amount) {
  const economy = getEconomy(guildId);
  if (economy[userId] === undefined) economy[userId] = DEFAULT_BALANCE;
  economy[userId] = Math.max(0, Math.floor(economy[userId] - amount));
  await storage.write(getEconomyKey(guildId), economy);
  return economy[userId];
}

async function deductBalance(guildId, userId, amount) {
  const economy = getEconomy(guildId);
  if (economy[userId] === undefined) economy[userId] = DEFAULT_BALANCE;
  if (economy[userId] < amount) return { success: false, newBalance: economy[userId] };
  economy[userId] = Math.floor(economy[userId] - amount);
  await storage.write(getEconomyKey(guildId), economy);
  return { success: true, newBalance: economy[userId] };
}

function getLeaderboard(guildId, limit = 10) {
  const economy = getEconomy(guildId);
  return Object.entries(economy)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([userId, balance]) => ({ userId, balance }));
}

module.exports = { getBalance, setBalance, addBalance, removeBalance, deductBalance, getLeaderboard, DEFAULT_BALANCE };
