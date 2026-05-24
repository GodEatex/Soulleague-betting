// src/commands/setrole.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { setConfig, getConfig } = require('../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setrole')
    .setDescription('Set which role is allowed to open matches with /forcecreate (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption(opt =>
      opt.setName('role')
        .setDescription('The role that can use /forcecreate')
        .setRequired(true)
    ),

  async execute(interaction) {
    const role = interaction.options.getRole('role');
    await setConfig(interaction.guildId, { forcecreateRoleId: role.id });

    const embed = new EmbedBuilder()
      .setTitle('✅ Role Updated')
      .setDescription(
        `Members with **${role.name}** can now use \`/forcecreate\` to open matches and start betting.\n\n` +
        `> Admins can always use \`/forcecreate\` regardless of this setting.\n` +
        `> Run \`/setrole\` again any time to change the role.`
      )
      .setColor(0x00cc66);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
