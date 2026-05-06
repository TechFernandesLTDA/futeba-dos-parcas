#!/usr/bin/env bash
# Smoke test final: roda bundleRelease local + verifica todos os secrets + lista checklist.
#
# Read-only (so checagem). Nao muda nada.

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
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")

PASS=0
FAIL=0
WARN=0

ok()    { echo -e "   ${GREEN}✓${NC} $1"; PASS=$((PASS+1)); }
fail()  { echo -e "   ${RED}✗${NC} $1"; FAIL=$((FAIL+1)); }
warn()  { echo -e "   ${YELLOW}⚠${NC} $1"; WARN=$((WARN+1)); }

echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  Fase 5: Validação${NC}"
echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ============================================================
# 1) Local files
# ============================================================
echo -e "${BOLD}1) Arquivos locais:${NC}"
[ -f "$KEYSTORE_FILE" ] && ok "Keystore: $KEYSTORE_FILE" || fail "Keystore faltando"
[ -f "$CREDS_FILE" ]    && ok "Creds: $CREDS_FILE"       || fail "Creds faltando"
[ -f "$SA_KEY_FILE" ]   && ok "SA JSON: $SA_KEY_FILE"     || fail "SA JSON faltando"
[ -f "$REPO_ROOT/app/google-services.json" ] && ok "google-services.json no repo" || fail "google-services.json faltando"

# ============================================================
# 2) GitHub Secrets
# ============================================================
echo ""
echo -e "${BOLD}2) GitHub Secrets:${NC}"
SECRETS=$(gh secret list -R "$GH_REPO" 2>/dev/null | awk '{print $1}' | grep -v '^NAME$' || echo "")
EXPECTED=("KEYSTORE_BASE64" "KEYSTORE_PATH" "KEYSTORE_PASSWORD" "KEY_ALIAS" "KEY_PASSWORD" "GOOGLE_SERVICES_JSON" "PLAY_STORE_SERVICE_ACCOUNT_JSON")
for sec in "${EXPECTED[@]}"; do
    if echo "$SECRETS" | grep -q "^${sec}$"; then
        ok "$sec"
    else
        fail "$sec faltando"
    fi
done

# ============================================================
# 3) Local build smoke test (opcional)
# ============================================================
echo ""
echo -e "${BOLD}3) Smoke test local (bundleRelease):${NC}"
read -p "   Rodar ./gradlew bundleRelease agora? Demora ~3-5min. (yes/no): " RUN_BUILD
if [ "$RUN_BUILD" = "yes" ]; then
    # Salvar local.properties original
    cd "$REPO_ROOT"
    LOCAL_PROPS="local.properties"
    BACKUP_PROPS="local.properties.before-validate"
    [ -f "$LOCAL_PROPS" ] && cp "$LOCAL_PROPS" "$BACKUP_PROPS"

    # shellcheck disable=SC1090
    source "$CREDS_FILE"
    cat > "$LOCAL_PROPS" <<EOF
sdk.dir=${ANDROID_SDK_ROOT:-/opt/homebrew/share/android-commandlinetools}
STORE_FILE=$KEYSTORE_FILE
STORE_PASSWORD=$STORE_PASSWORD
KEY_ALIAS=$KEY_ALIAS
KEY_PASSWORD=$KEY_PASSWORD
EOF

    if ./gradlew bundleRelease 2>&1 | tail -20; then
        AAB="app/build/outputs/bundle/release/app-release.aab"
        if [ -f "$AAB" ]; then
            ok "AAB gerado: $AAB ($(du -h "$AAB" | awk '{print $1}'))"
        else
            fail "Build OK mas AAB nao encontrado"
        fi
    else
        fail "Build falhou"
    fi

    # Restaurar local.properties
    [ -f "$BACKUP_PROPS" ] && mv "$BACKUP_PROPS" "$LOCAL_PROPS" || rm -f "$LOCAL_PROPS"
else
    warn "Pulando smoke test (recomendado rodar antes do primeiro deploy)"
fi

# ============================================================
# 4) Checklist manual (nao testavel via CLI)
# ============================================================
echo ""
echo -e "${BOLD}4) Checklist manual (voce confirmou?):${NC}"
echo "   [ ] Play Console tem app com.futebadosparcas com pelo menos 1 release"
echo "   [ ] Play Console → API access → SA 'github-actions-play-deploy' tem 'Release Manager'"
echo "   [ ] Firebase Console → Settings → SHA-1 do App Signing key cadastrado"
echo "   [ ] (se aplicavel) google-services.json re-baixado e substituido apos cadastrar SHA-1"

# ============================================================
# Summary
# ============================================================
echo ""
echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ "$FAIL" -eq 0 ]; then
    echo -e "${GREEN}${BOLD}✓ ALL CHECKS PASSED${NC} ($PASS passed, $WARN warnings)"
    echo ""
    echo -e "${BOLD}${CYAN}Próximo passo:${NC} ./06-trigger-deploy.sh"
else
    echo -e "${RED}${BOLD}✗ FAILED${NC} ($FAIL fail, $WARN warnings, $PASS passed)"
    echo ""
    echo -e "Resolva os ✗ antes de prosseguir."
fi
echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
