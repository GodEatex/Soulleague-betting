// src/events/ready.js
module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log(`📡 Serving ${client.guilds.cache.size} guild(s)`);
    client.user.setActivity('⚔️ Clan Wars', { type: 3 });
  },
};
