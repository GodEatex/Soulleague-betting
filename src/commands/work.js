// src/commands/work.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { addBalance, getBalance } = require('../utils/economy');
const { getConfig } = require('../utils/config');

const COOLDOWN_CORRECT_MS = 2 * 60 * 60 * 1000; // 2 hours on correct answer
const COOLDOWN_FAIL_MS    = 30 * 60 * 1000;      // 30 minutes on wrong/timeout
const storage = require('../utils/storage');

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateQuestion() {
  const type = randomInt(0, 3);
  let question, answer;

  if (type === 0) {
    const a = randomInt(5, 80);
    const b = randomInt(5, 80);
    answer = a + b;
    question = a + ' + ' + b;
  } else if (type === 1) {
    const a = randomInt(30, 90);
    const b = randomInt(1, 25);
    answer = a - b;
    question = a + ' - ' + b;
  } else if (type === 2) {
    const a = randomInt(2, 12);
    const b = randomInt(2, 12);
    answer = a * b;
    question = a + ' x ' + b;
  } else {
    const a = randomInt(1, 25);
    const b = randomInt(1, 25);
    const c = randomInt(1, 25);
    answer = a + b + c;
    question = a + ' + ' + b + ' + ' + c;
  }

  const wrongs = new Set();
  while (wrongs.size < 2) {
    const offset = randomInt(1, 10);
    const wrong = Math.random() > 0.5 ? answer + offset : Math.max(1, answer - offset);
    if (wrong !== answer) wrongs.add(wrong);
  }

  const options = [answer, ...wrongs].sort(() => Math.random() - 0.5);
  return { question, answer, options };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('work')
    .setDescription('Solve a math question to earn coins'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const cfg = getConfig(guildId);
    const emoji = cfg.currencyEmoji || '🪙';
    const name = cfg.currencyName || 'Coins';

    const cooldowns = storage.read('work_cooldowns');
    const entry = cooldowns[guildId + '_' + userId];
    if (entry) {
      const { timestamp, duration } = typeof entry === 'object' ? entry : { timestamp: entry, duration: COOLDOWN_CORRECT_MS };
      const remaining = duration - (Date.now() - timestamp);
      if (remaining > 0) {
        const hours = Math.floor(remaining / 3600000);
        const mins = Math.floor((remaining % 3600000) / 60000);
        const timeStr = hours > 0 ? hours + 'h ' + mins + 'm' : mins + 'm';
        const label = duration === COOLDOWN_FAIL_MS ? '❌ You got it wrong last time!' : '✅ You already worked!';
        return interaction.reply({ content: label + ' Try again in **' + timeStr + '**.', ephemeral: true });
      }
    }

    const { question, answer, options } = generateQuestion();
    const reward = randomInt(100, 1000);

    const embed = new EmbedBuilder()
      .setTitle('💼 Work Shift')
      .setDescription('Solve this to earn **' + emoji + ' ' + reward + ' ' + name + '**:\n\n# ' + question + ' = ?')
      .setColor(0x5865f2)
      .setFooter({ text: 'You have 15 seconds to answer.' });

    const row = new ActionRowBuilder().addComponents(
      options.map(function(opt, i) {
        const isCorrect = opt === answer;
        return new ButtonBuilder()
          .setCustomId('work_' + (isCorrect ? 'correct' : 'wrong') + '_' + reward + '_' + opt)
          .setLabel(String(opt))
          .setStyle(ButtonStyle.Secondary);
      })
    );

    await interaction.reply({ embeds: [embed], components: [row] });

    const msg = await interaction.fetchReply();

    try {
      const btn = await msg.awaitMessageComponent({ filter: function(i) { return i.user.id === userId; }, time: 15000 });
      const isCorrect = btn.customId.startsWith('work_correct');

      const updatedRow = new ActionRowBuilder().addComponents(
        options.map(function(opt, i) {
          const isAnswer = opt === answer;
          const isChosen = btn.customId.endsWith('_' + opt);
          return new ButtonBuilder()
            .setCustomId('done_' + i)
            .setLabel(String(opt))
            .setStyle(isAnswer ? ButtonStyle.Success : isChosen ? ButtonStyle.Danger : ButtonStyle.Secondary)
            .setDisabled(true);
        })
      );

      if (isCorrect) {
        cooldowns[guildId + '_' + userId] = { timestamp: Date.now(), duration: COOLDOWN_CORRECT_MS };
        await storage.write('work_cooldowns', cooldowns);

        await addBalance(guildId, userId, reward);
        const newBal = getBalance(guildId, userId);
        await btn.update({
          embeds: [new EmbedBuilder().setTitle('✅ Correct!').setDescription('You earned **' + emoji + ' ' + reward + ' ' + name + '**!\nBalance: **' + emoji + ' ' + newBal + ' ' + name + '**\n\n⏱️ Next shift available in **2 hours**.').setColor(0x00cc66)],
          components: [updatedRow],
        });
      } else {
        cooldowns[guildId + '_' + userId] = { timestamp: Date.now(), duration: COOLDOWN_FAIL_MS };
        await storage.write('work_cooldowns', cooldowns);

        await btn.update({
          embeds: [new EmbedBuilder().setTitle('❌ Wrong!').setDescription('The correct answer was **' + answer + '**. Better luck next time!\n\n⏱️ Try again in **30 minutes**.').setColor(0xff4444)],
          components: [updatedRow],
        });
      }
    } catch (e) {
      cooldowns[guildId + '_' + userId] = { timestamp: Date.now(), duration: COOLDOWN_FAIL_MS };
      await storage.write('work_cooldowns', cooldowns);

      const timedRow = new ActionRowBuilder().addComponents(
        options.map(function(opt, i) {
          return new ButtonBuilder().setCustomId('exp_' + i).setLabel(String(opt)).setStyle(ButtonStyle.Secondary).setDisabled(true);
        })
      );
      await interaction.editReply({
        embeds: [new EmbedBuilder().setTitle('⏱️ Too slow!').setDescription('You ran out of time. The answer was **' + answer + '**.\n\n⏱️ Try again in **30 minutes**.').setColor(0x888888)],
        components: [timedRow],
      });
    }
  },
};
