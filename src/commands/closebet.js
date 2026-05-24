// src/commands/closebet.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getConfig } = require('../utils/config');
const { getActiveMatches, lockMatch, getMatch } = require('../utils/matchManager');
const { buildMatchEmbed, buildBettingButtons } = require('../utils/betUI');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('closebet')
    .setDescription('Manually close betting on an active match')
    .addStringOption(opt =>
      opt.setName('session')
        .setDescription('Session ID of the match (leave empty to see active matches)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const cfg = getConfig(guildId);

    // Permission check: admin OR forcecreate role
    const member = interaction.member;
    const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
    const hasRole = cfg.forcecreateRoleId && member.roles.cache.has(cfg.forcecreateRoleId);
    if (!isAdmin && !hasRole) {
      return interaction.reply({ content: '❌ You need the designated role or Administrator permission to use this command.', ephemeral: true });
    }

    const sessionId = interaction.options.getString('session');

    // No session provided — list active matches
    if (!sessionId) {
      const active = getActiveMatches(guildId);
      if (!active.length) {
        return interaction.reply({ content: '❌ No active matches found.', ephemeral: true });
      }
      const list = active.map(m =>
        `**${m.teamA}** vs **${m.teamB}** — \`${m.sessionId}\` (${m.status})`
      ).join('\n');
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('📋 Active Matches')
            .setDescription(`Run \`/closebet session:<id>\` to close one:\n\n${list}`)
            .setColor(0x5865f2)
        ],
        ephemeral: true,
      });
    }

    // Session provided — lock it
    const match = getMatch(guildId, sessionId);
    if (!match) {
      return interaction.reply({ content: `❌ No match found with session ID \`${sessionId}\`.`, ephemeral: true });
    }
    if (match.status === 'LOCKED' || match.status === 'FINISHED') {
      return interaction.reply({ content: `❌ That match is already **${match.status}** — betting is already closed.`, ephemeral: true });
    }
    if (match.status !== 'OPEN') {
      return interaction.reply({ content: `❌ That match isn't open for betting yet (status: **${match.status}**).`, ephemeral: true });
    }

    const locked = await lockMatch(guildId, sessionId);

    // Update the original betting embed if we can find it
    if (locked.betMessageId && locked.betChannelId) {
      try {
        const ch = await interaction.client.channels.fetch(locked.betChannelId);
        const msg = await ch.messages.fetch(locked.betMessageId);
        const closedEmbed = buildMatchEmbed(locked, guildId);
        const disabledRow = buildBettingButtons(locked);
        await msg.edit({
          content: `🔒 Betting is now **closed** for **${locked.teamA}** vs **${locked.teamB}**. Waiting for result...`,
          embeds: [closedEmbed],
          components: [disabledRow],
        });
      } catch {}
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🔒 Betting Closed')
          .setDescription(`Betting has been manually closed for **${locked.teamA}** vs **${locked.teamB}**.`)
          .setColor(0xff9900)
      ],
      ephemeral: true,
    });
  },
};
