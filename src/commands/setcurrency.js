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
      opt.setName('emoji').setDescription('Currency emoji (default or custom server emoji)').setRequired(true).setMaxLength(100)
    ),

  async execute(interaction) {
    const name = interaction.options.getString('name');
    let emoji = interaction.options.getString('emoji').trim();

    // Accept both standard emoji and custom Discord emoji formats: <:name:id> or <a:name:id>
    const customEmojiRegex = /^<a?:\w+:\d+>$/;
    const isCustom = customEmojiRegex.test(emoji);
    const isStandard = /\p{Emoji}/u.test(emoji);

    if (!isCustom && !isStandard) {
      return interaction.reply({
        content: '❌ Invalid emoji. Use a standard emoji (🪙) or a server emoji from the emoji picker.',
        ephemeral: true,
      });
    }

    await setConfig(interaction.guildId, { currencyName: name, currencyEmoji: emoji });
    await interaction.reply({ content: `✅ Currency set to **${emoji} ${name}**.`, ephemeral: true });
  },
};
