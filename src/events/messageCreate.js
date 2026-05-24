// src/events/messageCreate.js
const { getConfig } = require('../utils/config');
const { findMatchFromContent, resolveMatch } = require('../utils/matchManager');
const { buildResultEmbed } = require('../utils/betUI');
const { logMatchResult } = require('../utils/logger');
const { addBalance } = require('../utils/economy');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function detectWinner(content, match) {
  const lower = content.toLowerCase();
  const teamALower = match.teamA.toLowerCase();
  const teamBLower = match.teamB.toLowerCase();

  const aWinHints = [
    `${teamALower} won`, `${teamALower} wins`, `${teamALower} win`,
    `${teamALower} victory`, `winner: ${teamALower}`, `winner ${teamALower}`,
    `${teamALower} 🏆`, `${teamALower} gg`,
  ];
  const bWinHints = [
    `${teamBLower} won`, `${teamBLower} wins`, `${teamBLower} win`,
    `${teamBLower} victory`, `winner: ${teamBLower}`, `winner ${teamBLower}`,
    `${teamBLower} 🏆`, `${teamBLower} gg`,
  ];

  function escapeRegex(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  const scoreRegex = new RegExp(`${escapeRegex(teamALower)}\\s+(\\d+)\\s*[-:]\\s*(\\d+)\\s+${escapeRegex(teamBLower)}`, 'i');
  const scoreRegexRev = new RegExp(`${escapeRegex(teamBLower)}\\s+(\\d+)\\s*[-:]\\s*(\\d+)\\s+${escapeRegex(teamALower)}`, 'i');

  const scoreMatch = scoreRegex.exec(lower);
  if (scoreMatch) {
    if (parseInt(scoreMatch[1]) > parseInt(scoreMatch[2])) return 'A';
    if (parseInt(scoreMatch[2]) > parseInt(scoreMatch[1])) return 'B';
  }
  const scoreMatchRev = scoreRegexRev.exec(lower);
  if (scoreMatchRev) {
    if (parseInt(scoreMatchRev[1]) > parseInt(scoreMatchRev[2])) return 'B';
    if (parseInt(scoreMatchRev[2]) > parseInt(scoreMatchRev[1])) return 'A';
  }

  // "Winner: TeamName" or "Winner: TeamName" (case insensitive, anywhere in message)
  const winnerLabelRegex = /winner[:\s]+([^\n]+)/gi;
  let winnerLabelMatch;
  while ((winnerLabelMatch = winnerLabelRegex.exec(lower)) !== null) {
    const val = winnerLabelMatch[1].trim();
    if (val.includes(teamALower)) return 'A';
    if (val.includes(teamBLower)) return 'B';
  }

  if (aWinHints.some(h => lower.includes(h))) return 'A';
  if (bWinHints.some(h => lower.includes(h))) return 'B';
  return null;
}

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (message.author.bot) return;
    if (!message.guildId) return;

    const guildId = message.guildId;
    const cfg = getConfig(guildId);

    // Only process result detection channel
    if (!cfg.resultDetectionChannelId || message.channelId !== cfg.resultDetectionChannelId) return;

    const content = message.content.trim();
    const match = findMatchFromContent(guildId, content);
    if (!match) return;

    const winner = detectWinner(content, match);
    if (!winner) return;

    const result = await resolveMatch(guildId, match.sessionId, winner);
    if (!result) return;

    const { payouts, match: resolved } = result;

    if (!resolved.isSandbox) {
      await Promise.all(payouts.map(({ userId, payout }) => addBalance(guildId, userId, payout)));
    }

    const resultEmbed = buildResultEmbed(resolved, guildId);
    const winnerName = winner === 'A' ? resolved.teamA : resolved.teamB;

    // Update original betting embed
    if (resolved.betMessageId && resolved.betChannelId) {
      try {
        const betCh = await client.channels.fetch(resolved.betChannelId);
        const betMsg = await betCh.messages.fetch(resolved.betMessageId);
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('auto_done_A').setLabel(resolved.teamA).setStyle(ButtonStyle.Primary).setDisabled(true),
          new ButtonBuilder().setCustomId('auto_done_B').setLabel(resolved.teamB).setStyle(ButtonStyle.Danger).setDisabled(true),
        );
        await betMsg.edit({ content: `🏆 **${winnerName}** wins!`, embeds: [resultEmbed], components: [disabledRow] }).catch(() => {});
      } catch {}
    }

    // Post to result channel
    if (cfg.resultChannelId) {
      const ch = await client.channels.fetch(cfg.resultChannelId).catch(() => null);
      if (ch) await ch.send({ embeds: [resultEmbed] }).catch(() => {});
    }

    await logMatchResult(client, guildId, resolved);
    await message.react('✅').catch(() => {});
  },
};
