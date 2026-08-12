'use strict';

const { User, Bot } = require('../../database/schemas');
const { checkSubscription, sendSubscriptionRequired } = require('./utils/channelChecker');
const MenuBuilder = require('./MenuBuilder');
const { bold, currency } = require('./utils/messageFormatter');

class UserRegistration {
  static async handleStart(bot, msg, botDoc) {
    const chatId = msg.chat.id;
    const telegramId = String(msg.from.id);
    const telegramUsername = msg.from.username || null;
    const firstName = msg.from.first_name || 'Usuário';

    if (botDoc.require_subscription && botDoc.required_channel) {
      const isMember = await checkSubscription(bot, chatId, botDoc.required_channel);
      if (!isMember) {
        return sendSubscriptionRequired(bot, chatId, botDoc.required_channel, botDoc.store_name);
      }
    }

    let user = await User.findByTelegram(telegramId, botDoc.id);
    let isNew = false;

    if (!user) {
      const refCode = UserRegistration._extractReferral(msg.text);
      user = await UserRegistration._createUser(telegramId, telegramUsername, firstName, botDoc, refCode);
      isNew = true;

      await Bot.findByIdAndUpdate(botDoc._id, { $inc: { total_users: 1 } });
    } else {
      await User.findByIdAndUpdate(user._id, {
        $set: {
          telegram_username: telegramUsername,
          telegram_last_seen: new Date(),
        },
      });
    }

    const welcomeText = UserRegistration._buildWelcome(botDoc, firstName, isNew);

    const sendOpts = {
      parse_mode: 'HTML',
      ...MenuBuilder.mainMenu(botDoc),
    };

    if (botDoc.start_image_url) {
      try {
        return await bot.sendPhoto(chatId, botDoc.start_image_url, {
          caption: welcomeText,
          ...sendOpts,
        });
      } catch {
        // fallback se imagem falhar
      }
    }

    return bot.sendMessage(chatId, welcomeText, sendOpts);
  }

  static _extractReferral(text) {
    if (!text) return null;
    const match = text.match(/\/start\s+ref_(\w+)/i);
    return match ? match[1] : null;
  }

  static async _createUser(telegramId, telegramUsername, firstName, botDoc, refCode) {
    const username = `tg_${telegramId}_${botDoc.id}`;
    const randomPass = require('crypto').randomBytes(16).toString('hex');

    const userData = {
      username,
      password: randomPass,
      telegram_id: telegramId,
      telegram_username: telegramUsername,
      bot_id: botDoc.id,
      owner_id: botDoc.owner_id,
      role: 'user',
      telegram_last_seen: new Date(),
    };

    const user = await User.create(userData);

    if (refCode && botDoc.referral_enabled) {
      const referrer = await User.findOne({
        _id: refCode,
        bot_id: botDoc.id,
        banned: false,
      });

      if (referrer && String(referrer._id) !== String(user._id)) {
        // TODO: implementar sistema de referral completo quando houver modelo
        console.log(`[Telegram] Referral: ${user.username} indicado por ${referrer.username}`);
      }
    }

    return user;
  }

  static _buildWelcome(botDoc, firstName, isNew) {
    if (botDoc.welcome_message) {
      return botDoc.welcome_message
        .replace(/{nome}/gi, firstName)
        .replace(/{loja}/gi, botDoc.store_name || 'Loja')
        .replace(/{username}/gi, firstName);
    }

    if (isNew) {
      return [
        `🎉 Bem-vindo(a), ${bold(firstName)}!`,
        ``,
        `Você está na ${bold(botDoc.store_name || 'nossa loja')}.`,
        `Seu saldo inicial é ${bold(currency(0))}.`,
        ``,
        `Escolha uma opção abaixo:`,
      ].join('\n');
    }

    return [
      `👋 Olá, ${bold(firstName)}!`,
      ``,
      `Bem-vindo(a) de volta à ${bold(botDoc.store_name || 'nossa loja')}.`,
      ``,
      `Escolha uma opção:`,
    ].join('\n');
  }
}

module.exports = UserRegistration;
