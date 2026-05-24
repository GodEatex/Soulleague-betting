// src/events/interactionCreate.js
const { getMatch, placeBet } = require('../utils/matchManager');
const { deductBalance, addBalance, getBalance } = require('../utils/economy');
const { buildMatchEmbed, buildBettingButtons, buildBetModal } = require('../utils/betUI');
const { getConfig } = require('../utils/config');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const buttonCooldowns = new Map();
const BUTTON_COOLDOWN_MS = 2000;

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {

    // ─── Slash Commands ────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction);
      } catch (err) {
        console.error(`[command:${interaction.commandName}]`, err);
        const content = '❌ An error occurred executing this command.';
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content, ephemeral: true }).catch(() => {});
        } else {
          await interaction.reply({ content, ephemeral: true }).catch(() => {});
        }
      }
      return;
    }

    // ─── Buttons ────────────────────────────────────────────────────────────
    if (interaction.isButton()) {
      const id = interaction.customId;

      // ── Bet Buttons ─────────────────────────────────────────────────────────
      if (!id.startsWith('bet_A_') && !id.startsWith('bet_B_')) return;

      const parts = id.split('_');
      if (parts.length < 3) return;
      const team = parts[1];
      const sessionId = parts.slice(2).join('_');

      const cooldownKey = `${interaction.user.id}_${sessionId}`;
      const lastPress = buttonCooldowns.get(cooldownKey) || 0;
      if (Date.now() - lastPress < BUTTON_COOLDOWN_MS) {
        await interaction.reply({ content: '⏳ Please wait before clicking again.', ephemeral: true });
        return;
      }
      buttonCooldowns.set(cooldownKey, Date.now());

      const match = getMatch(interaction.guildId, sessionId);
      if (!match) return interaction.reply({ content: '❌ Match not found.', ephemeral: true });
      if (match.status !== 'OPEN') return interaction.reply({ content: '🔒 Betting is closed.', ephemeral: true });

      const existing = match.bets.find(b => b.userId === interaction.user.id);
      if (existing) {
        return interaction.reply({
          content: `⚠️ You already bet **${existing.amount}** on **${existing.team === 'A' ? match.teamA : match.teamB}**.`,
          ephemeral: true,
        });
      }

      const teamName = team === 'A' ? match.teamA : match.teamB;
      const modal = buildBetModal(team, sessionId, teamName);
      await interaction.showModal(modal);
      return;
    }

    // ─── Modals ─────────────────────────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      const id = interaction.customId;
      if (!id.startsWith('modal_bet_')) return;

      await interaction.deferReply({ ephemeral: true });

      const parts = id.split('_');
      if (parts.length < 4) return;
      const team = parts[2];
      const sessionId = parts.slice(3).join('_');

      const rawAmount = interaction.fields.getTextInputValue('bet_amount').trim();
      const amount = parseInt(rawAmount, 10);

      if (isNaN(amount) || amount < 1) {
        return interaction.editReply({ content: '❌ Please enter a valid number (minimum 1).' });
      }

      const guildId = interaction.guildId;
      const userId = interaction.user.id;
      const cfg = getConfig(guildId);

      const match = getMatch(guildId, sessionId);
      if (!match || match.status !== 'OPEN') {
        return interaction.editReply({ content: '🔒 Betting closed before your bet could be placed.' });
      }

      const existingBet = match.bets.find(b => b.userId === userId);
      if (existingBet) {
        return interaction.editReply({
          content: `⚠️ You already bet **${existingBet.amount}** on **${existingBet.team === 'A' ? match.teamA : match.teamB}**.`,
        });
      }

      if (!match.isSandbox) {
        const { success } = await deductBalance(guildId, userId, amount);
        if (!success) {
          const bal = getBalance(guildId, userId);
          return interaction.editReply({
            content: `❌ Insufficient balance. You have **${bal.toLocaleString()} ${cfg.currencyEmoji}**, tried to bet **${amount.toLocaleString()}**.`,
          });
        }
      }

      const result = await placeBet(guildId, sessionId, userId, team, amount);
      if (!result.success) {
        if (!match.isSandbox) await addBalance(guildId, userId, amount);
        return interaction.editReply({ content: `❌ ${result.reason}` });
      }

      const teamName = team === 'A' ? match.teamA : match.teamB;
      const newBal = match.isSandbox ? '(sandbox)' : `${getBalance(guildId, userId).toLocaleString()} ${cfg.currencyEmoji}`;

      await interaction.editReply({
        content: `✅ Bet placed!\n**${amount.toLocaleString()} ${cfg.currencyEmoji}** on **${teamName}**\nRemaining balance: ${newBal}`,
      });

      // Update embed live
      if (result.match.betMessageId && result.match.betChannelId) {
        try {
          const ch = await interaction.client.channels.fetch(result.match.betChannelId);
          const betMsg = await ch.messages.fetch(result.match.betMessageId);
          const updatedEmbed = buildMatchEmbed(result.match, guildId);
          const buttons = buildBettingButtons(result.match);
          await betMsg.edit({ embeds: [updatedEmbed], components: [buttons] });
        } catch {}
      }
    }
  },
};
