#!/usr/bin/env bash
# Seta os 7 GitHub Secrets necessarios para deploy-production.yml.
#
# Le inputs de:
#   ~/.android-keystores/futebadosparcas-release.jks
#   ~/.android-keystores/futebadosparcas-release.creds
#   ~/.android-keystores/play-sa.json
#   app/google-services.json (no repo, gitignored)

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

GH_REPO="TechFernandesLTDA/futeba-dos-parcas"
KEYSTORE_DIR="$HOME/.android-keystores"
KEYSTORE_FILE="$KEYSTORE_DIR/futebadosparcas-release.jks"
CREDS_FILE="$KEYSTORE_DIR/futebadosparcas-release.creds"
SA_KEY_FILE="$KEYSTORE_DIR/play-sa.json"
GOOGLE_SERVICES_FILE="app/google-services.json"

# Path onde a workflow vai salvar o keystore decodificado durante CI
KEYSTORE_PATH_RUNTIME="/tmp/release.jks"

echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  Fase 3: Setar GitHub Secrets${NC}"
echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ============================================================
# Pre-checks
# ============================================================
if ! command -v gh >/dev/null 2>&1; then
    echo -e "${RED}✗ gh CLI nao instalado${NC}"
    exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
    echo -e "${RED}✗ gh nao autenticado. Rode: gh auth login${NC}"
    exit 1
fi

# Verificar inputs
echo -e "${BOLD}Verificando arquivos de input...${NC}"
ALL_OK=true

check_file() {
    local f="$1"
    local label="$2"
    if [ -f "$f" ]; then
        echo -e "   ${GREEN}✓${NC} $label: $f"
    else
        echo -e "   ${RED}✗${NC} $label: $f ${RED}(faltando)${NC}"
        ALL_OK=false
    fi
}

check_file "$KEYSTORE_FILE" "Keystore"
check_file "$CREDS_FILE" "Credentials file"
check_file "$SA_KEY_FILE" "SA Key JSON"

# google-services.json no repo (path relativo ao root)
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
check_file "$REPO_ROOT/$GOOGLE_SERVICES_FILE" "google-services.json"

if [ "$ALL_OK" = false ]; then
    echo ""
    echo -e "${RED}Faltam arquivos. Rode os scripts anteriores:${NC}"
    echo -e "   ./01-generate-keystore.sh (cria keystore + creds)"
    echo -e "   ./02-create-play-sa.sh (cria SA JSON)"
    echo -e "   E garanta que app/google-services.json existe no repo"
    exit 1
fi

# ============================================================
# Carregar credenciais
# ============================================================
echo ""
echo -e "${BOLD}Carregando credenciais...${NC}"
# shellcheck disable=SC1090
source "$CREDS_FILE"

if [ -z "${KEY_ALIAS:-}" ] || [ -z "${STORE_PASSWORD:-}" ] || [ -z "${KEY_PASSWORD:-}" ]; then
    echo -e "${RED}✗ Credenciais incompletas em $CREDS_FILE${NC}"
    exit 1
fi
echo -e "   ${GREEN}✓${NC} alias=$KEY_ALIAS"

# ============================================================
# Encode keystore base64
# ============================================================
echo ""
echo -e "${BOLD}Encodando keystore em base64...${NC}"
KEYSTORE_BASE64=$(base64 < "$KEYSTORE_FILE" | tr -d '\n')
echo -e "   ${GREEN}✓${NC} ${#KEYSTORE_BASE64} chars"

# ============================================================
# Confirmar antes de setar
# ============================================================
echo ""
echo -e "${YELLOW}${BOLD}Vou setar os seguintes secrets em $GH_REPO:${NC}"
echo "   KEYSTORE_BASE64                     (keystore .jks codificado)"
echo "   KEYSTORE_PATH = $KEYSTORE_PATH_RUNTIME"
echo "   KEYSTORE_PASSWORD                   (oculto)"
echo "   KEY_ALIAS = $KEY_ALIAS"
echo "   KEY_PASSWORD                        (oculto)"
echo "   GOOGLE_SERVICES_JSON                (conteudo do google-services.json)"
echo "   PLAY_STORE_SERVICE_ACCOUNT_JSON     (conteudo do play-sa.json)"
echo ""
read -p "Confirma? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo -e "${RED}Abortando.${NC}"
    exit 1
fi

# ============================================================
# Setar secrets
# ============================================================
set_secret() {
    local name="$1"
    local value="$2"
    echo -n "   Setting $name... "
    if echo -n "$value" | gh secret set "$name" -R "$GH_REPO" --body - 2>/dev/null; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗ FAIL${NC}"
        exit 1
    fi
}

set_secret_from_file() {
    local name="$1"
    local file="$2"
    echo -n "   Setting $name from $file... "
    if gh secret set "$name" -R "$GH_REPO" < "$file" 2>/dev/null; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗ FAIL${NC}"
        exit 1
    fi
}

echo ""
echo -e "${BOLD}Setando secrets...${NC}"
set_secret "KEYSTORE_BASE64" "$KEYSTORE_BASE64"
set_secret "KEYSTORE_PATH" "$KEYSTORE_PATH_RUNTIME"
set_secret "KEYSTORE_PASSWORD" "$STORE_PASSWORD"
set_secret "KEY_ALIAS" "$KEY_ALIAS"
set_secret "KEY_PASSWORD" "$KEY_PASSWORD"
set_secret_from_file "GOOGLE_SERVICES_JSON" "$REPO_ROOT/$GOOGLE_SERVICES_FILE"
set_secret_from_file "PLAY_STORE_SERVICE_ACCOUNT_JSON" "$SA_KEY_FILE"

# ============================================================
# Verificar
# ============================================================
echo ""
echo -e "${BOLD}Verificando secrets configurados:${NC}"
gh secret list -R "$GH_REPO" 2>/dev/null

echo ""
echo -e "${GREEN}${BOLD}✓ Secrets setados com sucesso!${NC}"
echo ""
echo -e "${BOLD}${CYAN}Próximo passo:${NC} ./04-cadastrar-sha-firebase.sh"
