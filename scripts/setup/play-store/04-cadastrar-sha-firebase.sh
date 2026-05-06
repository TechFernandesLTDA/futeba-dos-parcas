#!/usr/bin/env bash
# Cadastra SHA-1 do keystore release no Firebase via gcloud.
#
# Resolve memory pendente: project_play_store_sha_release.md
#
# IMPORTANTE: Este script cadastra o SHA-1 do UPLOAD KEY (local).
# Para o APP SIGNING KEY (gerenciado pelo Play Console), voce
# precisa pegar manualmente em Play Console → Setup → App integrity
# e cadastrar pela UI do Firebase.

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

KEYSTORE_DIR="$HOME/.android-keystores"
KEYSTORE_FILE="$KEYSTORE_DIR/futebadosparcas-release.jks"
CREDS_FILE="$KEYSTORE_DIR/futebadosparcas-release.creds"
FIREBASE_PROJECT="futebadosparcas"
FIREBASE_ANDROID_APP_ID="1:490094091078:android:4acb28d78734931db5a347"

echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  Fase 4: Cadastrar SHA-1 no Firebase${NC}"
echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ============================================================
# Pre-checks
# ============================================================
if [ ! -f "$KEYSTORE_FILE" ] || [ ! -f "$CREDS_FILE" ]; then
    echo -e "${RED}✗ Keystore ou creds faltando. Rode 01-generate-keystore.sh primeiro.${NC}"
    exit 1
fi

# shellcheck disable=SC1090
source "$CREDS_FILE"

# ============================================================
# Extrair SHA-1 do keystore upload
# ============================================================
echo -e "${BOLD}1) SHA-1 do upload key (keystore local):${NC}"
SHA1_UPLOAD=$(keytool -list -v \
    -keystore "$KEYSTORE_FILE" \
    -alias "$KEY_ALIAS" \
    -storepass "$STORE_PASSWORD" 2>/dev/null | grep "SHA1:" | head -1 | awk '{print $2}')
SHA256_UPLOAD=$(keytool -list -v \
    -keystore "$KEYSTORE_FILE" \
    -alias "$KEY_ALIAS" \
    -storepass "$STORE_PASSWORD" 2>/dev/null | grep "SHA256:" | head -1 | awk '{print $2}')

echo -e "   SHA-1:   ${BOLD}$SHA1_UPLOAD${NC}"
echo -e "   SHA-256: $SHA256_UPLOAD"

# ============================================================
# Cadastrar SHA-1 do upload key via firebase CLI
# ============================================================
echo ""
echo -e "${BOLD}2) Cadastrando SHA-1 do upload key no Firebase...${NC}"
read -p "Cadastrar SHA-1 do UPLOAD KEY agora? (yes/no): " CADASTRAR
if [ "$CADASTRAR" = "yes" ]; then
    if firebase apps:android:sha:create "$FIREBASE_ANDROID_APP_ID" "$SHA1_UPLOAD" \
        --project "$FIREBASE_PROJECT" 2>&1 | tee /tmp/firebase-sha-output.log; then
        echo -e "   ${GREEN}✓${NC} SHA-1 upload key cadastrado"
    else
        if grep -q "ALREADY_EXISTS" /tmp/firebase-sha-output.log 2>/dev/null; then
            echo -e "   ${YELLOW}⚠${NC} SHA-1 ja estava cadastrado"
        else
            echo -e "   ${RED}✗${NC} Falha ao cadastrar"
            exit 1
        fi
    fi
fi

# ============================================================
# Aviso sobre App Signing key
# ============================================================
echo ""
echo -e "${YELLOW}${BOLD}━━━━ AÇÃO MANUAL: SHA-1 do APP SIGNING KEY ━━━━${NC}"
echo ""
echo -e "${BOLD}Por que isso importa:${NC}"
echo "   Phone Auth (verificarPhoneNumber) usa o SHA-1 que o Play Store usa"
echo "   para assinar o APK final entregue ao usuario. Quando Play App Signing"
echo "   esta ativo, esse SHA-1 e DIFERENTE do upload key local."
echo ""
echo -e "${BOLD}Como pegar:${NC}"
echo "   1. Abrir Play Console:"
echo -e "      ${CYAN}https://play.google.com/console/u/0/developers/$(echo $FIREBASE_PROJECT | head -c 0)${NC}"
echo "   2. Selecionar app 'Futeba dos Parças'"
echo "   3. Setup → App integrity → tab 'App Signing'"
echo "   4. Copiar o ${BOLD}SHA-1 certificate fingerprint${NC} (NAO o upload key)"
echo ""
echo -e "${BOLD}Como cadastrar:${NC}"
echo "   Opcao A (UI Firebase Console):"
echo -e "      ${CYAN}https://console.firebase.google.com/project/$FIREBASE_PROJECT/settings/general${NC}"
echo "      Your apps → Android com.futebadosparcas → Add fingerprint"
echo ""
echo "   Opcao B (CLI, se voce ja tem o SHA-1):"
echo "      firebase apps:android:sha:create $FIREBASE_ANDROID_APP_ID <SHA1_DO_APP_SIGNING_KEY> --project $FIREBASE_PROJECT"
echo ""
echo -e "${BOLD}Depois de cadastrar:${NC}"
echo "   1. Re-baixar google-services.json no Firebase Console (Settings → Your apps → Android → Download)"
echo "   2. Substituir app/google-services.json no repo"
echo "   3. Re-rodar 03-set-github-secrets.sh para atualizar secret GOOGLE_SERVICES_JSON"
echo ""
echo -e "${BOLD}${CYAN}Próximo passo:${NC} ./05-validate.sh"
