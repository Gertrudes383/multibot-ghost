# INSTRUCOES DE RECONSTRUCAO - MULTIBOTS

## Plataforma SaaS Multi-Tenant de Bots Telegram

**Versao:** 1.0 | **Data:** 2026-08-11 | **Idioma:** Portugues Brasileiro

---

# INDICE

1. [Visao Geral do Projeto](#1-visao-geral-do-projeto)
2. [Stack Tecnologico](#2-stack-tecnologico)
3. [Arquitetura Multi-Tenant](#3-arquitetura-multi-tenant)
4. [Paineis Web (SPA)](#4-paineis-web-spa)
5. [Modulos do Backend](#5-modulos-do-backend)
6. [Integracoes Externas](#6-integracoes-externas)
7. [Como Rodar o Projeto](#7-como-rodar-o-projeto)
8. [Variaveis de Ambiente](#8-variaveis-de-ambiente)
9. [Deploy em Producao](#9-deploy-em-producao)

---

# 1. VISAO GERAL DO PROJETO

## 1.1 O Que E o MultiBots

O MultiBots e uma plataforma **SaaS (Software as a Service) multi-tenant** brasileira que permite a **donos de loja** (chamados de tenants ou owners) criarem e gerenciarem **bots do Telegram** para venda de produtos digitais (gift cards, creditos, vouchers, etc). Cada owner assina um plano mensal, recebe acesso a um painel web administrativo completo e pode operar 1 ou 2 bots Telegram que atendem seus clientes finais de forma automatizada.

## 1.2 Modelo de Negocio

A plataforma gera receita atraves de **assinaturas mensais** cobradas dos owners:

| Plano      | Preco Mensal | Bots Inclusos | Recursos                                                      |
|------------|-------------|---------------|---------------------------------------------------------------|
| **Basico** | R$300       | 1 Bot         | Painel Admin, Usuarios Ilimitados, Estoque, Recargas, Suporte |
| **Premium**| R$400       | 2 Bots        | Tudo do Basico + Bot de backup, Prioridade no suporte         |

Ambos os planos incluem: sistema de recargas (PIX, crypto, manual), gestao de estoque, sistema de gift cards, programa de referral (indicacoes), broadcast para usuarios e painel administrativo completo.

Alem das assinaturas, a plataforma pode gerar receita via spread entre preco de custo (fornecedor externo) e preco de venda configurado pelo owner por BIN.

## 1.3 Hierarquia de Papeis (4 Niveis)

O sistema possui 4 niveis hierarquicos de acesso:

```
SUPERADMIN (dono da plataforma MultiBots)
  |
  +-- Gerencia todos os tenants/owners
  +-- Controla planos de assinatura
  +-- Configuracoes globais (site-settings)
  +-- Cria/edita credenciais de owners
  +-- Dashboard global de receita
  |
  +-- TENANT/OWNER (dono de bot - ex: "gaspar", owner_id 283518)
        |
        +-- Tem 1-2 bots Telegram (conforme plano)
        +-- Painel admin web completo
        +-- Gerencia estoque de produtos (local + fornecedor externo)
        +-- Configura precos por BIN
        +-- Configura recargas (PIX, crypto, manual)
        +-- Gerencia usuarios do bot
        +-- Configura promocoes, referrals, gift cards
        +-- Broadcast para usuarios do bot
        |
        +-- ASSISTANT/SUPORTE (sub-conta do owner)
        |     +-- Acesso limitado ao painel
        |     +-- Pode criar/gerenciar gift cards
        |     +-- Visualizacao de dados (sem escrita em configs)
        |
        +-- USER/COMPRADOR (cliente final via Telegram)
              +-- Interage via bot Telegram ou painel web
              +-- Tem wallet (saldo em R$)
              +-- Compra produtos, recarrega saldo
              +-- Pode resgatar gift cards
              +-- Sistema de referral
```

## 1.4 Fluxo Geral da Plataforma

```
1. SuperAdmin configura a plataforma (planos, settings globais)
2. Owner se cadastra, escolhe plano e paga assinatura
3. Owner registra bot no BotFather do Telegram, obtem token
4. Owner cadastra token no painel admin
5. Backend inicia o bot (polling ou webhook)
6. Owner configura: precos, recargas, mensagens, canais, regras
7. Owner importa estoque (manual) ou configura fornecedor externo
8. Bot fica online, clientes comecam a interagir
9. Clientes recarregam saldo (PIX, crypto, manual)
10. Clientes compram produtos via bot ou painel web
11. Owner monitora dashboard, gerencia usuarios, faz broadcasts
```

---

# 2. STACK TECNOLOGICO

## 2.1 Backend

| Tecnologia              | Funcao                                       | Versao Recomendada |
|-------------------------|----------------------------------------------|--------------------|
| **Node.js**             | Runtime JavaScript do servidor               | 18 LTS ou 20 LTS  |
| **Express.js**          | Framework HTTP para API REST                 | 4.x                |
| **MongoDB**             | Banco de dados NoSQL (documentos)            | 6.x ou 7.x        |
| **Mongoose**            | ODM (Object-Document Mapper) para MongoDB    | 7.x ou 8.x        |
| **jsonwebtoken (JWT)**  | Autenticacao via tokens                      | 9.x                |
| **bcrypt / bcryptjs**   | Hash de senhas                               | 5.x                |
| **multer**              | Upload de arquivos (multipart/form-data)     | 1.x                |
| **axios**               | Cliente HTTP para chamadas a APIs externas   | 1.x                |
| **socket.io**           | Comunicacao real-time (WebSocket)            | 4.x                |
| **node-cron**           | Agendamento de tarefas (jobs)                | 3.x                |
| **helmet**              | Headers de seguranca HTTP                    | 7.x                |
| **cors**                | Middleware de CORS                            | 2.x                |
| **express-rate-limit**  | Rate limiting por IP e por conta             | 7.x                |
| **dotenv**              | Variaveis de ambiente via .env               | 16.x               |
| **winston / pino**      | Logging estruturado                          | 3.x                |
| **PM2**                 | Process Manager para producao                | 5.x                |

## 2.2 Frontend

| Tecnologia              | Funcao                                       | Versao Recomendada |
|-------------------------|----------------------------------------------|--------------------|
| **React**               | Biblioteca de UI (SPA)                       | 18.x               |
| **Vite**                | Build tool e dev server                      | 5.x                |
| **React Router DOM**    | Roteamento SPA                               | 6.x                |
| **Redux Toolkit**       | Gerenciamento de estado global               | 2.x                |
| **Tailwind CSS**        | Framework CSS utility-first                  | 3.x                |
| **shadcn/ui (Radix UI)**| Componentes UI acessiveis e customizaveis   | latest             |
| **Lucide React**        | Biblioteca de icones                         | latest             |
| **Recharts**            | Graficos e charts para dashboards            | 2.x                |
| **Axios**               | Cliente HTTP (chamadas a API)                | 1.x                |
| **Yup / Zod**           | Validacao de formularios e schemas           | latest             |
| **React Hook Form**     | Gerenciamento de formularios                 | 7.x                |
| **Socket.IO Client**    | Conexao WebSocket real-time                  | 4.x                |
| **date-fns / dayjs**    | Manipulacao de datas                         | latest             |
| **react-hot-toast**     | Notificacoes toast                           | 2.x                |

## 2.3 Infraestrutura

| Tecnologia              | Funcao                                       |
|-------------------------|----------------------------------------------|
| **Nginx**               | Reverse proxy (porta 80/443 -> Node.js:9999) |
| **Cloudflare**          | CDN, WAF, DNS, SSL                           |
| **PM2**                 | Process manager para Node.js em producao     |
| **Docker** (opcional)   | Containerizacao do MongoDB e servicos        |
| **MongoDB Atlas** (alt.)| MongoDB gerenciado na nuvem                  |
| **Ubuntu Server**       | Sistema operacional do servidor              |

## 2.4 Dependencias Adicionais

```
node-telegram-bot-api OU grammy    -> Biblioteca para Telegram Bot API
crypto (nativo Node.js)            -> Funcoes criptograficas (HMAC, hash)
uuid                               -> Geracao de IDs unicos
csv-parser / papaparse             -> Parse de arquivos CSV
sharp                              -> Processamento de imagens
qrcode                             -> Geracao de QR Codes (PIX)
```

---

# 3. ARQUITETURA MULTI-TENANT

## 3.1 Conceito Fundamental

A arquitetura multi-tenant significa que **uma unica instancia** da aplicacao serve **multiplos clientes** (tenants/owners), cada um com seus proprios dados isolados. Nao se cria uma instancia separada para cada owner; todos compartilham o mesmo banco de dados, API e frontend, mas os dados sao segregados por identificadores de tenant.

## 3.2 Hierarquia Detalhada

### SuperAdmin (Nivel 0 - Plataforma)

O SuperAdmin e o administrador da plataforma MultiBots como um todo. Ele nao gerencia bots ou produtos diretamente, mas sim os **owners** que operam bots.

**Responsabilidades:**
- Criar e gerenciar contas de owners (tenants)
- Gerenciar planos de assinatura (precos, duracoes, recursos)
- Monitorar pagamentos de assinatura
- Dashboard global com metricas de toda a plataforma
- Busca global por usuarios, owners, bots
- Criar usuarios de suporte (assistentes)
- Atualizar credenciais de owners
- Configuracoes globais do site

**Autenticacao:**
- Login separado via `POST /api/superadmin/login`
- JWT armazenado em `localStorage.superadmin_token`
- Claim no JWT: `is_super_admin: true`
- Painel acessivel em `/superadmin2025/*`

### Admin/Tenant/Owner (Nivel 1 - Loja)

O Owner e o dono de uma loja que opera 1 ou 2 bots Telegram. Ele paga assinatura mensal e tem acesso completo ao painel administrativo para gerenciar **seu(s) bot(s)**.

**Responsabilidades:**
- Configurar bot(s) Telegram (token, mensagens, canais)
- Gerenciar estoque de produtos (importar, exportar, categorizar)
- Definir precos por BIN (Bank Identification Number)
- Configurar metodos de recarga (PIX automatico, crypto, manual)
- Gerenciar usuarios do bot (banir, adicionar saldo, ver atividades)
- Criar promocoes e descontos
- Gerenciar gift cards
- Configurar programa de referral (indicacoes)
- Enviar broadcasts para todos usuarios do bot
- Configurar checker de produtos (API de validacao)
- Integrar com fornecedor externo de produtos
- Monitorar dashboard com metricas de vendas, recargas, usuarios

**Autenticacao:**
- Login via `POST /api/auth/login`
- JWT armazenado em `localStorage.token`
- Claim no JWT: `isAdmin: true, role: "admin"`
- Painel acessivel em `/admin/*`

### Assistant/Suporte (Nivel 2 - Acesso Limitado)

O Assistant e uma sub-conta criada pelo Owner para dar acesso limitado ao painel a membros da equipe de suporte.

**Responsabilidades:**
- Consultar dados de usuarios (lookup)
- Criar e gerenciar gift cards
- Visualizar compras e recargas (sem alterar)
- Processar refunds (se permitido)

**Autenticacao:**
- Login via `POST /api/auth/login`
- JWT com `role: "assistant"`
- Painel acessivel em `/assistant/*`

### User/Comprador (Nivel 3 - Cliente Final)

O User e o cliente final que compra produtos atraves do bot Telegram ou do painel web.

**Responsabilidades:**
- Registrar-se no bot (via /start no Telegram)
- Recarregar saldo (PIX, crypto, gift card)
- Comprar produtos (via bot ou painel web)
- Ver historico de compras e recargas
- Participar do programa de referral
- Solicitar trocas (exchanges)

**Autenticacao:**
- Login via `POST /api/auth/login` (painel web)
- Via Telegram: autenticacao pelo telegram_id
- JWT com `role: "user", isAdmin: false`
- Painel acessivel em `/user/*`

## 3.3 Isolamento de Dados Entre Tenants

### Principio Fundamental

**TODA query ao banco de dados DEVE filtrar por tenant ownership.** Nenhum owner pode acessar dados de outro owner. A regra de ouro e:

```
// CORRETO - sempre filtrar por owner
const cards = await Card.find({ bot_id: req.user.bot_id, owner_id: req.user.owner_id });

// ERRADO - permite acesso cross-tenant
const cards = await Card.find({ bot_id: req.body.bot_id }); // bot_id vem do usuario!
```

### Identificadores de Isolamento

| Campo         | Descricao                                    | Onde E Usado                    |
|---------------|----------------------------------------------|---------------------------------|
| `owner_id`    | ID do owner/tenant (= user.id do owner)      | Todas as tabelas do tenant      |
| `tenant_id`   | Alias de owner_id em alguns contextos         | Bots, settings                  |
| `bot_id`      | ID unico do bot (cada owner tem 1-2)          | Cards, orders, users, settings  |

### Regras de Isolamento (CRITICAS)

1. **Pool de produtos e POR TENANT** - Cada owner gerencia seu proprio estoque. Um owner NAO PODE ver ou vender produtos de outro owner.

2. **O `bot_id` nos endpoints de API DEVE ser validado contra o `owner_id` do JWT** - O backend NUNCA deve confiar em um `bot_id` enviado pelo frontend sem verificar se pertence ao owner autenticado.

3. **Settings sao por bot_id E por owner_id** - Configuracoes de precos, recargas, mensagens sao isoladas por bot.

4. **Usuarios (buyers) pertencem ao bot** - Cada usuario do Telegram e vinculado ao `bot_id` do bot que usou. O owner so ve usuarios dos seus proprios bots.

5. **Orders/purchases sao filtradas por bot_id + owner_id** - O historico de vendas e especifico de cada bot.

### Middleware de Verificacao de Tenant

Todo endpoint admin DEVE passar por middleware que:

```javascript
// Exemplo de middleware de verificacao de tenant
const verifyTenantOwnership = async (req, res, next) => {
  const { bot_id } = req.params || req.query || req.body;
  
  if (bot_id) {
    const bot = await Bot.findOne({ id: bot_id });
    
    if (!bot || bot.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado: bot nao pertence a este owner' });
    }
    
    req.bot = bot;
    req.tenant_id = req.user.id;
  }
  
  next();
};
```

### Falha Conhecida na Versao Original

Na versao original da plataforma, o parametro `bot_id` nos endpoints de API **NAO era validado contra o `owner_id`** do JWT. Isso permitia que um owner acessasse e modificasse dados de bots de outros owners simplesmente passando um `bot_id` diferente. **Esta falha DEVE ser corrigida na reconstrucao.**

---

# 4. PAINEIS WEB (SPA)

O frontend e uma Single Page Application (SPA) React servida como um build estatico. Os paineis sao diferenciados por rotas e por guards de autenticacao no frontend.

## 4.1 Estrutura Geral de Rotas

```
/                              -> Landing page + pagina de planos
/planos                        -> Pagina de planos de assinatura

/user/*                        -> Painel do Usuario (comprador)
  /user/login                  -> Login do usuario
  /user/register               -> Registro de novo usuario
  /user/                       -> Dashboard (saldo, compras recentes)
  /user/cards                  -> Catalogo de produtos para compra
  /user/recharge               -> Recarga de saldo (PIX, crypto, manual)
  /user/purchases              -> Historico de compras
  /user/giftcard               -> Resgate de gift cards
  /user/referrals              -> Programa de indicacoes
  /user/wallet                 -> Detalhes da carteira/saldo

/admin/*                       -> Painel Admin (tenant/owner)
  (detalhado abaixo na secao 4.3)

/assistant/*                   -> Painel do Assistente (suporte)
  /assistant/                  -> Dashboard do assistente
  /assistant/users             -> Busca de usuarios
  /assistant/gift-cards        -> Gerenciamento de gift cards

/superadmin/*                  -> Painel SuperAdmin
  /superadmin/login            -> Login do superadmin
  /superadmin/dashboard        -> Dashboard global
  /superadmin/tenants          -> Gerenciamento de tenants
  /superadmin/payments         -> Pagamentos de assinatura
  /superadmin/stats            -> Estatisticas globais
  /superadmin/search           -> Busca global
  /superadmin/create-user      -> Criar owner/tenant
```

## 4.2 Landing Page e Assinatura

A landing page (`/` e `/planos`) e publica e mostra:

- Descricao da plataforma
- Tabela de planos com precos e recursos
- Formulario de registro de novo owner (nome, username, senha, telegram)
- Integracao com pagamento da assinatura

Nao requer autenticacao. O registro de owner cria uma conta pendente que pode ser ativada automaticamente ou apos aprovacao do SuperAdmin.

## 4.3 Painel Admin (Tenant/Owner) - Detalhamento Completo

O painel admin e o mais complexo da plataforma, com mais de 50 sub-rotas:

### Dashboard e Analytics
```
/admin/dashboard                    -> Dashboard basico (vendas, recargas, usuarios do dia)
/admin/dashboard/advanced           -> Dashboard avancado (metricas de 30 dias, graficos)
```

### Gestao de Estoque (Cards)
```
/admin/cards                        -> Listagem de produtos com filtros (pais, BIN, tipo, status)
/admin/cards/upload                 -> Upload de produtos (texto colado, CSV, chunked, v5)
/admin/cards/export                 -> Exportacao de produtos para CSV
/admin/cards/duplicates             -> Deteccao e remocao de duplicatas
/admin/cards/reactivate-dead        -> Reativacao de produtos marcados como inativos
```

### Lotes (Batches) e Pool
```
/admin/batches                      -> Gerenciamento de lotes importados
/admin/batches/auxiliary-pool       -> Pool auxiliar de produtos
/admin/batches/mix-offers           -> Ofertas de pacotes mistos
```

### Tabela de Precos (BINs)
```
/admin/bins                         -> Tabela de precos por BIN (6 primeiros digitos)
/admin/bins/upload                  -> Upload massivo de BINs com precos
```

### Checker (Validacao de Produtos)
```
/admin/checker-settings             -> Config da API de checker (URL, keywords, precos)
/admin/checker-monitor-data         -> Monitoramento em tempo real do checker
/admin/card-check-sessions          -> Sessoes de verificacao em massa
```

### Usuarios
```
/admin/users                        -> Listagem de usuarios do bot (paginada)
/admin/users/all-activities         -> Log de atividades dos usuarios
/admin/top-users                    -> Ranking de maiores compradores
```

### Telegram
```
/admin/telegram-bots                -> Configuracao dos bots (token, backup, nome)
/admin/telegram/settings            -> Mensagens, canais, regras do bot
/admin/telegram/users               -> Usuarios do Telegram (lista completa)
/admin/telegram/users/delta         -> Novos usuarios desde timestamp X
/admin/telegram/orders              -> Pedidos feitos via Telegram
/admin/telegram/recharges           -> Recargas feitas via Telegram
/admin/telegram/exchanges           -> Trocas de produtos
/admin/telegram/references          -> Referencias pendentes
/admin/telegram/gift-cards          -> Gift cards criados
/admin/telegram/gift-cards/bulk     -> Criacao em massa de gift cards
/admin/telegram/broadcast           -> Envio de broadcast para usuarios
/admin/telegram/affiliates/*        -> Sistema de afiliados (config, usuarios, ganhos)
/admin/telegram/start-image         -> Imagem de boas-vindas do bot
/admin/telegram-bots/custom-emojis  -> Emojis customizados do Telegram
```

### Financeiro
```
/admin/automatic-pix-settings       -> Config do PIX automatico (PrimePix v2)
/admin/automatic-pix-payments       -> Pagamentos PIX processados
/admin/manual-recharge-settings     -> Config de recargas manuais
/admin/manual-recharge-attempts     -> Tentativas de recarga manual pendentes
/admin/unified-recharge-settings    -> Config unificada de todas as recargas
/admin/recharge-settings            -> Config geral de recargas
/admin/recharge-bonus               -> Bonus de recarga (ex: +10% para PIX)
/admin/crypto-payments              -> Pagamentos em criptomoeda (Plisio)
/admin/gateways                     -> Gateways de pagamento configurados
/admin/user-gateway-access          -> Controle de acesso por gateway por usuario
```

### Gift Cards e Promocoes
```
/admin/giftcards                    -> Listagem de gift cards ativos
/admin/promotions                   -> Promocoes e descontos
/admin/promotions/analytics         -> Analytics de uso de promocoes
```

### Referral (Indicacoes)
```
/admin/referral-settings            -> Config do programa de referral
/admin/referral-stats               -> Estatisticas gerais
/admin/referral-earnings            -> Ganhos de indicacao
/admin/referral-top-referrers       -> Top indicadores
/admin/referral-users               -> Usuarios indicados
```

### Configuracoes Diversas
```
/admin/registration-settings        -> Habilitar/desabilitar registro de usuarios
/admin/rules-settings               -> Regras de uso do bot
/admin/site-settings                -> Configuracoes gerais do site
/admin/support-contacts             -> Contatos de suporte
/admin/security-analysis            -> Analise de seguranca
/admin/security-ip-blocks           -> IPs bloqueados
/admin/user-cpf-settings            -> Config de visualizacao de CPF
/admin/dashboard-banners            -> Banners do dashboard do usuario
/admin/notifications                -> Notificacoes do admin
/admin/purchase-validation-logs     -> Logs de validacao de compra
/admin/status                       -> Status online do admin
/admin/system-uptime                -> Uptime do sistema
/admin/upload-logo                  -> Upload de logo da loja
/admin/upload-header-logo           -> Upload de logo do header
/admin/settings                     -> Configuracoes key-value genericas
/admin/bonus-visibility             -> Visibilidade de bonus para usuarios
```

### API Externa (Fornecedor)
```
/admin/external-api/admin/integrations  -> Config de integracao com fornecedor
/admin/external-api/admin/statistics    -> Estatisticas do fornecedor
```

## 4.4 Guards de Rota (Frontend)

O frontend implementa guards (HOCs ou componentes wrapper) que protegem rotas:

```javascript
// SuperAdminGuard - verifica is_super_admin no JWT/localStorage
const SuperAdminGuard = ({ children }) => {
  const token = localStorage.getItem('superadmin_token');
  if (!token || !decodedToken.is_super_admin) {
    return <Navigate to="/superadmin/login" />;
  }
  return children;
};

// AdminGuard - verifica isAdmin no JWT
const AdminGuard = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token || !decodedToken.isAdmin) {
    return <Navigate to="/user/login" />;
  }
  return children;
};

// AssistantGuard - verifica role === "assistant"
const AssistantGuard = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token || decodedToken.role !== 'assistant') {
    return <Navigate to="/user/login" />;
  }
  return children;
};

// AuthGuard - verifica presenca de token valido
const AuthGuard = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/user/login" />;
  }
  return children;
};
```

**IMPORTANTE:** Guards de frontend sao apenas UX. A seguranca REAL esta no backend, nos middlewares de autenticacao e autorizacao. Nunca confie apenas em guards de frontend.

## 4.5 Gerenciamento de Estado (Redux Toolkit)

O frontend utiliza Redux Toolkit com slices organizados por dominio:

### Slices Principais

```
store/
  +-- authSlice.js          -> Login, registro, getCurrentUser, changePassword
  +-- adminSlice.js         -> Dashboard, cards, users, bins, giftcards, batches
  +-- cardsSlice.js         -> Listagem de produtos para usuario
  +-- purchasesSlice.js     -> Compra (sync, async, auto-live, mix-package), historico
  +-- rechargeSlice.js      -> Criar recarga, historico, bonus
  +-- giftCardSlice.js      -> Resgate, historico
  +-- dashboardSlice.js     -> Dashboard do usuario
  +-- superadminSlice.js    -> Dashboard global, tenants, pagamentos, stats
```

### API Services

O frontend organiza chamadas HTTP em services (instancias axios com baseURL configurada):

```javascript
// services/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
});

// Interceptor para adicionar token JWT a todas as requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para tratar erros de autenticacao
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/user/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

### Services Especializados

| Service              | Responsabilidade                              |
|----------------------|-----------------------------------------------|
| `authAPI`            | Login, registro, me, change-password          |
| `adminAPI`           | Todos os endpoints /admin/*                   |
| `cardsAPI`           | Listagem de produtos para usuario             |
| `purchasesAPI`       | Compras (sync, async, auto-live)              |
| `rechargeAPI`        | Recargas (criar, historico)                   |
| `pixAPI`             | PIX automatico (gerar, verificar, limites)    |
| `manualRechargeAPI`  | Recargas manuais                              |
| `giftCardAPI`        | Gift cards (resgate, historico)               |
| `dashboardAPI`       | Dashboard do usuario                          |
| `publicAPI`          | Endpoints publicos (bonus, batches, rules)    |
| `superadminAPI`      | Todos os endpoints /superadmin/*              |

---

# 5. MODULOS DO BACKEND

## 5.1 Estrutura de Diretorios do Backend

```
backend/
  +-- src/
  |     +-- config/
  |     |     +-- database.js          -> Conexao MongoDB (Mongoose)
  |     |     +-- cors.js              -> Configuracao CORS
  |     |     +-- rateLimit.js         -> Rate limiting
  |     |     +-- socket.js            -> Configuracao Socket.IO
  |     |     +-- cloudflare.js        -> Integracao Cloudflare
  |     |
  |     +-- middleware/
  |     |     +-- auth.js              -> Verificacao JWT (user/admin)
  |     |     +-- superadminAuth.js    -> Verificacao JWT (superadmin)
  |     |     +-- tenantVerify.js      -> Verificacao de tenant ownership
  |     |     +-- rateLimit.js         -> Rate limiting por rota
  |     |     +-- upload.js            -> Multer config para uploads
  |     |     +-- errorHandler.js      -> Tratamento global de erros
  |     |     +-- requestLogger.js     -> Log de requests
  |     |
  |     +-- models/
  |     |     +-- User.js              -> Schema de usuarios
  |     |     +-- Bot.js               -> Schema de bots Telegram
  |     |     +-- Card.js              -> Schema de produtos
  |     |     +-- Batch.js             -> Schema de lotes
  |     |     +-- Bin.js               -> Schema de BINs/precos
  |     |     +-- Order.js             -> Schema de pedidos
  |     |     +-- Recharge.js          -> Schema de recargas
  |     |     +-- GiftCard.js          -> Schema de gift cards
  |     |     +-- Exchange.js          -> Schema de trocas
  |     |     +-- Promotion.js         -> Schema de promocoes
  |     |     +-- Referral.js          -> Schema de indicacoes
  |     |     +-- CheckerSession.js    -> Schema de sessoes de check
  |     |     +-- Notification.js      -> Schema de notificacoes
  |     |     +-- IpBlock.js           -> Schema de IPs bloqueados
  |     |     +-- SubscriptionPlan.js  -> Schema de planos
  |     |     +-- Setting.js           -> Schema key-value de configs
  |     |     +-- Activity.js          -> Schema de log de atividades
  |     |
  |     +-- routes/
  |     |     +-- auth.js              -> Rotas de autenticacao
  |     |     +-- cards.js             -> Rotas de produtos (usuario)
  |     |     +-- purchases.js         -> Rotas de compras
  |     |     +-- recharge.js          -> Rotas de recargas
  |     |     +-- giftcards.js         -> Rotas de gift cards
  |     |     +-- admin/
  |     |     |     +-- index.js       -> Router principal admin
  |     |     |     +-- dashboard.js   -> Dashboard e analytics
  |     |     |     +-- cards.js       -> Gestao de estoque
  |     |     |     +-- batches.js     -> Gestao de lotes
  |     |     |     +-- bins.js        -> Precos por BIN
  |     |     |     +-- checker.js     -> Config do checker
  |     |     |     +-- users.js       -> Gestao de usuarios
  |     |     |     +-- telegram.js    -> Config de bots Telegram
  |     |     |     +-- payments.js    -> PIX, manual, crypto
  |     |     |     +-- giftcards.js   -> Gift cards admin
  |     |     |     +-- promotions.js  -> Promocoes
  |     |     |     +-- referral.js    -> Programa de referral
  |     |     |     +-- settings.js    -> Configuracoes diversas
  |     |     |     +-- security.js    -> Seguranca (IP blocks, analise)
  |     |     |     +-- broadcast.js   -> Broadcast para usuarios
  |     |     |     +-- externalApi.js -> Integracao fornecedor
  |     |     |
  |     |     +-- assistant.js         -> Rotas do assistente
  |     |     +-- superadmin.js        -> Rotas do superadmin
  |     |     +-- public.js            -> Rotas publicas
  |     |     +-- webhooks.js          -> Callbacks de pagamento
  |     |     +-- subscription.js      -> Planos e assinaturas
  |     |
  |     +-- services/
  |     |     +-- telegramBot.js       -> Runtime do bot Telegram
  |     |     +-- pixService.js        -> Integracao PrimePix v2
  |     |     +-- cryptoService.js     -> Integracao Plisio
  |     |     +-- checkerService.js    -> Integracao com Checker API
  |     |     +-- supplierService.js   -> Integracao fornecedor externo
  |     |     +-- purchaseService.js   -> Logica de compra
  |     |     +-- rechargeService.js   -> Logica de recarga
  |     |     +-- broadcastService.js  -> Envio de broadcast
  |     |     +-- referralService.js   -> Calculo de referrals
  |     |     +-- socketService.js     -> Emissao de eventos real-time
  |     |
  |     +-- jobs/
  |     |     +-- checkerJob.js        -> Job de verificacao periodica
  |     |     +-- cleanupJob.js        -> Limpeza de dados expirados
  |     |     +-- heartbeatJob.js      -> Heartbeat dos bots
  |     |     +-- subscriptionJob.js   -> Verificacao de assinaturas
  |     |
  |     +-- utils/
  |     |     +-- helpers.js           -> Funcoes utilitarias
  |     |     +-- validators.js        -> Validacoes de entrada
  |     |     +-- formatters.js        -> Formatacao de dados
  |     |     +-- crypto.js            -> Funcoes HMAC/hash
  |     |
  |     +-- app.js                     -> Configuracao do Express
  |     +-- server.js                  -> Entry point (listen na porta)
  |
  +-- uploads/                          -> Diretorio de uploads
  +-- tests/                            -> Testes automatizados
  +-- .env.example                      -> Template de variaveis de ambiente
  +-- package.json                      -> Dependencias
  +-- pm2.config.js                     -> Config do PM2
```

## 5.2 Modulo: Autenticacao (auth)

**Rotas:**

| Metodo | Endpoint                    | Funcao                           |
|--------|-----------------------------|----------------------------------|
| POST   | `/api/auth/login`           | Login (username + password -> JWT)|
| POST   | `/api/auth/register`        | Registro de novo usuario         |
| POST   | `/api/auth/change-password` | Alteracao de senha               |
| GET    | `/api/auth/me`              | Dados do usuario autenticado     |
| GET    | `/api/auth/user/stats`      | Estatisticas do usuario          |

**Mecanismo de autenticacao:**
- Hash de senhas com bcrypt (salt rounds: 10+)
- JWT com expiracao configuravel (ex: 7 dias)
- Token contem: `{ id, username, role, isAdmin, is_super_admin, bot_id }`
- Rate limiting por conta (max 5 tentativas/minuto) E por IP global
- SuperAdmin tem login separado em `POST /api/superadmin/login` com JWT em `localStorage.superadmin_token`

**Schema do User (Mongoose):**

```javascript
const userSchema = new mongoose.Schema({
  username:           { type: String, required: true, unique: true },
  password:           { type: String, required: true },
  role:               { type: String, enum: ['user', 'admin', 'assistant'], default: 'user' },
  isAdmin:            { type: Boolean, default: false },
  is_super_admin:     { type: Boolean, default: false },
  balance:            { type: Number, default: 0 },
  banned:             { type: Boolean, default: false },
  ban_reason:         { type: String },
  telegram_id:        { type: String },
  telegram_username:  { type: String },
  referral_code:      { type: String, unique: true },
  referred_by:        { type: String },
  total_recharged:    { type: Number, default: 0 },
  total_purchased:    { type: Number, default: 0 },
  purchase_count:     { type: Number, default: 0 },
  bot_id:             { type: Number },       // Bot ao qual pertence (para users)
  owner_id:           { type: Number },       // Owner ao qual pertence (para admins)
  last_login:         { type: Date },
  created_at:         { type: Date, default: Date.now },
});
```

## 5.3 Modulo: Produtos/Cards (cards)

**Rotas do Usuario:**

| Metodo | Endpoint                          | Funcao                            |
|--------|-----------------------------------|-----------------------------------|
| GET    | `/api/cards`                      | Listar produtos disponiveis       |
| GET    | `/api/cards/countries`            | Paises com produtos disponiveis   |
| GET    | `/api/cards/available-gateways`   | Gateways disponiveis              |
| GET    | `/api/cards/check-sessions`       | Sessoes de verificacao            |
| POST   | `/api/cards/mass-check`           | Verificacao em massa              |

**Filtros disponiveis na listagem:**
- `country` - Pais (BR, US, etc.)
- `brand` - Bandeira (VISA, MASTERCARD, etc.)
- `type` - Tipo (CREDIT, DEBIT)
- `level` - Nivel (STANDARD, GOLD, PLATINUM, BLACK, INFINITE)
- `bank` - Banco emissor
- `base` - Tipo de dado (sem, full, consultaveis, tracks)
- `bin` - BIN especifico (6 digitos)
- `status` - Status (available, sold, dead)
- `bot_id` - ID do bot
- Paginacao: `page`, `limit`

**Schema do Card:**

```javascript
const cardSchema = new mongoose.Schema({
  bin:                { type: String, required: true },
  brand:              { type: String },     // VISA, MASTERCARD, ELO, AMEX
  type:               { type: String },     // CREDIT, DEBIT
  level:              { type: String },     // STANDARD, GOLD, PLATINUM, BLACK
  country:            { type: String },     // Codigo ISO (BR, US, etc.)
  bank:               { type: String },     // Nome do banco emissor
  base:               { type: String, enum: ['sem', 'full', 'consultaveis', 'tracks'] },
  status:             { type: String, enum: ['available', 'sold', 'dead', 'reserved'], default: 'available' },
  pan:                { type: String },     // Numero completo
  expiry_month:       { type: String },
  expiry_year:        { type: String },
  cvv:                { type: String },
  holder_name:        { type: String },     // Nome do titular (full)
  cpf:                { type: String },     // CPF do titular (full)
  consulted_password: { type: String },     // Senha consultada (consultaveis)
  available:          { type: Number },     // Limite disponivel (consultaveis)
  total:              { type: Number },     // Limite total (consultaveis)
  track1:             { type: String },     // Track 1 magnetica
  track2:             { type: String },     // Track 2 magnetica
  auxiliary_data:     { type: String },     // Dados adicionais
  bot_id:             { type: Number, required: true },
  owner_id:           { type: Number, required: true },
  batch_id:           { type: Number },
  sold_to:            { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sold_at:            { type: Date },
  created_at:         { type: Date, default: Date.now },
});
```

## 5.4 Modulo: Compras (purchases)

**Rotas:**

| Metodo | Endpoint                              | Funcao                                    |
|--------|---------------------------------------|-------------------------------------------|
| POST   | `/api/purchases`                      | Compra sincrona (por cardId)              |
| POST   | `/api/purchases/async`                | Compra assincrona (retorna jobId)         |
| GET    | `/api/purchases/async/:id`            | Poll status de compra assincrona          |
| POST   | `/api/purchases/auto-live/async`      | Compra auto-live assincrona               |
| GET    | `/api/purchases/auto-live/async/:id`  | Poll status de auto-live                  |
| POST   | `/api/purchases/mix-package`          | Compra de pacote misto                    |
| GET    | `/api/purchases/history`              | Historico de compras do usuario            |

**Tipos de Compra:**

| Tipo                | Descricao                                          | source_detail                   |
|---------------------|----------------------------------------------------|---------------------------------|
| Compra unitaria     | Selecao manual de um produto                       | `web-purchase` ou `telegram-*`  |
| Compra auto-live    | Compra com verificacao automatica no checker        | `*-auto-live`                   |
| Mix Package         | Pacote com multiplos produtos                      | `*-mix`                         |
| Fornecedor externo  | Produto vem de API externa (reserve -> order)      | `*-external-auto-live`          |

**Fluxo de Compra (Critico - Deve Ser Atomico):**

```javascript
// FLUXO CORRETO (com transacao MongoDB):
const session = await mongoose.startSession();
session.startTransaction();

try {
  // 1. Buscar preco do BIN
  const bin = await Bin.findOne({ bin: card.bin, bot_id }).session(session);
  const price = bin.price; // NUNCA aceitar preco do frontend!
  
  // 2. Verificar saldo do usuario
  const user = await User.findById(userId).session(session);
  if (user.balance < price) {
    throw new Error('Saldo insuficiente');
  }
  
  // 3. Debitar saldo (atomico)
  await User.findByIdAndUpdate(userId, { $inc: { balance: -price } }).session(session);
  
  // 4. Marcar produto como vendido (atomico)
  const card = await Card.findOneAndUpdate(
    { _id: cardId, status: 'available' },
    { status: 'sold', sold_to: userId, sold_at: new Date() }
  ).session(session);
  
  if (!card) throw new Error('Produto nao disponivel');
  
  // 5. Criar registro de order
  const order = await Order.create([{
    userId, price, card_data: card, bot_id, purchase_type, source_detail
  }], { session });
  
  await session.commitTransaction();
  return order;
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

**IMPORTANTE:** O preco DEVE ser buscado do banco de dados (tabela bins) pelo backend. NUNCA aceitar preco enviado pelo frontend. Na versao original, esta validacao nao existia, permitindo compras a R$0.

## 5.5 Modulo: Recargas (recharge)

**Rotas:**

| Metodo | Endpoint                                              | Funcao                                  |
|--------|-------------------------------------------------------|-----------------------------------------|
| POST   | `/api/recharge`                                       | Criar nova recarga                      |
| GET    | `/api/recharge/history`                               | Historico de recargas                   |
| GET    | `/api/recharge-settings`                              | Config de recarga do bot                |
| POST   | `/api/automatic-pix`                                  | Gerar PIX automatico (QR Code)         |
| GET    | `/api/automatic-pix/limits`                           | Limites de PIX (diario, por hora)      |
| GET    | `/api/automatic-pix/payments`                         | Pagamentos PIX processados             |
| GET    | `/api/automatic-pix/settings`                         | Config PIX (PrimePix)                  |
| POST   | `/api/manual-recharge`                                | Solicitar recarga manual               |
| GET    | `/api/manual-recharge/attempts`                       | Tentativas de recarga manual           |
| GET    | `/api/manual-recharge/settings`                       | Config de recarga manual               |
| POST   | `/api/recharge/primepix/webhook/:ownerId/:secret`     | Callback PIX (PrimePix)               |

**Metodos de Recarga:**

1. **PIX Automatico (PrimePix v2):**
   - Usuario informa valor -> API gera QR Code PIX via PrimePix
   - PrimePix notifica via webhook quando pagamento e detectado
   - Saldo creditado automaticamente na wallet do usuario
   - Limites: diario, por hora, cooldown entre requisicoes
   - Taxa configuravel (fixa ou percentual)

2. **Criptomoeda (Plisio):**
   - Usuario escolhe crypto -> API cria invoice no Plisio
   - Plisio notifica via callback quando pagamento e confirmado
   - Saldo creditado automaticamente
   - Callback em `POST /api/crypto/plisio/callback`

3. **Manual:**
   - Usuario informa valor e envia comprovante
   - Solicitacao fica pendente no painel admin
   - Admin aprova ou rejeita manualmente
   - Se aprovado, saldo e creditado

## 5.6 Modulo: Gift Cards (giftcards)

**Rotas do Usuario:**

| Metodo | Endpoint                    | Funcao                      |
|--------|-----------------------------|-----------------------------|
| POST   | `/api/giftcards/redeem`     | Resgatar gift card por codigo|
| GET    | `/api/giftcards/history`    | Historico de resgates       |

**Rotas Admin:**

| Metodo | Endpoint                                | Funcao                          |
|--------|-----------------------------------------|---------------------------------|
| GET    | `/api/admin/giftcards`                  | Listar gift cards               |
| POST   | `/api/admin/giftcards`                  | Criar gift card                 |
| POST   | `/api/admin/telegram/gift-cards/bulk`   | Criacao em massa                |

**Formato do codigo:** `XXXX-XXXX-XXXX-XXXX-XXXX-X` (alfanumerico)

**Fluxo:**
1. Admin cria gift card informando valor, quantidade e prefixo
2. Sistema gera codigos unicos
3. Admin distribui codigos para clientes (via Telegram, redes sociais, etc.)
4. Cliente resgata codigo via bot ou painel web
5. Valor e creditado na wallet do cliente

## 5.7 Modulo: Admin (80+ endpoints)

O modulo admin e o maior do sistema, com mais de 80 endpoints. Os principais grupos estao detalhados abaixo:

### Dashboard e Analytics

| Metodo | Endpoint                          | Funcao                              |
|--------|-----------------------------------|-------------------------------------|
| GET    | `/api/admin/dashboard`            | Metricas basicas (vendas, recargas) |
| GET    | `/api/admin/dashboard/advanced`   | Metricas avancadas (30 dias)        |
| GET    | `/api/admin/dashboard-banners`    | Banners do dashboard                |
| POST   | `/api/admin/dashboard-banners`    | Atualizar banners                   |

### Gestao de Estoque

| Metodo | Endpoint                                       | Funcao                              |
|--------|------------------------------------------------|-------------------------------------|
| GET    | `/api/admin/cards`                             | Listar produtos (paginado)          |
| GET    | `/api/admin/cards/export`                      | Exportar produtos (CSV)             |
| GET    | `/api/admin/cards/duplicates`                  | Detectar duplicatas                 |
| POST   | `/api/admin/cards/upload`                      | Upload de produtos                  |
| POST   | `/api/admin/cards/upload-bulk`                 | Upload bulk (texto)                 |
| POST   | `/api/admin/cards/upload-chunked`              | Upload chunked (lotes grandes)      |
| POST   | `/api/admin/cards/upload-v5`                   | Upload v5 (multipart)              |
| POST   | `/api/admin/cards/reactivate-dead`             | Reativar produtos inativos          |
| POST   | `/api/admin/cards/reactivate-dead/preview`     | Preview de reativacao               |
| POST   | `/api/admin/cards/reactivate-single`           | Reativar produto individual         |

### Lotes (Batches)

| Metodo | Endpoint                                           | Funcao                          |
|--------|----------------------------------------------------|---------------------------------|
| GET    | `/api/admin/batches`                               | Listar lotes                    |
| GET    | `/api/admin/batches/auxiliary-pool`                 | Pool auxiliar                   |
| GET    | `/api/admin/batches/auxiliary-pool/entries`          | Entradas do pool                |
| POST   | `/api/admin/batches/auxiliary-pool/upload`           | Upload ao pool                  |
| PATCH  | `/api/admin/batches/auxiliary-pool/settings`         | Config do pool                  |
| DELETE | `/api/admin/batches/auxiliary-pool/available`        | Limpar pool                     |
| GET    | `/api/admin/batches/mix-offers`                     | Ofertas mistas                  |

### BINs e Precos

| Metodo | Endpoint                    | Funcao                              |
|--------|-----------------------------|-------------------------------------|
| GET    | `/api/admin/bins`           | Listar BINs com precos              |
| POST   | `/api/admin/bins`           | Criar/atualizar BIN                 |
| POST   | `/api/admin/bins/upload`    | Upload massivo de BINs              |

### Checker

| Metodo | Endpoint                               | Funcao                          |
|--------|-----------------------------------------|---------------------------------|
| GET    | `/api/admin/checker-settings`          | Config do checker               |
| POST   | `/api/admin/checker-settings`          | Atualizar config do checker     |
| GET    | `/api/admin/checker-monitor-data`      | Dados de monitoramento          |
| GET    | `/api/admin/card-check-sessions`       | Sessoes de check                |

### Usuarios

| Metodo | Endpoint                              | Funcao                          |
|--------|---------------------------------------|---------------------------------|
| GET    | `/api/admin/users`                    | Listar usuarios                 |
| GET    | `/api/admin/users/all-activities`     | Atividades de usuarios          |
| GET    | `/api/admin/top-users`                | Top compradores                 |
| POST   | `/api/admin/users/:id/add-funds`      | Adicionar saldo                 |
| POST   | `/api/admin/users/:id/ban`            | Banir usuario                   |
| POST   | `/api/admin/users/:id/role`           | Atualizar papel                 |

### Telegram

| Metodo     | Endpoint                                       | Funcao                          |
|------------|------------------------------------------------|---------------------------------|
| GET        | `/api/admin/telegram-bots`                     | Listar bots do owner            |
| POST       | `/api/admin/telegram-bots`                     | Criar/atualizar bot             |
| GET        | `/api/admin/telegram/settings`                 | Config do Telegram              |
| POST       | `/api/admin/telegram/settings`                 | Atualizar config Telegram       |
| GET        | `/api/admin/telegram/users`                    | Usuarios do Telegram            |
| GET        | `/api/admin/telegram/users/delta`              | Novos usuarios desde timestamp  |
| DELETE     | `/api/admin/telegram/users/all`                | Deletar todos usuarios          |
| GET        | `/api/admin/telegram/orders`                   | Pedidos Telegram                |
| GET        | `/api/admin/telegram/recharges`                | Recargas Telegram               |
| GET        | `/api/admin/telegram/exchanges`                | Trocas                          |
| GET        | `/api/admin/telegram/references`               | Referencias                     |
| GET        | `/api/admin/telegram/gift-cards`               | Gift cards                      |
| POST       | `/api/admin/telegram/gift-cards/bulk`          | Criacao bulk                    |
| POST       | `/api/admin/telegram/broadcast`                | Broadcast                       |
| POST       | `/api/admin/telegram/start-image`              | Upload imagem start             |
| DELETE     | `/api/admin/telegram/start-image`              | Remover imagem start            |
| GET        | `/api/admin/telegram/start-image-proxy`        | Proxy da imagem                 |
| GET/PUT    | `/api/admin/telegram/affiliates/config`        | Config afiliados                |
| GET        | `/api/admin/telegram/affiliates/users`         | Usuarios afiliados              |
| GET        | `/api/admin/telegram/affiliates/recent-earnings`| Ganhos recentes                |
| POST       | `/api/admin/telegram-bots/custom-emojis/*`     | Emojis customizados             |

### Financeiro

| Metodo | Endpoint                                    | Funcao                              |
|--------|---------------------------------------------|-------------------------------------|
| GET    | `/api/admin/automatic-pix-payments`         | Pagamentos PIX                      |
| PUT    | `/api/admin/automatic-pix-settings`         | Config PIX                          |
| GET    | `/api/admin/manual-recharge-attempts`       | Tentativas manual                   |
| GET    | `/api/admin/manual-recharge-settings`       | Config manual                       |
| POST   | `/api/admin/manual-recharge-settings`       | Atualizar config manual             |
| GET    | `/api/admin/manual-recharge-statistics`     | Stats manual                        |
| GET    | `/api/admin/unified-recharge-settings`      | Config unificada                    |
| POST   | `/api/admin/unified-recharge-settings`      | Atualizar config unificada          |
| GET    | `/api/admin/recharge-settings`              | Config geral                        |
| POST   | `/api/admin/recharge-settings`              | Atualizar config                    |
| POST   | `/api/admin/recharge-bonus`                 | Config bonus                        |
| GET    | `/api/admin/crypto-payments`                | Pagamentos crypto                   |
| GET    | `/api/admin/gateways`                       | Gateways                            |
| POST   | `/api/admin/gateways`                       | Criar gateway                       |
| GET    | `/api/admin/user-gateway-access`            | Acesso por gateway                  |
| POST   | `/api/admin/user-gateway-access`            | Atualizar acesso                    |

### Gift Cards e Promocoes (Admin)

| Metodo | Endpoint                               | Funcao                          |
|--------|-----------------------------------------|---------------------------------|
| GET    | `/api/admin/giftcards`                 | Listar gift cards               |
| POST   | `/api/admin/giftcards`                 | Criar gift card                 |
| GET    | `/api/admin/promotions`                | Listar promocoes                |
| POST   | `/api/admin/promotions`                | Criar promocao                  |
| GET    | `/api/admin/promotions/analytics`      | Analytics promocoes             |

### Referral

| Metodo | Endpoint                              | Funcao                          |
|--------|---------------------------------------|---------------------------------|
| GET    | `/api/admin/referral-settings`        | Config referral                 |
| POST   | `/api/admin/referral-settings`        | Atualizar config                |
| GET    | `/api/admin/referral-stats`           | Estatisticas                    |
| GET    | `/api/admin/referral-earnings`        | Ganhos                          |
| GET    | `/api/admin/referral-top-referrers`   | Top indicadores                 |
| GET    | `/api/admin/referral-users`           | Usuarios indicados              |

### Configuracoes e Seguranca

| Metodo | Endpoint                                          | Funcao                          |
|--------|---------------------------------------------------|---------------------------------|
| GET    | `/api/admin/site-settings`                        | Config do site                  |
| POST   | `/api/admin/site-settings`                        | Atualizar config                |
| POST   | `/api/admin/settings`                             | Config key-value                |
| GET    | `/api/admin/registration-settings`                | Config registro                 |
| POST   | `/api/admin/registration-settings`                | Ativar/desabilitar              |
| GET    | `/api/admin/rules-settings`                       | Regras de uso                   |
| POST   | `/api/admin/rules-settings`                       | Atualizar regras                |
| POST   | `/api/admin/security-ip-blocks`                   | Bloquear IP                     |
| GET    | `/api/admin/security-ip-blocks`                   | IPs bloqueados                  |
| GET    | `/api/admin/security-analysis`                    | Analise de seguranca            |
| GET    | `/api/admin/support-contacts`                     | Contatos suporte                |
| POST   | `/api/admin/support-contacts`                     | Atualizar contatos              |
| GET    | `/api/admin/user-cpf-settings`                    | Config CPF                      |
| POST   | `/api/admin/user-cpf-settings`                    | Atualizar CPF                   |
| POST   | `/api/admin/bonus-visibility`                     | Visibilidade bonus              |
| POST   | `/api/admin/upload-logo`                          | Upload logo                     |
| POST   | `/api/admin/upload-header-logo`                   | Upload logo header              |
| GET    | `/api/admin/purchase-validation-logs`             | Logs validacao                  |
| GET    | `/api/admin/purchase-validation-logs/export`      | Export logs                     |
| GET    | `/api/admin/status`                               | Status admin                    |
| GET    | `/api/admin/system-uptime`                        | Uptime                          |
| GET    | `/api/admin/notifications`                        | Notificacoes                    |

### API Externa (Fornecedor)

| Metodo | Endpoint                                    | Funcao                          |
|--------|---------------------------------------------|---------------------------------|
| GET    | `/api/external-api/admin/integrations`      | Integracoes configuradas        |
| POST   | `/api/external-api/admin/integrations`      | Config integracao               |
| GET    | `/api/external-api/admin/statistics`        | Stats fornecedor                |

## 5.8 Modulo: Assistant (suporte)

**Rotas:**

| Metodo | Endpoint                           | Funcao                          |
|--------|------------------------------------|---------------------------------|
| GET    | `/api/assistant/gift-card-bots`    | Bots disponiveis                |
| GET    | `/api/assistant/gift-cards`        | Listar gift cards               |
| POST   | `/api/assistant/gift-cards`        | Criar gift cards                |
| POST   | `/api/assistant/page-view`         | Registrar visualizacao          |

O assistente tem acesso limitado: pode consultar usuarios, ver gift cards e criar novos gift cards. Nao tem permissao para alterar configuracoes, precos, ou dados financeiros.

## 5.9 Modulo: SuperAdmin

**Rotas:**

| Metodo | Endpoint                                        | Funcao                          |
|--------|--------------------------------------------------|---------------------------------|
| POST   | `/api/superadmin/login`                         | Login do superadmin             |
| GET    | `/api/superadmin/dashboard`                     | Dashboard global                |
| GET    | `/api/superadmin/stats`                         | Estatisticas globais            |
| GET    | `/api/superadmin/tenants`                       | Listar tenants                  |
| GET    | `/api/superadmin/payments`                      | Pagamentos de assinatura        |
| GET    | `/api/superadmin/search`                        | Busca global                    |
| POST   | `/api/superadmin/create-user`                   | Criar owner/tenant              |
| POST   | `/api/superadmin/create-support-user`           | Criar assistente                |
| PUT    | `/api/superadmin/update-user-credentials`       | Atualizar credenciais           |
| PUT    | `/api/superadmin/me/password`                   | Alterar senha propria           |

## 5.10 Modulo: Publico (public)

**Rotas (sem autenticacao):**

| Metodo | Endpoint                          | Funcao                          |
|--------|-----------------------------------|---------------------------------|
| GET    | `/api/public/bonus-info`          | Info de bonus (aceita bot_id)   |
| GET    | `/api/public/recent-batches`      | Lotes recentes                  |
| GET    | `/api/public/recent-purchases`    | Compras recentes                |
| GET    | `/api/public/rules-settings`      | Regras de uso                   |
| GET    | `/api/subscription/plans`         | Planos de assinatura            |
| POST   | `/api/subscription/create`        | Criar assinatura (registro)     |

## 5.11 Modulo: Webhooks

**Endpoints de callback (chamados por servicos externos):**

| Metodo | Endpoint                                              | Origem        | Auth                    |
|--------|-------------------------------------------------------|---------------|-------------------------|
| POST   | `/api/crypto/plisio/callback`                         | Plisio        | HMAC no body            |
| POST   | `/api/recharge/primepix/webhook/:ownerId/:secret`     | PrimePix      | Secret no path          |
| POST   | `/api/external-supplier/webhooks/:webhookKey`          | Fornecedor    | Key no path             |

**IMPORTANTE sobre seguranca de webhooks:**
- O callback do Plisio DEVE verificar a assinatura HMAC do payload
- O webhook do PrimePix usa secret no path (melhor: verificar assinatura no header)
- O webhook do fornecedor usa key no path (melhor: verificar assinatura)
- Todos os webhooks DEVEM ser idempotentes (processar o mesmo evento 2x sem efeito colateral)

---

# 6. INTEGRACOES EXTERNAS

## 6.1 Telegram Bot API

### Biblioteca Recomendada

Usar `node-telegram-bot-api` ou `grammy`. Ambas sao maduras e bem documentadas.

```javascript
// Opcao 1: node-telegram-bot-api
const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(token, { polling: true });

// Opcao 2: grammy (mais moderno, suporte a plugins)
const { Bot } = require('grammy');
const bot = new Bot(token);
```

### Ciclo de Vida do Bot

```
1. Owner cadastra token no painel admin
2. Backend busca tokens ativos no banco
3. Para cada bot ativo, inicia instancia (polling ou webhook)
4. Bot responde a /start com mensagem de boas-vindas + menu inline
5. Cliente navega por menu inline (callback queries)
6. Compras e recargas sao feitas via callback handlers
7. Heartbeat periodico verifica se bot esta online
8. Se bot cai, job de heartbeat reinicia automaticamente
```

### Configuracoes por Bot

Cada bot armazena no MongoDB:

| Campo                    | Tipo    | Descricao                                   |
|--------------------------|---------|----------------------------------------------|
| `bot_api_key`            | String  | Token do BotFather                           |
| `backup_bot_api_key`     | String  | Token do bot de backup                       |
| `welcome_message`        | String  | Mensagem de /start (HTML)                    |
| `start_image_url`        | String  | Imagem de boas-vindas                        |
| `store_name`             | String  | Nome da loja                                 |
| `support_username`       | String  | Username de suporte                          |
| `required_channel`       | String  | Canal obrigatorio para usar                  |
| `require_subscription`   | Boolean | Exigir inscricao no canal                    |
| `disable_purchases`      | Boolean | Desabilitar compras                          |
| `disable_pix`            | Boolean | Desabilitar PIX                              |
| `maintenance_mode`       | Boolean | Modo manutencao                              |
| `referral_enabled`       | Boolean | Programa de indicacoes                       |
| `referral_bonus_pct`     | Number  | Bonus por indicacao (%)                      |
| `exchanges_enabled`      | Boolean | Trocas habilitadas                           |
| `stock_origin`           | String  | "local" ou "fornecedor_externo"              |
| `mix_packages_enabled`   | Boolean | Pacotes mistos                               |
| `min_purchase_amount`    | Number  | Valor minimo de compra                       |
| `custom_emojis`          | Object  | IDs de emojis customizados do Telegram       |
| `exchange_window_min`    | Number  | Minutos para solicitar troca (padrao: 10)    |

### Menu do Bot (Inline Keyboard)

```
Menu Principal:
  [Comprar produtos]    -> Selecao de tipo/base
  [Adicionar saldo]     -> PIX / Crypto / Manual
  [Minha conta]         -> Perfil, historico, saldo
  [Suporte]             -> Canal e atendimento

Submenu Compra:
  [Tipo 1] [Tipo 2] [Tipo 3] [Tipo 4]
  -> Filtro por pais -> Filtro por banco -> Filtro por nivel
  -> Lista de produtos -> Confirmar compra

Submenu Recarga:
  [PIX Automatico] -> Informar valor -> QR Code
  [Cripto]         -> Escolher moeda -> Invoice
  [Manual]         -> Informar valor + comprovante
```

### Broadcast

O admin pode enviar mensagens para todos os usuarios do bot:

```javascript
// Broadcast com controle de pausar/resumir/cancelar
const broadcastMessage = async (botId, message, imageUrl) => {
  const users = await User.find({ bot_id: botId, banned: false });
  
  let sent = 0, failed = 0;
  
  for (const user of users) {
    if (broadcastCancelled) break;
    while (broadcastPaused) await sleep(1000);
    
    try {
      if (imageUrl) {
        await bot.sendPhoto(user.telegram_id, imageUrl, { caption: message, parse_mode: 'HTML' });
      } else {
        await bot.sendMessage(user.telegram_id, message, { parse_mode: 'HTML' });
      }
      sent++;
    } catch (e) {
      failed++;
    }
    
    await sleep(50); // Rate limiting do Telegram (30 msgs/s)
  }
  
  return { sent, failed, total: users.length };
};
```

## 6.2 PIX Payment (PrimePix v2)

### Fluxo de Pagamento PIX

```
1. Usuario solicita recarga informando valor
2. Backend chama API PrimePix para gerar cobranca PIX
3. PrimePix retorna: QR Code, payload PIX, ID da cobranca
4. Frontend exibe QR Code ao usuario
5. Usuario paga PIX no app do banco
6. PrimePix detecta pagamento via reconciliacao
7. PrimePix envia POST para webhook URL configurada
8. Webhook URL: /api/recharge/primepix/webhook/{ownerId}/{secret}
9. Backend valida webhook e credita saldo ao usuario
10. Notifica usuario via Telegram ou WebSocket
```

### Configuracao PrimePix

```json
{
  "enabled": true,
  "provider": "primepixv2",
  "api_key": "SUA_API_KEY_PRIMEPIX",
  "webhook_secret": "SEU_WEBHOOK_SECRET",
  "fee_type": "none",
  "fee_value": 0,
  "min_amount": 10,
  "max_amount": 1000,
  "daily_limit": 100,
  "hourly_limit": 20,
  "cooldown_minutes": 1,
  "expiration_minutes": 30,
  "processing_mode": "webhook",
  "webhook_fallback_seconds": 120
}
```

### Verificacao de Webhook PrimePix

```javascript
// Verificar autenticidade do webhook
const verifyPrimepixWebhook = (req, res, next) => {
  const { ownerId, secret } = req.params;
  
  // Buscar config do owner
  const config = await PixConfig.findOne({ owner_id: ownerId });
  
  if (!config || config.webhook_secret !== secret) {
    return res.status(403).json({ error: 'Webhook nao autorizado' });
  }
  
  // Verificar se pagamento ja foi processado (idempotencia)
  const existing = await Recharge.findOne({ external_id: req.body.payment_id });
  if (existing) {
    return res.status(200).json({ ok: true, message: 'Ja processado' });
  }
  
  next();
};
```

## 6.3 Crypto Payment (Plisio)

### Fluxo de Pagamento Crypto

```
1. Usuario solicita recarga crypto informando valor e moeda
2. Backend cria invoice no Plisio via API
3. Plisio retorna: endereco crypto, valor, QR Code, link de pagamento
4. Frontend exibe dados de pagamento ao usuario
5. Usuario envia cripto para o endereco
6. Plisio detecta pagamento e confirmacoes
7. Plisio envia POST para callback URL
8. Callback URL: POST /api/crypto/plisio/callback
9. Backend valida assinatura HMAC do payload
10. Backend credita saldo ao usuario
```

### Integracao Plisio

```javascript
const crypto = require('crypto');
const axios = require('axios');

// Criar invoice Plisio
const createPlisioInvoice = async (amount, currency, orderId) => {
  const response = await axios.get('https://plisio.net/api/v1/invoices/new', {
    params: {
      source_currency: 'BRL',
      source_amount: amount,
      currency: currency, // BTC, ETH, LTC, etc.
      order_number: orderId,
      order_name: 'Recarga de saldo',
      callback_url: `${process.env.BASE_URL}/api/crypto/plisio/callback`,
      api_key: process.env.PLISIO_API_KEY,
    },
  });
  return response.data;
};

// Verificar callback HMAC
const verifyPlisioCallback = (req) => {
  const data = req.body;
  const receivedHash = data.verify_hash;
  delete data.verify_hash;
  
  const sortedParams = Object.keys(data).sort().map(k => data[k]).join('');
  const expectedHash = crypto
    .createHmac('sha1', process.env.PLISIO_SECRET_KEY)
    .update(sortedParams)
    .digest('hex');
  
  return receivedHash === expectedHash;
};
```

**CRITICO:** Na versao original, o callback do Plisio NAO verificava a assinatura HMAC, aceitando qualquer POST e retornando `{"ok": true}`. Isso permitia forja de pagamentos. A verificacao HMAC e OBRIGATORIA na reconstrucao.

## 6.4 Fornecedor Externo de Produtos

### Conceito

O MultiBots pode operar com estoque local (produtos uploadados pelo owner) ou com um **fornecedor externo** via API. Quando `stock_origin: "fornecedor_externo"`, as compras sao encaminhadas para a API do fornecedor.

### Fluxo de Compra com Fornecedor

```
1. Bot consulta catalogo do fornecedor:
   GET {base_url}/catalog
   Headers: Authorization: Bearer {token}

2. Bot reserva produto:
   POST {base_url}/reservations
   Body: { bin, base, country, ... }

3. Bot confirma pedido:
   POST {base_url}/orders
   Body: { reservation_id }

4. Bot verifica status:
   GET {base_url}/orders/{orderId}

5. Fornecedor notifica entrega via webhook:
   POST /api/external-supplier/webhooks/{webhookKey}

6. Bot entrega produto ao cliente
```

### Configuracao da Integracao

```json
{
  "base_url": "https://api.fornecedor.com/multibot",
  "credential_header": "Authorization",
  "credential_scheme": "Bearer",
  "credential_value": "TOKEN_DO_FORNECEDOR",
  "timeout_ms": 8000,
  "catalog_path": "/catalog",
  "reserve_path": "/reservations",
  "order_path": "/orders",
  "status_path": "/orders/{orderId}",
  "webhook_key": "CHAVE_UNICA_DO_WEBHOOK",
  "webhook_url": "https://sua-api.com/api/external-supplier/webhooks/{webhookKey}"
}
```

## 6.5 Checker API (Validacao de Produtos)

### Conceito

O checker e uma API externa que verifica se um produto esta "ativo" (valido para uso). Suporta configuracao por owner.

### Configuracao

```json
{
  "api_url": "http://checker-api:3005/v1/check?key={API_KEY}&item={ITEM}",
  "method": "GET",
  "success_keyword": "#APROVADO",
  "fail_keyword": "#REPROVADO",
  "error_keyword": "ERRO",
  "live_price": 0.10,
  "dead_price": 0.05,
  "max_threads_per_user": 5,
  "timeout": 60000,
  "auto_purchase_dead_limit": 10,
  "auto_purchase_checker_error_limit": 5
}
```

### Fluxo de Verificacao

```
1. Sistema substitui {ITEM} na URL pelo dado do produto
2. Faz request HTTP (GET ou POST) para a API do checker
3. Analisa resposta em busca de keywords:
   - Se contem success_keyword -> Produto LIVE
   - Se contem fail_keyword -> Produto DEAD
   - Se contem error_keyword ou timeout -> ERRO
4. Atualiza status do produto no banco
5. Cobra do usuario: live_price se LIVE, dead_price se DEAD
```

---

# 7. COMO RODAR O PROJETO

## 7.1 Pre-requisitos

- **Node.js** 18 LTS ou 20 LTS
- **npm** 9+ ou **yarn** 1.22+
- **MongoDB** 6.x ou 7.x (local ou Atlas)
- **Git** (para clonar o repositorio)
- **Docker** e **Docker Compose** (opcional, para MongoDB)

## 7.2 Passo a Passo

### 1. Clonar o Repositorio

```bash
git clone <url-do-repositorio> multibots
cd multibots
```

### 2. Instalar Dependencias

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 3. Configurar Variaveis de Ambiente

```bash
# Copiar template
cp backend/.env.example backend/.env

# Editar com suas credenciais
# (ver secao 8 para lista completa de variaveis)
nano backend/.env
```

### 4. Iniciar MongoDB

**Opcao A: Docker Compose (recomendado para desenvolvimento)**

```bash
# No diretorio raiz do projeto
docker-compose up -d mongodb
```

**Opcao B: MongoDB local**

```bash
# Verificar se MongoDB esta rodando
mongosh --eval "db.adminCommand('ping')"
```

**Opcao C: MongoDB Atlas (nuvem)**

```
# Configurar MONGODB_URI no .env com a connection string do Atlas
MONGODB_URI=mongodb+srv://usuario:senha@cluster.mongodb.net/multibots?retryWrites=true&w=majority
```

### 5. Seed do Banco de Dados

```bash
cd backend

# Criar superadmin inicial
npm run seed

# O seed cria:
# - SuperAdmin: admin / senha-do-env
# - Planos de assinatura (Basico R$300, Premium R$400)
# - Configuracoes globais padrao
```

### 6. Iniciar Backend (Desenvolvimento)

```bash
cd backend
npm run dev

# Saida esperada:
# [INFO] MongoDB conectado
# [INFO] Server rodando na porta 9999
# [INFO] Socket.IO inicializado
```

### 7. Iniciar Frontend (Desenvolvimento)

```bash
cd frontend
npm run dev

# Saida esperada:
# VITE v5.x.x ready in 500ms
# -> Local:   http://localhost:5173/
# -> Network: http://192.168.x.x:5173/
```

### 8. Acessar a Aplicacao

```
Frontend (SPA):     http://localhost:5173
API Backend:        http://localhost:9999/api
SuperAdmin Login:   http://localhost:5173/superadmin/login
Admin Login:        http://localhost:5173/admin/login
User Login:         http://localhost:5173/user/login
```

### 9. Primeiro Acesso

```
1. Acesse /superadmin/login
2. Faca login com as credenciais do seed
3. Crie um tenant/owner em /superadmin/create-user
4. Faca logout e login como owner em /admin/login
5. Configure seu primeiro bot Telegram:
   a. Crie bot no BotFather (@BotFather no Telegram)
   b. Copie o token
   c. Cadastre em /admin/telegram-bots
6. Configure precos, recargas e estoque
7. Bot fica online automaticamente
```

## 7.3 Docker Compose (Opcional)

```yaml
# docker-compose.yml
version: '3.8'

services:
  mongodb:
    image: mongo:7
    container_name: multibots-mongodb
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: multibots
      MONGO_INITDB_ROOT_PASSWORD: sua_senha_segura
      MONGO_INITDB_DATABASE: multibots
    volumes:
      - mongodb_data:/data/db
    restart: unless-stopped

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: multibots-backend
    ports:
      - "9999:9999"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://multibots:sua_senha_segura@mongodb:27017/multibots?authSource=admin
    depends_on:
      - mongodb
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: multibots-frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  mongodb_data:
```

---

# 8. VARIAVEIS DE AMBIENTE

## 8.1 Variaveis Obrigatorias

```bash
# ============================================================
# SERVIDOR
# ============================================================
NODE_ENV=development                    # development | production
PORT=9999                               # Porta do servidor backend
BASE_URL=http://localhost:9999          # URL base da API (producao: https://api.seudominio.com)
FRONTEND_URL=http://localhost:5173      # URL do frontend (producao: https://seudominio.com)

# ============================================================
# BANCO DE DADOS
# ============================================================
MONGODB_URI=mongodb://localhost:27017/multibots
# Para MongoDB Atlas:
# MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/multibots?retryWrites=true&w=majority

# ============================================================
# AUTENTICACAO
# ============================================================
JWT_SECRET=sua_chave_secreta_muito_longa_e_aleatoria_minimo_32_caracteres
JWT_EXPIRATION=7d                       # Tempo de expiracao do token (7 dias)
SUPERADMIN_USERNAME=superadmin          # Username do superadmin (seed)
SUPERADMIN_PASSWORD=senha_super_segura  # Senha do superadmin (seed)

# ============================================================
# CORS
# ============================================================
CORS_ALLOWED_ORIGINS=http://localhost:5173,https://seudominio.com
```

## 8.2 Variaveis de Integracao (PIX)

```bash
# ============================================================
# PIX - PRIMEPIX V2
# ============================================================
PRIMEPIX_API_URL=https://api.primepix.com/v2        # URL base da API PrimePix
PRIMEPIX_API_KEY=sua_api_key_primepix               # Chave de API
PRIMEPIX_WEBHOOK_SECRET=seu_webhook_secret           # Secret para validar webhooks
```

## 8.3 Variaveis de Integracao (Crypto)

```bash
# ============================================================
# CRYPTO - PLISIO
# ============================================================
PLISIO_API_KEY=sua_api_key_plisio                   # Chave de API Plisio
PLISIO_SECRET_KEY=sua_secret_key_plisio             # Secret para verificar HMAC dos callbacks
```

## 8.4 Variaveis de Integracao (Telegram)

```bash
# ============================================================
# TELEGRAM
# ============================================================
# Os tokens dos bots sao armazenados no banco de dados (por bot),
# nao em variaveis de ambiente. Porem, pode-se definir um token
# padrao para desenvolvimento:
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11  # Token para dev
TELEGRAM_WEBHOOK_URL=https://api.seudominio.com/telegram/webhook  # URL para modo webhook
TELEGRAM_MODE=polling                                # polling | webhook
```

## 8.5 Variaveis de Integracao (Checker)

```bash
# ============================================================
# CHECKER API
# ============================================================
# A configuracao do checker e feita POR BOT via painel admin,
# armazenada no banco de dados. Variaveis aqui sao apenas defaults:
CHECKER_API_URL=http://checker-host:3005/v1/check
CHECKER_API_KEY=sua_api_key_checker
CHECKER_TIMEOUT=60000                               # Timeout em ms
```

## 8.6 Variaveis de Integracao (Fornecedor Externo)

```bash
# ============================================================
# FORNECEDOR EXTERNO
# ============================================================
# A configuracao do fornecedor e feita POR BOT via painel admin.
# Variaveis aqui sao apenas defaults:
EXTERNAL_SUPPLIER_URL=https://api.fornecedor.com/multibot
EXTERNAL_SUPPLIER_TOKEN=seu_bearer_token
EXTERNAL_SUPPLIER_TIMEOUT=8000                      # Timeout em ms
```

## 8.7 Variaveis de Infraestrutura

```bash
# ============================================================
# CLOUDFLARE (opcional)
# ============================================================
CLOUDFLARE_API_TOKEN=seu_cloudflare_token
CLOUDFLARE_ZONE_ID=seu_zone_id
TRUST_PROXY=true                                    # Confiar em headers X-Forwarded-*

# ============================================================
# RATE LIMITING
# ============================================================
RATE_LIMIT_WINDOW_MS=60000                          # Janela de 1 minuto
RATE_LIMIT_MAX_REQUESTS=100                         # Max requests por janela
LOGIN_RATE_LIMIT_MAX=5                              # Max tentativas de login

# ============================================================
# UPLOAD
# ============================================================
UPLOAD_MAX_SIZE=10485760                             # 10MB max upload
UPLOAD_DIR=./uploads                                 # Diretorio de uploads

# ============================================================
# LOGGING
# ============================================================
LOG_LEVEL=info                                       # debug | info | warn | error
LOG_FILE=./logs/app.log                              # Arquivo de log

# ============================================================
# SOCKET.IO
# ============================================================
SOCKET_CORS_ORIGIN=http://localhost:5173
```

## 8.8 Arquivo .env.example Completo

```bash
# MultiBots - Variaveis de Ambiente
# Copie este arquivo para .env e preencha com seus valores

# Servidor
NODE_ENV=development
PORT=9999
BASE_URL=http://localhost:9999
FRONTEND_URL=http://localhost:5173

# Banco de Dados
MONGODB_URI=mongodb://localhost:27017/multibots

# Autenticacao
JWT_SECRET=ALTERE_PARA_UMA_CHAVE_SECRETA_LONGA_E_ALEATORIA
JWT_EXPIRATION=7d
SUPERADMIN_USERNAME=superadmin
SUPERADMIN_PASSWORD=ALTERE_PARA_UMA_SENHA_SEGURA

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:5173

# PIX (PrimePix v2)
PRIMEPIX_API_URL=
PRIMEPIX_API_KEY=
PRIMEPIX_WEBHOOK_SECRET=

# Crypto (Plisio)
PLISIO_API_KEY=
PLISIO_SECRET_KEY=

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_MODE=polling

# Checker
CHECKER_API_URL=
CHECKER_API_KEY=
CHECKER_TIMEOUT=60000

# Fornecedor Externo
EXTERNAL_SUPPLIER_URL=
EXTERNAL_SUPPLIER_TOKEN=
EXTERNAL_SUPPLIER_TIMEOUT=8000

# Cloudflare
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ZONE_ID=
TRUST_PROXY=false

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
LOGIN_RATE_LIMIT_MAX=5

# Upload
UPLOAD_MAX_SIZE=10485760
UPLOAD_DIR=./uploads

# Logging
LOG_LEVEL=info
```

---

# 9. DEPLOY EM PRODUCAO

## 9.1 Visao Geral da Arquitetura de Producao

```
                    Internet
                       |
                       v
              +------------------+
              |   CLOUDFLARE     |
              |   (CDN/WAF/SSL)  |
              +--------+---------+
                       |
                       v
              +------------------+
              |      NGINX       |
              |  (Reverse Proxy) |
              |  Porta 80/443    |
              +--+----------+----+
                 |          |
                 v          v
          +-----------+  +------------------+
          | Frontend  |  | Backend (PM2)    |
          | (Static)  |  | Node.js :9999    |
          | /var/www/  |  | 2+ instancias   |
          | multibots/ |  +--------+---------+
          +-----------+           |
                                  v
                         +------------------+
                         |    MongoDB       |
                         |  (Atlas ou       |
                         |   self-hosted)   |
                         +------------------+
```

## 9.2 Build do Frontend

```bash
cd frontend

# Build para producao
npm run build

# Saida em frontend/dist/
# Contem: index.html, assets/index-*.js, assets/index-*.css

# Copiar para diretorio do Nginx
sudo cp -r dist/* /var/www/multibots/
```

**Configuracao do Vite para producao (vite.config.js):**

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,        // Nao gerar sourcemaps em producao
    minify: 'terser',        // Minificar com Terser
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          redux: ['@reduxjs/toolkit', 'react-redux'],
          ui: ['recharts', 'lucide-react'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:9999',
        changeOrigin: true,
      },
    },
  },
});
```

## 9.3 PM2 para o Backend

### Configuracao PM2

```javascript
// pm2.config.js (ou ecosystem.config.js)
module.exports = {
  apps: [
    {
      name: 'multibots-api',
      script: './src/server.js',
      cwd: '/home/deploy/multibots/backend',
      instances: 2,                    // 2 instancias (cluster mode)
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 9999,
      },
      max_memory_restart: '500M',      // Reiniciar se usar mais de 500MB
      error_file: '/var/log/pm2/multibots-error.log',
      out_file: '/var/log/pm2/multibots-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      watch: false,                    // Nao usar watch em producao
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,             // 5 segundos entre reinicializacoes
    },
  ],
};
```

### Comandos PM2

```bash
# Iniciar aplicacao
pm2 start pm2.config.js

# Ver status
pm2 status

# Ver logs
pm2 logs multibots-api

# Reiniciar
pm2 restart multibots-api

# Reload sem downtime (graceful)
pm2 reload multibots-api

# Parar
pm2 stop multibots-api

# Salvar config para startup automatico
pm2 save
pm2 startup
```

**ATENCAO com Cluster Mode e Telegram Bots:**

Se usar `exec_mode: 'cluster'` com PM2 (multiplas instancias), os bots Telegram NAO podem rodar em modo polling em todas as instancias simultaneamente (conflito de polling). Solucoes:

1. **Separar o bot em um processo dedicado** (1 instancia, fork mode)
2. **Usar webhook mode** em vez de polling (recomendado para producao)
3. **Usar PM2 com cluster mode apenas para a API**, e fork mode para o bot

```javascript
// pm2.config.js com separacao de processos
module.exports = {
  apps: [
    {
      name: 'multibots-api',
      script: './src/server.js',
      instances: 2,
      exec_mode: 'cluster',
      // ...
    },
    {
      name: 'multibots-bots',
      script: './src/botRunner.js',      // Script separado para bots
      instances: 1,                       // UMA instancia apenas
      exec_mode: 'fork',
      // ...
    },
  ],
};
```

## 9.4 Nginx como Reverse Proxy

### Configuracao do Nginx

```nginx
# /etc/nginx/sites-available/multibots

# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;

# Upstream para backend
upstream multibots_backend {
    server 127.0.0.1:9999;
    keepalive 32;
}

# Redirecionar HTTP para HTTPS
server {
    listen 80;
    server_name seudominio.com api.seudominio.com;
    return 301 https://$server_name$request_uri;
}

# Frontend (SPA)
server {
    listen 443 ssl http2;
    server_name seudominio.com;

    # SSL (Cloudflare Origin Certificate ou Let's Encrypt)
    ssl_certificate /etc/ssl/certs/seudominio.pem;
    ssl_certificate_key /etc/ssl/private/seudominio.key;

    # Diretorio do frontend buildado
    root /var/www/multibots;
    index index.html;

    # SPA: todas as rotas apontam para index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache para assets estaticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Bloquear acesso a arquivos ocultos
    location ~ /\. {
        deny all;
    }
}

# API Backend
server {
    listen 443 ssl http2;
    server_name api.seudominio.com;

    ssl_certificate /etc/ssl/certs/seudominio.pem;
    ssl_certificate_key /etc/ssl/private/seudominio.key;

    # Tamanho maximo de upload
    client_max_body_size 10M;

    # Proxy para o backend Node.js
    location /api/ {
        limit_req zone=api burst=50 nodelay;

        proxy_pass http://multibots_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Rate limiting mais agressivo para autenticacao
    location /api/auth/login {
        limit_req zone=auth burst=3 nodelay;

        proxy_pass http://multibots_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket para Socket.IO
    location /socket.io/ {
        proxy_pass http://multibots_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Uploads (servir arquivos estaticos)
    location /uploads/ {
        alias /home/deploy/multibots/backend/uploads/;
        expires 30d;
        add_header Cache-Control "public";
    }

    # Bloquear acesso a arquivos ocultos
    location ~ /\. {
        deny all;
    }
}
```

### Ativar Configuracao

```bash
# Criar link simbolico
sudo ln -s /etc/nginx/sites-available/multibots /etc/nginx/sites-enabled/

# Testar configuracao
sudo nginx -t

# Recarregar Nginx
sudo systemctl reload nginx
```

## 9.5 SSL/TLS

### Opcao A: Cloudflare (Recomendado)

1. Configurar dominio no Cloudflare (DNS)
2. Ativar proxy (nuvem laranja) nos registros A/CNAME
3. SSL/TLS mode: Full (Strict)
4. Gerar Origin Certificate no Cloudflare Dashboard
5. Instalar certificado no Nginx

### Opcao B: Let's Encrypt (Certbot)

```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx

# Gerar certificado
sudo certbot --nginx -d seudominio.com -d api.seudominio.com

# Renovacao automatica (cron ja configurado pelo certbot)
sudo certbot renew --dry-run
```

## 9.6 MongoDB em Producao

### Opcao A: MongoDB Atlas (Recomendado)

- Criar cluster no MongoDB Atlas (M10+ para producao)
- Configurar IP whitelist (IP do servidor)
- Criar usuario com acesso restrito ao banco `multibots`
- Copiar connection string para `MONGODB_URI`

### Opcao B: MongoDB Self-Hosted

```bash
# Instalar MongoDB 7
sudo apt install mongodb-org

# Habilitar autenticacao
# Editar /etc/mongod.conf:
security:
  authorization: enabled

# Criar usuario admin
mongosh
use admin
db.createUser({
  user: "multibots_admin",
  pwd: "senha_muito_segura",
  roles: [{ role: "readWrite", db: "multibots" }]
})

# Configurar backup automatico
# Crontab: backup diario as 3h
0 3 * * * mongodump --uri="mongodb://multibots_admin:senha@localhost:27017/multibots" --out=/backups/mongodb/$(date +\%Y\%m\%d) --gzip
```

## 9.7 Checklist de Seguranca para Producao

```
[ ] JWT_SECRET com pelo menos 64 caracteres aleatorios
[ ] Senhas de banco com pelo menos 32 caracteres
[ ] CORS configurado apenas para dominios permitidos (NAO usar wildcard *)
[ ] Rate limiting ativado em todas as rotas
[ ] Rate limiting mais agressivo em /auth/login e /superadmin/login
[ ] Callback Plisio com verificacao HMAC obrigatoria
[ ] Webhook PrimePix com verificacao de secret
[ ] Validacao de bot_id contra owner_id em TODOS os endpoints admin
[ ] Preco de compra buscado do banco, NUNCA do frontend
[ ] Transacoes MongoDB para operacoes financeiras (compra, recarga)
[ ] Idempotencia em todos os webhooks
[ ] Uploads com validacao de tipo MIME e tamanho maximo
[ ] Sanitizacao de entradas (prevencao de NoSQL Injection)
[ ] Headers de seguranca (Helmet)
[ ] HTTPS obrigatorio (redirecionar HTTP -> HTTPS)
[ ] Logs estruturados sem dados sensiveis
[ ] Backups automaticos do MongoDB
[ ] Monitoramento de uptime (PM2 + alertas)
[ ] Firewall configurado (apenas portas 22, 80, 443)
[ ] SSH com chave publica (desabilitar login por senha)
```

## 9.8 Monitoramento

```bash
# PM2 Monitoring
pm2 monit                              # Monitor interativo
pm2 status                             # Status dos processos
pm2 logs multibots-api --lines 100     # Ultimas 100 linhas de log

# MongoDB
mongosh --eval "db.serverStatus()"     # Status do MongoDB
mongosh --eval "db.stats()"            # Estatisticas do banco

# Nginx
sudo tail -f /var/log/nginx/access.log  # Logs de acesso
sudo tail -f /var/log/nginx/error.log   # Logs de erro

# Sistema
htop                                    # CPU, memoria
df -h                                   # Espaco em disco
```

---

# APENDICE A: COLLECTIONS DO MONGODB

## Schemas Resumidos

| Collection           | Campos Principais                                                          |
|----------------------|----------------------------------------------------------------------------|
| `users`              | id, username, password, role, isAdmin, is_super_admin, balance, banned, telegram_id, referral_code, bot_id, owner_id |
| `bots`               | id, owner_id, tenant_id, name, username, bot_token, backup_token, active, settings, last_heartbeat |
| `cards`              | id, bin, brand, type, level, country, bank, base, status, pan, cvv, expiry, holder_name, cpf, bot_id, owner_id, batch_id |
| `batches`            | id, name, supplier, status, card_count, bot_id, owner_id                   |
| `bins`               | id, bin, brand, type, level, country, bank, price, price_sem, price_consultaveis, price_tracks |
| `orders`             | id, userId, username, price, refunded, bot_id, purchase_type, source_detail, stock_origin, card_data |
| `recharges`          | id, userId, amount, method, status, external_id, bot_id                    |
| `giftcards`          | id, code, value, redeemed, redeemed_by, bot_id, expiration_date            |
| `exchanges`          | id, orderId, userId, status, reason, bot_id                               |
| `promotions`         | id, name, discount, conditions, active, bot_id                             |
| `referrals`          | referrer_id, referred_id, bonus_amount, bot_id                             |
| `checker_settings`   | id, api_url, method, success_keyword, fail_keyword, live_price, dead_price |
| `checker_sessions`   | id, cards_checked, live_count, dead_count, error_count                     |
| `notifications`      | id, type, message, read, created_at                                        |
| `ip_blocks`          | id, ip, hours, reason, created_at                                          |
| `subscription_plans` | id, name, price, maxBots, duration, features                               |
| `settings`           | key, value (key-value store)                                               |
| `activities`         | id, userId, action, details, created_at                                    |

---

# APENDICE B: GLOSSARIO DE TERMOS

| Termo                | Significado                                                    |
|----------------------|----------------------------------------------------------------|
| **Owner/Tenant**     | Dono de bot(s), paga assinatura mensal                         |
| **Bot**              | Bot do Telegram gerenciado pelo owner                          |
| **bot_id**           | ID unico do bot (ex: 60)                                      |
| **tenant_id**        | = owner_id, identifica o dono                                  |
| **owner_id**         | ID do usuario owner no banco                                   |
| **BIN**              | Bank Identification Number (6 primeiros digitos)               |
| **PAN**              | Primary Account Number (numero completo)                       |
| **base**             | Tipo de dado: sem, full, consultaveis, tracks                  |
| **Batch**            | Lote de produtos importados                                    |
| **Checker**          | API que valida se produto esta ativo                           |
| **LIVE/DEAD**        | Status do produto pos-verificacao                              |
| **Exchange**         | Troca de produto que nao funcionou                             |
| **Gift Card**        | Codigo resgatavel por saldo                                    |
| **Referral**         | Sistema de indicacao entre usuarios                            |
| **Pool auxiliar**    | Estoque secundario de produtos                                 |
| **Mix Package**      | Pacote com multiplos produtos                                  |
| **Auto Live**        | Compra com verificacao automatica                              |
| **Fornecedor**       | API de terceiros que fornece produtos                          |
| **PrimePix**         | Gateway de pagamento PIX                                       |
| **Plisio**           | Gateway de pagamento crypto                                    |
| **Broadcast**        | Envio em massa para usuarios do bot                            |
| **SPA**              | Single Page Application (aplicacao de pagina unica)            |
| **JWT**              | JSON Web Token (token de autenticacao)                         |
| **HMAC**             | Hash-based Message Authentication Code                         |
| **ODM**              | Object-Document Mapper (Mongoose)                              |
| **Webhook**          | Callback HTTP que servico externo envia para notificar eventos |

---

# APENDICE C: FLUXOS CRITICOS DE NEGOCIO

## Fluxo: Owner Onboarding

```
1. Visitante acessa landing page -> /planos
2. Escolhe plano (Basico R$300 ou Premium R$400)
3. Preenche formulario: username, senha, telegram
4. POST /api/subscription/create
5. SuperAdmin aprova (ou aprovacao automatica)
6. Owner faz login no painel admin
7. Registra bot no BotFather -> obtem token
8. Cadastra token em /admin/telegram-bots
9. Configura mensagens, canais, regras
10. Define precos por BIN em /admin/bins
11. Configura recarga (PIX, manual, crypto)
12. Opcionalmente: configura fornecedor externo
13. Bot fica online -> clientes comecam a usar
```

## Fluxo: Compra de Produto (Telegram)

```
1. Cliente envia /start ao bot
2. Bot retorna welcome_message + menu inline
3. Cliente clica "Comprar"
4. Bot mostra selecao de tipo/base
5. Cliente seleciona tipo
6. Bot mostra filtros (pais, banco, nivel, BIN)
7. Cliente aplica filtros
8. Bot consulta estoque (local ou fornecedor externo)
9. Bot mostra produtos disponiveis (mascarados)
10. Cliente confirma compra
11. Bot verifica saldo do cliente
12. Se insuficiente -> "Recarregue seu saldo"
13. Se suficiente:
    a. Debita saldo (atomico)
    b. Marca produto como vendido
    c. Cria registro em orders
    d. Opcionalmente: checker API para verificacao
    e. Retorna dados ao cliente
14. Se auto-live ativado:
    a. Verifica no checker
    b. LIVE -> entrega / DEAD -> tenta proximo
15. Admin recebe notificacao
```

## Fluxo: Recarga PIX

```
1. Cliente no Telegram -> "Adicionar saldo"
2. Informa valor (min/max configurado)
3. Bot chama POST /api/automatic-pix
4. API gera QR Code PIX via PrimePix
5. Bot envia QR Code ao cliente
6. Cliente paga no app do banco
7. PrimePix detecta pagamento
8. POST /api/recharge/primepix/webhook/{ownerId}/{secret}
9. Backend valida, credita saldo
10. Bot notifica: "Saldo creditado: R$X"
```

---

# FIM DO DOCUMENTO

**Este documento contem todas as informacoes necessarias para reconstruir a plataforma MultiBots do zero. Para duvidas sobre implementacao especifica de cada modulo, consulte os schemas do MongoDB (Apendice A), os endpoints da API (Secao 5) e as integracoes externas (Secao 6).**
