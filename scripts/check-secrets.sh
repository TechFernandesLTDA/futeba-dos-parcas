#!/usr/bin/env bash
set -uo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/portable-search.sh"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ROOT_DIR="$(git rev-parse --show-toplevel)"
ERRORS=0
WARNINGS=0

pass() { echo -e "  ${GREEN}✓${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; ERRORS=$((ERRORS + 1)); }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; WARNINGS=$((WARNINGS + 1)); }

echo "═══════════════════════════════════════════"
echo "  Futeba dos Parças — Verificação de Secrets"
echo "═══════════════════════════════════════════"
echo ""

echo "── Verificando secrets em arquivos versionados ──"

SECRET_PATTERNS=(
  "private_key"
  "-----BEGIN"
  "ghp_[A-Za-z0-9]{36}"
  "gho_[A-Za-z0-9]{36}"
  "xox[baprs]-[A-Za-z0-9-]+"
  "AKIA[0-9A-Z]{16}"
  "sk-[A-Za-z0-9]{48}"
)

COMBINED_PATTERN=$(IFS='|'; echo "${SECRET_PATTERNS[*]}")

ALLOWLIST=(
  "scripts/check-secrets.sh"
  "AGENTS.md"
  "CLAUDE.md"
  "prompt-qwen-validations.md"
  ".gitignore"
  ".env.example"
  ".env.template"
  "web/.env.production"
  "scripts/audit-patterns.sh"
)

FOUND=0
while IFS=: read -r file line content; do
  [ -z "$file" ] && continue

  SKIP=false
  for allow in "${ALLOWLIST[@]}"; do
    if echo "$file" | grep -qF "$allow"; then
      SKIP=true
      break
    fi
  done
  $SKIP && continue

  if echo "$content" | grep -qE '^\s*//' || echo "$content" | grep -qE '^\s*#'; then
    warn "$file:$line — Possível secret em comentário: $(echo "$content" | head -c 80)"
  else
    fail "$file:$line — SECRET ENCONTRADO: $(echo "$content" | head -c 80)"
  fi
  FOUND=$((FOUND + 1))
done < <(cd "$ROOT_DIR" && portable_search "$COMBINED_PATTERN" . 2>/dev/null || true)

if [ $FOUND -eq 0 ]; then
  pass "Nenhum secret encontrado em arquivos versionados"
fi

echo ""
echo "── Verificando .gitignore ──"

GITIGNORE="$ROOT_DIR/.gitignore"
if [ -f "$GITIGNORE" ]; then
  REQUIRED_ENTRIES=(
    ".env"
    ".env.local"
    "serviceAccountKey"
    "google-services.json"
    "*.jks"
    "*.keystore"
  )

  for entry in "${REQUIRED_ENTRIES[@]}"; do
    if grep -q "$entry" "$GITIGNORE" 2>/dev/null; then
      pass ".gitignore contém '$entry'"
    else
      fail ".gitignore NÃO contém '$entry' — adicione para proteger secrets"
    fi
  done
else
  fail ".gitignore não encontrado na raiz do projeto"
fi

echo ""
echo "── Verificando arquivos .env versionados ──"

ENV_FILES=(
  ".env"
  ".env.local"
  ".env.development.local"
  ".env.test.local"
  "web/.env"
  "web/.env.local"
  "functions/.env"
  "functions/.env.local"
)

for envfile in "${ENV_FILES[@]}"; do
  if cd "$ROOT_DIR" && git ls-files --error-unmatch "$envfile" 2>/dev/null; then
    fail "$envfile está versionado no git — remova com 'git rm --cached $envfile'"
  fi
done
pass "Nenhum arquivo .env sensível está versionado"

echo ""
echo "═══════════════════════════════════════════"
if [ $ERRORS -gt 0 ]; then
  echo -e "  ${RED}❌ CRÍTICO: $ERRORS secret(s) exposto(s)!${NC}"
  echo -e "  Remova imediatamente e rotacione as credenciais."
  echo "═══════════════════════════════════════════"
  exit 1
else
  echo -e "  ${GREEN}✅ Sem secrets expostos. $WARNINGS aviso(s).${NC}"
  echo "═══════════════════════════════════════════"
  exit 0
fi
