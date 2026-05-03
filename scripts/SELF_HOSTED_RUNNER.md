# Self-Hosted GitHub Actions Runner (macOS Apple Silicon)

Guia para rodar CI do **Futeba dos Parcas** em runner self-hosted no Mac M-series, eliminando custos de minutos do GitHub Actions.

> **Motivacao:** Billing GitHub Actions falhou. Rodar self-hosted = custo zero (apenas energia eletrica do Mac).

---

## Visao geral

Todos os 14 workflows em `.github/workflows/` foram migrados para usar:

```yaml
runs-on: ${{ fromJSON(vars.RUNNER_LABELS || '["self-hosted","macOS","ARM64"]') }}
```

- **Default:** `self-hosted, macOS, ARM64` (seu Mac).
- **Fallback opcional:** Defina a variavel de repositorio `RUNNER_LABELS` em **Settings -> Secrets and variables -> Actions -> Variables** com valor `["ubuntu-latest"]` para reverter para github-hosted (vai reativar billing).

---

## Step 1 - Gerar token de registro

> Token expira em **~1 hora**. Gere apenas no momento de rodar o setup.

1. Acesse: <https://github.com/TechFernandesLTDA/futeba-dos-parcas/settings/actions/runners/new>
2. Selecione **macOS** + **ARM64**
3. Copie o valor do token em `--token AABBCCDDEEFF...` (apenas o token, nao o comando inteiro).

---

## Step 2 - Verificar dependencias (opcional)

Antes de instalar, valide o ambiente:

```bash
./scripts/setup-self-hosted-runner.sh --check
```

Output esperado:
- Java 17 (Temurin recomendado)
- Node 20+
- `ANDROID_SDK_ROOT` definido
- Xcode Command Line Tools
- CocoaPods (iOS)
- gcloud + firebase CLI (deploy)

Para instalar dependencias faltantes:
```bash
brew install --cask temurin@17
brew install node@20 cocoapods google-cloud-sdk
npm install -g firebase-tools
xcode-select --install
# Android SDK: instale via Android Studio, depois:
echo 'export ANDROID_SDK_ROOT=$HOME/Library/Android/sdk' >> ~/.zshrc
echo 'export ANDROID_HOME=$ANDROID_SDK_ROOT' >> ~/.zshrc
source ~/.zshrc
```

---

## Step 3 - Instalar runner

### Modo padrao (servico launchd, persiste entre reboots)

```bash
./scripts/setup-self-hosted-runner.sh AABBCCDDEEFF...
```

### Modo interativo (sem servico, morre quando fechar terminal)

```bash
./scripts/setup-self-hosted-runner.sh --no-svc AABBCCDDEEFF...
```

### Via env var (token nao aparece no histor do shell)

```bash
read -s GITHUB_RUNNER_TOKEN
export GITHUB_RUNNER_TOKEN
./scripts/setup-self-hosted-runner.sh
```

### Customizando nome/diretorio

```bash
./scripts/setup-self-hosted-runner.sh \
  --runner-name macmini-ci \
  --runner-dir /opt/actions-runner \
  AABBCCDDEEFF...
```

### Importante: arquivo `.env` do runner

`launchd` (servico de macOS) **nao carrega `~/.zshrc`**, entao `ANDROID_SDK_ROOT`, `JAVA_HOME` etc do shell **nao chegam ao runner**. O actions-runner resolve isso lendo `~/actions-runner/.env` automaticamente.

O setup script **gera esse arquivo** na instalacao com:
- `ANDROID_SDK_ROOT` / `ANDROID_HOME` (do env atual ou `$HOME/Library/Android/sdk`)
- `JAVA_HOME` (via `/usr/libexec/java_home -v 17`)
- `PATH` minimo (homebrew, JDK, Android SDK platform-tools)
- `LANG=en_US.UTF-8`

Para inspecionar/editar:

```bash
cat ~/actions-runner/.env
# Edite se necessario, depois:
sudo ~/actions-runner/svc.sh stop
sudo ~/actions-runner/svc.sh start
```

Se mudar JDK, mover SDK ou instalar nova versao, **atualize esse arquivo e reinicie o servico** - caso contrario builds Android quebram com `sdk.dir=` vazio.

---

## Step 4 - Verificar runner online

1. Acesse: <https://github.com/TechFernandesLTDA/futeba-dos-parcas/settings/actions/runners>
2. Procure o runner com o nome do hostname (ou `--runner-name`)
3. Status deve estar **Idle** (verde)

Localmente:
```bash
cd ~/actions-runner
sudo ./svc.sh status
```

---

## Step 5 - Operacoes

### Parar / Iniciar / Status do servico

```bash
cd ~/actions-runner
sudo ./svc.sh stop
sudo ./svc.sh start
sudo ./svc.sh status
```

### Logs em tempo real

```bash
tail -f ~/actions-runner/_diag/Runner_*.log
```

### Desinstalar

```bash
# Gere outro token (mesma URL do Step 1; o "Remove" gera token de remocao)
./scripts/setup-self-hosted-runner.sh --uninstall AABBCCDDEEFF...
```

---

## Multiplos runners (paralelismo)

Um runner serializa todos os jobs (`android-ci.yml` tem 4 jobs paralelos = ~30+ min serial vs ~10min paralelo no GitHub).

Para rodar 2-3 runners em paralelo no mesmo Mac:

```bash
./scripts/setup-self-hosted-runner.sh --runner-dir ~/actions-runner-2 --runner-name $(hostname -s)-2 TOKEN_2
./scripts/setup-self-hosted-runner.sh --runner-dir ~/actions-runner-3 --runner-name $(hostname -s)-3 TOKEN_3
```

