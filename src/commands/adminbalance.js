// src/commands/adminbalance.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getBalance, setBalance, addBalance, removeBalance } = require('../utils/economy');
const { getConfig } = require('../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('adminbalance')
    .setDescription('Manage a user\'s balance (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Set a user\'s balance to an exact amount')
        .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('New balance').setRequired(true).setMinValue(0))
    )
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add currency to a user\'s balance')
        .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount to add').setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove currency from a user\'s balance')
        .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount to remove').setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub =>
      sub.setName('check')
        .setDescription('Check a user\'s balance')
        .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const guildId = interaction.guildId;
    const cfg = getConfig(guildId);

    let newBalance, action;

    if (sub === 'set') {
      newBalance = await setBalance(guildId, user.id, amount);
      action = `Set to **${newBalance.toLocaleString()} ${cfg.currencyEmoji}**`;
    } else if (sub === 'add') {
      newBalance = await addBalance(guildId, user.id, amount);
      action = `Added **${amount.toLocaleString()} ${cfg.currencyEmoji}** → New balance: **${newBalance.toLocaleString()} ${cfg.currencyEmoji}**`;
    } else if (sub === 'remove') {
      newBalance = await removeBalance(guildId, user.id, amount);
      action = `Removed **${amount.toLocaleString()} ${cfg.currencyEmoji}** → New balance: **${newBalance.toLocaleString()} ${cfg.currencyEmoji}**`;
    } else if (sub === 'check') {
      newBalance = getBalance(guildId, user.id);
      action = `Balance: **${newBalance.toLocaleString()} ${cfg.currencyEmoji}**`;
    }

    const embed = new EmbedBuilder()
      .setTitle('💼 Admin Balance Update')
      .setDescription(`**User:** ${user}\n${action}`)
      .setColor(0x5865f2)
      .setThumbnail(user.displayAvatarURL())
      .setFooter({ text: `Action by ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
