# PLANO DE IMPLEMENTACAO COMPLETO — MultiBot-Ghost

## Contexto

O MultiBot-Ghost e uma plataforma SaaS multi-tenant para venda de produtos digitais via Telegram bots.
Hospedado em **multibot.ghoststore.cc**, no mesmo ambiente/servidor do ghost-marketplace.

**Estado atual**: Esqueleto completo (middleware, schemas, componentes UI) mas **100% da logica de negocio sao stubs** — todos os 11 services retornam "Nao implementado", todos os ~80 route handlers retornam 501, todas as 42 paginas frontend usam dados hardcoded. **O bot runtime do Telegram nao existe** — nenhum arquivo que rode os bots foi criado.

**Objetivo**: Implementar o sistema completo com:
- Mesmas tecnologias do ghost-marketplace (Zustand, TanStack Query, Tailwind v4, Valibot)
- Design system "Tactical Night Panel" do ghost-marketplace
- Seguranca/auth replicando padroes do ghost-marketplace
- Gerenciamento completo de Telegram bots (criar, configurar, rodar)
- Integracao com Api-MultiBot-Ghost (ja rodando)
- MongoDB em Docker container

---

## DECISOES CONFIRMADAS

| Item | Decisao |
|------|---------|
| Design | Tactical Night Panel completo do ghost-marketplace |
| Stack frontend | Migrar para Zustand + TanStack Query v5 + Tailwind v4 + Valibot |
| Auth/Seguranca | Replicar padroes ghost-marketplace (apiFetch, JWT refresh) |
| Prioridade | Backend core primeiro, bugs corrigidos on-the-go |
| Api-MultiBot-Ghost | Ja rodando, configurar URL de conexao |
| Banco | MongoDB em Docker container |
| Dominio | multibot.ghoststore.cc (mesmo servidor ghost-marketplace) |
| Telegram | Gerenciamento completo: painel web + comandos admin no proprio bot |

---

## FASE 0 — Migracao de Stack + Correcoes Criticas

### 0.1 Migrar dependencias do frontend

**Remover**: `@reduxjs/toolkit`, `react-redux`, `axios`, `yup`, `tailwindcss@3`, `postcss`, `autoprefixer`

**Adicionar**: `zustand`, `@tanstack/react-query@5`, `@tailwindcss/vite` + `tailwindcss@4`, `valibot`, `react-router-dom@7`, `framer-motion`, `gsap`

**Manter**: `react@18`, `vite@5`, `lucide-react`, `recharts`, `@radix-ui/*`, `cva`, `clsx`, `tailwind-merge`, `socket.io-client`

### 0.2 Migrar state — Redux → Zustand

Substituir 8 slices + store.js por Zustand stores:

| Arquivo Atual (remover) | Novo Store (criar) |
|------------------------|-------------------|
| `slices/authSlice.js` | `stores/auth.store.js` |
| `slices/cardsSlice.js` | `stores/cards.store.js` |
| `slices/purchasesSlice.js` | `stores/purchases.store.js` |
| `slices/rechargeSlice.js` | `stores/recharge.store.js` |
| `slices/giftCardSlice.js` | `stores/giftcard.store.js` |
| `slices/adminSlice.js` | `stores/admin.store.js` |
| `slices/dashboardSlice.js` | `stores/dashboard.store.js` |
| `slices/themeSlice.js` | `stores/theme.store.js` |
| `store/store.js` | (remover — Zustand nao precisa de root store) |

Adicionar: `stores/sidebar.store.js` (padrao ghost-marketplace: isCollapsed, toggle)

### 0.3 Migrar data fetching — Axios → apiFetch + TanStack Query

**Criar `services/apiFetch.js`** (replicar ghost-marketplace):
- fetch nativo com JWT Bearer
- auto-retry 401 com refresh token
- error normalization
- base URL: `VITE_API_URL || 'http://localhost:9999/api'`

**Configurar QueryClient** em `main.jsx` com `QueryClientProvider`

**Migrar services**: trocar `api.get/post/put/delete` por `apiFetch()`

**Pages usam `useQuery`/`useMutation`** em vez de `dispatch()`

### 0.4 Migrar Tailwind v3 → v4

- Remover `tailwind.config.js` e `postcss.config.js`
- Criar `app.css` com `@import "tailwindcss"` + `@theme { ... }`
- Atualizar `vite.config.js`: adicionar `@tailwindcss/vite` plugin

