// src/utils/betUI.js
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { getConfig } = require('./config');

function buildMatchEmbed(match, guildId) {
  const cfg = getConfig(guildId);
  const totalPool = match.poolA + match.poolB;
  const pctA = totalPool > 0 ? ((match.poolA / totalPool) * 100).toFixed(1) : '50.0';
  const pctB = totalPool > 0 ? ((match.poolB / totalPool) * 100).toFixed(1) : '50.0';
  const barLength = 20;
  const filledA = totalPool > 0 ? Math.round((match.poolA / totalPool) * barLength) : barLength / 2;
  const bar = '█'.repeat(filledA) + '░'.repeat(barLength - filledA);

  const statusText = match.status === 'OPEN'
    ? '🟢 Betting Open'
    : match.status === 'LOCKED'
      ? '🔒 Betting Closed'
      : match.status === 'FINISHED'
        ? '🏁 Finished'
        : match.status;

  return new EmbedBuilder()
    .setTitle(`⚔️  ${match.teamA}  vs  ${match.teamB}`)
    .setDescription(
      (match.isSandbox ? '*(SANDBOX — no real currency)*\n' : '') +
      `**Status:** ${statusText}\n\n` +
      `**${match.teamA}** [\`${bar.slice(0, filledA)}${bar.slice(filledA)}\`] **${match.teamB}**\n` +
      `${pctA}% — ${pctB}%`
    )
    .addFields(
      {
        name: `🔵 ${match.teamA}`,
        value: `Pool: **${match.poolA.toLocaleString()} ${cfg.currencyEmoji}**\nBets: ${match.bets.filter(b => b.team === 'A').length}`,
        inline: true,
      },
      {
        name: `🔴 ${match.teamB}`,
        value: `Pool: **${match.poolB.toLocaleString()} ${cfg.currencyEmoji}**\nBets: ${match.bets.filter(b => b.team === 'B').length}`,
        inline: true,
      },
      {
        name: '💰 Total Pool',
        value: `**${totalPool.toLocaleString()} ${cfg.currencyEmoji}**`,
        inline: true,
      }
    )
    .setColor(match.status === 'OPEN' ? 0x00cc66 : 0x888888)
    .setFooter({ text: `Session: ${match.sessionId.slice(0, 8)}` })
    .setTimestamp();
}

function buildBettingButtons(match) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`bet_A_${match.sessionId}`)
      .setLabel(`🔵 Bet on ${match.teamA}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(match.status !== 'OPEN'),
    new ButtonBuilder()
      .setCustomId(`bet_B_${match.sessionId}`)
      .setLabel(`🔴 Bet on ${match.teamB}`)
      .setStyle(ButtonStyle.Danger)
      .setDisabled(match.status !== 'OPEN'),
  );
}

function buildBetModal(team, sessionId, teamName) {
  const modal = new ModalBuilder()
    .setCustomId(`modal_bet_${team}_${sessionId}`)
    .setTitle(`Bet on ${teamName}`);
  const amountInput = new TextInputBuilder()
    .setCustomId('bet_amount')
    .setLabel('How much do you want to bet?')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Enter a number, e.g. 500')
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(10);
  modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
  return modal;
}

function buildResultEmbed(match, guildId) {
  const cfg = getConfig(guildId);
  const winnerName = match.winner === 'A' ? match.teamA : match.teamB;
  const loserName = match.winner === 'A' ? match.teamB : match.teamA;
  const winPool = match.winner === 'A' ? match.poolA : match.poolB;
  const losePool = match.winner === 'A' ? match.poolB : match.poolA;
  const total = match.poolA + match.poolB;
  const pctWin = total > 0 ? ((winPool / total) * 100).toFixed(1) : '0';
  const pctLose = total > 0 ? ((losePool / total) * 100).toFixed(1) : '0';

  return new EmbedBuilder()
    .setTitle(`🏆 ${match.teamA} vs ${match.teamB}`)
    .setDescription(`**Winner: ${winnerName}** 🎉`)
    .addFields(
      { name: `✅ ${winnerName}`, value: `Pool: **${winPool.toLocaleString()} ${cfg.currencyEmoji}** (${pctWin}%)`, inline: true },
      { name: `❌ ${loserName}`, value: `Pool: **${losePool.toLocaleString()} ${cfg.currencyEmoji}** (${pctLose}%)`, inline: true },
      { name: '💰 Total Pool', value: `**${total.toLocaleString()} ${cfg.currencyEmoji}**`, inline: true },
      { name: '👥 Participants', value: `${match.bets.length} bets placed`, inline: true },
    )
    .setColor(0xffd700)
    .setFooter({ text: `Session: ${match.sessionId.slice(0, 8)}` })
    .setTimestamp();
}

module.exports = { buildMatchEmbed, buildBettingButtons, buildBetModal, buildResultEmbed };
