# HANDOFF — MultiBots.cc
## Documento de Transferência de Conhecimento Técnico
**Data:** 2026-08-11 | **Baseado em:** Pentest black-box autenticado (2026-08-10/11)

---

## 1. VISÃO GERAL DO PRODUTO

### O que é
MultiBots.cc é uma plataforma **SaaS multi-tenant brasileira** que permite a **donos de loja** (owners/tenants) criarem e gerenciarem múltiplos **bots do Telegram** para venda de cartões de crédito (CCs), gift cards e dados financeiros. Cada owner assina um plano mensal, recebe acesso a um painel web administrativo e pode operar 1 ou 2 bots Telegram que atendem seus clientes finais automaticamente.

### Objetivo do negócio
Fornecer infraestrutura pronta (bot + painel + pagamentos + estoque) para que operadores de "CC stores" lancem suas lojas no Telegram sem precisar desenvolver software. O MultiBots cuida do hosting do bot, do processamento de pagamentos (PIX/crypto), do checker de cartões e da interface de gerenciamento. O owner só precisa configurar preços, importar estoque e divulgar seu bot.

### Modelo de receita
- **Assinatura mensal** dos owners (R$300–R$400/mês)
- **Comissão implícita** sobre o estoque global (fornecedor externo)
- **Spread** entre preço de custo do cartão (fornecedor) e preço de venda (definido por BIN)

### Data de criação
Domínio registrado em **2026-07-30** (Hostinger). Plataforma extremamente recente (~12 dias no momento da análise).

---

## 2. ARQUITETURA DE ALTO NÍVEL

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLOUDFLARE (CDN/WAF)                      │
│                  IPs: 172.67.152.141 / 104.21.12.148             │
└────────────┬──────────────────────────────────┬──────────────────┘
             │                                  │
             ▼                                  ▼
┌────────────────────────┐        ┌──────────────────────────────┐
│   FRONTEND (SPA)       │        │   BACKEND API                │
│   React 18 + Vite      │        │   Node.js + Express          │
│   Cloudflare Pages     │        │   187.127.21.147:9999        │
│   multibots.cc         │        │   api.multibots.cc           │
│   1.6MB bundle JS      │        │   (nginx 1.24.0 reverse      │
│   760KB CSS            │        │    proxy na porta 80/443)    │
└────────────────────────┘        └──────┬───────────┬───────────┘
                                         │           │
                              ┌──────────┘           └──────────┐
                              ▼                                  ▼
                   ┌────────────────────┐          ┌──────────────────────┐
                   │   MONGODB          │          │   SERVIÇOS EXTERNOS  │
                   │   (banco principal)│          │                      │
                   │   Collections:     │          │  • Checker API       │
                   │   users, cards,    │          │    102.165.46.194    │
                   │   orders, bots,    │          │    porta 3005        │
                   │   recharges,       │          │                      │
                   │   batches, bins,   │          │  • PrimePix v2 (PIX) │
                   │   giftcards,       │          │                      │
                   │   promotions,      │          │  • Plisio (Crypto)   │
                   │   settings...      │          │                      │
                   └────────────────────┘          │  • GhostStore API    │
                                                   │    (fornecedor       │
                                                   │     externo de CCs)  │
                                                   │    api.ghoststore.cc │
                                                   └──────────────────────┘
                              │
                              ▼
                   ┌────────────────────┐
                   │  TELEGRAM BOT API  │
                   │  Bot runtime no    │
                   │  mesmo servidor    │
                   │  (polling/webhook) │
                   └────────────────────┘
```

### Stack tecnológico confirmado

| Camada | Tecnologia | Evidência |
|--------|-----------|-----------|
| Frontend | React 18 + Vite + Redux Toolkit | Bundle JS analisado, react-dom, createSlice |
| Backend | Node.js + Express | Headers, error messages, axios 1.11.0 |
| Database | MongoDB | Comportamento NoSQLi ($ne, $regex processados) |
| Servidor | Ubuntu (Hostinger VPS) | SSH banner OpenSSH 9.6p1 |
| Webserver | nginx 1.24.0 | Headers diretos no IP real |
| CDN/WAF | Cloudflare | DNS, headers cf-ray |
| Bot Runtime | Node.js (node-telegram-bot-api ou grammy) | Heartbeat, webhook, mesmo servidor |

### Infraestrutura

| Recurso | Valor |
|---------|-------|
| IP real do servidor | `187.127.21.147` |
| Hostname | `srv1868775.hstgr.cloud` |
| Hosting | Hostinger VPS |
| Portas abertas (IP real) | 22 (SSH), 80 (HTTP), 443 (HTTPS) |
| API interna | porta 9999 (nginx proxy → Node.js) |
| Domínios | multibots.cc, api.multibots.cc, api.multibots.app |

---

## 3. MODELO MULTI-TENANT

### Hierarquia de papéis (4 níveis)

```
SUPERADMIN (dono da plataforma MultiBots)
  │
  ├── Gerencia todos os tenants/owners
  ├── Controla planos de assinatura
  ├── Configurações globais (site-settings)
  ├── Cria/edita credenciais de owners
  ├── Dashboard global de receita
  │
  └── TENANT/OWNER (dono de bot — ex: "gaspar", owner_id 283518)
        │
        ├── Tem 1-2 bots Telegram (conforme plano)
        ├── Painel admin web completo
        ├── Gerencia estoque de cartões (local + fornecedor externo)
        ├── Configura preços por BIN
        ├── Configura recargas (PIX, crypto, manual)
        ├── Gerencia usuários do bot
        ├── Configura promoções, referrals, gift cards
        ├── Broadcast para usuários do bot
        │
        ├── ASSISTANT/SUPORTE (sub-conta do owner)
        │     ├── Acesso limitado ao painel
        │     ├── Pode criar/gerenciar gift cards
        │     └── Visualização de dados (sem escrita em configs)
        │
        └── USER/COMPRADOR (cliente final via Telegram)
              ├── Interage exclusivamente via bot Telegram ou painel web
              ├── Tem wallet (saldo em R$)
              ├── Compra cartões, recarrega saldo
              ├── Pode resgatar gift cards
              └── Sistema de referral
