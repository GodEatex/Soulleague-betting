// src/commands/setcurrency.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { setConfig } = require('../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setcurrency')
    .setDescription('Set the currency name and emoji (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt.setName('name').setDescription('Currency name (e.g. Coins, Gold)').setRequired(true).setMaxLength(20)
    )
    .addStringOption(opt =>
      opt.setName('emoji').setDescription('Currency emoji (e.g. 🪙)').setRequired(true).setMaxLength(8)
    ),

  async execute(interaction) {
    const name = interaction.options.getString('name');
    const emoji = interaction.options.getString('emoji');
    await setConfig(interaction.guildId, { currencyName: name, currencyEmoji: emoji });
    await interaction.reply({ content: `✅ Currency set to **${emoji} ${name}**.`, ephemeral: true });
  },
};
