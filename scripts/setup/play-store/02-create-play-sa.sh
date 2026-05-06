#!/usr/bin/env bash
# Cria Service Account no GCP para upload de AAB pra Play Store via API.
#
# Output: ~/.android-keystores/play-sa.json (JSON da SA, chmod 600)
#
# DEPOIS DESTE SCRIPT, voce precisa:
#   1. Linkar o GCP project no Play Console (manual)
#   2. Conceder permissao "Release Manager" pra SA no Play Console (manual)

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

GCP_PROJECT="futebadosparcas"
SA_NAME="github-actions-play-deploy"
SA_DISPLAY="GitHub Actions Play Store Deploy"
SA_EMAIL="${SA_NAME}@${GCP_PROJECT}.iam.gserviceaccount.com"
KEYSTORE_DIR="$HOME/.android-keystores"
SA_KEY_FILE="$KEYSTORE_DIR/play-sa.json"

echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  Fase 2: Criar Service Account GCP${NC}"
echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ============================================================
# Pre-checks
# ============================================================
if ! command -v gcloud >/dev/null 2>&1; then
    echo -e "${RED}✗ gcloud nao instalado${NC}"
    exit 1
fi

CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null || echo "")
if [ "$CURRENT_PROJECT" != "$GCP_PROJECT" ]; then
    echo -e "${YELLOW}⚠ gcloud project atual: '$CURRENT_PROJECT'${NC}"
    read -p "Setar para '$GCP_PROJECT'? (yes/no): " SET_PROJECT
    if [ "$SET_PROJECT" = "yes" ]; then
        gcloud config set project "$GCP_PROJECT"
    else
        echo -e "${RED}Abortando.${NC}"
        exit 1
    fi
fi

mkdir -p "$KEYSTORE_DIR"
chmod 700 "$KEYSTORE_DIR"

# ============================================================
# Habilitar API
# ============================================================
echo -e "${BOLD}1) Habilitando Google Play Android Developer API...${NC}"
if gcloud services list --enabled --filter="name:androidpublisher.googleapis.com" --format="value(name)" 2>/dev/null | grep -q "androidpublisher"; then
    echo -e "   ${GREEN}✓${NC} ja habilitada"
else
    gcloud services enable androidpublisher.googleapis.com
    echo -e "   ${GREEN}✓${NC} habilitada"
fi

# ============================================================
# Criar SA (idempotente)
# ============================================================
echo ""
echo -e "${BOLD}2) Criando Service Account...${NC}"
if gcloud iam service-accounts describe "$SA_EMAIL" >/dev/null 2>&1; then
    echo -e "   ${YELLOW}⚠${NC} SA ja existe: $SA_EMAIL"
else
    gcloud iam service-accounts create "$SA_NAME" \
        --display-name="$SA_DISPLAY" \
        --description="Service account usada pelo GitHub Actions deploy-production.yml para upload de AAB no Play Store"
    echo -e "   ${GREEN}✓${NC} SA criada: $SA_EMAIL"
fi

# ============================================================
# Gerar key JSON
# ============================================================
echo ""
echo -e "${BOLD}3) Gerando JSON key...${NC}"
if [ -f "$SA_KEY_FILE" ]; then
    echo -e "   ${YELLOW}⚠${NC} Key JSON ja existe em $SA_KEY_FILE"
    read -p "Sobrescrever? (yes/no): " OVERWRITE
    if [ "$OVERWRITE" != "yes" ]; then
        echo -e "${GREEN}✓${NC} Mantendo key existente."
    else
        cp "$SA_KEY_FILE" "${SA_KEY_FILE}.backup-$(date +%s)"
        gcloud iam service-accounts keys create "$SA_KEY_FILE" \
            --iam-account="$SA_EMAIL"
        chmod 600 "$SA_KEY_FILE"
    fi
else
    gcloud iam service-accounts keys create "$SA_KEY_FILE" \
        --iam-account="$SA_EMAIL"
    chmod 600 "$SA_KEY_FILE"
fi
echo -e "   ${GREEN}✓${NC} Key salva em $SA_KEY_FILE (chmod 600)"

# ============================================================
# Print proximos passos manuais
# ============================================================
echo ""
echo -e "${GREEN}${BOLD}✓ Service Account criada com sucesso!${NC}"
echo ""
echo -e "${YELLOW}${BOLD}━━━━ AÇÃO MANUAL OBRIGATÓRIA ━━━━${NC}"
echo ""
echo -e "${BOLD}Você precisa:${NC}"
echo ""
echo -e "1. Abrir Play Console → Setup → API access:"
echo -e "   ${CYAN}https://play.google.com/console/u/0/developers/api-access${NC}"
echo ""
echo -e "2. Se ainda nao linkado, clicar em ${BOLD}'Link a Google Cloud project'${NC}"
echo -e "   e selecionar: ${BOLD}futebadosparcas${NC}"
echo ""
echo -e "3. Na lista de Service Accounts, encontrar:"
echo -e "   ${BOLD}${SA_EMAIL}${NC}"
echo ""
echo -e "4. Clicar ${BOLD}'Grant access'${NC} e setar:"
echo -e "   - App permissions: ${BOLD}Release Manager${NC} (ou superior)"
echo -e "   - Account permissions: ${BOLD}View app information${NC} (read-only suficiente)"
echo ""
echo -e "5. Salvar"
echo ""
echo -e "${YELLOW}⚠ Sem este passo manual, o deploy vai falhar com 401/403.${NC}"
echo ""
echo -e "${BOLD}${CYAN}Próximo script (depois do passo manual acima):${NC} ./03-set-github-secrets.sh"
