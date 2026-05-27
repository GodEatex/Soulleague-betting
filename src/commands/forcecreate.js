// src/commands/forcecreate.js
const {
  SlashCommandBuilder, PermissionFlagsBits,
} = require('discord.js');
const { getConfig } = require('../utils/config');
const { createMatch, activateMatch, lockMatch, saveMatch } = require('../utils/matchManager');
const { buildMatchEmbed, buildBettingButtons } = require('../utils/betUI');

const ALLOWED_ROLE_IDS = (process.env.ALLOWED_ROLE_IDS || '')
  .split(',').map(r => r.trim()).filter(Boolean);

const DEFAULT_LOCK_MINUTES = 2;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('forcecreate')
    .setDescription('Open a match and start betting')
    .addStringOption(opt =>
      opt.setName('team_a').setDescription('First team / clan name').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('team_b').setDescription('Second team / clan name').setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('timer')
        .setDescription('Minutes before betting auto-locks (default: 2, max: 60)')
        .setMinValue(1)
        .setMaxValue(60)
        .setRequired(false)
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const member = interaction.member;

    const guild = interaction.guild ?? await interaction.client.guilds.fetch(guildId);

    const isServerOwner = guild.ownerId === interaction.user.id;
    const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
    const hasAllowedRole = ALLOWED_ROLE_IDS.length > 0 && ALLOWED_ROLE_IDS.some(id => member.roles.cache.has(id));

    if (!isServerOwner && !isAdmin && !hasAllowedRole) {
      return interaction.reply({
        content: '❌ You don\'t have permission to open matches.',
        ephemeral: true,
      });
    }

    const teamA = interaction.options.getString('team_a').trim();
    const teamB = interaction.options.getString('team_b').trim();
    const timerMinutes = interaction.options.getInteger('timer') ?? DEFAULT_LOCK_MINUTES;
    const timerMs = timerMinutes * 60 * 1000;

    if (teamA.toLowerCase() === teamB.toLowerCase()) {
      return interaction.reply({ content: '❌ Both teams cannot have the same name.', ephemeral: true });
    }

    await interaction.deferReply();

    const { match, sessionId } = createMatch(guildId, { teamA, teamB });
    const openMatch = await activateMatch(guildId, sessionId);

    const embed = buildMatchEmbed(openMatch, guildId);
    const row = buildBettingButtons(openMatch);

    const msg = await interaction.editReply({
      content: `🎰 Betting is now **OPEN** for **${teamA}** vs **${teamB}**! You have **${timerMinutes} minute${timerMinutes !== 1 ? 's' : ''}** to place your bets.`,
      embeds: [embed],
      components: [row],
    });

    openMatch.betMessageId = msg.id;
    openMatch.betChannelId = msg.channelId;
    await saveMatch(guildId, openMatch);

    // Auto-lock after configured timer
    setTimeout(async () => {
      try {
        const locked = await lockMatch(guildId, sessionId);
        const lockedEmbed = buildMatchEmbed(locked, guildId);
        const disabledRow = buildBettingButtons(locked);
        await msg.edit({
          content: `🔒 Betting is now **CLOSED** for **${teamA}** vs **${teamB}**. Waiting for result...`,
          embeds: [lockedEmbed],
          components: [disabledRow],
        });
      } catch {}
    }, timerMs);
  },
};
