// src/commands/forcecreate.js
const {
  SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { getConfig } = require('../utils/config');
const { createMatch, lockMatch } = require('../utils/matchManager');
const { buildMatchEmbed, buildBettingButtons } = require('../utils/betUI');

// Add role IDs here (comma-separated in env) OR hardcode them below
// Example: ALLOWED_ROLE_IDS=123456789,987654321
const ALLOWED_ROLE_IDS = (process.env.ALLOWED_ROLE_IDS || '').split(',').map(r => r.trim()).filter(Boolean);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('forcecreate')
    .setDescription('Open a match and start betting')
    .addStringOption(opt =>
      opt.setName('team_a').setDescription('First team / clan name').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('team_b').setDescription('Second team / clan name').setRequired(true)
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const cfg = getConfig(guildId);
    const member = interaction.member;

    const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
    const hasRole = ALLOWED_ROLE_IDS.length > 0 && ALLOWED_ROLE_IDS.some(id => member.roles.cache.has(id));

    if (!isAdmin && !hasRole) {
      return interaction.reply({
        content: '❌ You don\'t have permission to open matches.',
        ephemeral: true,
      });
    }

    const teamA = interaction.options.getString('team_a').trim();
    const teamB = interaction.options.getString('team_b').trim();

    if (teamA.toLowerCase() === teamB.toLowerCase()) {
      return interaction.reply({ content: '❌ Both teams cannot have the same name.', ephemeral: true });
    }

    await interaction.deferReply();

    const match = await createMatch(guildId, teamA, teamB, interaction.user.id);
    const embed = buildMatchEmbed(match, guildId);
    const row = buildBettingButtons(match);

    const msg = await interaction.editReply({
      content: `🎰 Betting is now **OPEN** for **${teamA}** vs **${teamB}**! You have 2 minutes to place your bets.`,
      embeds: [embed],
      components: [row],
    });

    await match.betMessageId && true;
    match.betMessageId = msg.id;
    match.betChannelId = msg.channelId;

    // Auto-lock after 2 minutes
    setTimeout(async () => {
      try {
        const locked = await lockMatch(guildId, match.sessionId);
        const lockedEmbed = buildMatchEmbed(locked, guildId);
        const disabledRow = buildBettingButtons(locked);
        await msg.edit({
          content: `🔒 Betting is now **CLOSED** for **${teamA}** vs **${teamB}**. Waiting for result...`,
          embeds: [lockedEmbed],
          components: [disabledRow],
        });
      } catch {}
    }, 2 * 60 * 1000);
  },
};