Cada runner precisa de um token novo (gerado individualmente na UI).

---

## Troubleshooting

### Mac dorme = runner offline

GitHub mostra `Offline` quando o Mac entra em sleep. Resolva:

```bash
# Opcao 1 (recomendado para runner dedicado): desabilitar sleep na tomada
sudo pmset -c sleep 0 disksleep 0

# Opcao 2 (menos invasivo): caffeinate em background
caffeinate -d -i -s &
disown

# Reverter pmset:
sudo pmset -c sleep 10
```

### Runner nao aparece online

Cheque conectividade:
```bash
curl -fsSL https://api.github.com/repos/actions/runner/releases/latest | head -3
```

Cheque logs:
```bash
tail -50 ~/actions-runner/_diag/Runner_*.log
```

Re-registre (token expirou):
```bash
cd ~/actions-runner
./config.sh remove --token <novo-token-de-remocao>
./config.sh --url https://github.com/TechFernandesLTDA/futeba-dos-parcas \
  --token <novo-token> \
  --labels self-hosted,macOS,ARM64 \
  --unattended
sudo ./svc.sh stop && sudo ./svc.sh start
```

### Caches inflam o disco

Self-hosted nao limpa entre runs. `_work/_actions`, `_work/_tool`, `~/.gradle`, `~/.android` crescem. Limpeza periodica:

```bash
cd ~/actions-runner
sudo ./svc.sh stop
rm -rf _work/_actions/_temp _work/<repo-owner>/<repo>/<repo>/build
# Gradle:
rm -rf ~/.gradle/caches/transforms-*
# Restart:
sudo ./svc.sh start
```

### local.properties stale ou sdk.dir vazio

Workflows recriam `local.properties` em cada run com `echo "sdk.dir=$ANDROID_SDK_ROOT"`. Se a variavel nao chega ao runner, gera `sdk.dir=` (vazio) e Gradle quebra com **"SDK location not found"**.

Causa principal: `launchd` nao herda env do shell. Verifique:

```bash
# 1. Confira o .env do runner
cat ~/actions-runner/.env | grep ANDROID

# 2. Se vazio, edite e reinicie
echo "ANDROID_SDK_ROOT=$HOME/Library/Android/sdk" >> ~/actions-runner/.env
echo "ANDROID_HOME=$HOME/Library/Android/sdk" >> ~/actions-runner/.env
sudo ~/actions-runner/svc.sh stop
sudo ~/actions-runner/svc.sh start

# 3. Verifique caminho do SDK
ls $HOME/Library/Android/sdk/platforms/  # deve ter android-35
```

### Build Java lento ou OOM

Aumentar memoria do Gradle:

```bash
echo 'org.gradle.jvmargs=-Xmx6g -XX:MaxMetaspaceSize=1g' >> ~/.gradle/gradle.properties
```

### CodeQL lento

Roda em Apple Silicon mas e ~30% mais lento que Linux. `timeout-minutes: 360` ja esta configurado.

### Reverter para github-hosted (emergencia)

1. Settings -> Secrets and variables -> Actions -> Variables
2. Crie variavel `RUNNER_LABELS` com valor `["ubuntu-latest"]`
3. Workflows passam a usar github-hosted novamente (billing reativa)
4. Para remover override, delete a variavel.

---

## Workflows migrados

| Workflow | Antes | Agora |
|----------|-------|-------|
| `pr-check.yml` | `ubuntu-latest` | self-hosted macOS ARM64 |
| `android-ci.yml` | `ubuntu-latest` (4 jobs) | self-hosted macOS ARM64 |
| `functions-ci.yml` | `ubuntu-latest` (3 jobs) | self-hosted macOS ARM64 |
| `ios-build.yml` | `macos-14` (3 jobs) + `ubuntu-latest` (notify) | self-hosted macOS ARM64 |
| `codeql.yml` | `ubuntu-latest` | self-hosted macOS ARM64 |
| `deploy-beta.yml` | `ubuntu-latest` | self-hosted macOS ARM64 |
| `deploy-production.yml` | `ubuntu-latest` | self-hosted macOS ARM64 |
| `release.yml` | `ubuntu-latest` (2 jobs) | self-hosted macOS ARM64 |
| `version-bump.yml` | `ubuntu-latest` | self-hosted macOS ARM64 |
| `claude.yml` | `ubuntu-latest` | self-hosted macOS ARM64 |
| `claude-code-review.yml` | `ubuntu-latest` | self-hosted macOS ARM64 |
| `pr-review-to-issues.yml` | `ubuntu-latest` | self-hosted macOS ARM64 |
| `issue-automation.yml` | `ubuntu-latest` (3 jobs) | self-hosted macOS ARM64 |
| `sync-labels.yml` | `ubuntu-latest` | self-hosted macOS ARM64 |

---

## Seguranca

- **Nunca commite tokens.** O token de registro expira em 1h, mas trate como secreto.
- **Rede:** Runner faz long-polling para GitHub - precisa de saida HTTPS para `api.github.com` e `*.actions.githubusercontent.com`.
- **PRs de fork nao executam em self-hosted por padrao** (politica de seguranca padrao do GitHub). Para times pequenos isso e OK; para projetos open-source considere isolacao adicional.
- **Quem tem acesso ao Mac tem acesso aos secrets.** Se outras pessoas usam o Mac, considere user separado e SSH-only.

---

## Referencias

- [GitHub Docs - About self-hosted runners](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners/about-self-hosted-runners)
- [actions/runner releases](https://github.com/actions/runner/releases)
- [Repository variables](https://docs.github.com/en/actions/learn-github-actions/variables#defining-configuration-variables-for-multiple-workflows)
