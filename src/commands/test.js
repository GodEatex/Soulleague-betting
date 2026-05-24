// src/commands/test.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createMatch, activateMatch, resolveMatch, saveMatch } = require('../utils/matchManager');
const { buildMatchEmbed, buildBettingButtons, buildResultEmbed } = require('../utils/betUI');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const FAKE_TEAMS = [
  ['Alpha Wolves', 'Beta Bears'],
  ['Dragon Squad', 'Phoenix Clan'],
  ['Crimson Elite', 'Steel Legion'],
  ['Night Owls', 'Dawn Raiders'],
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('test')
    .setDescription('Run a sandboxed test match — no real currency affected (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply();
    const guildId = interaction.guildId;
    const [teamA, teamB] = FAKE_TEAMS[Math.floor(Math.random() * FAKE_TEAMS.length)];
    const delay = Math.floor(Math.random() * 11 + 10) * 1000;

    const { match, sessionId } = createMatch(guildId, {
      teamA, teamB, isSandbox: true, channelId: interaction.channelId,
    });
    await activateMatch(guildId, sessionId);
    const activated = { ...match, status: 'OPEN', isSandbox: true };

    const embed = buildMatchEmbed(activated, guildId);
    const buttons = buildBettingButtons(activated);

    const msg = await interaction.editReply({
      content: `🧪 **SANDBOX TEST** — Auto-resolves in **${delay / 1000}s**`,
      embeds: [embed],
      components: [buttons],
    });

    activated.betMessageId = msg.id;
    activated.betChannelId = interaction.channelId;
    await saveMatch(guildId, activated);

    setTimeout(async () => {
      try {
        const winner = Math.random() < 0.5 ? 'A' : 'B';
        const result = await resolveMatch(guildId, sessionId, winner);
        if (!result) return;
        const { match: resolved } = result;
        const resultEmbed = buildResultEmbed(resolved, guildId);
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('sb_A').setLabel(teamA).setStyle(ButtonStyle.Primary).setDisabled(true),
          new ButtonBuilder().setCustomId('sb_B').setLabel(teamB).setStyle(ButtonStyle.Danger).setDisabled(true),
        );
        const ch = await interaction.client.channels.fetch(interaction.channelId).catch(() => null);
        if (ch) {
          const bMsg = await ch.messages.fetch(msg.id).catch(() => null);
          if (bMsg) await bMsg.edit({
            content: `🧪 **SANDBOX COMPLETE** — Winner: **${winner === 'A' ? teamA : teamB}**`,
            embeds: [resultEmbed],
            components: [disabledRow],
          }).catch(() => {});
        }
      } catch (err) { console.error('[test]', err); }
    }, delay);
  },
};
