// src/commands/forceresult.js
const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getAllMatches, resolveMatch } = require('../utils/matchManager');
const { addBalance } = require('../utils/economy');
const { buildResultEmbed } = require('../utils/betUI');
const { logMatchResult } = require('../utils/logger');
const { getConfig } = require('../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('forceresult')
    .setDescription('Manually resolve a match and declare a winner (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt.setName('session_id')
        .setDescription('Session ID of the match (first 8 chars or full)')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('winner')
        .setDescription('Which team wins?')
        .setRequired(true)
        .addChoices(
          { name: 'Team A', value: 'A' },
          { name: 'Team B', value: 'B' },
        )
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId;
    const rawId = interaction.options.getString('session_id').trim();
    const winner = interaction.options.getString('winner');

    const allMatches = Object.values(getAllMatches(guildId));
    const match = allMatches.find(m => m.sessionId === rawId || m.sessionId.startsWith(rawId));

    if (!match) return interaction.editReply({ content: `❌ No match found with ID \`${rawId}\`.` });
    if (match.status === 'FINISHED') return interaction.editReply({ content: `❌ Match is already finished.` });

    const result = await resolveMatch(guildId, match.sessionId, winner);
    if (!result) return interaction.editReply({ content: '❌ Failed to resolve match.' });

    const { payouts, match: resolved } = result;

    if (!resolved.isSandbox) {
      await Promise.all(payouts.map(({ userId, payout }) => addBalance(guildId, userId, payout)));
    }

    const cfg = getConfig(guildId);
    const resultEmbed = buildResultEmbed(resolved, guildId);

    // Post to result channel
    const resultChannelId = resolved.betChannelId || cfg.resultChannelId;
    if (resultChannelId) {
      const ch = await interaction.client.channels.fetch(resultChannelId).catch(() => null);
      if (ch) await ch.send({ embeds: [resultEmbed] }).catch(() => {});
    }

    // Update original betting embed
    if (resolved.betMessageId && resolved.betChannelId) {
      try {
        const betCh = await interaction.client.channels.fetch(resolved.betChannelId);
        const betMsg = await betCh.messages.fetch(resolved.betMessageId);
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('done_A').setLabel(resolved.teamA).setStyle(ButtonStyle.Primary).setDisabled(true),
          new ButtonBuilder().setCustomId('done_B').setLabel(resolved.teamB).setStyle(ButtonStyle.Danger).setDisabled(true),
        );
        await betMsg.edit({ embeds: [resultEmbed], components: [disabledRow] });
      } catch {}
    }

    await logMatchResult(interaction.client, guildId, resolved);

    const winnerName = winner === 'A' ? resolved.teamA : resolved.teamB;
    await interaction.editReply({
      content: `✅ Match resolved. **${winnerName}** wins!\n${payouts.length} winner(s) paid out.`,
    });
  },
};