```

### Isolamento entre tenants

**Conceito projetado:**
- Cada owner tem seu(s) bot(s) com `tenant_id` = `owner_id`
- Cada bot tem um `bot_id` único (ex: bot_id=60 → GHOOOST STORE)
- Usuários do Telegram são vinculados ao `bot_id` do bot que usaram
- Estoque de cartões é **globalmente compartilhado** entre os bots de um **mesmo owner**, mas **isolado** entre owners diferentes
- Configurações (preços, recargas, mensagens) são **por bot_id**

**Realidade encontrada (falha de isolamento):**
- O parâmetro `bot_id` nos endpoints de API **não é validado contra o `owner_id`** do JWT
- Um owner pode ler/escrever configurações de bots de **outros owners** simplesmente passando um `bot_id` diferente
- O pool de cartões é efetivamente global (384K+ cards acessíveis por qualquer admin autenticado)

### Planos de assinatura

| Plano | Preço | Bots | Duração |
|-------|-------|------|---------|
| **Básico** | R$300/mês | 1 Bot Telegram | 30 dias |
| **Premium** | R$400/mês | 2 Bots Telegram | 30 dias |

Ambos incluem: Painel Admin Completo, Gestão de Usuários Ilimitados, Gestão de Cartões, Sistema de Recargas, Suporte Técnico.

---

## 4. PAINÉIS WEB (SPA)

O frontend é uma Single Page Application React servida em `multibots.cc`. Os painéis são diferenciados por hash MD5 na URL (security through obscurity) e por guards de rota no frontend.

### Rotas dos painéis

| Painel | URL | Guard | Função |
|--------|-----|-------|--------|
| **Landing/Assinatura** | `/` → `/planos` | Nenhum | Página de planos, registro de owner |
| **Painel do Usuário** | `/7a8d0634654adb1c15a18ad2a57ee150` | Auth (user) | Login/registro de comprador, compra de cards, recargas, wallet |
| **Painel Admin** | `/3218b365656f2f473c0d263817adaba6/*` | Auth (admin) | Gerenciamento completo do bot pelo owner |
| **Checker Monitor** | `/3218b365656f2f473c0d263817adaba6/checker-monitor` | Auth (admin) | Monitoramento real-time de verificações de cards |
| **Painel Assistente** | `/68c291d1f87cccd9cb73c6ff270f6fcb` | AssistantGuard | Painel limitado de suporte |
| **SuperAdmin** | `/superadmin2025/*` | SuperAdminGuard | Gestão da plataforma |

### Sub-rotas do Painel Admin (tenant)

```
/admin/
  ├── dashboard               → Analytics e métricas do bot
  ├── dashboard/advanced      → Dashboard avançado (30 dias)
  ├── cards                   → Estoque de cartões (listagem, filtro)
  ├── cards/upload            → Upload de cartões (texto, CSV, chunked, v5)
  ├── cards/export            → Exportação de cartões
  ├── cards/duplicates        → Detecção de duplicatas
  ├── cards/reactivate-dead   → Reativação de cards marcados como dead
  ├── batches                 → Gerenciamento de lotes importados
  ├── batches/auxiliary-pool   → Pool auxiliar de cartões
  ├── batches/mix-offers      → Ofertas mistas (pacotes)
  ├── bins                    → Tabela de preços por BIN
  ├── bins/upload             → Upload massivo de BINs
  ├── checker-settings        → Config do checker de cartões (API URL, keywords)
  ├── checker-monitor-data    → Dados de monitoramento do checker
  ├── card-check-sessions     → Sessões de verificação em massa
  ├── users                   → Usuários do bot (listagem)
  ├── users/all-activities    → Log de atividades dos usuários
  ├── top-users               → Ranking de maiores compradores
  ├── telegram-bots           → Config dos bots Telegram (token, backup)
  ├── telegram/settings       → Config do Telegram (mensagens, canais, regras)
  ├── telegram/users          → Usuários do Telegram (9.837 no bot 60)
  ├── telegram/users/delta    → Novos usuários desde timestamp
  ├── telegram/orders         → Pedidos feitos via Telegram
  ├── telegram/recharges      → Recargas feitas via Telegram
  ├── telegram/exchanges      → Trocas de cartões
  ├── telegram/references     → Referências pendentes
  ├── telegram/gift-cards     → Gift cards criados
  ├── telegram/gift-cards/bulk→ Criação em massa de gift cards
  ├── telegram/broadcast      → Envio de broadcast para usuários
  ├── telegram/affiliates/*   → Sistema de afiliados
  ├── telegram/start-image    → Imagem de boas-vindas do bot
  ├── telegram-bots/custom-emojis/* → Emojis customizados
  ├── automatic-pix-settings  → Config PIX automático (PrimePix v2)
  ├── automatic-pix-payments  → Pagamentos PIX processados
  ├── manual-recharge-settings→ Config recargas manuais
  ├── manual-recharge-attempts→ Tentativas de recarga manual
  ├── unified-recharge-settings→ Config unificada de recargas
  ├── recharge-settings       → Config geral de recargas
  ├── recharge-bonus          → Bônus de recarga
  ├── crypto-payments         → Pagamentos crypto (Plisio)
  ├── gateways                → Gateways de pagamento
  ├── user-gateway-access     → Acesso por gateway por usuário
  ├── giftcards               → Listagem de gift cards
  ├── promotions              → Promoções e descontos
  ├── promotions/analytics    → Analytics de promoções
  ├── referral-settings       → Config do programa de referral
  ├── referral-stats          → Estatísticas de referral
  ├── referral-earnings       → Ganhos de indicação
  ├── referral-top-referrers  → Top indicadores
  ├── referral-users          → Usuários indicados
  ├── registration-settings   → Habilitar/desabilitar registro
  ├── rules-settings          → Regras de uso
  ├── site-settings           → Configurações do site
  ├── support-contacts        → Contatos de suporte
  ├── security-analysis       → Análise de segurança
  ├── security-ip-blocks      → IPs bloqueados
  ├── user-cpf-settings       → Config de visualização de CPF
  ├── dashboard-banners       → Banners do dashboard
  ├── notifications           → Notificações admin
  ├── purchase-validation-logs→ Logs de validação de compra
  ├── status                  → Status online do admin
  ├── system-uptime           → Uptime do sistema
  ├── upload-logo             → Upload de logo
  ├── upload-header-logo      → Upload de logo do header
  ├── settings                → Config key-value
  ├── bonus-visibility        → Visibilidade de bônus para users
  └── external-api/admin/*    → Integrações com API externa (fornecedor)
```

### Sub-rotas do Painel Usuário

```
/7a8d0634654adb1c15a18ad2a57ee150/
  ├── /              → Dashboard do usuário (saldo, compras recentes)
  ├── /cards         → Catálogo de cartões para compra
  ├── /recharge      → Recarga de saldo (PIX, crypto, manual)
  ├── /purchases     → Histórico de compras
  ├── /giftcard      → Resgate de gift cards
  └── /referrals     → Programa de indicações
```

### Sub-rotas do SuperAdmin

```
/superadmin2025/
  ├── /login         → Login do superadmin
  ├── /dashboard     → Dashboard global da plataforma
  ├── /tenants       → Gerenciamento de tenants
  ├── /payments      → Pagamentos de assinatura
  ├── /stats         → Estatísticas globais
  └── /search        → Busca global
```

---

## 5. API BACKEND — MAPA COMPLETO

### Autenticação

| Método | Endpoint | Função |
|--------|----------|--------|
| POST | `/api/auth/login` | Login (username + password → JWT) |
| POST | `/api/auth/register` | Registro de novo usuário |
| POST | `/api/auth/change-password` | Alteração de senha |
| GET | `/api/auth/me` | Dados do usuário autenticado |
| GET | `/api/auth/user/stats` | Estatísticas do usuário |
| POST | `/api/superadmin/login` | Login do superadmin (JWT separado) |

**Mecanismo de autenticação:**
- JWT armazenado em `localStorage.token` (admin/user)
- JWT armazenado em `localStorage.superadmin_token` (superadmin)
- Header: `Authorization: Bearer <token>`
- Token contém: `id`, `username`, `role`, `isAdmin`, `is_super_admin`
- Rate limiting por conta E por IP global

### Endpoints Públicos (sem auth)

| Método | Endpoint | Função |
|--------|----------|--------|
| GET | `/api/public/bonus-info` | Info de bônus (aceita bot_id) |
| GET | `/api/public/recent-batches` | Lotes recentes |
| GET | `/api/public/recent-purchases` | Compras recentes |
| GET | `/api/public/rules-settings` | Regras de uso |
| GET | `/api/subscription/plans` | Planos de assinatura |
| POST | `/api/subscription/create` | Criar assinatura (registro de owner) |
| POST | `/api/crypto/plisio/callback` | Callback de pagamento crypto (SEM AUTH) |

### Endpoints de Usuário (auth: user/admin)

| Método | Endpoint | Função |
|--------|----------|--------|
| GET | `/api/cards` | Listar cartões disponíveis (com filtros) |
| GET | `/api/cards/countries` | Países com cartões disponíveis |
| GET | `/api/cards/available-gateways` | Gateways disponíveis |
| GET | `/api/cards/check-sessions` | Sessões de verificação |
| POST | `/api/cards/mass-check` | Verificação em massa de cartões |
| POST | `/api/purchases` | Comprar cartão (por cardId) |
| POST | `/api/purchases/async` | Compra assíncrona |
| POST | `/api/purchases/auto-live/async` | Compra auto-live assíncrona |
| POST | `/api/purchases/mix-package` | Compra de pacote misto |
| GET | `/api/purchases/history` | Histórico de compras |
| GET | `/api/dashboard` | Dashboard do usuário |
| GET | `/api/dashboard/recent-purchases` | Compras recentes |
| POST | `/api/recharge` | Criar recarga |
| GET | `/api/recharge/history` | Histórico de recargas |
| GET | `/api/recharge-settings` | Config de recarga |
| POST | `/api/automatic-pix` | Gerar PIX automático |
| GET | `/api/automatic-pix/limits` | Limites de PIX |
| GET | `/api/automatic-pix/payments` | Pagamentos PIX |
| GET | `/api/automatic-pix/settings` | Config PIX |
| POST | `/api/manual-recharge` | Recarga manual |
| GET | `/api/manual-recharge/attempts` | Tentativas de recarga manual |
| GET | `/api/manual-recharge/settings` | Config recarga manual |
| POST | `/api/giftcards/redeem` | Resgatar gift card |
| GET | `/api/giftcards/history` | Histórico de gift cards |

### Endpoints Admin (auth: admin/owner)

**Estoque e Cartões:**
| Método | Endpoint | Função |
|--------|----------|--------|
| GET | `/api/admin/cards` | Listar cards (com paginação) |
| GET | `/api/admin/cards/export` | Exportar cards (CSV) |
| GET | `/api/admin/cards/duplicates` | Detectar duplicatas |
| POST | `/api/admin/cards/upload` | Upload de cartões |
| POST | `/api/admin/cards/upload-bulk` | Upload bulk (texto) |
| POST | `/api/admin/cards/upload-chunked` | Upload chunked |
| POST | `/api/admin/cards/upload-v5` | Upload v5 (multipart) |
| POST | `/api/admin/cards/reactivate-dead` | Reativar cards dead |
| POST | `/api/admin/cards/reactivate-dead/preview` | Preview reativação |
| POST | `/api/admin/cards/reactivate-single` | Reativar card individual |
| GET | `/api/admin/batches` | Listar lotes |
| GET | `/api/admin/batches/auxiliary-pool` | Pool auxiliar |
| GET | `/api/admin/batches/auxiliary-pool/entries` | Entradas do pool |
| POST | `/api/admin/batches/auxiliary-pool/upload` | Upload ao pool |
| PATCH | `/api/admin/batches/auxiliary-pool/settings` | Config do pool |
| DELETE | `/api/admin/batches/auxiliary-pool/available` | Limpar pool |
| GET | `/api/admin/batches/mix-offers` | Ofertas mistas |

**BINs e Preços:**
| Método | Endpoint | Função |
|--------|----------|--------|
| GET | `/api/admin/bins` | Listar BINs com preços |
| POST | `/api/admin/bins` | Criar/atualizar BIN |
| POST | `/api/admin/bins/upload` | Upload massivo de BINs |

**Checker:**
| Método | Endpoint | Função |
|--------|----------|--------|
| GET | `/api/admin/checker-settings` | Config do checker |
| POST | `/api/admin/checker-settings` | Atualizar config do checker |
| GET | `/api/admin/checker-monitor-data` | Dados de monitoramento |
| GET | `/api/admin/card-check-sessions` | Sessões de check |

**Usuários e Atividade:**
| Método | Endpoint | Função |
|--------|----------|--------|
| GET | `/api/admin/users` | Listar usuários |
| GET | `/api/admin/users/all-activities` | Atividades de usuários |
| GET | `/api/admin/top-users` | Top compradores |
| POST | `/api/admin/security-ip-blocks` | Bloquear IP |
| GET | `/api/admin/security-ip-blocks` | IPs bloqueados |
| GET | `/api/admin/security-analysis` | Análise de segurança |

**Telegram:**
| Método | Endpoint | Função |
|--------|----------|--------|
| GET | `/api/admin/telegram-bots` | Listar bots do owner |
| POST | `/api/admin/telegram-bots` | Criar/atualizar bot |
| GET | `/api/admin/telegram/settings` | Config do Telegram |
| POST | `/api/admin/telegram/settings` | Atualizar config Telegram |
| GET | `/api/admin/telegram/users` | Usuários do Telegram |
| GET | `/api/admin/telegram/users/delta` | Novos usuários desde X |
| DELETE | `/api/admin/telegram/users/all` | Deletar todos usuários |
| GET | `/api/admin/telegram/orders` | Pedidos Telegram |
| GET | `/api/admin/telegram/recharges` | Recargas Telegram |
| GET | `/api/admin/telegram/exchanges` | Trocas |
| GET | `/api/admin/telegram/references` | Referências |
| GET | `/api/admin/telegram/gift-cards` | Gift cards |
| POST | `/api/admin/telegram/gift-cards/bulk` | Criação bulk |
| POST | `/api/admin/telegram/broadcast` | Broadcast |
| POST | `/api/admin/telegram/start-image` | Upload imagem start |
| DELETE | `/api/admin/telegram/start-image` | Remover imagem start |
| GET | `/api/admin/telegram/start-image-proxy` | Proxy da imagem |
| GET/PUT | `/api/admin/telegram/affiliates/config` | Config afiliados |
| GET | `/api/admin/telegram/affiliates/users` | Usuários afiliados |
| GET | `/api/admin/telegram/affiliates/recent-earnings` | Ganhos recentes |
| POST | `/api/admin/telegram-bots/custom-emojis/*` | Emojis customizados |

**Financeiro:**
| Método | Endpoint | Função |
|--------|----------|--------|
| GET | `/api/admin/automatic-pix-payments` | Pagamentos PIX |
| PUT | `/api/admin/automatic-pix-settings` | Config PIX |
| GET | `/api/admin/manual-recharge-attempts` | Tentativas manual |
| GET | `/api/admin/manual-recharge-settings` | Config manual |
| POST | `/api/admin/manual-recharge-settings` | Atualizar config manual |
| GET | `/api/admin/manual-recharge-statistics` | Stats manual |
| GET | `/api/admin/unified-recharge-settings` | Config unificada |
| POST | `/api/admin/unified-recharge-settings` | Atualizar config unificada |
| GET | `/api/admin/recharge-settings` | Config geral |
| POST | `/api/admin/recharge-settings` | Atualizar config |
| POST | `/api/admin/recharge-bonus` | Config bônus |
| GET | `/api/admin/crypto-payments` | Pagamentos crypto |
| GET | `/api/admin/gateways` | Gateways |
| POST | `/api/admin/gateways` | Criar gateway |
| GET | `/api/admin/user-gateway-access` | Acesso por gateway |
| POST | `/api/admin/user-gateway-access` | Atualizar acesso |
| GET | `/api/admin/exchange-status` | Status de trocas |

**Gift Cards e Promoções:**
| Método | Endpoint | Função |
|--------|----------|--------|
| GET | `/api/admin/giftcards` | Listar gift cards |
| POST | `/api/admin/giftcards` | Criar gift card |
| GET | `/api/admin/promotions` | Listar promoções |
| POST | `/api/admin/promotions` | Criar promoção |
| GET | `/api/admin/promotions/analytics` | Analytics promoções |

**Referral:**
| Método | Endpoint | Função |
|--------|----------|--------|
| GET | `/api/admin/referral-settings` | Config referral |
| POST | `/api/admin/referral-settings` | Atualizar config |
| GET | `/api/admin/referral-stats` | Estatísticas |
| GET | `/api/admin/referral-earnings` | Ganhos |
| GET | `/api/admin/referral-top-referrers` | Top indicadores |
| GET | `/api/admin/referral-users` | Usuários indicados |

**Config e Dashboard:**
| Método | Endpoint | Função |
|--------|----------|--------|
| GET | `/api/admin/dashboard` | Dashboard básico |
| GET | `/api/admin/dashboard/advanced` | Dashboard avançado |
| GET | `/api/admin/dashboard-banners` | Banners |
| POST | `/api/admin/dashboard-banners` | Atualizar banners |
| GET | `/api/admin/site-settings` | Config do site |
| POST | `/api/admin/site-settings` | Atualizar config |
| POST | `/api/admin/settings` | Config key-value |
| GET | `/api/admin/status` | Status admin |
| GET | `/api/admin/system-uptime` | Uptime |
| GET | `/api/admin/notifications` | Notificações |
| GET | `/api/admin/support-contacts` | Contatos suporte |
| POST | `/api/admin/support-contacts` | Atualizar contatos |
| GET | `/api/admin/registration-settings` | Config registro |
| POST | `/api/admin/registration-settings` | Ativar/desativar |
| GET | `/api/admin/rules-settings` | Regras |
| POST | `/api/admin/rules-settings` | Atualizar regras |
| GET | `/api/admin/user-cpf-settings` | Config CPF |
| POST | `/api/admin/user-cpf-settings` | Atualizar CPF |
| POST | `/api/admin/bonus-visibility` | Visibilidade bônus |
| POST | `/api/admin/upload-logo` | Upload logo |
| POST | `/api/admin/upload-header-logo` | Upload logo header |
| GET | `/api/admin/purchase-validation-logs` | Logs validação |
| GET | `/api/admin/purchase-validation-logs/export` | Export logs |

**API Externa / Fornecedor:**
| Método | Endpoint | Função |
|--------|----------|--------|
| GET | `/api/external-api/admin/integrations` | Integrações |
| POST | `/api/external-api/admin/integrations` | Config integração |
| GET | `/api/external-api/admin/statistics` | Stats fornecedor |

### Endpoints de Assistente

| Método | Endpoint | Função |
|--------|----------|--------|
| GET | `/api/assistant/gift-card-bots` | Bots disponíveis |
| GET | `/api/assistant/gift-cards` | Listar gift cards |
| POST | `/api/assistant/gift-cards` | Criar gift cards |
| POST | `/api/assistant/page-view` | Registrar visualização |

### Endpoints SuperAdmin

| Método | Endpoint | Função |
|--------|----------|--------|
| GET | `/api/superadmin/dashboard` | Dashboard global |
| GET | `/api/superadmin/stats` | Estatísticas globais |
| GET | `/api/superadmin/tenants` | Listar tenants |
| GET | `/api/superadmin/payments` | Pagamentos de assinatura |
| GET | `/api/superadmin/search` | Busca global |
| POST | `/api/superadmin/create-user` | Criar owner/tenant |
| POST | `/api/superadmin/create-support-user` | Criar assistente |
| PUT | `/api/superadmin/update-user-credentials` | Atualizar credenciais |
| PUT | `/api/superadmin/me/password` | Alterar senha própria |

### Webhooks e Callbacks

| Endpoint | Origem | Auth |
|----------|--------|------|
| `POST /api/crypto/plisio/callback` | Plisio (crypto) | **NENHUMA** |
| `POST /api/recharge/primepix/webhook/{ownerId}/{secret}` | PrimePix (PIX) | Secret no path |
| `POST /api/external-supplier/webhooks/{webhookKey}` | GhostStore (fornecedor) | Key no path |

---

## 6. INTEGRAÇÃO COM TELEGRAM

### Como funciona

O bot do Telegram é a interface principal para os **clientes finais** (compradores). O owner configura o bot via painel web, e o runtime do bot roda no mesmo servidor da API (187.127.21.147).

### Ciclo de vida

```
1. OWNER assina plano → recebe acesso ao painel
2. OWNER registra bot no BotFather → obtém token
3. OWNER cadastra token no painel (/admin/telegram-bots)
4. Backend inicia o bot (polling ou webhook contra Telegram API)
5. Bot fica online e responde a /start
6. CLIENTE encontra bot → /start → mensagem de boas-vindas com menu
7. CLIENTE navega por menu inline (keyboard buttons)
8. CLIENTE compra cartão → bot chama API interna → retorna dados
```

### Configurações do bot (por bot_id)

Cada bot tem configurações independentes armazenadas em MongoDB e gerenciadas via `/api/admin/telegram/settings`:

| Campo | Função | Exemplo |
|-------|--------|---------|
| `bot_api_key` | Token do BotFather | (protegido) |
| `welcome_message` | Mensagem de /start | HTML com emojis customizados |
| `start_image_url` | Imagem de boas-vindas | `/uploads/telegram/start-image-*.jpg` |
| `store_name` | Nome da loja | "Ghost Store" |
| `support_username` | Suporte | "@ghostsuportee" |
| `required_channel` | Canal obrigatório para usar | "@updatesghost" |
| `require_subscription` | Exigir inscrição no canal | true/false |
| `exchange_channel` | Canal de trocas | "@updatesghost" |
| `client_group_channel` | Grupo de clientes | link do Telegram |
| `disable_purchases` | Desabilitar compras | true/false |
| `disable_pix` | Desabilitar PIX | true/false |
| `maintenance_mode` | Modo manutenção | true/false |
| `referral_enabled` | Programa de indicações | true |
| `referral_bonus_percentage` | Bônus por indicação | "5.00" (5%) |
| `exchanges_enabled` | Trocas habilitadas | true |
| `references_enabled` | Referências habilitadas | true |
| `backup_enabled` | Bot backup ativo | true |
| `stock_origin` | Origem do estoque | "fornecedor_externo" ou "local" |
| `mix_packages_enabled` | Pacotes mistos | true |
| `min_purchase_amount` | Compra mínima | "0.00" |
| `card_prices` | Preços por tipo | `{"full":{}, "sem":{}}` |

### Menu do bot

O menu é configurável e usa inline keyboards. Estrutura padrão:

```
Menu Principal:
  🛒 Comprar cartões    → Estoque e bases
  💳 Adicionar saldo    → Recarga PIX e cripto
  👤 Minha conta        → Perfil, pedidos e recargas
  💬 Suporte            → Canal e atendimento
```

### Fluxo de compra via Telegram

```
CLIENTE → /start → Menu
  └→ 🛒 Comprar cartões
       └→ Escolhe base (CC, CC Full, Consultáveis, Trilhas)
            └→ Filtra por país/BIN/banco/nível
                 └→ Escolhe cartão ou compra unitária
                      └→ Bot verifica saldo do cliente
                           └→ Se suficiente: processa compra
                                └→ Se stock_origin == "fornecedor_externo":
                                     └→ Chama GhostStore API
                                          └→ /catalog (busca)
                                          └→ /reservations (reserva)
                                          └→ /orders (confirma)
                                          └→ /orders/{id} (status)
                                └→ Se stock_origin == "local":
                                     └→ Consulta cards locais no MongoDB
                                └→ Opcionalmente: chama Checker API
                                └→ Retorna dados do cartão ao cliente
                                └→ Debita saldo
                                └→ Notifica admin (se configurado)
```

### Tipos de compra

| Tipo | Descrição | Source Detail |
|------|-----------|--------------|
| Compra unitária (menu) | Seleção manual por menu inline | `telegram-menu` |
| Compra unitária (busca inline) | Busca inline por BIN | `telegram-inline` |
| Compra unitária (filtro) | Filtro por banco/nível | `telegram-filter` |
| Auto Live · Remoto | Compra com check automático (fornecedor) | `telegram-external-auto-live` |
| Compra Virgin (site) | Via painel web | `web-purchase` |
| Mix Package | Pacote misto | `telegram-mix` |

### Emojis customizados

O bot suporta emojis customizados do Telegram (premium), configuráveis por ID:

```json
{
  "cc": "5212962322967966165",
  "buy": "5215406837964220543",
  "full": "5215406837964220543",
  "verify": "5215304360044552834",
  "recharge": "4956671024436347559",
  ...
}
```

### Broadcast

O admin pode enviar mensagens broadcast para todos os usuários do bot, com:
- Texto e/ou imagem (multipart form)
- Métricas de entrega (9.837 destinatários, 11 ativos em 7d)
- Pause/resume/cancel durante envio

### Sistema de trocas (exchanges)

Quando um cartão não funciona, o cliente pode solicitar troca dentro de um prazo (10 minutos). O admin aprova ou rejeita via painel. Se aprovado, o saldo é estornado.

---

## 7. SISTEMA FINANCEIRO

### Fluxo de recarga (depósito)

```
CLIENTE quer comprar cartão
  └→ Precisa de saldo na wallet
       └→ 3 métodos de recarga:

  1. PIX Automático (PrimePix v2)
     └→ Cliente informa valor → API gera QR Code PIX
     └→ Pagamento detectado via webhook PrimePix
     └→ Saldo creditado automaticamente
     └→ Webhook URL: /api/recharge/primepix/webhook/{ownerId}/{secret}

  2. Crypto (Plisio)
     └→ Cliente escolhe crypto → API cria invoice Plisio
     └→ Pagamento detectado via callback Plisio
     └→ Callback: POST /api/crypto/plisio/callback
     └→ Saldo creditado

  3. Manual
     └→ Cliente informa valor e comprovante
     └→ Admin aprova/rejeita manualmente
     └→ Saldo creditado após aprovação
```

### Configuração PIX (PrimePix v2)

```json
{
  "enabled": false,
  "provider": "primepixv2",
  "fee_type": "none",
  "fee_value": 0,
  "min_amount": 10,
  "max_amount": 1000,
  "daily_limit": 100,
  "hourly_limit": 20,
  "cooldown_minutes": 1,
  "expiration_minutes": 30,
  "verification_interval_seconds": 15,
  "processing_mode": "webhook",
  "webhook_fallback_seconds": 120
}
```

### Configuração do Checker

O checker é uma API externa que verifica se um cartão está "vivo" (aprovado para transação):

```json
{
  "api_url": "http://102.165.46.194:3005/v1/ghostvip/zeroauth?key=sk_...&CC={CARD}",
  "method": "GET",
  "success_keyword": "#APROVADA",
  "fail_keyword": "#REPROVADA",
  "error_keyword": "ERRO",
  "live_price": 0.10,
  "dead_price": 0.05,
  "max_threads_per_user": 5,
  "timeout": 60000,
  "auto_purchase_dead_limit": 10,
  "auto_purchase_checker_error_limit": 5
}
```

O checker suporta múltiplos modos:
- **full/sem**: Checker padrão para CCs
- **consultáveis**: Verifica limite disponível
- **tracks**: Verifica trilhas magnéticas

### Tabela de preços por BIN

Cada BIN (6 primeiros dígitos do cartão) tem preço configurável:

```json
{
  "bin": "448067",
  "brand": "VISA",
  "type": "CREDIT",
  "level": "PLATINUM",
  "country": "BR",
  "bank": "ITAU UNIBANCO",
  "price": 60,        // preço CC Full
  "price_sem": 35,    // preço CC Sem (sem dados do titular)
  "price_consultaveis": 0,
  "price_tracks": 0,
  "source": "global",
  "isUserSpecific": false
}
```

### Gift Cards

- Admin cria gift cards (valor + quantidade + prefixo)
- Gera códigos no formato `XXXX-XXXX-XXXX-XXXX-XXXX-X`
- Cliente resgata via `/api/giftcards/redeem` ou bot Telegram
- Crédito é adicionado à wallet do cliente

### Programa de Referral

- Cada usuário tem `referral_code`
- Indicador ganha % de cada recarga do indicado
- Bônus de registro configurável
- Ranking de top indicadores

---

## 8. FORNECEDOR EXTERNO (GhostStore)

O MultiBots pode operar com estoque local (cartões uploadados pelo owner) ou com **fornecedor externo**. O bot GHOOOST STORE usa o fornecedor `api.ghoststore.cc`.

### Integração

```json
{
  "base_url": "https://api.ghoststore.cc/multibot",
  "credential_header": "Authorization",
  "credential_scheme": "Bearer",
  "credential_configured": true,
  "timeout_ms": 8000,
  "catalog_path": "/catalog",
  "reserve_path": "/reservations",
  "order_path": "/orders",
  "status_path": "/orders/{orderId}",
  "webhook_key": "a024dd5b475946769239ea8bd345690e",
  "webhook_url": "https://api.multibots.cc/api/external-supplier/webhooks/a024dd5b47..."
}
```

### Fluxo de compra com fornecedor externo

```
1. Bot consulta catálogo:
   GET api.ghoststore.cc/multibot/catalog

2. Bot reserva cartão:
   POST api.ghoststore.cc/multibot/reservations

3. Bot confirma pedido:
   POST api.ghoststore.cc/multibot/orders

4. Bot verifica status:
   GET api.ghoststore.cc/multibot/orders/{orderId}

5. Fornecedor notifica entrega:
   POST api.multibots.cc/api/external-supplier/webhooks/{key}

6. Bot entrega cartão ao cliente
```

### Dados observados de pedidos reais

```
purchase_type: "Auto Live · Remoto"
source_detail: "telegram-external-auto-live"
stock_origin: "fornecedor_externo"
supplier_price: R$48-60 por cartão Full
```

---

## 9. ESTOQUE DE CARTÕES

### Estrutura de um cartão

```json
{
  "id": 535477,
  "bin": "545368",
  "brand": "MASTERCARD",
  "type": "CREDIT",
  "level": "STANDARD",
  "country": "BR",
  "bank": "ITAU UNIBANCO",
  "base": "full",
  "status": "available",
  "pan": "5453681374944385",
  "expiry_month": "01",
  "expiry_year": "2032",
  "cvv": "323",
  "holder_name": "CARLOS E. S. CAMARGO",
  "cpf": "21906428840",
  "consulted_password": null,
  "available": null,
  "total": null,
  "track1": null,
  "track2": null,
  "auxiliary_data": null,
  "bot_id": 60,
  "batch_id": 1
}
```

### Tipos de cartão (base)

| Base | Descrição | Dados |
|------|-----------|-------|
| `sem` | CC Sem | PAN + CVV + Exp (sem dados do titular) |
| `full` | CC Full | PAN + CVV + Exp + Nome + CPF |
| `consultaveis` | Consultáveis | Full + Limite disponível + Limite total |
| `tracks` | Trilhas | Track1 + Track2 + CVV |

### Inventário observado

| Tipo | Quantidade |
|------|-----------|
| CC Sem | ~262.000 |
| CC Full | ~112.000 |
| **Total** | **~374.000 cartões** |

- 98 países representados (BR, US, etc.)
- 68 bot_ids acessíveis no pool
- Pool global compartilhado (falha de isolamento)

### Upload de estoque

O owner pode importar cartões por:
1. **Texto** (cola no textarea): `POST /api/admin/cards/upload-bulk`
2. **Upload de arquivo**: `POST /api/admin/cards/upload-v5` (multipart)
3. **Chunked**: `POST /api/admin/cards/upload-chunked` (para lotes grandes)
4. **Pool auxiliar**: `POST /api/admin/batches/auxiliary-pool/upload`

Formato aceito: `PAN|MM|YYYY|CVV|NOME|CPF` (pipe-delimited)

---

## 10. GERENCIAMENTO DE ESTADO (FRONTEND)

### Redux Toolkit Slices

O frontend usa Redux Toolkit com os seguintes slices e async thunks:

```
auth/
  ├── login              → POST /api/auth/login
  ├── register           → POST /api/auth/register
  ├── getCurrentUser     → GET /api/auth/me
  └── changePassword     → POST /api/auth/change-password

admin/
  ├── fetchDashboard     → GET /api/admin/dashboard
  ├── fetchAdminCards    → GET /api/admin/cards
  ├── fetchUsers         → GET /api/admin/users
  ├── fetchBins          → GET /api/admin/bins
  ├── getGiftCards       → GET /api/admin/giftcards
  ├── getSuppliers       → GET /api/admin/batches (suppliers)
  ├── getRechargeBonus   → GET /api/admin/recharge-bonus
  ├── uploadCards        → POST /api/admin/cards/upload
  ├── uploadBins         → POST /api/admin/bins/upload
  ├── createBin          → POST /api/admin/bins
  ├── updateBin          → POST /api/admin/bins (update)
  ├── updateBinPrice     → POST /api/admin/bins (price)
  ├── createGiftCard     → POST /api/admin/giftcards
  ├── updateGiftCard     → POST /api/admin/giftcards (update)
  ├── deleteCard         → DELETE /api/admin/cards/{id}
  ├── approveBatch       → POST /api/admin/batches (approve)
  ├── addFunds           → POST /api/admin/users (add funds)
  ├── banUser            → POST /api/admin/users (ban)
  ├── updateUserRole     → POST /api/admin/users (role)
  └── updateRechargeBonus→ POST /api/admin/recharge-bonus

cards/
  ├── fetchCards         → GET /api/cards
  └── fetchCard          → GET /api/cards/{id}

purchases/
  ├── purchaseCard       → POST /api/purchases
  ├── startAsyncPurchase → POST /api/purchases/async
  ├── pollAsyncPurchase  → GET /api/purchases/async/{id}
  ├── startAsyncAutoLive → POST /api/purchases/auto-live/async
  ├── pollAsyncAutoLive  → GET /api/purchases/auto-live/async/{id}
  └── fetchPurchaseHistory→GET /api/purchases/history

recharge/
  ├── createRecharge     → POST /api/recharge
  ├── confirmPayment     → POST /api/recharge/confirm
  ├── fetchRechargeHistory→GET /api/recharge/history
  └── fetchRechargeBonus → GET /api/recharge/bonus

giftCard/
  ├── redeem             → POST /api/giftcards/redeem
  └── getHistory         → GET /api/giftcards/history

dashboard/
  └── fetchDashboard     → GET /api/dashboard
```

### API Service Objects

| Nome no código | Propósito |
|---------------|-----------|
| `K` | Instância axios para API tenant (baseURL: `/api`) |
| `vs` | Instância axios para API superadmin (baseURL: `/api`) |
| `Dd` | Auth API |
| `Eo` | Purchases API |
| `Cb` | Cards API |
| `Na` | SuperAdmin API |
| `adminAPI` | Admin endpoints |
| `cardsAPI` | Cards endpoints |
| `dashboardAPI` | Dashboard endpoints |
| `giftCardAPI` | Gift cards |
| `manualRechargeAPI` | Recargas manuais |
| `PixAPI` | PIX automático |
| `publicAPI` | Endpoints públicos |
| `purchasesAPI` | Compras |
| `rechargeAPI` | Recargas |

---

## 11. BANCO DE DADOS (MongoDB)

### Collections inferidas

Com base nos endpoints, modelos de dados e respostas da API:

| Collection | Campos-chave | Relações |
|------------|-------------|----------|
| `users` | id, username, password, balance, isAdmin, is_super_admin, role, banned, ban_reason, telegram_id, telegram_username, referral_code, total_recharged, created_at | owner → bots |
| `bots` (telegram_bots) | id, owner_id, tenant_id, name, username, active, status, bot_token, backup_bot_token, last_heartbeat, welcome_message, settings..., external_supplier{} | owner_id → users.id |
| `cards` | id, bin, brand, type, level, country, bank, base, status, pan, expiry_month, expiry_year, cvv, holder_name, cpf, track1, track2, auxiliary_data, bot_id, batch_id | bot_id → bots.id |
| `batches` | id, name, supplier, status, card_count, created_at | → cards |
| `bins` | id, bin, brand, type, level, country, bank, price, price_sem, price_consultaveis, price_tracks, source, isUserSpecific | Lookup por BIN |
| `orders` (purchases) | id, userId, username, telegram_id, price, refunded, created_at, bot_id, bot_name, purchase_type, source_detail, stock_origin, card data, group_items[] | userId → users.id, bot_id → bots.id |
| `recharges` | id, userId, amount, method, status, created_at | userId → users.id |
| `giftcards` | id, code, value, redeemed, redeemed_by, bot_id, created_at, expiration_date | bot_id → bots.id |
| `exchanges` | id, orderId, userId, status, created_at | orderId → orders.id |
| `referrals` | referrer_id, referred_id, bonus_amount | → users.id |
| `promotions` | id, name, discount, conditions, active, bot_id | bot_id → bots.id |
| `checker_settings` | id, api_url, method, success_keyword, fail_keyword, live_price, dead_price, active... | Singleton per owner/global |
| `checker_sessions` | id, cards_checked, live_count, dead_count, error_count | |
| `notifications` | id, type, message, read, created_at | |
| `ip_blocks` | id, ip, hours, reason, created_at | |
| `subscription_plans` | id, name, price, maxBots, duration, features[] | |
| `settings` | key, value (key-value store) | |
| `activities` | id, userId, action, details, created_at | Audit log |

### Atomicidade e consistência

**Observações sobre atomicidade:**
- As operações de **compra** envolvem: verificar saldo → debitar saldo → marcar card como sold → criar order. Isso **não** parece usar transações MongoDB (evidência: compra a R$0 funciona sem validar saldo, indicando que a validação de preço e débito são passos separados sem rollback atômico).
- **Recargas PIX**: webhook processa e credita saldo — sem evidência de idempotency key (callback crypto aceita qualquer POST).
- **Trocas**: exchange_window_minutes (10min) implica uma janela temporal gerenciada por timestamp, não por lock.
- **Race conditions**: sem evidência de locking otimista/pessimista (vulnerabilidade confirmada no race condition financeiro).

---

## 12. SEGURANÇA — AUTENTICAÇÃO E AUTORIZAÇÃO

### Middleware de autenticação

```
JWT → decode → extrair {id, username, role, isAdmin, is_super_admin}
  │
  ├── is_super_admin == true → SuperAdmin routes
  ├── isAdmin == true → Admin routes + User routes
  ├── role == "assistant" → Assistant routes
  └── role == "user" → User routes only
```

### Guards no frontend

| Guard | Verifica | Redireciona |
|-------|---------|-------------|
| `SuperAdminGuard` | `is_super_admin` no JWT/localStorage | `/superadmin2025/login` |
| `AssistantGuard` | `role == "assistant"` | `/login` |
| Auth genérico | `token` presente | `/login` |

### Falhas de autorização encontradas

1. **Sem validação de tenant_id no bot_id** → Cross-tenant access
2. **Endpoint `/api/purchases` não valida preço** → Compra a R$0
3. **Checker URL aceita qualquer protocolo** → SSRF
4. **Callback crypto sem verificação** → Forja de pagamentos
5. **NoSQL operators processados no login** → NoSQLi

---

## 13. DADOS EXTRAÍDOS DO ENGAGEMENT

| Recurso | Quantidade | Arquivo |
|---------|-----------|---------|
| Estoque CC Full (mascarado) | 112.000 cards | estoque-full.csv |
| Estoque CC Sem (mascarado) | 262.000 cards | estoque-sem.csv |
| Usuários Telegram | 9.837 | telegram-users-p1..p5.json |
| Pedidos com card data full | 8 orders | telegram-orders-all.json |
| BINs com preços | 50+ entries | admin-bins-data.json |
| Checker config (API key) | 1 | admin-checker-settings.json |
| PIX config (API key + webhook) | 1 | admin-pix-settings.json |
| Telegram bot config completa | 1 bot | admin-telegram-bots.json |
| Dashboard analytics 30d | completo | admin-dashboard-advanced.json |
| Frontend bundle | 3.2MB | index-DrSL8W3b.beautified.js |
| API map completo | 175+ endpoints | full-api-map.txt |
| Broadcast metrics | 9.837 users | broadcast-metrics.json |

---

## 14. RESUMO DE VULNERABILIDADES ENCONTRADAS

| # | Severidade | Vulnerabilidade | CVSS | Status |
|---|-----------|----------------|------|--------|
| 001 | CRITICAL | Compra de cartões a R$0 (price validation bypass) | 9.8 | Confirmado |
| 002 | CRITICAL | SSRF via checker-settings (IP real exposto) | 9.1 | Confirmado |
| 003 | CRITICAL | Callback crypto sem autenticação | 9.0 | Confirmado |
| 004 | HIGH | CORS wildcard com credentials | 8.1 | Confirmado |
| 005 | HIGH | NoSQL Injection no login | 7.5 | Confirmado |
| 006 | HIGH | Cross-tenant data access e escrita | 7.5 | Confirmado |
| 007 | HIGH | API keys e secrets em responses | 7.2 | Confirmado |
| 008 | HIGH | Stored XSS via bot settings | 6.8 | Confirmado |
| 009 | MEDIUM | Gift card creation → self-recharge | 6.5 | Confirmado |
| 010 | MEDIUM | Upload de polyglot JPEG+PHP | 5.3 | Confirmado |
| 011 | MEDIUM | Information disclosure no frontend | 5.0 | Confirmado |
| 012 | LOW | PIX webhook secret no path | 3.7 | Confirmado |
| 013 | LOW | CSV upload content reflection | 2.0 | Confirmado |

---

## 15. FLUXOS CRÍTICOS DE NEGÓCIO

### Fluxo completo: Owner onboarding

```
1. Visitante acessa multibots.cc → /planos
2. Escolhe plano (Básico R$300 ou Premium R$400)
3. POST /api/subscription/create {planType, username, password, telegram_username}
4. SuperAdmin aprova (ou automático)
5. Owner recebe credenciais → faz login em /3218b365656f2f473c0d263817adaba6
6. Configura bot Telegram:
   a. Registra bot no BotFather → obtém token
   b. POST /api/admin/telegram-bots {token, name, username}
   c. Configura mensagens, canais, regras
   d. Define preços por BIN (/api/admin/bins)
   e. Configura recarga (PIX, manual, crypto)
   f. Opcionalmente: configura fornecedor externo
7. Bot fica online → clientes começam a usar
```

### Fluxo completo: Compra de cartão (Telegram)

```
1. Cliente envia /start ao bot
2. Bot retorna welcome_message + start_image + menu inline
3. Cliente clica "🛒 Comprar cartões"
4. Bot mostra seleção de base (CC, Full, Consultáveis, Trilhas)
5. Cliente seleciona "CC Full"
6. Bot mostra filtros (País → Banco → Nível → BIN)
7. Cliente seleciona filtros
8. Bot consulta estoque:
   - Se local: GET /api/cards?base=full&country=BR&bot_id=60
   - Se externo: GET api.ghoststore.cc/multibot/catalog
9. Bot mostra cartões disponíveis (mascarados: 4480****0229)
10. Cliente confirma compra
11. Bot verifica saldo do cliente (user.balance >= bin.price)
12. Se saldo insuficiente → "Saldo insuficiente, recarregue"
13. Se suficiente:
    a. Debita saldo do cliente
    b. Marca card como "sold"
    c. Cria registro em orders
    d. Opcionalmente: chama checker API para verificar
    e. Retorna dados desmascarados ao cliente
14. Se auto-live ativado:
    a. Verifica cartão no checker
    b. Se LIVE → entrega ao cliente
    c. Se DEAD → tenta próximo cartão (até dead_limit)
15. Admin recebe notificação (se configurado)
```

### Fluxo completo: Recarga PIX

```
1. Cliente no Telegram → "💳 Adicionar saldo"
2. Cliente informa valor (min R$10, max R$1000)
3. Bot chama POST /api/automatic-pix {amount}
4. API gera QR Code via PrimePix v2
5. Cliente paga o PIX
6. PrimePix detecta pagamento → POST webhook URL
7. Webhook URL: /api/recharge/primepix/webhook/{ownerId}/{secret}
8. API valida webhook → credita saldo na wallet do cliente
9. Bot notifica cliente: "Saldo creditado: R$X"
```

---

## 16. GLOSSÁRIO DE TERMOS DO SISTEMA

| Termo | Significado |
|-------|------------|
| **Owner/Tenant** | Dono de bot(s), paga assinatura |
| **Bot** | Bot do Telegram gerenciado pelo owner |
| **bot_id** | ID único do bot (ex: 60) |
| **tenant_id** | = owner_id, identifica o dono |
| **BIN** | Bank Identification Number (6 primeiros dígitos do PAN) |
| **PAN** | Primary Account Number (número do cartão) |
| **base** | Tipo do dado: sem, full, consultaveis, tracks |
| **Batch** | Lote de cartões importados |
| **Checker** | API que valida se cartão está vivo |
| **LIVE/DEAD** | Status do cartão pós-check |
| **Exchange** | Troca de cartão que não funcionou |
| **Gift Card** | Código resgatável por saldo |
| **Referral** | Sistema de indicação entre usuários |
| **Pool auxiliar** | Estoque secundário de cartões |
| **Mix Package** | Pacote com múltiplos cartões |
| **Auto Live** | Compra com verificação automática |
| **Fornecedor externo** | API de terceiros que fornece cartões (GhostStore) |
| **PrimePix** | Gateway de pagamento PIX |
| **Plisio** | Gateway de pagamento crypto |
| **Broadcast** | Envio em massa para usuários do bot |

---

## 17. ARQUIVOS DO ENGAGEMENT

```
results/multibots.cc-2026-08-10/
├── HANDOFF.md                          ← ESTE DOCUMENTO
├── RELATORIO-FINAL-CONSOLIDADO.md      ← Relatório de pentest com vulns
├── RELATORIO-FINAL.md                  ← Versão anterior do relatório
├── STRUCTURE.md                        ← Resumo da estrutura
├── auth_token.json                     ← Token JWT obtido
├── auth_token.txt                      ← Token em texto
├── login_response.json                 ← Resposta do login
├── 01-recon/                           ← Reconhecimento
├── 02-endpoints/
│   ├── api-endpoints.txt               ← Endpoints encontrados em strings
│   ├── api-routes-from-strings.txt     ← Rotas extraídas do JS
│   ├── full-api-map.txt                ← Mapa completo da API
│   └── spa-routes.txt                  ← Rotas do SPA
├── 03-analise/
│   ├── main.js                         ← Bundle original (1.6MB)
│   ├── main.beautified.js              ← Bundle beautificado (3.2MB)
│   ├── main.css                        ← CSS completo (760KB)
│   ├── api-functions.txt               ← Funções de API extraídas
│   ├── api-services-full.txt           ← Services completos
│   ├── business-logic.txt              ← Lógica de negócio extraída
│   ├── data-models.txt                 ← Modelos de dados
│   ├── redux-store.txt                 ← Redux store structure
│   ├── redux-slices.txt                ← Redux slices
│   ├── routes.txt                      ← Definições de rotas
│   └── route-tree.js                   ← Árvore de rotas
├── 04-vulnerabilidades/
│   ├── vulnerabilities-summary.json    ← Sumário de vulns
│   ├── POC-free-card-purchase.md       ← PoC compra a R$0
│   ├── checker-settings-original.json  ← Config original do checker
│   └── PLAN-cross-tenant.md            ← Plano de teste cross-tenant
├── 05-evidencias/
│   ├── admin-bots.png                  ← Screenshot do painel
│   ├── admin-settings.png              ← Screenshot settings
│   └── after-upload.png                ← Screenshot pós-upload
├── 07-dados-extraidos/
│   ├── me.json                         ← Dados do user autenticado
│   ├── admin-telegram-bots.json        ← Config completa dos bots
│   ├── admin-checker-settings.json     ← Config do checker (com API key)
│   ├── admin-pix-settings.json         ← Config PIX (com API key)
│   ├── telegram-users-p1..p5.json      ← 9.837 usuários Telegram
│   ├── telegram-orders-all.json        ← Pedidos com card data
│   ├── checker-monitor.json            ← Dados do checker
│   ├── broadcast-metrics.json          ← Métricas de broadcast
│   ├── subscription-plans.json         ← Planos de assinatura
│   ├── user-countries.json             ← 98 países
│   └── [+50 outros JSONs]             ← Configs, stats, dados
└── DUMP-COMPLETO/
    ├── frontend/                       ← Assets do frontend (5.5MB)
    ├── backend-api/                    ← Mapa de API (24KB)
    ├── data-dump/                      ← Dados extraídos (448KB)
    └── configs/                        ← Configurações
```
