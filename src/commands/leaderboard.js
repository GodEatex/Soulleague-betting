// src/commands/leaderboard.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getLeaderboard } = require('../utils/economy');
const { getConfig } = require('../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the top 10 richest members'),

  async execute(interaction) {
    await interaction.deferReply();
    const guildId = interaction.guildId;
    const cfg = getConfig(guildId);
    const top = getLeaderboard(guildId, 10);

    if (!top.length) return interaction.editReply({ content: 'No data yet!' });

    const medals = ['🥇', '🥈', '🥉'];
    const lines = await Promise.all(top.map(async ({ userId, balance }, i) => {
      let name;
      try {
        const member = await interaction.guild.members.fetch(userId);
        name = member.displayName;
      } catch {
        name = `<@${userId}>`;
      }
      const medal = medals[i] || `**${i + 1}.**`;
      return `${medal} ${name} — **${balance.toLocaleString()} ${cfg.currencyEmoji}**`;
    }));

    const embed = new EmbedBuilder()
      .setTitle('🏆 Richest Members')
      .setDescription(lines.join('\n'))
      .setColor(0xffd700)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
