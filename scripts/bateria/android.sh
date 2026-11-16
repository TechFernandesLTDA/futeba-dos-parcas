#!/usr/bin/env bash
# Bateria de testes — Android (testes instrumentados contra os emuladores).
#
# Chamado por scripts/bateria/rodar.sh android, com os emuladores do Firebase
# no ar e o seed aplicado. Sozinho, espera encontrar os emuladores nas portas
# do firebase.bateria.json.
#
# Usa um aparelho/emulador Android já conectado; se não houver, sobe o AVD
# BATERIA_AVD (ou o primeiro da lista) sem janela e o desliga ao terminar.
# O build de debug é apontado para o projeto demo pelo BateriaTestRunner:
# nenhum teste daqui fala com produção.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$RAIZ"

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
ADB="$SDK/platform-tools/adb"
EMULADOR="$SDK/emulator/emulator"
PACOTE="com.futebadosparcas"
# O runner do app; `-e bateria true` + a propriedade debug.futeba.bateria ligam
# o modo emulador (ver BateriaTestRunner.kt).
RUNNER="$PACOTE.test/com.futebadosparcas.bateria.BateriaTestRunner"
SAIDA="${TMPDIR:-/tmp}/futeba-bateria-android.log"

aviso() { printf '[bateria:android] %s\n' "$*"; }
erro() { printf '[bateria:android] ERRO: %s\n' "$*" >&2; exit 1; }
porta() { node -e "console.log(require('./firebase.bateria.json').emulators['$1'].port)"; }

[ -x "$ADB" ] || erro "adb não encontrado em $ADB (defina ANDROID_HOME)."
[ -f app/google-services.json ] || erro "app/google-services.json ausente neste checkout."

AVD_INICIADO=""
desligar() {
  # A chave do modo bateria nunca fica ligada depois da rodada.
  if [ -n "${ANDROID_SERIAL:-}" ]; then
    "$ADB" -s "$ANDROID_SERIAL" shell setprop debug.futeba.bateria 0 >/dev/null 2>&1 || true
  fi
  if [ -n "$AVD_INICIADO" ]; then
    aviso "desligando o AVD $AVD_INICIADO"
    "$ADB" -s "$ANDROID_SERIAL" emu kill >/dev/null 2>&1 || true
  fi
}
trap desligar EXIT

aparelho() { "$ADB" devices | awk 'NR>1 && $2=="device" {print $1; exit}'; }

ANDROID_SERIAL="${ANDROID_SERIAL:-$(aparelho)}"
if [ -z "$ANDROID_SERIAL" ]; then
  [ -x "$EMULADOR" ] || erro "nenhum aparelho conectado e o emulador não está instalado."
  AVD="${BATERIA_AVD:-$("$EMULADOR" -list-avds | grep -v '^INFO' | head -1)}"
  [ -n "$AVD" ] || erro "nenhum AVD criado. Crie um no Android Studio ou defina BATERIA_AVD."
  aviso "subindo o AVD $AVD sem janela"
  "$EMULADOR" -avd "$AVD" -no-window -no-audio -no-boot-anim -no-snapshot-save \
    >"${TMPDIR:-/tmp}/futeba-bateria-avd.log" 2>&1 &
  AVD_INICIADO="$AVD"
  for _ in $(seq 1 90); do
    ANDROID_SERIAL="$(aparelho)"
    if [ -n "$ANDROID_SERIAL" ] &&
      [ "$("$ADB" -s "$ANDROID_SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; then
      break
    fi
    sleep 2
  done
  [ -n "$ANDROID_SERIAL" ] || erro "o AVD $AVD não terminou de iniciar."
fi
export ANDROID_SERIAL
aviso "aparelho: $ANDROID_SERIAL"

# 10.0.2.2 é o Mac visto do emulador. Em aparelho físico, usa adb reverse.
HOST="10.0.2.2"
case "$ANDROID_SERIAL" in
  emulator-*) ;;
  *)
    HOST="localhost"
    for servico in auth firestore functions storage; do
      "$ADB" reverse "tcp:$(porta "$servico")" "tcp:$(porta "$servico")" >/dev/null
    done
    ;;
esac

aviso "compilando e instalando (debug + androidTest)"
./gradlew --quiet :app:installDebug :app:installDebugAndroidTest

# Estado limpo: sem sessão nem cache do Firestore de uma rodada anterior.
"$ADB" shell pm clear "$PACOTE" >/dev/null

aviso "rodando os testes da bateria"
# Liga o projeto demo antes do FirebaseInitProvider (ver BateriaTestRunner.kt).
"$ADB" shell setprop debug.futeba.bateria 1
"$ADB" shell am instrument -w \
  -e bateria true \
  -e package com.futebadosparcas.bateria \
  -e bateriaHost "$HOST" \
  -e bateriaPortaAuth "$(porta auth)" \
  -e bateriaPortaFirestore "$(porta firestore)" \
  -e bateriaPortaFunctions "$(porta functions)" \
  -e bateriaPortaStorage "$(porta storage)" \
  "$RUNNER" | tee "$SAIDA"

# `am instrument` devolve 0 mesmo com teste vermelho: o resultado está no texto.
if grep -q '^OK (' "$SAIDA" && ! grep -Eq 'FAILURES!!!|INSTRUMENTATION_FAILED|Process crashed|INSTRUMENTATION_RESULT: shortMsg' "$SAIDA"; then
  aviso "Android: $(grep '^OK (' "$SAIDA")"
else
  erro "testes da bateria falharam no Android. Saída completa: $SAIDA"
fi
