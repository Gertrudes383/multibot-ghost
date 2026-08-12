#!/usr/bin/env bash
# =============================================================================
# setup.sh — Script de configuracao inicial da plataforma MultiBots
#
# Executa:
#   1. Verifica pre-requisitos (Node, npm, MongoDB)
#   2. Instala dependencias do backend e frontend
#   3. Cria arquivo .env a partir do template
#   4. Executa seed do banco de dados
#   5. Compila o frontend (Vite build)
#
# Uso: bash scripts/setup.sh
# =============================================================================

set -euo pipefail

# --- Cores para output ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # Sem cor

# --- Funcoes utilitarias ---
log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[AVISO]${NC} $1"; }
log_error()   { echo -e "${RED}[ERRO]${NC} $1"; }

# --- Diretorio raiz do projeto ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo ""
echo "========================================="
echo "  MultiBots — Setup Inicial"
echo "========================================="
echo ""

# =============================================================================
# 1. Verifica pre-requisitos
# =============================================================================
log_info "Verificando pre-requisitos..."

# Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    log_success "Node.js encontrado: $NODE_VERSION"
    # Verifica versao minima (18)
    MAJOR=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d. -f1)
    if [ "$MAJOR" -lt 18 ]; then
        log_error "Node.js 18+ e necessario. Versao atual: $NODE_VERSION"
        exit 1
    fi
else
    log_error "Node.js nao encontrado. Instale: https://nodejs.org/"
    exit 1
fi

# npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    log_success "npm encontrado: $NPM_VERSION"
else
    log_error "npm nao encontrado."
    exit 1
fi

# MongoDB (opcional — pode estar em Docker ou remoto)
if command -v mongosh &> /dev/null; then
    log_success "mongosh encontrado"
elif command -v mongo &> /dev/null; then
    log_success "mongo client encontrado"
else
    log_warn "MongoDB client nao encontrado localmente."
    log_warn "Certifique-se de que o MongoDB esta acessivel via MONGO_URI."
fi

echo ""

# =============================================================================
# 2. Cria arquivo .env (se nao existir)
# =============================================================================
log_info "Configurando variaveis de ambiente..."

if [ -f .env ]; then
    log_warn "Arquivo .env ja existe. Nao sera sobrescrito."
else
    # Gera segredos aleatorios
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | base64 | tr -d '\n/' | head -c 64)
    ENCRYPTION_KEY=$(openssl rand -hex 16 2>/dev/null || head -c 32 /dev/urandom | base64 | tr -d '\n/' | head -c 32)

    cat > .env << EOF
# =============================================================================
# MultiBots — Variaveis de Ambiente
# Gerado automaticamente em: $(date '+%Y-%m-%d %H:%M:%S')
# =============================================================================

# --- Ambiente ---
NODE_ENV=development
PORT=9999

# --- MongoDB ---
MONGO_URI=mongodb://localhost:27017/multibots
MONGO_USER=multibots_admin
MONGO_PASS=S3nh4F0rt3!M0ng0
MONGO_DB=multibots

# --- Redis ---
REDIS_URL=redis://localhost:6379
REDIS_PASS=R3d1sP4ss!

# --- Seguranca ---
JWT_SECRET=${JWT_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
SESSION_SECRET=$(openssl rand -hex 24 2>/dev/null || echo "troque-este-segredo")

# --- Seed do banco ---
SEED_ADMIN_USER=admin
SEED_ADMIN_PASS=Admin@2024!

# --- Logs ---
LOG_LEVEL=debug

# --- Frontend ---
VITE_API_URL=http://localhost:9999/api
VITE_APP_NAME=MultiBots
EOF

    log_success "Arquivo .env criado com segredos aleatorios."
    log_warn "Revise e ajuste o .env antes de ir para producao!"
fi

echo ""

# =============================================================================
# 3. Instala dependencias do backend
# =============================================================================
log_info "Instalando dependencias do backend..."

if [ -f package.json ]; then
    npm install
    log_success "Dependencias do backend instaladas."
else
    log_warn "package.json nao encontrado no diretorio raiz."
    log_warn "Crie o package.json ou ajuste o caminho."
fi

echo ""

# =============================================================================
# 4. Instala dependencias e compila o frontend
# =============================================================================
log_info "Configurando frontend..."

if [ -d frontend ] && [ -f frontend/package.json ]; then
    cd frontend
    npm install
    log_success "Dependencias do frontend instaladas."

    log_info "Compilando frontend (Vite build)..."
    npm run build
    log_success "Frontend compilado com sucesso."
    cd "$PROJECT_DIR"
else
    log_warn "Diretorio frontend/ nao encontrado ou sem package.json."
    log_warn "O frontend sera configurado posteriormente."
fi

echo ""

# =============================================================================
# 5. Executa seed do banco de dados
# =============================================================================
log_info "Executando seed do banco de dados..."

# Carrega variaveis do .env
if [ -f .env ]; then
    export $(grep -v '^#' .env | grep -v '^\s*$' | xargs)
fi

if [ -f database/seeds/seed.js ]; then
    node database/seeds/seed.js
    log_success "Seed executado com sucesso."
else
    log_warn "Arquivo de seed nao encontrado: database/seeds/seed.js"
fi

echo ""

# =============================================================================
# Resumo final
# =============================================================================
echo "========================================="
echo "  Setup concluido!"
echo "========================================="
echo ""
echo "  Proximos passos:"
echo "  1. Revise o arquivo .env"
echo "  2. Inicie o backend:   node server.js"
echo "  3. Ou use Docker:      cd docker && docker compose up -d"
echo ""
echo "  Credenciais padrao:"
echo "    Admin:  admin / Admin@2024!"
echo "    Tenant: tenant_exemplo / Tenant@2024!"
echo ""
echo "  IMPORTANTE: Troque as senhas em producao!"
echo ""
