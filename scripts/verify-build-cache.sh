#!/usr/bin/env bash
#
# Verificacao empirica da reabilitacao do Gradle build cache (Efficiency Hardening F4).
#
# Confirma a invariante critica: um build COM cache produz exatamente os mesmos
# outputs de codegen (KSP/Compose) que um build limpo — ou seja, sem "stale codegen".
# Esse era o medo que motivou desabilitar o cache em jan/2026 (corrupcao do KSP2);
# o projeto migrou para KSP1, mas validamos mesmo assim antes de reabilitar.
#
# ATENCAO (maquina de 24GB): NAO rode com os runners CI ativos — 2 daemons Gradle
# + este build = risco de OOM. Pause os runners antes:
#   cd ~/actions-runner   && ./svc.sh stop
#   cd ~/actions-runner-2 && ./svc.sh stop
# E reative depois (./svc.sh start).
#
# Uso: scripts/verify-build-cache.sh
# Saida: exit 0 + "DONE" se a invariante valer e houver cache hits; exit 1 caso contrario.

set -euo pipefail
cd "$(dirname "$0")/.."

TASK=":app:compileDebugKotlin"
GEN_DIRS=(app/build/generated/ksp shared/build/generated/ksp)

# Hash estavel (ordenado) do conteudo dos diretorios de codegen.
hash_gen() {
  for d in "${GEN_DIRS[@]}"; do
    if [ -d "$d" ]; then
      # KSP do projeto (Room) gera .java (ex: *_Impl.java); KMP/outros podem gerar .kt.
      # Hashear ambos garante que a comparacao de codegen NAO seja vacua.
      find "$d" -type f \( -name '*.kt' -o -name '*.java' \) -print0 | sort -z | xargs -0 shasum 2>/dev/null || true
    fi
  done | shasum | awk '{print $1}'
}

echo "==> 1/5 clean + primeiro build (popula o cache) — $TASK"
./gradlew --quiet clean
./gradlew "$TASK" --build-cache --console=plain
H1=$(hash_gen)
echo "    hash codegen (1o build, sem cache) = $H1"

echo "==> 2/5 clean (apaga outputs, MANTEM o cache em ~/.gradle/caches/build-cache-1)"
./gradlew --quiet clean

echo "==> 3/5 segundo build (deve puxar tasks FROM-CACHE)"
OUT=$(./gradlew "$TASK" --build-cache --console=plain 2>&1)
echo "$OUT" | grep -E 'FROM-CACHE' || true
H2=$(hash_gen)
echo "    hash codegen (2o build, com cache) = $H2"

echo "==> 4/5 comparando outputs de codegen"
if [ "$H1" = "$H2" ]; then
  echo "    OK: codegen identico entre build limpo e build com cache (sem stale)."
else
  echo "    FALHA: codegen DIVERGIU — nao reabilite o cache global; investigue o task."
  exit 1
fi

echo "==> 5/5 conferindo que houve cache hits"
FROMCACHE=$(echo "$OUT" | grep -c 'FROM-CACHE' || true)
echo "    tasks FROM-CACHE no 2o build: $FROMCACHE"
if [ "$FROMCACHE" -gt 0 ]; then
  echo "DONE: cache reabilitado com seguranca ($FROMCACHE task(s) servidas do cache)."
else
  echo "    AVISO: nenhum hit de cache — o cache nao esta ajudando; investigue antes de mergear."
  exit 1
fi
