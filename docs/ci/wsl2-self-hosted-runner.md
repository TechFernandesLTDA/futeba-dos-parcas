# Self-Hosted Runner no WSL2 (5700X3D / 32GB) — runbook para Claude Code

Runbook para adicionar um **3º runner GitHub Actions** numa máquina separada
(Ryzen 5700X3D + 32GB) rodando **Ubuntu via WSL2**, descarregando os jobs
pesados (web/functions/android) dos 2 runners macOS do MacBook — que ficam
reservados só pra **iOS/KMP-Apple**.

> **Por quê WSL2 e não Windows nativo:** os workflows deste repo são escritos
> em **bash**. No Linux/WSL2 rodam nativos (sem `shell: bash` forçado, sem
> PowerShell, sem long-path, sem CRLF). `./gradlew`, Node, Jest e Vitest se
> comportam igual aos runners macOS. Label final: `self-hosted,Linux,X64`.
>
> **Por quê máquina separada:** o gargalo de CI é a fila de 2 slots no MacBook.
> Um 3º runner NO Mac dá OOM. Uma máquina separada dobra a capacidade sem risco.
> Épico de infra: #2313.

---

## Como usar este documento

Este arquivo é um **runbook executável pelo Claude Code** rodando *dentro do
WSL2* na 5700X3D, logado **nesta mesma conta** (`renankakinho69`, que é admin do
repo `TechFernandesLTDA/futeba-dos-parcas`). Por ser admin, o próprio Claude Code
gera o token de registro do runner via `gh api` — você **não precisa copiar nada**
do GitHub Settings manualmente.

Pré-condição na máquina WSL2: `gh auth status` autenticado nesta conta
(`gh auth login` se necessário). Tudo abaixo roda como comando bash.

---

## O que esta máquina vai rodar

| Workflow | Roda no WSL2? | Observação |
|----------|---------------|------------|
| `web-ci.yml` (Vitest/ESLint/build) | ✅ sim | Node puro |
| `functions-ci.yml` (Jest/tsc) | ✅ sim | Node puro |
| `android-ci.yml` (Gradle/APK/detekt/KMP-Android) | ✅ sim | JVM roda igual/+rápido no x86 |
| `codeql.yml` (JS/TS) | ✅ sim | |
| `ios-build.yml` / KMP iOS framework | ❌ **NÃO** | exige Xcode/macOS — fica nos Macs |
| `deploy-production.yml` (Play Store) | ⚠️ opcional | pode migrar depois |

---

## Passo 0 — habilitar systemd no WSL2 (uma vez)

Necessário pra o runner subir como serviço no boot. Em `/etc/wsl.conf`:
```ini
[boot]
systemd=true
```
Depois, **no PowerShell do Windows host**: `wsl --shutdown` e reabra o Ubuntu.
Confirme com `systemctl is-system-running` (deve responder `running`/`degraded`,
não `offline`).

Opcional — dar CPU/RAM ao WSL2 (`C:\Users\<voce>\.wslconfig` no Windows host):
```ini
[wsl2]
memory=24GB
processors=12
```

---

## Passo 1 — dependências (bash, dentro do WSL2)

```bash
sudo apt update && sudo apt install -y curl git unzip jq

# Node 22 (.nvmrc do projeto)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs

# JDK 17 (Android/Gradle)
sudo apt install -y openjdk-17-jdk

# GitHub CLI (se ainda não tiver)
type gh >/dev/null 2>&1 || { sudo mkdir -p -m 755 /etc/apt/keyrings && \
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg >/dev/null && \
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list >/dev/null && \
  sudo apt update && sudo apt install -y gh; }

node --version ; java -version ; git --version ; gh --version
gh auth status   # deve estar logado como renankakinho69
```

**Android SDK headless** (só pra android-ci; não precisa de GPU/emulador):
```bash
mkdir -p ~/android/cmdline-tools && cd ~/android/cmdline-tools
# Baixe o command-line tools Linux mais recente de developer.android.com/studio
# (seção "Command line tools only"), extraia de forma que fique em:
#   ~/android/cmdline-tools/latest/bin/sdkmanager
# Exemplo (ajuste a URL/versão conforme o site):
#   curl -o cli.zip -L "https://dl.google.com/android/repository/commandlinetools-linux-XXXXXXXX_latest.zip"
#   unzip cli.zip && mv cmdline-tools latest
grep -q ANDROID_HOME ~/.bashrc || {
  echo 'export ANDROID_HOME=$HOME/android' >> ~/.bashrc
  echo 'export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools' >> ~/.bashrc
}
source ~/.bashrc && yes | sdkmanager --licenses
```

---

## Passo 2 — gerar token de registro (self-service via gh, conta admin)

Não precisa abrir o GitHub. Como a conta é admin do repo, gere o token e a URL
do release mais recente do runner direto pelo `gh`:

```bash
REPO=TechFernandesLTDA/futeba-dos-parcas

# Token de registro (expira em ~1h — use logo em seguida)
REG_TOKEN=$(gh api --method POST "repos/$REPO/actions/runners/registration-token" --jq .token)
echo "token gerado: ${REG_TOKEN:0:6}…"

# Versão mais recente do runner Linux x64
RUNNER_VER=$(gh api repos/actions/runner/releases/latest --jq .tag_name | sed 's/^v//')
echo "runner version: $RUNNER_VER"
```

---

## Passo 3 — instalar e registrar o runner (Linux x64)

