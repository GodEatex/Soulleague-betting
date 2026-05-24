// src/commands/setup.js
const {
  SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder,
  ActionRowBuilder, ChannelSelectMenuBuilder, ChannelType,
  ComponentType, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { getConfig, setConfig } = require('../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure the bot for your server (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const guildId = interaction.guildId;
    const filter = i => i.user.id === interaction.user.id;
    const collected = {};

    // ─── STEP 1: Logs Channel ──────────────────────────────────────────────
    const step1Embed = new EmbedBuilder()
      .setTitle('🛠️ Bot Setup — Step 1 of 3')
      .setDescription(
        '## 📜 Logs Channel\n' +
        'Pick a channel where the bot will post a **summary of every match** after it ends.\n\n' +
        '> This is your history log — bet totals, who won, payouts, etc.\n' +
        '> It\'s fine to use a private staff-only channel.\n\n' +
        '_Select a text channel below:_'
      )
      .setColor(0x5865f2)
      .setFooter({ text: 'You have 60 seconds to pick. Type /setup again if it times out.' });

    const step1Row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('setup_logs')
        .setPlaceholder('📜 Choose your logs channel...')
        .addChannelTypes(ChannelType.GuildText)
    );

    const msg = await interaction.editReply({ embeds: [step1Embed], components: [step1Row] });

    try {
      const sel = await msg.awaitMessageComponent({ filter, componentType: ComponentType.ChannelSelect, time: 60_000 });
      collected.logsChannelId = sel.values[0];
      await sel.deferUpdate();
    } catch {
      return interaction.editReply({ content: '⏱️ Timed out. Run `/setup` again.', embeds: [], components: [] });
    }

    // ─── STEP 2: Result Channel ────────────────────────────────────────────
    const step2Embed = new EmbedBuilder()
      .setTitle('🛠️ Bot Setup — Step 2 of 3')
      .setDescription(
        '## 🏆 Result Announcement Channel\n' +
        'Pick a channel where the bot will **announce the winner** of each match.\n\n' +
        '> This is the public-facing channel your members will see the result in.\n' +
        '> The bot posts a result card showing who won and the payout totals.\n\n' +
        '_Select a text channel below:_'
      )
      .setColor(0x5865f2)
      .setFooter({ text: 'Step 2 of 3 — You have 60 seconds to pick.' });

    const step2Row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('setup_result')
        .setPlaceholder('🏆 Choose your result announcement channel...')
        .addChannelTypes(ChannelType.GuildText)
    );

    await interaction.editReply({ embeds: [step2Embed], components: [step2Row] });

    try {
      const sel = await msg.awaitMessageComponent({ filter, componentType: ComponentType.ChannelSelect, time: 60_000 });
      collected.resultChannelId = sel.values[0];
      await sel.deferUpdate();
    } catch {
      return interaction.editReply({ content: '⏱️ Timed out. Run `/setup` again.', embeds: [], components: [] });
    }

    // ─── STEP 3: Detection Channel ─────────────────────────────────────────
    const step3Embed = new EmbedBuilder()
      .setTitle('🛠️ Bot Setup — Step 3 of 3')
      .setDescription(
        '## 🔍 Match Result Detection Channel\n' +
        'Pick the channel where **war results are posted** after each match.\n\n' +
        '> The bot reads messages in this channel to automatically detect who won.\n' +
        '> It looks for lines like:\n' +
        '> - `Winner: ClanName`\n' +
        '> - `ClanName won` / `ClanName wins`\n' +
        '> - Score formats like `ClanA 3-1 ClanB`\n\n' +
        '> As soon as it detects the winner, it **automatically pays out bets** and posts the result — no manual command needed.\n\n' +
        '⚠️ This is usually a **private channel** where your war result bot or staff post the outcome.\n\n' +
        '_Select a text channel below:_'
      )
      .setColor(0x5865f2)
      .setFooter({ text: 'Step 3 of 3 — You have 60 seconds to pick.' });

    const step3Row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('setup_detect')
        .setPlaceholder('🔍 Choose your result detection channel...')
        .addChannelTypes(ChannelType.GuildText)
    );

    await interaction.editReply({ embeds: [step3Embed], components: [step3Row] });

    try {
      const sel = await msg.awaitMessageComponent({ filter, componentType: ComponentType.ChannelSelect, time: 60_000 });
      collected.resultDetectionChannelId = sel.values[0];
      await sel.deferUpdate();
    } catch {
      return interaction.editReply({ content: '⏱️ Timed out. Run `/setup` again.', embeds: [], components: [] });
    }

    // ─── STEP 4: Currency ──────────────────────────────────────────────────
    const currencyEmbed = new EmbedBuilder()
      .setTitle('🛠️ Bot Setup — Almost Done!')
      .setDescription(
        '## 💰 Choose Your Currency\n' +
        'Pick what the virtual currency in your server is called.\n\n' +
        '> This is what members earn and spend when betting.\n' +
        '> You can change this later with `/setcurrency`.\n\n' +
        '_Pick one below:_'
      )
      .setColor(0x5865f2);

    const currencyRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('cur_coins').setLabel('🪙 Coins').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('cur_gold').setLabel('💰 Gold').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('cur_points').setLabel('⭐ Points').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('cur_credits').setLabel('💎 Credits').setStyle(ButtonStyle.Secondary),
    );

    await interaction.editReply({ embeds: [currencyEmbed], components: [currencyRow] });

    let curChoice;
    try {
      curChoice = await msg.awaitMessageComponent({ filter, componentType: ComponentType.Button, time: 60_000 });
      await curChoice.deferUpdate();
    } catch {
      return interaction.editReply({ content: '⏱️ Timed out. Run `/setup` again.', embeds: [], components: [] });
    }

    const currencyMap = {
      cur_coins:   { name: 'Coins',   emoji: '🪙' },
      cur_gold:    { name: 'Gold',    emoji: '💰' },
      cur_points:  { name: 'Points',  emoji: '⭐' },
      cur_credits: { name: 'Credits', emoji: '💎' },
    };
    const currency = currencyMap[curChoice.customId] || { name: 'Coins', emoji: '🪙' };

    await setConfig(guildId, {
      ...collected,
      currencyName: currency.name,
      currencyEmoji: currency.emoji,
    });

    // ─── Done ──────────────────────────────────────────────────────────────
    const doneEmbed = new EmbedBuilder()
      .setTitle('✅ Bot is ready!')
      .setDescription(
        'Setup is complete. Here\'s what was configured:\n\n' +
        `📜 **Logs Channel** → <#${collected.logsChannelId}>\n` +
        `🏆 **Result Channel** → <#${collected.resultChannelId}>\n` +
        `🔍 **Detection Channel** → <#${collected.resultDetectionChannelId}>\n` +
        `${currency.emoji} **Currency** → ${currency.name}\n\n` +
        '**Next steps:**\n' +
        '• Use `/setrole @Role` to choose who can open matches\n' +
        '• Use `/forcecreate TeamA TeamB` to open a match and start betting\n' +
        '• The bot will auto-detect results and pay out from your detection channel'
      )
      .setColor(0x00cc66)
      .setFooter({ text: 'Use /setup any time to reconfigure.' });

    await interaction.editReply({ embeds: [doneEmbed], components: [] });
  },
};
