#!/usr/bin/env bash
# Bateria de testes — iOS (roteiro no Simulador contra os emuladores).
#
# Chamado por scripts/bateria/rodar.sh ios, com os emuladores do Firebase no ar
# e o seed aplicado.
#
# É um roteiro mais simples que o do web e o do Android: compila o app de
# debug, instala no Simulador e, para um jogador (com os documentos legados de
# campo `id` gravado), um dono de quadra e o administrador, abre o app já
# logado no projeto demo (ver iosApp/iosApp/Services/BateriaEmulador.swift) e
# confere que:
#   - o login chegou ao emulador do Auth (lastLoginAt da conta mudou);
#   - o processo continua vivo depois de carregar a primeira tela;
#   - não apareceu relatório de falha novo do app.
# Guarda uma captura de tela por conta para conferência visual.
#
# LIMITE: o roteiro não clica em nada. O app abre na tela de boas-vindas
# ("Começar") com o pedido de notificações por cima e fica nela, então as telas
# de dentro (início, grupos, jogos) NÃO são exercitadas aqui. Isso fica para um
# XCUITest futuro. O que este roteiro garante é: o app de debug compila, sobe
# no projeto demo, autentica contra o emulador e não fecha.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$RAIZ"

PACOTE="com.futebadosparcas"
PROJETO="demo-futebadosparcas"
DERIVADOS="${BATERIA_IOS_DERIVADOS:-$RAIZ/build/bateria-ios}"
SAIDA="${TMPDIR:-/tmp}/futeba-bateria-ios"
ESPERA="${BATERIA_IOS_ESPERA:-25}"
CONTAS_DO_ROTEIRO=(jogador01 dono01 admin)

aviso() { printf '[bateria:ios] %s\n' "$*"; }
erro() { printf '[bateria:ios] ERRO: %s\n' "$*" >&2; exit 1; }
porta() { node -e "console.log(require('./firebase.bateria.json').emulators['$1'].port)"; }

for comando in xcodebuild xcrun xcodegen pod node curl; do
  command -v "$comando" >/dev/null || erro "falta o comando $comando."
done

SENHA="$(sed -n "s/^export const SENHA_EMULADOR = '\(.*\)';$/\1/p" scripts/bateria/contas.ts)"
[ -n "$SENHA" ] || erro "não achei SENHA_EMULADOR em scripts/bateria/contas.ts."
PORTA_AUTH="$(porta auth)"

mkdir -p "$SAIDA"
rm -f "$SAIDA"/*.png

# ── Simulador ───────────────────────────────────────────────────────────────
SIMULADOR_INICIADO=""
desligar() {
  if [ -n "$SIMULADOR_INICIADO" ]; then
    aviso "desligando o Simulador"
    xcrun simctl shutdown "$SIMULADOR_INICIADO" >/dev/null 2>&1 || true
  fi
}
trap desligar EXIT

UDID="$(xcrun simctl list devices booted | sed -n 's/.*(\([0-9A-F-]\{36\}\)) (Booted).*/\1/p' | head -1)"
if [ -z "$UDID" ]; then
  NOME="${BATERIA_SIMULADOR:-iPhone}"
  UDID="$(xcrun simctl list devices available | grep "$NOME" | sed -n 's/.*(\([0-9A-F-]\{36\}\)).*/\1/p' | head -1)"
  [ -n "$UDID" ] || erro "nenhum Simulador disponível com \"$NOME\" no nome (defina BATERIA_SIMULADOR)."
  aviso "ligando o Simulador $UDID"
  xcrun simctl boot "$UDID"
  SIMULADOR_INICIADO="$UDID"
  xcrun simctl bootstatus "$UDID" -b >/dev/null
fi
aviso "Simulador: $UDID"

# ── Build ───────────────────────────────────────────────────────────────────
if [ ! -d iosApp/iosApp.xcworkspace ] || [ iosApp/project.yml -nt iosApp/iosApp.xcodeproj ] ||
  [ ! -f iosApp/iosApp/Services/BateriaEmulador.swift ] ||
  ! grep -q BateriaEmulador.swift iosApp/iosApp.xcodeproj/project.pbxproj 2>/dev/null; then
  aviso "gerando o projeto (xcodegen + pod install)"
  (cd iosApp && xcodegen generate --quiet && pod install --silent)
