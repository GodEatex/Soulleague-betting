// src/utils/config.js
const storage = require('./storage');

const DEFAULTS = {
  warTriggerChannelId: null,
  logsChannelId: null,
  resultChannelId: null,
  resultDetectionChannelId: null,
  forcecreateRoleId: null,
  currencyName: process.env.CURRENCY_NAME || 'Coins',
  currencyEmoji: process.env.CURRENCY_EMOJI || '🪙',
};

function getConfig(guildId) {
  const all = storage.read('guild_configs');
  const guildData = all[guildId] || {};
  return Object.assign({}, DEFAULTS, guildData, {
    currencyName: process.env.CURRENCY_NAME || guildData.currencyName || DEFAULTS.currencyName,
    currencyEmoji: process.env.CURRENCY_EMOJI || guildData.currencyEmoji || DEFAULTS.currencyEmoji,
  });
}

async function setConfig(guildId, updates) {
  const all = storage.read('guild_configs');
  all[guildId] = Object.assign({}, all[guildId] || {}, updates);
  await storage.write('guild_configs', all);
  return getConfig(guildId);
}

module.exports = { getConfig, setConfig };