### 0.5 Corrigir bugs backend

- `tenantAuth.js`: corrigir import path do Bot model
- `server.js`: adicionar JWT auth no Socket.IO handshake
- `.env.example`: PORT = 9999

### 0.6 Corrigir bugs frontend (antes da migracao)

- Sidebar paths → alinhar com App.jsx routes
- LoginPage → corrigir modo register

### 0.7 Docker Compose — Integracao

```yaml
networks:
  multibots-network:
    driver: bridge
  ghost-app-network:
    external: true

services:
  backend:
    networks:
      - multibots-network
      - ghost-app-network
    environment:
      - SUPPLIER_API_URL=http://ghost-multibot-api:3003
      - SUPPLIER_API_KEY=${SUPPLIER_API_KEY}
```

---

## FASE 1 — Backend: Services Core (Auth + Cards + Purchases)

### 1.1 auth.service.js — 7 metodos

- `register()`: bcrypt, JWT, unicidade email/username, tenant association
- `login()`: buscar `+password`, bcrypt.compare, JWT `{ id, role, owner_id, bot_id }`
- `changePassword()`: validar atual, hashear nova
- `getUserProfile()`: `toSafeObject()` do schema
- `getUserStats()`: aggregation compras + saldo
- `refreshToken()`: validar refresh, novo par
- `validateToken()`: verificar JWT

### 1.2 card.service.js — 9 metodos

- `listCards()`: filtros + paginacao + tenant isolation
- `getCardCountries()` / `getCardGateways()`: aggregation distinct
- `massCheck()`: batch via checker service
- `uploadCards()`: parse CSV, batch_id, validacao formato
- `exportCards()`: CSV mascarado
- `findDuplicates()`: aggregation hash
- `reactivateCards()`: dead → available

### 1.3 purchase.service.js — 5 metodos

- `purchaseCard()`: transacao atomica: saldo → `priceResolver` → `Card.reserveCard()` → debitar → Order → Socket.IO
- `purchaseAsync()`: com checker async
- `purchaseAutoLive()`: checker inline
- `purchaseMixPackage()`: multipla em transacao
- `getPurchaseHistory()`: paginada

**VULN-001**: preco SEMPRE via `priceResolver.js`, NUNCA do frontend.

### 1.4 Wiring — Route handlers → services

`auth.routes.js`, `cards.routes.js`, `purchases.routes.js`: substituir 501 por service calls

---

## FASE 2 — Backend: Fluxo Financeiro

### 2.1 recharge.service.js — 6 metodos
- `createRecharge()`, `processPixRecharge()` (PrimePix v2 API), `processManualRecharge()`, `processCryptoRecharge()` (Plisio API), `getRechargeHistory()`, `getRechargeSettings()`

### 2.2 pix.service.js — 5 metodos
- `generatePixCharge()`, `checkPixStatus()`, `processPixCallback()` (VULN-012: secret no header), `getPixSettings()`, `updatePixSettings()`

### 2.3 crypto.service.js — 4 metodos
- `generateCryptoInvoice()`, `checkCryptoStatus()`, `processCryptoCallback()` (VULN-003: HMAC obrigatorio), `getSupportedCurrencies()` (ja implementado)

### 2.4 Webhook handlers
- Conectar `webhooks.routes.js` aos services com idempotencia

---

## FASE 3 — Telegram: Motor de Bots Completo

> **CRITICO**: Esta fase cria o componente central que nao existe — o runtime que roda os bots do Telegram.

### 3.1 BotManager — Gerenciador Multi-Bot (`backend/src/telegram/BotManager.js`)

Classe singleton que gerencia N instancias de bots simultaneamente:

```
BotManager
├── bots: Map<botId, TelegramBotInstance>
├── startAll()          // Carrega todos bots ativos do MongoDB, inicia cada um
├── startBot(botId)     // Carrega token do DB, cria instancia, registra handlers
├── stopBot(botId)      // Para polling/webhook, remove instancia
├── restartBot(botId)   // Stop + Start
├── getBotStatus(botId) // running/stopped/error + uptime + last heartbeat
├── handleUpdate(botId, update)  // Roteia update pro bot correto
└── healthCheck()       // Cron: verifica heartbeat de todos bots, reinicia os caidos
```

