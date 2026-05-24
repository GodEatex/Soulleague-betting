// src/utils/config.js
const storage = require('./storage');

const DEFAULTS = {
  warTriggerChannelId: null,
  logsChannelId: null,
  resultChannelId: null,
  resultDetectionChannelId: null, // NEW: channel bot watches for match reports
  forcecreateRoleId: null,        // NEW: role that can use /forcecreate
  currencyName: 'Coins',
  currencyEmoji: '🪙',
};

function getConfig(guildId) {
  const all = storage.read('guild_configs');
  return Object.assign({}, DEFAULTS, all[guildId] || {});
}

async function setConfig(guildId, updates) {
  const all = storage.read('guild_configs');
  all[guildId] = Object.assign({}, DEFAULTS, all[guildId] || {}, updates);
  await storage.write('guild_configs', all);
  return all[guildId];
}

module.exports = { getConfig, setConfig };
