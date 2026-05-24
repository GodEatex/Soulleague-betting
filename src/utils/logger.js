// src/utils/logger.js
const { EmbedBuilder } = require('discord.js');
const { getConfig } = require('./config');

async function logMatchOpened(client, guildId, match) {
  const cfg = getConfig(guildId);
  if (!cfg.logsChannelId) return;
  const channel = await client.channels.fetch(cfg.logsChannelId).catch(() => null);
  if (!channel) return;
  const embed = new EmbedBuilder()
    .setTitle('📢 Match Opened for Betting')
    .setDescription(`**${match.teamA}** vs **${match.teamB}**`)
    .setColor(0x00cc66)
    .setFooter({ text: `Session: ${match.sessionId.slice(0, 8)}` })
    .setTimestamp();
  await channel.send({ embeds: [embed] }).catch(() => {});
}

async function logMatchResult(client, guildId, match) {
  const cfg = getConfig(guildId);
  if (!cfg.logsChannelId) return;
  const channel = await client.channels.fetch(cfg.logsChannelId).catch(() => null);
  if (!channel) return;
  const winnerName = match.winner === 'A' ? match.teamA : match.teamB;
  const loserName = match.winner === 'A' ? match.teamB : match.teamA;
  const winPool = match.winner === 'A' ? match.poolA : match.poolB;
  const losePool = match.winner === 'A' ? match.poolB : match.poolA;
  const total = match.poolA + match.poolB;
  const embed = new EmbedBuilder()
    .setTitle('🏁 Match Result Summary')
    .setDescription(`**${match.teamA}** vs **${match.teamB}**`)
    .addFields(
      { name: '🏆 Winner', value: winnerName, inline: true },
      { name: '❌ Loser', value: loserName, inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
      { name: `✅ ${winnerName} Pool`, value: `${winPool.toLocaleString()} ${cfg.currencyEmoji}`, inline: true },
      { name: `❌ ${loserName} Pool`, value: `${losePool.toLocaleString()} ${cfg.currencyEmoji}`, inline: true },
      { name: '💰 Total Pool', value: `${total.toLocaleString()} ${cfg.currencyEmoji}`, inline: true },
      { name: '👥 Total Bets', value: `${match.bets.length}`, inline: true },
    )
    .setColor(0xffd700)
    .setFooter({ text: `Session: ${match.sessionId.slice(0, 8)}` })
    .setTimestamp();
  await channel.send({ embeds: [embed] }).catch(() => {});
}

module.exports = { logMatchOpened, logMatchResult };
