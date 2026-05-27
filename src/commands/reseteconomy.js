// src/commands/reseteconomy.js
const {
  SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const storage = require('../utils/storage');
const { DEFAULT_BALANCE } = require('../utils/economy');
const { getConfig } = require('../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reseteconomy')
    .setDescription('⚠️ Wipe the entire server economy and reset all balances (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const cfg = getConfig(guildId);

    // Read current economy to show stats before wiping
    const economy = storage.read(`economy_${guildId}`);
    const userCount = Object.keys(economy).length;
    const totalCoins = Object.values(economy).reduce((a, b) => a + b, 0);

    const warnEmbed = new EmbedBuilder()
      .setTitle('⚠️ Reset Entire Economy?')
      .setDescription(
        `This will **permanently wipe** all balances in this server.\n\n` +
        `**Current economy:**\n` +
        `• ${userCount.toLocaleString()} users affected\n` +
        `• ${totalCoins.toLocaleString()} ${cfg.currencyEmoji} total in circulation\n\n` +
        `Every user will be reset to **${DEFAULT_BALANCE.toLocaleString()} ${cfg.currencyEmoji}**.\n\n` +
        `**This cannot be undone.** Are you sure?`
      )
      .setColor(0xff4444);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('reseteco_confirm')
        .setLabel('Yes, wipe everything')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('reseteco_cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({ embeds: [warnEmbed], components: [row], ephemeral: true });

    const msg = await interaction.fetchReply();

    try {
      const btn = await msg.awaitMessageComponent({
        filter: i => i.user.id === interaction.user.id,
        time: 30_000,
      });

      if (btn.customId === 'reseteco_cancel') {
        await btn.update({
          embeds: [
            new EmbedBuilder()
              .setTitle('✅ Cancelled')
              .setDescription('Economy reset cancelled. Nothing was changed.')
              .setColor(0x00cc66),
          ],
          components: [],
        });
        return;
      }

      // Confirmed — wipe the economy
      await storage.write(`economy_${guildId}`, {});

      await btn.update({
        embeds: [
          new EmbedBuilder()
            .setTitle('🗑️ Economy Reset')
            .setDescription(
              `The economy has been wiped.\n\n` +
              `**${userCount.toLocaleString()} users** cleared.\n` +
              `Everyone starts fresh at **${DEFAULT_BALANCE.toLocaleString()} ${cfg.currencyEmoji}** on their next interaction.`
            )
            .setColor(0xff9900)
            .setTimestamp(),
        ],
        components: [],
      });

    } catch {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('⏱️ Timed out')
            .setDescription('No response received. Economy reset was **not** performed.')
            .setColor(0x888888),
        ],
        components: [],
      });
    }
  },
};