fi

aviso "compilando o app de debug para o Simulador (demora na primeira vez)"
if ! xcodebuild -workspace iosApp/iosApp.xcworkspace -scheme iosApp -configuration Debug \
  -sdk iphonesimulator -destination "platform=iOS Simulator,id=$UDID" \
  -derivedDataPath "$DERIVADOS" CODE_SIGNING_ALLOWED=NO build >"$SAIDA/xcodebuild.log" 2>&1; then
  grep -E "error:|BUILD FAILED" "$SAIDA/xcodebuild.log" | head -20 >&2 || true
  erro "o build do iOS falhou. Saída completa: $SAIDA/xcodebuild.log"
fi
APP="$(find "$DERIVADOS/Build/Products/Debug-iphonesimulator" -maxdepth 1 -name '*.app' | head -1)"
[ -d "$APP" ] || erro "não achei o .app compilado em $DERIVADOS."

xcrun simctl terminate "$UDID" "$PACOTE" >/dev/null 2>&1 || true
xcrun simctl install "$UDID" "$APP"

# ── Roteiro ─────────────────────────────────────────────────────────────────
ultimo_login() {
  curl -s -X POST "http://127.0.0.1:$PORTA_AUTH/identitytoolkit.googleapis.com/v1/projects/$PROJETO/accounts:lookup" \
    -H 'Authorization: Bearer owner' -H 'Content-Type: application/json' \
    -d "{\"localId\":[\"bat-$1\"]}" |
    node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const u=(JSON.parse(s).users||[])[0];console.log(u?Number(u.lastLoginAt||0):-1)})"
}

FALHAS=0
for chave in "${CONTAS_DO_ROTEIRO[@]}"; do
  antes="$(ultimo_login "$chave")"
  [ "$antes" != "-1" ] || erro "a conta bat-$chave não existe no emulador: rode o seed."
  inicio="$(date +%s)"

  saida_launch="$(
    SIMCTL_CHILD_FUTEBA_BATERIA=1 \
      SIMCTL_CHILD_FUTEBA_BATERIA_EMAIL="$chave@bateria.futeba.test" \
      SIMCTL_CHILD_FUTEBA_BATERIA_SENHA="$SENHA" \
      SIMCTL_CHILD_FUTEBA_BATERIA_PORTA_AUTH="$PORTA_AUTH" \
      SIMCTL_CHILD_FUTEBA_BATERIA_PORTA_FIRESTORE="$(porta firestore)" \
      SIMCTL_CHILD_FUTEBA_BATERIA_PORTA_FUNCTIONS="$(porta functions)" \
      SIMCTL_CHILD_FUTEBA_BATERIA_PORTA_STORAGE="$(porta storage)" \
      xcrun simctl launch --terminate-running-process "$UDID" "$PACOTE"
  )"
  pid="${saida_launch##*: }"
  sleep "$ESPERA"
  xcrun simctl io "$UDID" screenshot "$SAIDA/$chave.png" >/dev/null 2>&1 || true

  motivo=""
  depois="$(ultimo_login "$chave")"
  if ! kill -0 "$pid" 2>/dev/null; then
    motivo="o app fechou sozinho"
  elif [ "$depois" -le "$antes" ]; then
    motivo="o login não chegou ao emulador do Auth"
  elif find "$HOME/Library/Logs/DiagnosticReports" -maxdepth 1 -name 'iosApp*' -newermt "@$inicio" 2>/dev/null | grep -q .; then
    motivo="apareceu relatório de falha novo em ~/Library/Logs/DiagnosticReports"
  fi

  if [ -n "$motivo" ]; then
    aviso "FALHOU $chave: $motivo"
    FALHAS=$((FALHAS + 1))
  else
    aviso "ok $chave: login chegou ao emulador e o app ficou aberto ${ESPERA}s sem fechar ($SAIDA/$chave.png)"
  fi
done
xcrun simctl terminate "$UDID" "$PACOTE" >/dev/null 2>&1 || true

[ "$FALHAS" -eq 0 ] || erro "$FALHAS conta(s) falharam no iOS. Capturas em $SAIDA."
aviso "iOS: OK (${#CONTAS_DO_ROTEIRO[@]} contas, só fumaça: sem navegar pelas telas). Capturas em $SAIDA."
