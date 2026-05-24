#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0
WARNINGS=0
ROOT_DIR="$(git rev-parse --show-toplevel)"

pass() { echo -e "  ${GREEN}✓${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; ERRORS=$((ERRORS + 1)); }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; WARNINGS=$((WARNINGS + 1)); }

echo "═══════════════════════════════════════════"
echo "  Futeba dos Parças — Validação Pre-Push"
echo "═══════════════════════════════════════════"
echo ""

CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "detached")
if [ "$CURRENT_BRANCH" = "master" ]; then
  fail "Push direto a 'master' é BLOQUEADO. Use uma branch e abra PR."
  echo -e "\n${RED}❌ Validação falhou ($ERRORS erro(s)). Push abortado.${NC}"
  exit 1
fi
pass "Branch não é master ($CURRENT_BRANCH)"

if command -v node &>/dev/null && [ -f "$ROOT_DIR/web/package.json" ]; then
  NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VERSION" -lt 20 ]; then
    fail "Node.js v20+ necessário (atual: $(node -v))"
  else
    pass "Node.js $(node -v)"
  fi
fi

echo ""
echo "── Web: TypeScript ──"
if [ -d "$ROOT_DIR/web" ]; then
  if (cd "$ROOT_DIR/web" && npx tsc --noEmit --project tsconfig.dev.json 2>&1); then
    pass "TypeScript compila sem erros"
  else
    fail "TypeScript com erros de compilação (web/)"
  fi
fi

echo ""
echo "── Web: ESLint ──"
if [ -d "$ROOT_DIR/web" ]; then
  if (cd "$ROOT_DIR/web" && npm run lint 2>&1); then
    pass "ESLint sem erros"
  else
    fail "ESLint com erros (web/)"
  fi
fi

echo ""
echo "── Functions: TypeScript Build ──"
if [ -d "$ROOT_DIR/functions" ]; then
  if (cd "$ROOT_DIR/functions" && npm run build 2>&1); then
    pass "Functions compila sem erros"
  else
    fail "Functions com erros de compilação (functions/)"
  fi
fi

echo ""
echo "── Functions: ESLint ──"
if [ -d "$ROOT_DIR/functions" ]; then
  if (cd "$ROOT_DIR/functions" && npm run lint 2>&1); then
    pass "ESLint sem erros"
  else
    fail "ESLint com erros (functions/)"
  fi
fi

echo ""
echo "── Commit Messages ──"
LAST_COMMIT=$(git log -1 --format=%s 2>/dev/null || echo "")
if [ -n "$LAST_COMMIT" ]; then
  if npx --no -- commitlint --last 2>/dev/null; then
    pass "Último commit segue Conventional Commits"
  else
    warn "Último commit não segue Conventional Commits: '$LAST_COMMIT'"
  fi
fi

echo ""
echo "═══════════════════════════════════════════"
if [ $ERRORS -gt 0 ]; then
  echo -e "  ${RED}❌ Falhou: $ERRORS erro(s), $WARNINGS aviso(s)${NC}"
  echo -e "  Corrija os erros acima antes de fazer push."
  echo "═══════════════════════════════════════════"
  exit 1
else
  echo -e "  ${GREEN}✅ Aprovado: 0 erros, $WARNINGS aviso(s)${NC}"
  echo "═══════════════════════════════════════════"
  exit 0
fi
