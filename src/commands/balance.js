// src/commands/balance.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getBalance } = require('../utils/economy');
const { getConfig } = require('../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your current balance'),

  async execute(interaction) {
    const balance = getBalance(interaction.guildId, interaction.user.id);
    const cfg = getConfig(interaction.guildId);
    const embed = new EmbedBuilder()
      .setTitle('💰 Your Balance')
      .setDescription(`**${balance.toLocaleString()} ${cfg.currencyEmoji} ${cfg.currencyName}**`)
      .setColor(0x5865f2)
      .setThumbnail(interaction.user.displayAvatarURL());
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
