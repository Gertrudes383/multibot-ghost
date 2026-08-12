'use strict';

const checkSubscription = async (bot, chatId, channelUsername) => {
  if (!channelUsername) return true;

  const channel = channelUsername.startsWith('@') ? channelUsername : `@${channelUsername}`;

  try {
    const member = await bot.getChatMember(channel, chatId);
    const allowed = ['creator', 'administrator', 'member'];
    return allowed.includes(member.status);
  } catch {
    return false;
  }
};

const sendSubscriptionRequired = async (bot, chatId, channelUsername, storeName) => {
  const channel = channelUsername.startsWith('@') ? channelUsername : `@${channelUsername}`;

  const text = [
    `⚠️ <b>Canal Obrigatório</b>`,
    ``,
    `Para usar <b>${storeName || 'a loja'}</b>, você precisa entrar no canal:`,
    `👉 ${channel}`,
    ``,
    `Após entrar, clique em <b>Verificar</b>.`,
  ].join('\n');

  return bot.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '📢 Entrar no Canal', url: `https://t.me/${channelUsername.replace('@', '')}` }],
        [{ text: '✅ Verificar', callback_data: 'check:subscription' }],
      ],
    },
  });
};

module.exports = { checkSubscription, sendSubscriptionRequired };
