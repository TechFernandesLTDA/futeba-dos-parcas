#!/usr/bin/env bash
# QA visual do iOS (#4432) — capturas de Welcome, Permissões e Login em claro,
# escuro e accessibility-extra-large (AX3), sem precisar clicar à mão.
#
# Por que XCUITest: `xcrun simctl` não tem comando de toque. O teste
# `iosAppUITests/ScreenCaptureUITests.swift` abre o app, avança as telas e anexa
# uma captura por tela ao `.xcresult`; este script roda o teste em cada modo e
# extrai os PNGs.
#
# Uso:
#   scripts/bateria/ios-ui-capturas.sh                 # simulador padrão (Futeba SE)
#   scripts/bateria/ios-ui-capturas.sh "iPhone 18 Pro" # outro simulador
#   SAIDA=/tmp/x scripts/bateria/ios-ui-capturas.sh    # diretório de saída
#
# Limite: Perfil e Exclusão de conta exigem login real (issue #4431).
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$RAIZ"

DISPOSITIVO="${1:-Futeba SE}"
SAIDA="${SAIDA:-/tmp/futeba-qa-ios}"
DERIVADOS="${BATERIA_IOS_DERIVADOS:-$RAIZ/build/bateria-ios-ui}"

aviso() { printf '[qa-ios] %s\n' "$*"; }
erro() { printf '[qa-ios] ERRO: %s\n' "$*" >&2; exit 1; }

command -v xcodebuild >/dev/null || erro "xcodebuild não encontrado (instale o Xcode)."
command -v xcodegen >/dev/null || erro "xcodegen não encontrado (brew install xcodegen)."

[ -f iosApp/iosApp/GoogleService-Info.plist ] ||
  erro "iosApp/iosApp/GoogleService-Info.plist ausente. Baixe com:
  firebase apps:sdkconfig IOS 1:490094091078:ios:e51b069afe7aefa3b5a347 --project futebadosparcas --out iosApp/iosApp/GoogleService-Info.plist"

mkdir -p "$SAIDA"

# 1. Projeto + Pods (idempotente).
aviso "gerando projeto (xcodegen) e instalando Pods"
(cd iosApp && xcodegen generate >/dev/null)
(cd iosApp && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install --no-repo-update >/dev/null)

# 2. Framework KMP (o app não compila sem ele).
aviso "linkando o framework KMP (Simulator Arm64)"
./gradlew --max-workers=3 :composeApp:linkDebugFrameworkIosSimulatorArm64 -q

ID_DISPOSITIVO="$(xcrun simctl list devices available |
  awk -v nome="$DISPOSITIVO" '$0 ~ nome && /\([0-9A-F-]{36}\)/ { match($0, /[0-9A-F-]{36}/); print substr($0, RSTART, RLENGTH); exit }')"
[ -n "$ID_DISPOSITIVO" ] || erro "simulador \"$DISPOSITIVO\" não encontrado. Veja: xcrun simctl list devices available"

aviso "simulador: $DISPOSITIVO ($ID_DISPOSITIVO)"
xcrun simctl boot "$ID_DISPOSITIVO" 2>/dev/null || true

# 3. Um run por modo. `appearance`/`content_size` são estado do dispositivo,
#    então cada modo precisa da sua própria execução do teste.
rodar_modo() {
  local modo="$1" aparecimento="$2" tamanho="$3"
  local resultado="$SAIDA/$modo.xcresult"

  aviso "modo $modo (appearance=$aparecimento, content_size=$tamanho)"
  xcrun simctl ui "$ID_DISPOSITIVO" appearance "$aparecimento" 2>/dev/null ||
    aviso "aviso: appearance '$aparecimento' não suportado nesta versão do iOS"
  if [ -n "$tamanho" ]; then
    xcrun simctl ui "$ID_DISPOSITIVO" content_size "$tamanho" 2>/dev/null ||
      aviso "aviso: content_size '$tamanho' não suportado nesta versão do iOS"
  fi

  rm -rf "$resultado"
  xcodebuild test \
    -workspace iosApp/iosApp.xcworkspace \
    -scheme iosAppUITests \
    -destination "platform=iOS Simulator,id=$ID_DISPOSITIVO" \
    -configuration Debug \
    -derivedDataPath "$DERIVADOS" \
    -resultBundlePath "$resultado" \
    CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=NO \
    >"$SAIDA/$modo.log" 2>&1 || aviso "o teste falhou no modo $modo (veja $SAIDA/$modo.log)"

  # Extrai as capturas anexadas pelo teste (nomes começam com qa-).
  local destino="$SAIDA/$modo"
  rm -rf "$destino"
  mkdir -p "$destino"
  xcrun xcresulttool export attachments \
    --path "$resultado" \
    --output-path "$destino" >/dev/null 2>&1 || {
    aviso "aviso: xcresulttool export attachments falhou; tentando o modo legado"
    xcrun xcresulttool export --legacy --type directory --path "$resultado" \
      --output-path "$destino" >/dev/null 2>&1 || true
  }
  aviso "capturas do modo $modo em $destino"
}

# MODOS permite rodar um modo só (ex.: MODOS=ax3 para repetir o AX3).
for modo in ${MODOS:-claro escuro ax3}; do
  case "$modo" in
    claro) rodar_modo claro light "" ;;
    escuro) rodar_modo escuro dark "" ;;
    ax3) rodar_modo ax3 light accessibility-extra-large ;;
    *) erro "modo desconhecido: $modo (use claro, escuro ou ax3)" ;;
  esac
done

# 4. Volta o simulador ao padrão para não afetar outras execuções.
xcrun simctl ui "$ID_DISPOSITIVO" appearance light 2>/dev/null || true
xcrun simctl ui "$ID_DISPOSITIVO" content_size large 2>/dev/null || true

aviso "concluído. Capturas:"
find "$SAIDA" -name '*.png' -maxdepth 3 | sort | sed 's/^/  /'
