---
name: futeba-runner
description: Gerencia self-hosted GitHub Actions runners no Mac local — install, start, stop, scale, troubleshoot RAM/Spotlight contention. Use quando o usuário pedir "ativar runner", "parar runner", "criar mais runners", "runner offline", ou após problemas de capacidade CI.
---

# Futeba Runner Manager

Self-hosted runners macOS ARM64 para CI grátis (substitui GH Actions billing).

## Capacidade ideal por hardware

| RAM Mac | Runners ativos | Workloads simultâneos |
|---------|----------------|------------------------|
| 16 GB | 1 | 1 gradle daemon |
| 24 GB | 2 | 1 iOS Framework + 1 Cloud Functions |
| 32 GB | 4 | iOS + Android + Functions + Web |
| 64 GB+ | 6-8 | Full parallelism |

**Atenção**: cada gradle daemon ~3-4GB; iOS Framework Build ~6-8GB; Spotlight (`mds_stores`) pode comer 8GB durante indexação inicial de Xcode.

## Setup novo runner

```bash
# 1. Validar deps
cd /Users/renanlocatizfernandes/Code/personal/TechFernandesLTDA/futeba-dos-parcas
./scripts/setup-self-hosted-runner.sh --check

# 2. Gerar token (~/.zshrc env vars já setadas)
# Abrir: https://github.com/TechFernandesLTDA/futeba-dos-parcas/settings/actions/runners/new
# OU via API:
TOKEN=$(gh api -X POST /repos/TechFernandesLTDA/futeba-dos-parcas/actions/runners/registration-token -q .token)

# 3. Setup com nome único e dir separado
./scripts/setup-self-hosted-runner.sh \
  --runner-name "Mac<N>" \
  --runner-dir "$HOME/actions-runner-<N>" \
  --no-svc \
  "$TOKEN"

# 4. Install service (NUNCA com sudo — svc.sh recusa)
cd ~/actions-runner-<N>
./svc.sh install
./svc.sh start
./svc.sh status   # PID e estado
```

## Start/Stop runner existente

```bash
cd ~/actions-runner-<N>
./svc.sh stop      # Para temporariamente
./svc.sh start     # Volta ativar
./svc.sh status    # Verificar
./svc.sh uninstall # Remove launchd service (mas preserva config)
```

Para desregistrar do GitHub:
```bash
cd ~/actions-runner-<N>
TOKEN=$(gh api -X POST /repos/TechFernandesLTDA/futeba-dos-parcas/actions/runners/remove-token -q .token)
./config.sh remove --token "$TOKEN"
```

## Troubleshoot

### Runner mostra "offline" no GitHub
```bash
cd ~/actions-runner-<N>
./svc.sh status        # service rodando?
ps -p $(launchctl list | grep -i actions | awk '{print $1}') 2>&1
tail -20 ~/Library/Logs/actions.runner.TechFernandesLTDA-futeba-dos-parcas.<Name>/Runner_*.log
```

### `Gradle build daemon disappeared` (OOM)
```bash
# 1. Diagnose
vm_stat | head -3 | awk '/free/ {printf "Free: %.1f GB\n", $3 * 16384 / 1024 / 1024 / 1024}'
ps aux | sort -k4 -rn | head -5

# 2. Se mds_stores >5%: kill (Spotlight indexing)
osascript -e 'do shell script "killall -KILL mds_stores" with administrator privileges'

# 3. Se ainda apertado: reduzir runners
cd ~/actions-runner-2 && ./svc.sh stop  # repetir pra Mac3..N
```

### Cache Gradle corrompido (concorrência runners)
```bash
rm -rf ~/.gradle/caches/modules-2/metadata-*
# Retriggerar runs falhos
```

### Re-instalar Rosetta 2 (CodeQL, x86_64 binários)
```bash
sudo softwareupdate --install-rosetta --agree-to-license
arch -x86_64 echo "Rosetta works"  # Validar
```

## Workflow YAML pattern

```yaml
runs-on: ${{ fromJSON(vars.RUNNER_LABELS || '["self-hosted","macOS","ARM64"]') }}
```

`vars.RUNNER_LABELS` pode ser overrideada no Settings → Variables para fallback rápido para `["ubuntu-latest"]` se billing voltar.

## Env vars críticas (`~/.zshrc`)

```bash
export JAVA_HOME="/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home"
export ANDROID_SDK_ROOT="/opt/homebrew/share/android-commandlinetools"
export ANDROID_HOME="$ANDROID_SDK_ROOT"
export PATH="$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:/opt/homebrew/share/google-cloud-sdk/bin:$PATH"
```

Cada runner também tem `~/actions-runner-<N>/.env` com mesmas vars (launchd não herda shell env).
