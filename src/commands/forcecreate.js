// src/commands/forcecreate.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getConfig } = require('../utils/config');
const { createMatch, activateMatch, saveMatch, lockMatch, resolveMatch } = require('../utils/matchManager');
const { buildMatchEmbed, buildBettingButtons, buildResultEmbed } = require('../utils/betUI');
const { addBalance } = require('../utils/economy');
const { logMatchOpened, logMatchResult } = require('../utils/logger');

const BETTING_DURATION_MS = 2 * 60 * 1000; // 2 minutes

module.exports = {
  data: new SlashCommandBuilder()
    .setName('forcecreate')
    .setDescription('Force-create a match and open betting immediately')
    .addStringOption(opt =>
      opt.setName('team_a')
        .setDescription('First team / clan name')
        .setRequired(true)
        .setMaxLength(50)
    )
    .addStringOption(opt =>
      opt.setName('team_b')
        .setDescription('Second team / clan name')
        .setRequired(true)
        .setMaxLength(50)
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const cfg = getConfig(guildId);

    // Check permissions: admin OR configured role
    const member = interaction.member;
    const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
    const hasRole = cfg.forcecreateRoleId && member.roles.cache.has(cfg.forcecreateRoleId);

    if (!isAdmin && !hasRole) {
      return interaction.reply({
        content: '❌ You need the designated role or Administrator permission to use this command.',
        ephemeral: true,
      });
    }

    const teamA = interaction.options.getString('team_a').trim();
    const teamB = interaction.options.getString('team_b').trim();

    if (teamA.toLowerCase() === teamB.toLowerCase()) {
      return interaction.reply({ content: '❌ Both teams cannot have the same name.', ephemeral: true });
    }

    await interaction.deferReply();

    const { match, sessionId } = createMatch(guildId, {
      teamA, teamB,
      channelId: interaction.channelId,
    });

    // Activate immediately (no !war needed)
    await activateMatch(guildId, sessionId);
    match.status = 'OPEN';
    match.openedAt = Date.now();

    const embed = buildMatchEmbed(match, guildId);
    const buttons = buildBettingButtons(match);

    const timerText = `⏱️ Betting closes in **2 minutes** — place your bets now!`;
    const msg = await interaction.editReply({ content: timerText, embeds: [embed], components: [buttons] });

    match.betMessageId = msg.id;
    match.betChannelId = interaction.channelId;
    await saveMatch(guildId, match);

    await logMatchOpened(interaction.client, guildId, match);

    // Auto-lock after 2 minutes
    setTimeout(async () => {
      try {
        const locked = await lockMatch(guildId, sessionId);
        if (!locked) return;

        const closedEmbed = buildMatchEmbed(locked, guildId);
        const disabledRow = buildBettingButtons(locked); // buttons auto-disabled when status !== OPEN

        const ch = await interaction.client.channels.fetch(interaction.channelId).catch(() => null);
        if (ch) {
          const bMsg = await ch.messages.fetch(msg.id).catch(() => null);
          if (bMsg) {
            await bMsg.edit({
              content: `🔒 Betting is now **closed** for **${teamA}** vs **${teamB}**. Waiting for result...`,
              embeds: [closedEmbed],
              components: [disabledRow],
            }).catch(() => {});
          }
        }
      } catch (err) {
        console.error('[forcecreate] Auto-lock error:', err);
      }
    }, BETTING_DURATION_MS);
  },
};
