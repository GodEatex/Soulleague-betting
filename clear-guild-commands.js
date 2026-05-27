// One-time script to clear guild-specific commands
// Run with: DISCORD_TOKEN=xxx CLIENT_ID=xxx GUILD_ID=xxx node clear-guild-commands.js
require('dotenv').config();
const { REST, Routes } = require('discord.js');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId || !guildId) {
  console.error('❌ Set DISCORD_TOKEN, CLIENT_ID, and GUILD_ID');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
  console.log('✅ Guild commands cleared — duplicates are gone.');
})();
