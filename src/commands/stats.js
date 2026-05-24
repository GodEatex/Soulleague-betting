// src/commands/stats.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getStats } = require('../utils/matchManager');
const { getConfig } = require('../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View match statistics for this server'),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const cfg = getConfig(guildId);
    const stats = getStats(guildId);

    const embed = new EmbedBuilder()
      .setTitle('📊 Server Stats')
      .addFields(
        { name: '⚔️ Total Matches', value: `${stats.total}`, inline: true },
        { name: '🟢 Active', value: `${stats.active}`, inline: true },
        { name: '🏁 Finished', value: `${stats.finished}`, inline: true },
        { name: '🎯 Total Bets', value: `${stats.totalBets}`, inline: true },
        { name: '💰 Total Volume', value: `${stats.totalVolume.toLocaleString()} ${cfg.currencyEmoji}`, inline: true },
      )
      .setColor(0x5865f2)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
