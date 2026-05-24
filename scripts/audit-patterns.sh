#!/usr/bin/env bash
set -uo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

ROOT_DIR="$(git rev-parse --show-toplevel)"
WEB_SRC="$ROOT_DIR/web/src"
FUNC_SRC="$ROOT_DIR/functions/src"
REPORT_FILE="${ROOT_DIR}/audit-report.txt"

TOTAL_ISSUES=0
CRITICAL=0
WARNING=0

echo "═══════════════════════════════════════════"
echo "  Futeba dos Parças — Auditoria de Padrões"
echo "═══════════════════════════════════════════"
echo ""

: > "$REPORT_FILE"

report() {
  local severity="$1"
  local file="$2"
  local line="$3"
  local msg="$4"
  local code="$5"

  TOTAL_ISSUES=$((TOTAL_ISSUES + 1))
  if [ "$severity" = "CRITICAL" ]; then
    CRITICAL=$((CRITICAL + 1))
    echo -e "  ${RED}[CRITICAL]${NC} $file:$line — $msg"
  else
    WARNING=$((WARNING + 1))
    echo -e "  ${YELLOW}[WARNING]${NC}  $file:$line — $msg"
  fi
  echo "[$severity] $file:$line — $msg ($code)" >> "$REPORT_FILE"
}

check_web_pattern() {
  local label="$1"
  local severity="$2"
  local code="$3"
  local pattern="$4"
  local description="$5"

  echo -e "  ${CYAN}→${NC} $label"

  while IFS=: read -r file line content; do
    [ -z "$file" ] && continue
    report "$severity" "$file" "$line" "$description" "$code"
  done < <(cd "$ROOT_DIR" && rg --no-heading --line-number --color=never "$pattern" "web/src/" 2>/dev/null || true)
}

check_func_pattern() {
  local label="$1"
  local severity="$2"
  local code="$3"
  local pattern="$4"
  local description="$5"

  echo -e "  ${CYAN}→${NC} $label"

  while IFS=: read -r file line content; do
    [ -z "$file" ] && continue
    report "$severity" "$file" "$line" "$description" "$code"
  done < <(cd "$ROOT_DIR" && rg --no-heading --line-number --color=never "$pattern" "functions/src/" 2>/dev/null || true)
}

echo "── Web: Firebase Write Patterns ──"

check_web_pattern \
  "Timestamp.now() em código web" \
  "WARNING" "FW-001" \
  "Timestamp\.now\(\)" \
  "Use serverTimestamp() ao invés de Timestamp.now()"

check_web_pattern \
  "new Date() em hooks" \
  "WARNING" "FW-002" \
  "new Date\(\)" \
  "Possível uso de new Date() — prefira serverTimestamp() para dados Firestore"

check_web_pattern \
  "navigate(-1) em telas com delete" \
  "WARNING" "FW-003" \
  "navigate\(-1\)" \
  "navigate(-1) pode causar problemas após operações destrutivas — use navigate('/')"

check_web_pattern \
  "Cores hardcoded em sx" \
  "WARNING" "FW-004" \
  "sx=\{\{[^}]*(?:'white'|'black'|'red'|'blue'|'green'|'#[0-9a-fA-F]{3,6}')" \
  "Cores hardcoded em sx={{}} — use theme.palette.*"

echo ""
echo "── Web: Hook Patterns ──"

check_web_pattern \
  "onSnapshot sem callback de erro" \
  "WARNING" "HK-001" \
  "onSnapshot\([^,]+,\s*[^,)]+\)" \
  "onSnapshot sem 3º argumento de erro — adicione callback de erro"

check_web_pattern \
  "useEffect async sem cleanup" \
  "WARNING" "HK-002" \
  "useEffect\(\s*async\s*\(" \
  "useEffect async sem flag cancelled/AbortController — risco de state update em componente desmontado"

echo ""
echo "── Functions: Firebase Patterns ──"

check_func_pattern \
  "console.log em Cloud Functions" \
  "WARNING" "CF-001" \
  "console\.log\(" \
  "Use logger.info/warn/error ao invés de console.log em Cloud Functions"

echo ""
echo "── Cross-cutting: Secrets ──"

SECRETS_PATTERN="serviceAccountKey|private_key|-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY|firebase-adminsdk.*\.json|AIzaSy[A-Za-z0-9_-]{33}"

echo -e "  ${CYAN}→${NC} Verificando secrets em arquivos versionados"
while IFS=: read -r file line content; do
  [ -z "$file" ] && continue
  echo "$file" | grep -qE '\.(md|txt|yml|yaml)$' && continue
  echo "$file" | grep -qE '(\.env\.example|\.env\.template)' && continue
  report "CRITICAL" "$file" "$line" "Possível secret/chave exposta no código" "SEC-001"
done < <(cd "$ROOT_DIR" && rg --no-heading --line-number --color=never "$SECRETS_PATTERN" --glob '!.git' --glob '!node_modules' --glob '!*.lock' --glob '!dist/**' --glob '!lib/**' --glob '!.claude/**' . 2>/dev/null || true)

echo ""
echo "═══════════════════════════════════════════"
echo "  Resultado da Auditoria"
echo "═══════════════════════════════════════════"
echo -e "  ${RED}Critical:${NC} $CRITICAL"
echo -e "  ${YELLOW}Warning:${NC}  $WARNING"
echo -e "  Total:     $TOTAL_ISSUES"
echo ""

if [ $TOTAL_ISSUES -gt 0 ]; then
  echo "  Relatório salvo em: $REPORT_FILE"
fi

echo ""
if [ $CRITICAL -gt 0 ]; then
  echo -e "  ${RED}⚠ $CRITICAL issue(s) crítica(s) encontrada(s).${NC}"
  echo -e "  Resolva antes de mergear em produção."
  exit 1
else
  echo -e "  ${GREEN}✓ Sem issues críticas.${NC}"
  if [ $WARNING -gt 0 ]; then
    echo -e "  ${YELLOW}$WARNING warning(s) para revisão.${NC}"
  fi
  exit 0
fi