**Inicializacao**: Chamado no `server.js` apos connect do MongoDB:
```javascript
const botManager = new BotManager();
await botManager.startAll();
app.set('botManager', botManager);
```

**Token do BotFather**: O admin coloca o token no painel (campo `bot_token` no schema Bot), o BotManager le do MongoDB — nao de env vars.

### 3.2 TelegramBotInstance — Instancia Individual (`backend/src/telegram/BotInstance.js`)

Cada bot e uma instancia independente com:

```
TelegramBotInstance
├── bot: TelegramBot (node-telegram-bot-api)
├── botId: string
├── config: Bot document do MongoDB
├── handlers:
│   ├── onStart()        // /start → welcome_message + menu principal
│   ├── onMenu()         // /menu → inline keyboard do menu
│   ├── onSaldo()        // /saldo → saldo do usuario
│   ├── onSuporte()      // /suporte → info de suporte
│   ├── onAdmin()        // /admin → menu admin (so owner/assistants)
│   ├── onCallbackQuery() // Handler de botoes inline
│   └── onMessage()      // Handler de mensagens texto
├── start()              // Inicia polling, registra handlers, atualiza heartbeat
├── stop()               // Para polling, limpa interval
└── updateConfig()       // Recarrega config do MongoDB sem reiniciar
```

### 3.3 Menu Builder — Construtor de Menus Inline (`backend/src/telegram/MenuBuilder.js`)

Gera inline keyboards dinamicamente baseado nas configs do bot:

```javascript
class MenuBuilder {
  static mainMenu(botConfig) {
    // Gera menu principal baseado nas features habilitadas
    const keyboard = [];
    keyboard.push([{ text: '🛒 Comprar', callback_data: 'menu:buy' }]);
    if (!botConfig.disable_pix) {
      keyboard.push([{ text: '💰 Adicionar Saldo', callback_data: 'menu:recharge' }]);
    }
    keyboard.push([{ text: '👤 Minha Conta', callback_data: 'menu:account' }]);
    keyboard.push([{ text: '📞 Suporte', callback_data: 'menu:support' }]);
    if (botConfig.referral_enabled) {
      keyboard.push([{ text: '🤝 Indicações', callback_data: 'menu:referral' }]);
    }
    return { reply_markup: { inline_keyboard: keyboard } };
  }

  static buyMenu(countries)     // Tipo → Pais → Banco → Nivel → Lista → Confirmar
  static rechargeMenu(config)   // [PIX Auto] → Valor → QR | [Crypto] → Moeda → Invoice
  static accountMenu()          // Saldo, Historico, Dados
  static adminMenu()            // Configuracoes, Usuarios, Estoque, Broadcast, Stats
}
```

**Customizavel pelo painel**: O admin configura via web:
- `metadata.menu_flow`: 'default' | 'compact' | 'custom'
- `metadata.custom_emojis`: { buy: '🛒', recharge: '💰', ... }
- `welcome_message`, `help_message`, `terms_message`
- `store_name`, `store_color`, `start_image_url`

### 3.4 Callback Router — Roteador de Acoes (`backend/src/telegram/CallbackRouter.js`)

Processa callback_query dos botoes inline:

```
CallbackRouter
├── menu:buy        → Mostra tipos de produto (full, sem, consultaveis, tracks)
├── buy:type:{type} → Lista paises com estoque
├── buy:country:{c} → Lista BINs disponiveis
├── buy:bin:{bin}    → Mostra preco + confirmar
├── buy:confirm:{id} → Executa compra (usa purchase.service)
│
├── menu:recharge     → Mostra metodos de pagamento
├── recharge:pix      → Solicita valor → Gera QR code
├── recharge:crypto   → Seleciona moeda → Gera invoice
├── recharge:manual   → Instrucoes para envio manual
│
├── menu:account      → Mostra saldo, historico, dados
├── account:history   → Ultimas compras
├── account:wallet    → Saldo detalhado
│
├── menu:support      → Info de suporte + username
├── menu:referral     → Codigo de indicacao + stats
│
├── admin:*           → Menu administrativo (ver 3.5)
└── page:{n}          → Paginacao inline
```

### 3.5 Admin via Bot — Comandos Administrativos no Telegram

