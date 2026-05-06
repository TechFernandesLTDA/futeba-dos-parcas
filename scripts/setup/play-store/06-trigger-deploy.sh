#!/usr/bin/env bash
# Dispara primeiro deploy de producao via deploy-production.yml.
#
# Duas opcoes:
#   A) workflow_dispatch — roda agora sem criar tag
#   B) Criar tag v* — dispara via push de tag

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

GH_REPO="TechFernandesLTDA/futeba-dos-parcas"
WORKFLOW="deploy-production.yml"

echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  Fase 6: Trigger Primeiro Deploy${NC}"
echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ============================================================
# Pre-checks
# ============================================================
if ! gh auth status >/dev/null 2>&1; then
    echo -e "${RED}✗ gh nao autenticado${NC}"
    exit 1
fi

# Verificar branch atual
BRANCH=$(git branch --show-current 2>/dev/null || echo "?")
if [ "$BRANCH" != "master" ] && [ "$BRANCH" != "main" ]; then
    echo -e "${YELLOW}⚠ Voce nao esta em master (atual: $BRANCH)${NC}"
fi

# Mostrar versao atual
CURRENT_VERSION=$(grep 'versionName =' app/build.gradle.kts | sed 's/.*versionName = "\(.*\)".*/\1/' || echo "?")
CURRENT_CODE=$(grep 'versionCode =' app/build.gradle.kts | sed 's/.*versionCode = \([0-9]*\).*/\1/' || echo "?")

echo -e "${BOLD}Versao atual no build.gradle.kts:${NC}"
echo -e "   versionName = ${BOLD}$CURRENT_VERSION${NC}"
echo -e "   versionCode = ${BOLD}$CURRENT_CODE${NC}"

# Tags existentes
echo ""
echo -e "${BOLD}Tags v* existentes (top 5):${NC}"
git tag -l 'v*' --sort=-creatordate 2>/dev/null | head -5 | sed 's/^/   /'

# Run history
echo ""
echo -e "${BOLD}Ultimas execucoes do deploy-production.yml:${NC}"
gh run list --workflow="$WORKFLOW" -L 3 -R "$GH_REPO" 2>/dev/null | head -5 | sed 's/^/   /' || echo "   (nenhuma)"

# ============================================================
# Escolher modo
# ============================================================
echo ""
echo -e "${BOLD}Modo de trigger:${NC}"
echo ""
echo "  A) ${BOLD}workflow_dispatch${NC} (roda agora, sem criar tag)"
echo "     Usa o codigo do branch atual ($BRANCH). Nao cria release no GitHub."
echo "     Bom pra TESTAR o pipeline."
echo ""
echo "  B) ${BOLD}Criar tag nova${NC} (versao $CURRENT_VERSION ja existe? checar)"
echo "     Cria tag v$CURRENT_VERSION e push → dispara deploy + GitHub release."
echo "     Use quando estiver pronto pro release oficial."
echo ""
echo "  C) ${BOLD}Cancelar${NC}"
echo ""
read -p "Escolha (A/B/C): " MODE

case "$MODE" in
    A|a)
        echo ""
        echo -e "${BOLD}Disparando workflow_dispatch...${NC}"
        if gh workflow run "$WORKFLOW" -R "$GH_REPO" --ref "$BRANCH"; then
            sleep 3
            RUN_ID=$(gh run list --workflow="$WORKFLOW" -L 1 -R "$GH_REPO" --json databaseId --jq '.[0].databaseId')
            RUN_URL="https://github.com/$GH_REPO/actions/runs/$RUN_ID"
            echo -e "${GREEN}✓ Disparado${NC}"
            echo ""
            echo -e "${BOLD}Acompanhar:${NC}"
            echo "   $RUN_URL"
            echo ""
            echo "   Ou via CLI:"
            echo "   gh run watch $RUN_ID -R $GH_REPO"
        else
            echo -e "${RED}✗ Falhou${NC}"
            exit 1
        fi
        ;;
    B|b)
        TAG="v$CURRENT_VERSION"
        if git tag -l "$TAG" | grep -q "$TAG"; then
            echo ""
            echo -e "${YELLOW}⚠ Tag $TAG ja existe localmente${NC}"
            read -p "   Deletar e recriar? Pode quebrar releases existentes. (yes/no): " RECREATE
            if [ "$RECREATE" != "yes" ]; then
                echo -e "${RED}Abortando.${NC} Bump versao no build.gradle.kts primeiro."
                exit 1
            fi
            git tag -d "$TAG"
            git push origin --delete "$TAG" 2>/dev/null || true
        fi

        echo ""
        echo -e "${BOLD}Criando tag $TAG e push...${NC}"
        read -p "Confirma? Vai disparar deploy real. (yes/no): " CONFIRM
        if [ "$CONFIRM" != "yes" ]; then
            echo -e "${RED}Abortando.${NC}"
            exit 1
        fi

        git tag -a "$TAG" -m "Release $TAG"
        git push origin "$TAG"
        echo -e "${GREEN}✓ Tag $TAG criada e pushed${NC}"
        echo ""
        echo -e "${BOLD}Acompanhar:${NC}"
        echo "   https://github.com/$GH_REPO/actions/workflows/$WORKFLOW"
        ;;
    C|c|*)
        echo -e "${RED}Cancelado.${NC}"
        exit 0
        ;;
esac

echo ""
echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Pos-deploy:${NC}"
echo "   1. Aguardar build + upload (~10-15min)"
echo "   2. Conferir Play Console: https://play.google.com/console"
echo "      Internal Testing track deve mostrar nova versao"
echo "   3. Promover pra production manualmente:"
echo "      bundle exec fastlane production"
echo "      (faz staged rollout 10%)"
echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
