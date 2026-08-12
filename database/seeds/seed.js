/**
 * Script de Seed - Popula o banco de dados com dados iniciais
 *
 * Cria:
 * 1. Superadmin da plataforma
 * 2. Planos de assinatura (basic e premium)
 * 3. Tenant de exemplo com 1 bot
 * 4. Entradas de preco por BIN de exemplo
 *
 * Uso: node database/seeds/seed.js
 * Variavel de ambiente: MONGO_URI (padrao: mongodb://localhost:27017/multibots)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Importa todos os modelos
const User = require('../schemas/User.schema');
const Bot = require('../schemas/Bot.schema');
const Bin = require('../schemas/Bin.schema');
const Subscription = require('../schemas/Subscription.schema');

// --- Configuracao ---
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/multibots';
const SUPERADMIN_USERNAME = process.env.SEED_ADMIN_USER || 'admin';
const SUPERADMIN_PASSWORD = process.env.SEED_ADMIN_PASS || 'Admin@2024!';

// --- Dados de seed ---

// BINs de exemplo com precos (dados ficticios)
const SAMPLE_BINS = [
  {
    bin: '411111',
    brand: 'VISA',
    type: 'CREDIT',
    level: 'STANDARD',
    country: 'BR',
    bank: 'Banco do Brasil',
    price: 15.0,
    price_sem: 8.0,
    price_consultaveis: 5.0,
    price_tracks: 25.0,
    source: 'global',
  },
  {
    bin: '546167',
    brand: 'MASTERCARD',
    type: 'CREDIT',
    level: 'GOLD',
    country: 'BR',
    bank: 'Itau',
    price: 25.0,
    price_sem: 12.0,
    price_consultaveis: 8.0,
    price_tracks: 35.0,
    source: 'global',
  },
  {
    bin: '431940',
    brand: 'VISA',
    type: 'CREDIT',
    level: 'PLATINUM',
    country: 'BR',
    bank: 'Bradesco',
    price: 35.0,
    price_sem: 18.0,
    price_consultaveis: 12.0,
    price_tracks: 50.0,
    source: 'global',
  },
  {
    bin: '524369',
    brand: 'MASTERCARD',
    type: 'CREDIT',
    level: 'BLACK',
    country: 'BR',
    bank: 'Nubank',
    price: 50.0,
    price_sem: 25.0,
    price_consultaveis: 18.0,
    price_tracks: 70.0,
    source: 'global',
  },
  {
    bin: '636368',
    brand: 'ELO',
    type: 'DEBIT',
    level: 'STANDARD',
    country: 'BR',
    bank: 'Caixa Economica',
    price: 10.0,
    price_sem: 5.0,
    price_consultaveis: 3.0,
    price_tracks: 15.0,
    source: 'global',
  },
  {
    bin: '406655',
    brand: 'VISA',
    type: 'CREDIT',
    level: 'INFINITE',
    country: 'BR',
    bank: 'Santander',
    price: 60.0,
    price_sem: 30.0,
    price_consultaveis: 20.0,
    price_tracks: 80.0,
    source: 'global',
  },
  {
    bin: '552289',
    brand: 'MASTERCARD',
    type: 'CREDIT',
    level: 'STANDARD',
    country: 'US',
    bank: 'Chase',
    price: 20.0,
    price_sem: 10.0,
    price_consultaveis: 7.0,
    price_tracks: 30.0,
    source: 'global',
  },
  {
    bin: '431234',
    brand: 'VISA',
    type: 'DEBIT',
    level: 'PREPAID',
    country: 'BR',
    bank: 'PagBank',
    price: 8.0,
    price_sem: 4.0,
    price_consultaveis: 2.0,
    price_tracks: 12.0,
    source: 'global',
  },
];

// --- Funcao principal ---
async function seed() {
  console.log('===========================================');
  console.log('   SEED — Populando banco de dados');
  console.log('===========================================\n');

  try {
    // Conecta ao MongoDB
    console.log(`[*] Conectando ao MongoDB: ${MONGO_URI}`);
    await mongoose.connect(MONGO_URI);
    console.log('[+] Conectado com sucesso!\n');

    // --- 1. Cria superadmin ---
    console.log('[1/4] Criando superadmin...');
    let superadmin = await User.findOne({ username: SUPERADMIN_USERNAME });
    if (superadmin) {
      console.log(`  [!] Superadmin "${SUPERADMIN_USERNAME}" ja existe. Pulando.`);
    } else {
      superadmin = await User.create({
        username: SUPERADMIN_USERNAME,
        password: SUPERADMIN_PASSWORD, // hash e feito pelo pre-save hook
        isAdmin: true,
        is_super_admin: true,
        role: 'admin',
        balance: 0,
      });
      console.log(`  [+] Superadmin criado: ${superadmin.username} (ID: ${superadmin._id})`);
    }

    // --- 2. Cria planos de assinatura de exemplo ---
    console.log('\n[2/4] Criando planos de assinatura...');

    // Cria um tenant de exemplo para associar a assinatura
    let tenant = await User.findOne({ username: 'tenant_exemplo' });
    if (!tenant) {
      tenant = await User.create({
        username: 'tenant_exemplo',
        password: 'Tenant@2024!',
        isAdmin: true,
        is_super_admin: false,
        role: 'admin',
        balance: 0,
      });
      console.log(`  [+] Tenant de exemplo criado: ${tenant.username} (ID: ${tenant._id})`);
    } else {
      console.log(`  [!] Tenant "tenant_exemplo" ja existe. Pulando.`);
    }

    // Plano Basic
    const existingBasic = await Subscription.findOne({
      tenant_id: tenant._id,
      plan: 'basic',
    });
    if (!existingBasic) {
      await Subscription.create({
        tenant_id: tenant._id,
        plan: 'basic',
        price: 300.0,
        maxBots: 3,
        status: 'active',
        started_at: new Date(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
        payment_method: 'manual',
      });
      console.log('  [+] Plano Basic criado (R$ 300,00 - 3 bots - 30 dias)');
    } else {
      console.log('  [!] Plano Basic ja existe para o tenant. Pulando.');
    }

    // Referencia de Plano Premium (apenas documentacao; cria se nao houver tenant premium)
    console.log('  [i] Plano Premium disponivel: R$ 400,00 - bots ilimitados');

    // --- 3. Cria bot de exemplo ---
    console.log('\n[3/4] Criando bot de exemplo...');
    let sampleBot = await Bot.findOne({ username: 'exemplo_store_bot' });
    if (!sampleBot) {
      sampleBot = await Bot.create({
        name: 'Loja Exemplo',
        description: 'Bot de exemplo para demonstracao da plataforma',
        username: 'exemplo_store_bot',
        owner_id: tenant._id,
        tenant_id: tenant._id,
        bot_token: 'PLACEHOLDER_TOKEN_SUBSTITUA_PELO_REAL',
        active: false, // inativo ate configurar token real
        status: 'inactive',
        store_name: 'Loja Exemplo',
        store_color: '#10b981',
        min_purchase_amount: 5,
        max_purchase_amount: 500,
        welcome_message:
          'Bem-vindo a Loja Exemplo! Use /menu para ver as opcoes disponiveis.',
        help_message:
          'Comandos:\n/menu - Ver opcoes\n/saldo - Seu saldo\n/comprar - Comprar\n/suporte - Ajuda',
        referral_enabled: true,
        referral_bonus_percentage: 5,
      });
      console.log(
        `  [+] Bot criado: ${sampleBot.name} (@${sampleBot.username}, ID: ${sampleBot.id})`
      );
    } else {
      console.log(`  [!] Bot "exemplo_store_bot" ja existe. Pulando.`);
    }

    // --- 4. Cria entradas de BIN globais ---
    console.log('\n[4/4] Criando tabela de precos por BIN...');
    let createdBins = 0;
    let skippedBins = 0;

    for (const binData of SAMPLE_BINS) {
      const existing = await Bin.findOne({
        bin: binData.bin,
        owner_id: null,
        source: 'global',
      });

      if (existing) {
        skippedBins++;
        continue;
      }

      await Bin.create({
        ...binData,
        owner_id: null, // global
      });
      createdBins++;
    }

    console.log(`  [+] BINs criados: ${createdBins}`);
    if (skippedBins > 0) {
      console.log(`  [!] BINs ja existentes (pulados): ${skippedBins}`);
    }

    // --- Resumo ---
    console.log('\n===========================================');
    console.log('   SEED CONCLUIDO COM SUCESSO!');
    console.log('===========================================');
    console.log(`\n  Superadmin: ${SUPERADMIN_USERNAME}`);
    console.log(`  Senha:      ${SUPERADMIN_PASSWORD}`);
    console.log(`  Tenant:     tenant_exemplo / Tenant@2024!`);
    console.log(`  Bot:        @exemplo_store_bot (inativo)`);
    console.log(`  BINs:       ${createdBins + skippedBins} entradas globais`);
    console.log(`\n  [!] TROQUE AS SENHAS EM PRODUCAO!\n`);
  } catch (error) {
    console.error('\n[ERRO] Falha no seed:', error.message);
    if (error.code === 11000) {
      console.error('  Dados duplicados detectados. Verifique se o seed ja foi executado.');
    }
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('[*] Conexao com MongoDB encerrada.');
  }
}

// Executa o seed
seed();