O owner/admin pode gerenciar o bot PELO PROPRIO TELEGRAM com `/admin`:

```
/admin → Menu Administrativo:
├── [⚙️ Configurações]
│   ├── Editar mensagem de boas-vindas
│   ├── Editar nome da loja
│   ├── Ativar/desativar compras
│   ├── Ativar/desativar PIX
│   ├── Configurar canal obrigatorio
│   └── Ativar/desativar indicacoes
│
├── [👥 Usuários]
│   ├── Total de usuarios
│   ├── Usuarios ativos (24h)
│   ├── Buscar usuario (por ID ou username)
│   ├── Banir/desbanir usuario
│   └── Creditar saldo a usuario
│
├── [📦 Estoque]
│   ├── Resumo por tipo/pais/BIN
│   ├── Total disponivel/vendido/morto
│   └── Alertas de estoque baixo
│
├── [📢 Broadcast]
│   ├── Enviar mensagem para todos
│   ├── Enviar para usuarios ativos (7d)
│   └── Enviar com imagem
│
├── [💰 Financeiro]
│   ├── Vendas hoje/semana/mes
│   ├── Recargas pendentes (aprovar manual)
│   ├── Receita total
│   └── Top compradores
│
├── [🎁 Gift Cards]
│   ├── Criar gift card
│   ├── Listar ativos
│   └── Revogar gift card
│
└── [📊 Estatísticas]
    ├── Dashboard resumido
    ├── Grafico de vendas (texto ASCII)
    └── Status do bot (uptime, memoria)
```

**Seguranca**: O `/admin` so responde se `user.telegram_id` pertence ao owner do bot (query User com `role: 'admin'` + `owner_id` do bot).

**Edicao inline**: Para editar configs (ex: welcome_message), o bot entra em "modo edicao":
1. Admin clica "Editar mensagem de boas-vindas"
2. Bot responde "Envie a nova mensagem de boas-vindas:"
3. Bot ativa `bot.once('message', ...)` para capturar a proxima mensagem
4. Salva no MongoDB, confirma "Mensagem atualizada!"
5. Chama `botInstance.updateConfig()` para aplicar sem reiniciar

### 3.6 Heartbeat + Auto-Restart (`backend/src/telegram/HealthMonitor.js`)

Job periodico (cron a cada 2 minutos):
1. Para cada bot ativo no MongoDB:
   - Verifica `last_heartbeat` (atualizado pelo bot a cada 60s)
   - Se heartbeat > 3 minutos atras → marca como `error`, tenta restart
   - Se restart falha 3x → marca como `stopped`, notifica admin via outro bot ou email
2. Atualiza `runtime_status` e `uptime` no schema Bot

### 3.7 Telegram User Registration

Quando usuario faz `/start` no bot:
1. Verifica se ja existe User com `telegram_id` + `bot_id`
2. Se nao: cria User com dados do Telegram (first_name, username, telegram_id)
3. Se `require_subscription` ativo: verifica se usuario segue o `required_channel`
4. Aplica referral se veio com parametro (`/start ref_CODIGO`)
5. Envia `welcome_message` + `start_image_url` (se houver) + menu principal

### 3.8 Wiring — Conectar routes de Telegram

Implementar os 24 handlers em `telegram.routes.js`:
- CRUD bots: criar (valida token com getMe), atualizar, deletar (para bot primeiro), restart
- Settings: GET/PUT usa Bot model + `updateConfig()` no BotManager
- Users/Orders/Recharges/etc: queries com tenant isolation

### 3.9 telegram.service.js + broadcast.service.js

Implementar todos os metodos dos services usando o BotManager:

```javascript
class TelegramService {
  sendMessage(botId, chatId, message) {
    const instance = botManager.getBotInstance(botId);
    return instance.bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
  }

  sendBroadcast(botId, message, filters) {
    // Rate limit: 30 msgs/sec (Telegram API limit)
    // Filtra usuarios por: ativos, data, saldo minimo
    // Usa queue para nao bloquear
  }
}
```

### 3.10 Estrutura de arquivos Telegram (todos novos)

