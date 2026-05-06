#!/usr/bin/env bash
# Mostra overview e checklist do setup Play Store pipeline.
# Read-only — não muda nada.

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  Play Store Pipeline Setup — Overview${NC}"
echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BOLD}Spec:${NC} specs/feat-2026-05-06-activate-play-store-pipeline.md"
echo -e "${BOLD}README:${NC} scripts/setup/play-store/README.md"
echo ""

# ============================================================
# Verificar tools
# ============================================================
echo -e "${BOLD}1) Tools necessárias:${NC}"
check_tool() {
    local name="$1"
    local cmd="$2"
    if command -v "$cmd" >/dev/null 2>&1; then
        echo -e "   ${GREEN}✓${NC} $name ($(command -v "$cmd"))"
    else
        echo -e "   ${RED}✗${NC} $name — instalar antes de prosseguir"
    fi
}
check_tool "gh CLI" gh
check_tool "firebase CLI" firebase
check_tool "gcloud CLI" gcloud
check_tool "keytool" keytool
check_tool "base64" base64

echo ""
echo -e "${BOLD}2) Auth status:${NC}"

# gh
if gh auth status >/dev/null 2>&1; then
    GH_USER=$(gh api user --jq .login 2>/dev/null || echo "?")
    echo -e "   ${GREEN}✓${NC} gh: logged in ($GH_USER)"
else
    echo -e "   ${RED}✗${NC} gh: NOT logged in — rode: gh auth login"
fi

# firebase
if firebase login:list 2>&1 | grep -q "Logged in as"; then
    FB_USER=$(firebase login:list 2>&1 | grep -oE '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+' | head -1)
    echo -e "   ${GREEN}✓${NC} firebase: logged in ($FB_USER)"
else
    echo -e "   ${RED}✗${NC} firebase: NOT logged in — rode: firebase login"
fi

# gcloud
GCLOUD_ACCOUNT=$(gcloud config get-value account 2>/dev/null || echo "")
if [ -n "$GCLOUD_ACCOUNT" ] && [ "$GCLOUD_ACCOUNT" != "(unset)" ]; then
    echo -e "   ${GREEN}✓${NC} gcloud: logged in ($GCLOUD_ACCOUNT)"
    GCLOUD_PROJECT=$(gcloud config get-value project 2>/dev/null || echo "")
    if [ "$GCLOUD_PROJECT" = "futebadosparcas" ]; then
        echo -e "   ${GREEN}✓${NC} gcloud project: futebadosparcas"
    else
        echo -e "   ${YELLOW}⚠${NC} gcloud project: $GCLOUD_PROJECT (esperado: futebadosparcas)"
        echo -e "       rode: gcloud config set project futebadosparcas"
    fi
else
    echo -e "   ${RED}✗${NC} gcloud: NOT logged in — rode: gcloud auth login"
fi

echo ""
echo -e "${BOLD}3) GitHub Secrets atuais:${NC}"
SECRETS=$(gh secret list -R TechFernandesLTDA/futeba-dos-parcas 2>/dev/null | awk '{print $1}' | grep -v '^NAME$' || echo "")
EXPECTED=("KEYSTORE_BASE64" "KEYSTORE_PATH" "KEYSTORE_PASSWORD" "KEY_ALIAS" "KEY_PASSWORD" "GOOGLE_SERVICES_JSON" "PLAY_STORE_SERVICE_ACCOUNT_JSON")
for sec in "${EXPECTED[@]}"; do
    if echo "$SECRETS" | grep -q "^${sec}$"; then
        echo -e "   ${GREEN}✓${NC} $sec"
    else
        echo -e "   ${RED}✗${NC} $sec (não setado)"
    fi
done

echo ""
echo -e "${BOLD}4) URLs que você vai precisar:${NC}"
echo "   Play Console:        https://play.google.com/console/u/0/developers"
echo "   Play API access:     https://play.google.com/console/u/0/developers/api-access"
echo "   GCP IAM:             https://console.cloud.google.com/iam-admin/iam?project=futebadosparcas"
echo "   GCP Service Accounts: https://console.cloud.google.com/iam-admin/serviceaccounts?project=futebadosparcas"
echo "   Firebase Settings:   https://console.firebase.google.com/project/futebadosparcas/settings/general"
echo "   GH Actions:          https://github.com/TechFernandesLTDA/futeba-dos-parcas/actions/workflows/deploy-production.yml"

echo ""
echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  Próximo passo:${NC} ./01-generate-keystore.sh"
echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