```bash
mkdir -p ~/actions-runner && cd ~/actions-runner
curl -o runner.tar.gz -L "https://github.com/actions/runner/releases/download/v${RUNNER_VER}/actions-runner-linux-x64-${RUNNER_VER}.tar.gz"
tar xzf runner.tar.gz

# Registro NÃO-interativo com as labels corretas pro routing
./config.sh --unattended \
  --url "https://github.com/$REPO" \
  --token "$REG_TOKEN" \
  --name futeba-wsl-5700x3d \
  --labels self-hosted,Linux,X64 \
  --work _work \
  --replace
```

> As labels `self-hosted,Linux,X64` são o que a PR de routing vai mirar pros jobs
> não-Apple. **Não** adicione `macOS`/`ARM64` aqui.

---

## Passo 4 — rodar como serviço (systemd)

```bash
cd ~/actions-runner
sudo ./svc.sh install "$USER"
sudo ./svc.sh start
sudo ./svc.sh status   # deve mostrar "active (running)"
```

Sem systemd (fallback): `nohup ./run.sh > runner.log 2>&1 &`.

---

## Passo 5 — clonar o repo de trabalho (opcional, acelera o 1º job)

O runner clona sozinho via `actions/checkout` no `_work`, mas pré-aquecer o
cache do Gradle ajuda:
```bash
git clone "https://github.com/$REPO" ~/futeba-dos-parcas
cd ~/futeba-dos-parcas && (cd web && npm ci) ; (cd functions && npm ci) ; ./gradlew help || true
```

---

## Passo 6 — ligar o balanceamento inteligente Mac↔WSL2

### Como o routing já está montado (lever centralizado)

**Todos** os ~39 jobs deste repo usam a mesma expressão:
```yaml
runs-on: ${{ fromJSON(vars.RUNNER_LABELS || '["self-hosted","macOS","ARM64"]') }}
```
Ou seja: leem a **variável de repo `RUNNER_LABELS`**; se ela não existir, caem no
fallback `["self-hosted","macOS","ARM64"]` (só Mac). Hoje a var **não existe** →
tudo vai pros 2 Macs.

### Ligar o balanceamento (1 comando, sem editar workflow)

Setar a var afrouxa **todos** os jobs de uma vez pra exigir só `self-hosted`,
fazendo Mac + Mac2 + WSL2 casarem o mesmo pool. O GitHub então **balanceia
sozinho**: o primeiro runner idle pega o job (sem pesos; é fila/first-available).
```bash
gh variable set RUNNER_LABELS --body '["self-hosted"]' --repo TechFernandesLTDA/futeba-dos-parcas
```

### ⚠️ FOOTGUN — fixar os jobs Apple-only ANTES de setar a var

A var afrouxa **inclusive** os jobs que **só rodam em macOS** — eles tentariam
rodar no WSL2 (Linux) e **falhariam**:

| Workflow | Por quê é Mac-only |
|----------|--------------------|
| `ios-build.yml` (4 jobs) | KMP iOS framework exige Xcode/macOS |
| `android-macrobenchmark.yml` | exige emulador/device Android |

**Antes** de `gh variable set RUNNER_LABELS`, edite esses dois arquivos trocando a
expressão da var por um literal fixo (assim ignoram a var e ficam presos ao Mac):
```yaml
runs-on: ["self-hosted", "macOS", "ARM64"]   # FIXO: iOS/macrobenchmark só no Mac
```
Faça via **branch + PR** (master é protegido). Depois que essa PR mergear, aí sim
rode o `gh variable set RUNNER_LABELS`.

> Ordem segura: (1) PR fixando ios-build.yml + android-macrobenchmark.yml → merge
> → (2) `gh variable set RUNNER_LABELS '["self-hosted"]'` → (3) abrir um PR que
> toque `web/` e confirmar em **Set up job → Runner name** que caiu no
> `futeba-wsl-5700x3d`. Se algo der errado, **reverter é instantâneo**:
> `gh variable delete RUNNER_LABELS` volta tudo pro fallback (só Mac).

### Alternativa (sem a var): editar runs-on por job

Em vez da var, dá pra trocar `runs-on` job-a-job pros não-Apple. Mais edições,
mais blast radius. A var-lever acima é preferível: 1 PR pequena (pin Apple) + 1
comando + revert trivial.

---

## Verificação pós-instalação

1. `sudo ./svc.sh status` → `active (running)`.
2. No GitHub: **Settings → Actions → Runners** → `futeba-wsl-5700x3d` aparece **idle/green**.
   (Via gh: `gh api repos/$REPO/actions/runners --jq '.runners[] | "\(.name)\t\(.status)"'`)
3. Após a PR de routing mergear, abra um PR que toque `web/` e confirme em
   **Set up job → Runner name** que caiu no `futeba-wsl-5700x3d`.

---

## Manutenção

- **Atualizar runner:** `sudo ./svc.sh stop && ./config.sh remove --token <novo>` e refaça os passos 2–4 com a versão nova (o runner também se auto-atualiza pra patches).
- **Remover runner:** `sudo ./svc.sh stop && sudo ./svc.sh uninstall && ./config.sh remove --token $(gh api --method POST repos/$REPO/actions/runners/remove-token --jq .token)`.
- **Logs:** `journalctl -u actions.runner.* -f` (com systemd) ou `~/actions-runner/runner.log` (nohup).

---

## (Apêndice) Windows nativo — não recomendado

Só se WSL2 não for viável. Precisa de Git Bash, `shell: bash` forçado em todos os
jobs, long-paths habilitado, exclusão do Defender em `_work` e
`core.autocrlf input`. Labels `self-hosted,Windows,X64`. O routing teria que
forçar `shell: bash` em cada job — mais frágil. Prefira WSL2.