```
backend/src/telegram/
├── BotManager.js          // Singleton, gerencia todas instancias
├── BotInstance.js          // Uma instancia de bot
├── MenuBuilder.js          // Gera inline keyboards
├── CallbackRouter.js       // Processa callback queries
├── AdminCommands.js        // /admin handlers
├── HealthMonitor.js        // Heartbeat + auto-restart
├── UserRegistration.js     // /start + referral + subscription check
└── utils/
    ├── rateLimiter.js      // Rate limit para broadcast (30/sec)
    ├── channelChecker.js   // Verifica subscription em canal
    └── messageFormatter.js // Formata mensagens com HTML/emojis
```

---

## FASE 4 — Backend: Admin Panel + Supplier + Restantes

### 4.1 Admin route handlers (12 files, ~130 handlers)

Padrao: importar service → try/catch → res.json({ success, data })

Prioridades:
- `dashboard.routes.js`: aggregations (getSalesReport, getRechargeReport, countByType)
- `cards.routes.js`: CRUD + CSV upload/export + `uploadHandler`
- `users.routes.js`: CRUD + ban/unban + creditar
- `payments.routes.js`: `maskObjectSecrets` (VULN-007)
- `settings.routes.js`: `htmlSanitizer` (VULN-008)
- `checker.routes.js`: `urlValidator` SSRF protection
- `external-api.routes.js`: conexao com Api-MultiBot-Ghost

### 4.2 checker.service.js — 4 metodos
- `checkCard()`: `urlValidator` + parsear keywords
- `checkBatch()`: controle de threads
- `getAvailableGateways()` / `getCheckerStatus()`

### 4.3 supplier.service.js — 4 metodos (Api-MultiBot-Ghost)
- `fetchCards()`: `GET ghost-multibot-api:3003/catalog?view=summary`
- `syncInventory()`: `GET /catalog?view=units`
- `processSupplierCallback()`: webhook handler
- `getSupplierStatus()`: health check

### 4.4 giftcard.service.js — 4 metodos
- `redeemGiftcard()`: `GiftCard.redeemByCode()`, VULN-009 (limites, sem self-redeem)
- `getGiftcardHistory()`, `createGiftcard()`, `validateGiftcardCode()`

### 4.5 SuperAdmin + Assistant handlers
- SuperAdmin: CRUD tenants/bots, system stats, maintenance, audit logs
- Assistant: user lookup, refund, credit

### 4.6 auditLogger → Activity model
- Persistir audit events no MongoDB via `Activity.log()`

---

## FASE 5 — Frontend: Design System "Tactical Night Panel"

### 5.1 Design tokens (`app.css` com Tailwind v4)

```css
@import "tailwindcss";

@theme {
  --color-bg-base: #01040d;
  --color-bg-surface: #040b1e;
  --color-bg-elevated: #06112a;
  --color-accent: #35c5ff;
  --color-accent-hover: #2abcf8;
  --color-accent-strong: #007ded;
  --color-text-primary: #ecf6ff;
  --color-text-secondary: #d4e6ff;
  --color-text-muted: #93b2d8;
  --color-text-caption: #6f8db8;
  --color-success: #5cecae;
  --color-warning: #ffd377;
  --color-error: #ff9da8;
  --color-info: #68caff;
  --font-sans: 'Manrope', system-ui, sans-serif;
  --font-display: 'Space Grotesk', sans-serif;
  --ease-out-expo: cubic-bezier(0.22, 1, 0.36, 1);
}
```

### 5.2 Componentes design system (replicar ghost-marketplace)

- **`Surface.jsx`**: border gradient, bg gradient, inner glow
- **`GlassPanel.jsx`**: `backdrop-blur-[20px]`, radial gradients
- **`InputField.jsx`**: variante auth, icone cyan, focus glow
- **`AppShell.jsx`**: sidebar colapsavel (6.5rem/20rem) + navbar + content

### 5.3 Refatorar layouts e componentes

- `AdminLayout.jsx` → AppShell com glass-panel sidebar
- `UserLayout.jsx` → Surface components
- `Header.jsx` → wallet card, theme toggle
- `Sidebar.jsx` → glass-panel, glow effects, thin borders
- Todos shared components → Tactical Night Panel tokens
- Regra: 80-85% dark, cantos quadrados, glow = "energia tecnica"

---

## FASE 6 — Frontend: Integrar Pages com API

### 6.1 Padrao com TanStack Query + Zustand

```jsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@services/apiFetch';
import { useAuthStore } from '@stores/auth.store';

export default function CatalogPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['cards', filters],
    queryFn: () => apiFetch('/cards?' + new URLSearchParams(filters)),
  });

  const purchase = useMutation({
    mutationFn: (cardId) => apiFetch('/purchases', { method: 'POST', body: { cardId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cards'] }),
  });
}
```

### 6.2 Paginas Public (4)
- `LandingPage.jsx`: hero Tactical Night Panel, dados reais via useQuery
- `PlansPage.jsx`: planos reais (Basico R$300 / Premium R$400)
- `LoginPage.jsx`: useMutation + useAuthStore, validacao Valibot
- `BannedPage.jsx`: estatico

### 6.3 Paginas User (7)
- Dashboard, Catalog, Purchases, Recharge, Wallet, GiftCard, Referrals
- useQuery para dados + useMutation para acoes

### 6.4 Paginas Admin (22) — incluindo Telegram

Todas conectadas ao backend via TanStack Query + componentes design system.

**Telegram (9 paginas) — detalhamento**:

**TelegramBotsPage.jsx**:
- Lista todos os bots do owner com status (online/offline/error)
- Dialog "Novo Bot": campo token do BotFather → backend valida com `getMe` → cria bot → inicia instancia
- Acoes por bot: Start/Stop/Restart, Editar, Deletar
- Status badge: verde (online), vermelho (error), cinza (stopped)
- Indicadores: usuarios, vendas, receita, uptime

**TelegramSettingsPage.jsx**:
- Edicao completa das configs do bot selecionado:
  - **Identidade**: nome da loja, logo URL, cor, imagem de boas-vindas
  - **Mensagens**: welcome, help, terms (textarea com preview)
  - **Compras**: min/max amount, disable purchases, disable PIX, mix packages
  - **Canal**: required_channel, require_subscription, exchange_channel
  - **Referral**: enabled, bonus percentage
  - **Features**: backup, exchanges, references
  - **Menu**: layout (default/compact/custom), custom emojis
  - **Suporte**: support_username
- Preview em tempo real do menu do bot
- Botao "Salvar" → PUT /admin/telegram/settings → BotManager.updateConfig()

**TelegramUsersPage.jsx**:
- Lista usuarios do bot com filtros (ativos, inativos, banidos)
- Busca por telegram_id, username, nome
- Acoes: ver perfil, creditar saldo, banir/desbanir
- Stats: total, novos hoje, ativos 24h

**TelegramOrdersPage.jsx**:
- Historico de compras feitas via bot
- Filtros: status, data, tipo, usuario
- Detalhes do pedido: card (mascarado), preco, data, status

**TelegramRechargesPage.jsx**:
- Recargas pendentes de aprovacao manual
- Acoes: aprovar/rejeitar recarga manual
- Historico com filtros

**TelegramBroadcastPage.jsx**:
- Composer de mensagem (texto + imagem opcional)
- Target: todos, ativos 7d, ativos 30d, com saldo > X
- Preview da mensagem
- Historico de broadcasts com stats (enviados/entregues/bloqueados)
- Progress bar para broadcast em andamento

**TelegramGiftCardsPage.jsx**:
- Criar gift cards com valor + quantidade + expiracao
- Lista com status (ativo/usado/expirado/revogado)
- Acoes: revogar, ver quem resgatou

**TelegramAffiliatesPage.jsx**:
- Config de referral: bonus %, regras
- Ranking de affiliados
- Stats: indicacoes, conversoes, bonus pagos

**TelegramExchangesPage.jsx**:
- Trocas/devoluções via bot
- Status tracking
- Aprovacao/rejeicao pelo admin

### 6.5 Paginas SuperAdmin (3) + Assistant (2)
- SuperAdmin: login real, dashboard sistema, CRUD tenants
- Assistant: lookup usuario, refund/credit

### 6.6 Integrar useSocket para real-time
- PIX: status pagamento
- Cards: estoque real-time
- Telegram: notificacoes novas compras/recargas
- Admin: alertas

### 6.7 Toast global
- `<ToastContainer />` no App.jsx
- `useToast()` em acoes sucesso/erro

---

## FASE 7 — Testes e Validacao

### 7.1 Backend
```bash
docker-compose up -d mongo redis
node database/seeds/seed.js
cd backend && npm run dev
# Testar auth, compras, webhooks, telegram bot start
```

