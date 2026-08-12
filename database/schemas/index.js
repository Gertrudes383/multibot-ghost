/**
 * Arquivo de indice para todos os schemas do banco de dados
 * Importa e exporta todos os modelos Mongoose da plataforma
 */

const User = require('./User.schema');
const Bot = require('./Bot.schema');
const Card = require('./Card.schema');
const Bin = require('./Bin.schema');
const Order = require('./Order.schema');
const Recharge = require('./Recharge.schema');
const Batch = require('./Batch.schema');
const GiftCard = require('./GiftCard.schema');
const Promotion = require('./Promotion.schema');
const CheckerSetting = require('./CheckerSetting.schema');
const PixSetting = require('./PixSetting.schema');
const ValidationLog = require('./ValidationLog.schema');
const Activity = require('./Activity.schema');
const Subscription = require('./Subscription.schema');
const ExternalSupplier = require('./ExternalSupplier.schema');
const IpBlock = require('./IpBlock.schema');
const Exchange = require('./Exchange.schema');
const Referral = require('./Referral.schema');
const Setting = require('./Setting.schema');
const SubscriptionPlan = require('./SubscriptionPlan.schema');
const CheckerSession = require('./CheckerSession.schema');
const Notification = require('./Notification.schema');

module.exports = {
  User,
  Bot,
  Card,
  Bin,
  Order,
  Recharge,
  Batch,
  GiftCard,
  Promotion,
  CheckerSetting,
  PixSetting,
  ValidationLog,
  Activity,
  Subscription,
  ExternalSupplier,
  IpBlock,
  Exchange,
  Referral,
  Setting,
  SubscriptionPlan,
  CheckerSession,
  Notification,
};
