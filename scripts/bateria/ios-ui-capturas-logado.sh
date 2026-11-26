#!/usr/bin/env bash
# QA visual do iOS (#4432/#4431) — telas que exigem sessão: Perfil e Exclusão.
#
# Sobe o Firebase Emulator Suite da bateria (contas semeadas), roda o XCUITest
# `LoggedInScreensUITests` com o app em modo bateria e extrai as capturas.
# Nada toca produção: o projeto é `demo-futebadosparcas` (ver firebase.bateria.json).
#
# Uso:
#   scripts/bateria/ios-ui-capturas-logado.sh ["Futeba SE"]
#
# Pré-requisitos: firebase-tools, java 21, JDK e o framework KMP (o script linka).
# O roteiro de exclusão NÃO confirma a exclusão: só abre a tela e captura.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$RAIZ"

DISPOSITIVO="${1:-Futeba SE}"
SAIDA="${SAIDA:-/tmp/futeba-qa-ios-logado}"
DERIVADOS="$RAIZ/build/bateria-ios-ui-logado"
CONTA="${CONTA:-jogador05}"
SENHA="${SENHA:-Bateria#2026}"

aviso() { printf '[qa-ios-logado] %s\n' "$*"; }
erro() { printf '[qa-ios-logado] ERRO: %s\n' "$*" >&2; exit 1; }

command -v xcodebuild >/dev/null || erro "xcodebuild ausente."
command -v xcodegen >/dev/null || erro "xcodegen ausente (brew install xcodegen)."
command -v firebase >/dev/null || erro "firebase-tools ausente."
[ -f iosApp/iosApp/GoogleService-Info.plist ] ||
  erro "iosApp/iosApp/GoogleService-Info.plist ausente (só existe para o app compilar)."

mkdir -p "$SAIDA"

porta() {
  node -e "const c=require('./firebase.bateria.json').emulators; console.log(c['$1'].port)"
}
PORTA_AUTH="$(porta auth)"
PORTA_FIRESTORE="$(porta firestore)"
PORTA_FUNCTIONS="$(porta functions)"
PORTA_STORAGE="$(porta storage)"

# 1. Emuladores + seed (o `subir` fica no ar; matamos no fim).
if ! curl -fsS "http://127.0.0.1:$PORTA_FIRESTORE/" >/dev/null 2>&1; then
  aviso "subindo emuladores + seed"
  nohup ./scripts/bateria/rodar.sh subir > "$SAIDA/bateria.log" 2>&1 &
  for _ in $(seq 1 90); do
    grep -q "no ar" "$SAIDA/bateria.log" 2>/dev/null && break
    sleep 2
  done
  grep -q "no ar" "$SAIDA/bateria.log" || {
    tail -20 "$SAIDA/bateria.log" >&2
    erro "os emuladores não subiram (veja $SAIDA/bateria.log)"
  }
  SUBIU_AQUI=1
else
  aviso "emuladores já estavam no ar"
  SUBIU_AQUI=0
fi

limpar() {
  if [ "${SUBIU_AQUI:-0}" = "1" ]; then
    aviso "parando emuladores"
    pkill -f "firebase.*emulators" 2>/dev/null || true
  fi
}
trap limpar EXIT

# 2. Projeto + Pods + framework.
(cd iosApp && xcodegen generate >/dev/null)
(cd iosApp && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install --no-repo-update >/dev/null)
./gradlew --max-workers=3 :composeApp:linkDebugFrameworkIosSimulatorArm64 -q

ID_DISPOSITIVO="$(xcrun simctl list devices available |
  awk -v nome="$DISPOSITIVO" '$0 ~ nome && /\([0-9A-F-]{36}\)/ { match($0, /[0-9A-F-]{36}/); print substr($0, RSTART, RLENGTH); exit }')"
[ -n "$ID_DISPOSITIVO" ] || erro "simulador \"$DISPOSITIVO\" não encontrado"
xcrun simctl boot "$ID_DISPOSITIVO" 2>/dev/null || true

# 3. Teste com o app em modo bateria (o xcodebuild herda este ambiente e o
#    teste repassa ao app via launchEnvironment).
RESULTADO="$SAIDA/logado.xcresult"
rm -rf "$RESULTADO" "$SAIDA/capturas"
mkdir -p "$SAIDA/capturas"

aviso "rodando o teste (conta $CONTA)"
# O xcodebuild só entrega ao runner as variáveis com o prefixo TEST_RUNNER_
# (ele remove o prefixo). Sem isso o teste não vê o modo bateria e é pulado.
TEST_RUNNER_FUTEBA_BATERIA=1 \
TEST_RUNNER_FUTEBA_BATERIA_HOST=127.0.0.1 \
TEST_RUNNER_FUTEBA_BATERIA_PORTA_AUTH="$PORTA_AUTH" \
TEST_RUNNER_FUTEBA_BATERIA_PORTA_FIRESTORE="$PORTA_FIRESTORE" \
TEST_RUNNER_FUTEBA_BATERIA_PORTA_FUNCTIONS="$PORTA_FUNCTIONS" \
TEST_RUNNER_FUTEBA_BATERIA_PORTA_STORAGE="$PORTA_STORAGE" \
TEST_RUNNER_FUTEBA_BATERIA_EMAIL="${CONTA}@bateria.futeba.test" \
TEST_RUNNER_FUTEBA_BATERIA_SENHA="$SENHA" \
xcodebuild test \
  -workspace iosApp/iosApp.xcworkspace \
  -scheme iosAppUITests \
  -only-testing:iosAppUITests/LoggedInScreensUITests \
  -destination "platform=iOS Simulator,id=$ID_DISPOSITIVO" \
  -configuration Debug \
  -derivedDataPath "$DERIVADOS" \
  -resultBundlePath "$RESULTADO" \
  CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=NO \
  >"$SAIDA/logado.log" 2>&1 || aviso "o teste falhou (veja $SAIDA/logado.log)"

xcrun xcresulttool export attachments --path "$RESULTADO" \
  --output-path "$SAIDA/capturas" >/dev/null 2>&1 ||
  aviso "aviso: xcresulttool export attachments falhou"

aviso "concluído. Capturas:"
find "$SAIDA/capturas" -name '*.png' | sort | sed 's/^/  /'
