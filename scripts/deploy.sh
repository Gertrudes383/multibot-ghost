#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Script de deploy para producao da plataforma MultiBots
#
# Executa:
#   1. Puxa atualizacoes do repositorio (git pull)
#   2. Instala dependencias atualizadas
#   3. Compila o frontend (Vite build)
#   4. Reinicia servicos via PM2 (ou Docker)
#
# Uso:
#   bash scripts/deploy.sh              # Deploy padrao (PM2)
#   bash scripts/deploy.sh --docker     # Deploy via Docker Compose
#
# Pre-requisitos:
#   - PM2 instalado globalmente (npm install -g pm2) para modo PM2
#   - Docker + Docker Compose para modo Docker
# =============================================================================

set -euo pipefail

# --- Cores para output ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# --- Funcoes utilitarias ---
log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[AVISO]${NC} $1"; }
log_error()   { echo -e "${RED}[ERRO]${NC} $1"; }
log_step()    { echo -e "${CYAN}[ETAPA]${NC} $1"; }

# --- Diretorio raiz do projeto ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# --- Modo de deploy ---
DEPLOY_MODE="pm2"
if [[ "${1:-}" == "--docker" ]]; then
    DEPLOY_MODE="docker"
fi

# --- Timestamp do deploy ---
DEPLOY_TIME=$(date '+%Y-%m-%d %H:%M:%S')
DEPLOY_TAG=$(date '+%Y%m%d_%H%M%S')

echo ""
echo "========================================="
echo "  MultiBots — Deploy de Producao"
echo "  Modo: ${DEPLOY_MODE^^}"
echo "  Data: ${DEPLOY_TIME}"
echo "========================================="
echo ""

# =============================================================================
# 1. Pre-verificacoes
# =============================================================================
log_step "1/5 — Verificacoes pre-deploy"

# Verifica se .env existe
if [ ! -f .env ]; then
    log_error "Arquivo .env nao encontrado. Execute setup.sh primeiro."
    exit 1
fi
log_success ".env encontrado"

# Carrega variaveis de ambiente
export $(grep -v '^#' .env | grep -v '^\s*$' | xargs 2>/dev/null) || true

# Verifica NODE_ENV
if [ "${NODE_ENV:-}" != "production" ]; then
    log_warn "NODE_ENV nao esta definido como 'production'. Definindo agora..."
    export NODE_ENV=production
fi

echo ""

# =============================================================================
# 2. Atualiza codigo-fonte
# =============================================================================
log_step "2/5 — Atualizando codigo-fonte"

if [ -d .git ]; then
    # Salva hash atual para referencia
    CURRENT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "desconhecido")
    log_info "Hash atual: ${CURRENT_HASH}"

    # Puxa atualizacoes
    log_info "Executando git pull..."
    git pull --rebase 2>&1 || {
        log_error "Falha no git pull. Resolva conflitos manualmente."
        exit 1
    }

    NEW_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "desconhecido")
    if [ "$CURRENT_HASH" = "$NEW_HASH" ]; then
        log_info "Nenhuma atualizacao encontrada (hash: ${NEW_HASH})"
    else
        log_success "Atualizado: ${CURRENT_HASH} → ${NEW_HASH}"
    fi
else
    log_warn "Nao e um repositorio git. Pulando git pull."
fi

echo ""

# =============================================================================
# 3. Instala dependencias
# =============================================================================
log_step "3/5 — Instalando dependencias"

if [ "$DEPLOY_MODE" = "pm2" ]; then
    # Backend
    log_info "Instalando dependencias do backend..."
    npm ci --omit=dev 2>&1 || npm install --omit=dev 2>&1
    log_success "Dependencias do backend atualizadas"

    # Frontend
    if [ -d frontend ] && [ -f frontend/package.json ]; then
        log_info "Instalando dependencias do frontend..."
        cd frontend
        npm ci 2>&1 || npm install 2>&1
        log_success "Dependencias do frontend atualizadas"
        cd "$PROJECT_DIR"
    fi
else
    log_info "Modo Docker — dependencias serao instaladas no build da imagem."
fi

echo ""

# =============================================================================
# 4. Compila frontend
# =============================================================================
log_step "4/5 — Compilando frontend"

if [ "$DEPLOY_MODE" = "pm2" ]; then
    if [ -d frontend ] && [ -f frontend/package.json ]; then
        cd frontend
        log_info "Executando Vite build..."
        npm run build 2>&1
        log_success "Frontend compilado com sucesso"
        cd "$PROJECT_DIR"
    else
        log_warn "Frontend nao encontrado. Pulando build."
    fi
else
    log_info "Modo Docker — frontend sera compilado no Dockerfile."
fi

echo ""

# =============================================================================
# 5. Reinicia servicos
# =============================================================================
log_step "5/5 — Reiniciando servicos"

if [ "$DEPLOY_MODE" = "docker" ]; then
    # --- Deploy via Docker Compose ---
    log_info "Rebuild e restart via Docker Compose..."

    cd docker

    # Build das imagens com tag de deploy
    docker compose build --no-cache 2>&1
    log_success "Imagens Docker reconstruidas"

    # Reinicia servicos (sem downtime se possivel)
    docker compose up -d --remove-orphans 2>&1
    log_success "Servicos reiniciados via Docker Compose"

    # Mostra status
    echo ""
    log_info "Status dos containers:"
    docker compose ps

    cd "$PROJECT_DIR"

else
    # --- Deploy via PM2 ---

    # Verifica se PM2 esta instalado
    if ! command -v pm2 &> /dev/null; then
        log_error "PM2 nao encontrado. Instale: npm install -g pm2"
        exit 1
    fi

    # Verifica se ja existe processo rodando
    if pm2 describe multibots-backend &> /dev/null; then
        log_info "Reiniciando backend via PM2..."
        pm2 reload multibots-backend --update-env 2>&1
        log_success "Backend reiniciado (zero-downtime reload)"
    else
        log_info "Iniciando backend via PM2..."
        pm2 start server.js \
            --name multibots-backend \
            --instances max \
            --exec-mode cluster \
            --max-memory-restart 1G \
            --env production \
            2>&1
        log_success "Backend iniciado via PM2"
    fi

    # Salva configuracao do PM2 para restart automatico
    pm2 save 2>&1
    log_success "Configuracao PM2 salva"

    # Mostra status
    echo ""
    log_info "Status dos processos PM2:"
    pm2 status
fi

echo ""

# =============================================================================
# Resumo do deploy
# =============================================================================
echo "========================================="
echo "  Deploy concluido!"
echo "========================================="
echo ""
echo "  Modo:      ${DEPLOY_MODE^^}"
echo "  Data:      ${DEPLOY_TIME}"
echo "  Tag:       ${DEPLOY_TAG}"

if [ -d .git ]; then
    echo "  Commit:    $(git rev-parse --short HEAD 2>/dev/null || echo 'N/A')"
fi

echo ""
echo "  Comandos uteis:"
if [ "$DEPLOY_MODE" = "docker" ]; then
    echo "    Logs:     cd docker && docker compose logs -f"
    echo "    Status:   cd docker && docker compose ps"
    echo "    Parar:    cd docker && docker compose down"
else
    echo "    Logs:     pm2 logs multibots-backend"
    echo "    Status:   pm2 status"
    echo "    Monit:    pm2 monit"
    echo "    Parar:    pm2 stop multibots-backend"
fi
echo ""
