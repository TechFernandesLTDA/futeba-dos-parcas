#!/usr/bin/env bash
# Gera keystore release para o Futeba dos Parças.
#
# ⚠️ IRREVERSÍVEL: se o app ja tem release no Play Store assinado com
# keystore antigo, perdemos controle do app a menos que Play App Signing
# esteja ativo. Leia o README antes de rodar.

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
KEY_ALIAS="futebadosparcas"
APPLICATION_ID="com.futebadosparcas"

echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  Fase 1: Gerar Keystore Release${NC}"
echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ============================================================
# Aviso CRÍTICO
# ============================================================
echo -e "${RED}${BOLD}⚠️  AVISO CRÍTICO ⚠️${NC}"
echo ""
echo -e "Se o app ${BOLD}com.futebadosparcas${NC} já está publicado no Play Store"
echo -e "com um keystore antigo, ${RED}NÃO${NC} gere um novo SEM CONFIRMAR uma destas opções:"
echo ""
echo -e "  ${BOLD}A)${NC} Recuperar o .jks original (verificar Drive, 1Password, etc)"
echo -e "  ${BOLD}B)${NC} Confirmar que ${BOLD}Play App Signing${NC} está ATIVO no Play Console"
echo -e "     (https://play.google.com/console → Setup → App integrity)"
echo -e "     Se ativo, Google gerencia a assinatura final e podemos resetar o upload key"
echo ""
read -p "$(echo -e "${BOLD}Você confirma uma das opções acima OU é primeiro release? (yes/no):${NC} ") " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo -e "${RED}Abortando.${NC} Recupere o keystore original ou ative Play App Signing antes."
    exit 1
fi

echo ""

# ============================================================
# Detectar keystore existente
# ============================================================
if [ -f "$KEYSTORE_FILE" ]; then
    echo -e "${YELLOW}⚠ Keystore já existe em $KEYSTORE_FILE${NC}"
    read -p "Sobrescrever? Vai PERDER o anterior. (yes/no): " OVERWRITE
    if [ "$OVERWRITE" != "yes" ]; then
        echo -e "${GREEN}✓${NC} Mantendo keystore existente."
        echo ""
        echo "Detalhes do keystore atual:"
        keytool -list -v -keystore "$KEYSTORE_FILE" -alias "$KEY_ALIAS" 2>&1 | grep -E 'Owner:|SHA1:|SHA256:|Valid' || true
        exit 0
    fi
    cp "$KEYSTORE_FILE" "${KEYSTORE_FILE}.backup-$(date +%s)"
    echo -e "${YELLOW}Backup criado: ${KEYSTORE_FILE}.backup-$(date +%s)${NC}"
fi

# ============================================================
# Coletar dados
# ============================================================
mkdir -p "$KEYSTORE_DIR"
chmod 700 "$KEYSTORE_DIR"

echo -e "${BOLD}Dados pro keystore:${NC}"
echo ""
read -p "Nome completo (CN, ex: Renan Locatiz Fernandes): " CN
read -p "Organização (O, ex: TechFernandesLTDA): " O
read -p "Cidade (L, ex: Sao Paulo): " L
read -p "Estado (ST, ex: SP): " ST
read -p "País (C, 2 letras, ex: BR): " C

echo ""
echo -e "${BOLD}Senhas (NÃO use a mesma do seu Google):${NC}"
echo "  - Recomendado: gerar uma random com: openssl rand -base64 32"
echo ""

# Senha do store
while true; do
    read -s -p "Senha do KEYSTORE (mínimo 6 chars): " STORE_PASSWORD; echo
    if [ ${#STORE_PASSWORD} -lt 6 ]; then
        echo -e "${RED}Mínimo 6 chars.${NC}"
        continue
    fi
    read -s -p "Confirme a senha do KEYSTORE: " STORE_PASSWORD2; echo
    if [ "$STORE_PASSWORD" = "$STORE_PASSWORD2" ]; then
        break
    fi
    echo -e "${RED}Não confere.${NC}"
done

# Senha da key (pode ser igual)
echo ""
read -p "Senha da KEY pode ser a mesma do KEYSTORE? (yes/no): " SAME
if [ "$SAME" = "yes" ]; then
    KEY_PASSWORD="$STORE_PASSWORD"
else
    while true; do
        read -s -p "Senha da KEY (mínimo 6 chars): " KEY_PASSWORD; echo
        if [ ${#KEY_PASSWORD} -lt 6 ]; then
            echo -e "${RED}Mínimo 6 chars.${NC}"
            continue
        fi
        read -s -p "Confirme a senha da KEY: " KEY_PASSWORD2; echo
        if [ "$KEY_PASSWORD" = "$KEY_PASSWORD2" ]; then
            break
        fi
        echo -e "${RED}Não confere.${NC}"
    done
fi

# ============================================================
# Gerar keystore
# ============================================================
DNAME="CN=$CN, O=$O, L=$L, ST=$ST, C=$C"
echo ""
echo -e "${BOLD}Gerando keystore...${NC}"
keytool -genkeypair \
    -v \
    -keystore "$KEYSTORE_FILE" \
    -alias "$KEY_ALIAS" \
    -keyalg RSA \
    -keysize 4096 \
    -validity 36500 \
    -storepass "$STORE_PASSWORD" \
    -keypass "$KEY_PASSWORD" \
    -dname "$DNAME" 2>&1 | grep -v "Warning" || true

# ============================================================
# Salvar credenciais
# ============================================================
cat > "$CREDS_FILE" <<EOF
# Keystore credentials para com.futebadosparcas
# Gerado em $(date)
# CHMOD 600 — só você lê
KEYSTORE_FILE=$KEYSTORE_FILE
KEY_ALIAS=$KEY_ALIAS
STORE_PASSWORD=$STORE_PASSWORD
KEY_PASSWORD=$KEY_PASSWORD
DNAME=$DNAME
EOF
chmod 600 "$CREDS_FILE"
chmod 600 "$KEYSTORE_FILE"

# ============================================================
# Mostrar fingerprints
# ============================================================
echo ""
echo -e "${GREEN}${BOLD}✓ Keystore gerado com sucesso!${NC}"
echo ""
echo -e "${BOLD}Fingerprints (anote pra Fase 4):${NC}"
keytool -list -v \
    -keystore "$KEYSTORE_FILE" \
    -alias "$KEY_ALIAS" \
    -storepass "$STORE_PASSWORD" 2>/dev/null | grep -E 'SHA1:|SHA256:'

echo ""
echo -e "${BOLD}Arquivos criados:${NC}"
echo "  Keystore:    $KEYSTORE_FILE"
echo "  Credenciais: $CREDS_FILE"
echo ""
echo -e "${YELLOW}${BOLD}⚠ FAÇA BACKUP do keystore + credenciais em local seguro!${NC}"
echo "  Sugestão: 1Password, GPG-encrypted backup, etc."
echo "  Se perder, perde controle do app no Play Store"
echo "  (a menos que Play App Signing esteja ATIVO)"
echo ""
echo -e "${BOLD}${CYAN}Próximo passo:${NC} ./02-create-play-sa.sh"
