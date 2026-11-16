#!/usr/bin/env bash
# Bateria de testes do Futeba dos Parças — um comando.
#
#   scripts/bateria/rodar.sh rapida    conferência sem emulador (roda no pre-push)
#   scripts/bateria/rodar.sh web       emuladores + seed + Playwright
#   scripts/bateria/rodar.sh android   emuladores + seed + testes instrumentados
#   scripts/bateria/rodar.sh ios       emuladores + seed + roteiro no Simulador
#   scripts/bateria/rodar.sh tudo      web, android e ios, cada um com seed novo
#   scripts/bateria/rodar.sh subir     emuladores + seed e fica no ar (uso manual)
#
# Os emuladores sobem em portas PRÓPRIAS (firebase.bateria.json), nunca nas
# padrão do firebase.json: o runner self-hosted do CI usa as padrão neste Mac.
# O projeto é sempre demo-futebadosparcas, que não alcança produção.
#
# Spec: specs/feat-2026-11-15-bateria-de-testes.md
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$RAIZ"

PROJETO="demo-futebadosparcas"
CONFIG="firebase.bateria.json"
TSX="$RAIZ/web/node_modules/.bin/tsx"
ALVO="${1:-}"

aviso() { printf '[bateria] %s\n' "$*"; }
erro() { printf '[bateria] ERRO: %s\n' "$*" >&2; exit 1; }

porta() {
  node -e "const c=require('./$CONFIG').emulators; console.log(c['$1'].port)"
}

conferir_dependencias() {
  command -v node >/dev/null || erro "node não encontrado (use mise install)."
  [ -x "$TSX" ] || erro "web/node_modules ausente. Rode: (cd web && npm ci)"
  [ -d functions/node_modules ] || erro "functions/node_modules ausente. Rode: (cd functions && npm ci)"
}

conferir_emuladores() {
  command -v firebase >/dev/null || erro "firebase-tools não encontrado no PATH."
  command -v java >/dev/null || erro "java não encontrado (os emuladores precisam de JDK 21)."
  # Os emuladores executam functions/lib: recompila se faltar ou estiver velho.
  if [ ! -f functions/lib/index.js ] ||
    [ -n "$(find functions/src -name '*.ts' -newer functions/lib/index.js -print -quit)" ]; then
    aviso "compilando Cloud Functions"
    npm --prefix functions run build >/dev/null
  fi
  local ocupadas=""
  for servico in auth firestore functions storage hub logging; do
    local p
    p="$(porta "$servico")"
    if lsof -nP -iTCP:"$p" -sTCP:LISTEN -t >/dev/null 2>&1; then
      ocupadas="$ocupadas $p"
    fi
  done
  [ -z "$ocupadas" ] || erro "porta(s) da bateria em uso:$ocupadas. Outra bateria rodando? Veja: lsof -nP -iTCP:<porta> -sTCP:LISTEN"
}

exportar_hosts() {
  export GCLOUD_PROJECT="$PROJETO"
  export FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:$(porta auth)"
  export FIRESTORE_EMULATOR_HOST="127.0.0.1:$(porta firestore)"
  export FIREBASE_STORAGE_EMULATOR_HOST="127.0.0.1:$(porta storage)"
  export FUNCTIONS_EMULATOR_HOST="127.0.0.1:$(porta functions)"
}

semear() {
  exportar_hosts
  NODE_PATH="$RAIZ/functions/node_modules" "$TSX" scripts/bateria/seed-emulador.ts --limpar
}

# Roda "$0 _dentro <alvo>" com os emuladores no ar e derruba tudo ao terminar.
com_emuladores() {
  conferir_dependencias
  conferir_emuladores
  # CPF_SALT fictício: setUserVerified exige o segredo; no emulador qualquer valor serve.
  CPF_SALT="bateria-sal-de-teste" firebase emulators:exec \
    --config "$CONFIG" --project "$PROJETO" \
    --only auth,firestore,functions,storage \
    "bash scripts/bateria/rodar.sh _dentro $1"
}

rodar_web() {
  semear
  (cd web && npx playwright test -c playwright.bateria.config.ts)
}

rodar_android() {
  semear
  bash scripts/bateria/android.sh
}

rodar_ios() {
  semear
  bash scripts/bateria/ios.sh
}

case "$ALVO" in
  rapida)
    conferir_dependencias
    NODE_PATH="$RAIZ/functions/node_modules" "$TSX" scripts/bateria/conferir.ts
    ;;
  web | android | ios | tudo)
    com_emuladores "$ALVO"
    ;;
  subir)
    conferir_dependencias
    conferir_emuladores
    aviso "emuladores + seed; Ctrl+C encerra"
    CPF_SALT="bateria-sal-de-teste" firebase emulators:exec \
      --config "$CONFIG" --project "$PROJETO" \
      --only auth,firestore,functions,storage \
      "bash scripts/bateria/rodar.sh _dentro espera"
    ;;
  _dentro)
    case "${2:-}" in
      web) rodar_web ;;
      android) rodar_android ;;
      ios) rodar_ios ;;
      tudo)
        falhas=0
        rodar_web || falhas=$((falhas + 1))
        rodar_android || falhas=$((falhas + 1))
        rodar_ios || falhas=$((falhas + 1))
        [ "$falhas" -eq 0 ] || erro "$falhas plataforma(s) com falha."
        ;;
      espera)
        semear
        aviso "no ar. Auth $(porta auth), Firestore $(porta firestore), Functions $(porta functions), Storage $(porta storage)."
        while true; do sleep 3600; done
        ;;
      *) erro "alvo interno desconhecido: ${2:-}" ;;
    esac
    ;;
  *)
    sed -n '2,10p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
    exit 2
    ;;
esac