### 7.2 Frontend
```bash
cd frontend && npm run dev
# Testar: registro → login → dashboard → catalogo → compra → recarga → telegram admin
```

### 7.3 Docker Compose completo
```bash
docker-compose up --build
# multibot.ghoststore.cc → frontend
# Backend health: :9999/health
# Conectividade Api-MultiBot-Ghost: :3003
```

### 7.4 Teste Telegram
```bash
# 1. Criar bot no BotFather, copiar token
# 2. No painel admin: Telegram → Novo Bot → colar token
# 3. Verificar bot online no Telegram
# 4. Testar /start, /menu, /saldo, /admin
# 5. Testar fluxo de compra via bot
# 6. Testar broadcast
# 7. Testar edicao de config via /admin no bot
```

### 7.5 Checklist de seguranca (FALHAS-E-CORRECOES.md)

- [ ] VULN-001: preco nunca vem do frontend (priceResolver)
- [ ] VULN-002: checker URLs validadas (SSRF blocked)
- [ ] VULN-003: HMAC em webhooks crypto (Plisio)
- [ ] VULN-004: CORS com allowlist explicita
- [ ] VULN-005: express-mongo-sanitize ativo
- [ ] VULN-006: tenant isolation em todas queries
- [ ] VULN-007: secrets mascarados nas responses
- [ ] VULN-008: HTML sanitizado em inputs texto rico
- [ ] VULN-009: gift cards com limites
- [ ] VULN-010: uploads re-encoded com sharp
- [ ] VULN-011: source maps off em prod
- [ ] VULN-012: PIX webhook secret no header
- [ ] VULN-013: erros CSV sem reflection

---

## ORDEM DE EXECUCAO FINAL

| # | Fase | Escopo |
|---|------|--------|
| 1 | FASE 0 | Migrar stack frontend + fix bugs + docker-compose |
| 2 | FASE 1 | Backend: auth + cards + purchases |
| 3 | FASE 2 | Backend: recharge + payments + webhooks |
| 4 | FASE 3 | **Telegram: motor completo de bots** (BotManager, menus, admin via bot) |
| 5 | FASE 4 | Backend: admin handlers + supplier + restantes |
| 6 | FASE 5 | Frontend: Design System Tactical Night Panel |
| 7 | FASE 6 | Frontend: integrar 42 pages + 9 pages Telegram |
| 8 | FASE 7 | Testes end-to-end + checklist seguranca |

---

## ARQUIVOS CRITICOS

### Novos a criar

**Backend — Telegram engine (Fase 3)**:
```
backend/src/telegram/
├── BotManager.js
├── BotInstance.js
├── MenuBuilder.js
├── CallbackRouter.js
├── AdminCommands.js
├── HealthMonitor.js
├── UserRegistration.js
└── utils/
    ├── rateLimiter.js
    ├── channelChecker.js
    └── messageFormatter.js
```

**Frontend — Stores + Services (Fase 0)**:
```
frontend/src/stores/
├── auth.store.js
├── cards.store.js
├── purchases.store.js
├── recharge.store.js
├── giftcard.store.js
├── admin.store.js
├── dashboard.store.js
├── theme.store.js
└── sidebar.store.js

frontend/src/services/apiFetch.js
frontend/src/app.css (Tailwind v4)
```

**Frontend — Design System (Fase 5)**:
```
frontend/src/components/design/
├── Surface.jsx
├── GlassPanel.jsx
├── InputField.jsx
└── AppShell.jsx
```

### Existentes a implementar (stubs → codigo real)

- 11 backend services (backend/src/services/*.js)
- ~80 backend route handlers (backend/src/routes/**/*.js)
- 42 frontend pages (frontend/src/pages/**/*.jsx)

### Existentes a REUTILIZAR (ja prontos)

- 8 middleware (backend/src/middleware/)
- 5 utils (backend/src/utils/)
- 16 schemas com metodos atomicos (database/schemas/)
- Config + CORS + DB connection (backend/src/config/)
- app.js + server.js (backend/src/)
- Docker: Dockerfiles + nginx.conf + docker-compose base

### Do ghost-marketplace a replicar

- Design tokens (design-tokens.css)
- apiFetch wrapper pattern
- Zustand store patterns
- Surface/GlassPanel/InputField components
- AppShell layout
- Auth com JWT refresh
