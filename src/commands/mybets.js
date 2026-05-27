// src/commands/mybets.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getActiveMatches, getAllMatches } = require('../utils/matchManager');
const { getConfig } = require('../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mybets')
    .setDescription('View your active and recent bets'),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = getConfig(guildId);

    const allMatches = Object.values(getAllMatches(guildId));

    // Active bets: matches that are OPEN or LOCKED and user has a bet
    const activeBets = allMatches
      .filter(m => (m.status === 'OPEN' || m.status === 'LOCKED') && m.bets.some(b => b.userId === userId))
      .map(m => {
        const bet = m.bets.find(b => b.userId === userId);
        const teamName = bet.team === 'A' ? m.teamA : m.teamB;
        const totalPool = m.poolA + m.poolB;
        const betPool = bet.team === 'A' ? m.poolA : m.poolB;
        const odds = totalPool > 0 && betPool > 0
          ? (totalPool / betPool).toFixed(2)
          : '??';
        const statusIcon = m.status === 'OPEN' ? '🟢' : '🔒';
        return `${statusIcon} **${m.teamA}** vs **${m.teamB}**\n` +
               `↳ Bet **${bet.amount.toLocaleString()} ${cfg.currencyEmoji}** on **${teamName}** (${odds}x odds)\n` +
               `↳ Session: \`${m.sessionId.slice(0, 8)}\``;
      });

    // Recent finished bets (last 5)
    const recentBets = allMatches
      .filter(m => m.status === 'FINISHED' && m.bets.some(b => b.userId === userId))
      .sort((a, b) => b.finishedAt - a.finishedAt)
      .slice(0, 5)
      .map(m => {
        const bet = m.bets.find(b => b.userId === userId);
        const teamName = bet.team === 'A' ? m.teamA : m.teamB;
        const won = m.winner === bet.team;
        const payout = m.payouts?.find(p => p.userId === userId);
        const resultStr = won
          ? `✅ Won **+${payout ? payout.payout.toLocaleString() : '?'} ${cfg.currencyEmoji}**`
          : `❌ Lost **${bet.amount.toLocaleString()} ${cfg.currencyEmoji}**`;
        return `**${m.teamA}** vs **${m.teamB}** — bet on **${teamName}**\n↳ ${resultStr}`;
      });

    if (!activeBets.length && !recentBets.length) {
      return interaction.reply({
        content: '📭 You have no active or recent bets.',
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('🎯 Your Bets')
      .setColor(0x5865f2)
      .setThumbnail(interaction.user.displayAvatarURL())
      .setTimestamp();

    if (activeBets.length) {
      embed.addFields({ name: '⏳ Active Bets', value: activeBets.join('\n\n') });
    }
    if (recentBets.length) {
      embed.addFields({ name: '📜 Recent Results', value: recentBets.join('\n\n') });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
