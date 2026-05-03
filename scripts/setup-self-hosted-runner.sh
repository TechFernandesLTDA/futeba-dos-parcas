#!/usr/bin/env bash
# ==============================================================================
# Setup GitHub Actions Self-Hosted Runner para macOS Apple Silicon
# ==============================================================================
# Uso:
#   ./scripts/setup-self-hosted-runner.sh <RUNNER_TOKEN>
#
# Ou via env:
#   GITHUB_RUNNER_TOKEN=AABBCC ./scripts/setup-self-hosted-runner.sh
#
# Opcoes:
#   --runner-dir DIR   Diretorio de instalacao (default: $HOME/actions-runner)
#   --runner-name NAME Nome do runner (default: hostname)
#   --no-svc           Nao instalar como servico launchd
#   --uninstall        Remove o runner existente
#   --check            So roda checks de dependencias e sai
#
# Token gerado em:
#   https://github.com/TechFernandesLTDA/futeba-dos-parcas/settings/actions/runners/new
#   (expira em ~1 hora; gere apenas no momento de rodar o script)
# ==============================================================================
set -euo pipefail

# ---- Config ------------------------------------------------------------------
REPO_OWNER="TechFernandesLTDA"
REPO_NAME="futeba-dos-parcas"
REPO_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}"
RUNNER_LABELS="self-hosted,macOS,ARM64"
RUNNER_DIR_DEFAULT="${HOME}/actions-runner"
RUNNER_NAME_DEFAULT="$(hostname -s)"
GITHUB_API="https://api.github.com/repos/actions/runner/releases/latest"

# ---- Cores -------------------------------------------------------------------
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[0;33m'
BLUE=$'\033[0;34m'
NC=$'\033[0m'

ok()    { printf "%s[OK]%s   %s\n"   "$GREEN" "$NC" "$1"; }
warn()  { printf "%s[WARN]%s %s\n"   "$YELLOW" "$NC" "$1"; }
err()   { printf "%s[ERR]%s  %s\n"   "$RED"   "$NC" "$1" >&2; }
info()  { printf "%s[INFO]%s %s\n"   "$BLUE"  "$NC" "$1"; }

# ---- Args --------------------------------------------------------------------
RUNNER_DIR="$RUNNER_DIR_DEFAULT"
RUNNER_NAME="$RUNNER_NAME_DEFAULT"
INSTALL_SVC=1
ACTION="install"
TOKEN="${GITHUB_RUNNER_TOKEN:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --runner-dir)  RUNNER_DIR="$2"; shift 2 ;;
    --runner-name) RUNNER_NAME="$2"; shift 2 ;;
    --no-svc)      INSTALL_SVC=0; shift ;;
    --uninstall)   ACTION="uninstall"; shift ;;
    --check)       ACTION="check"; shift ;;
    -h|--help)
      sed -n '2,25p' "$0"
      exit 0
      ;;
    *)
      if [[ -z "$TOKEN" ]]; then
        TOKEN="$1"
      else
        err "Argumento desconhecido: $1"
        exit 1
      fi
      shift
      ;;
  esac
done

# ---- Checks de plataforma ----------------------------------------------------
check_platform() {
  info "Verificando plataforma..."
  local os arch
  os="$(uname -s)"
  arch="$(uname -m)"
  if [[ "$os" != "Darwin" ]]; then
    err "Este script e apenas para macOS. Detectado: $os"
    exit 1
  fi
  if [[ "$arch" != "arm64" ]]; then
    err "Apenas Apple Silicon (arm64) suportado. Detectado: $arch"
    exit 1
  fi
  ok "macOS Darwin arm64"
}

check_dependencies() {
  info "Verificando dependencias para CI..."
  local missing=()

  # JDK 17 (java pode existir como stub no macOS sem JDK real)
  local jver=""
  if command -v java >/dev/null 2>&1; then
    jver="$(java -version 2>&1 | head -1 || true)"
    if echo "$jver" | grep -q "Unable to locate"; then
      err "java stub presente mas JDK nao instalado"
      missing+=("JDK 17 (brew install --cask temurin@17)")
    elif [[ -n "$jver" ]]; then
      ok "Java: $jver"
      if ! echo "$jver" | grep -qE '"17|"21'; then
        warn "JDK 17 recomendado. Instale via: brew install --cask temurin@17"
      fi
    else
      err "java falhou ao executar"
      missing+=("JDK 17 funcional")
    fi
  else
    err "java nao encontrado"
    missing+=("JDK 17 (brew install --cask temurin@17)")
  fi

  # Node 20+
  if command -v node >/dev/null 2>&1; then
    local nver
    nver="$(node --version 2>&1 || true)"
    if [[ -n "$nver" ]]; then
      ok "Node: $nver"
      local major="${nver#v}"
      major="${major%%.*}"
      if [[ "$major" =~ ^[0-9]+$ ]] && [[ "$major" -lt 20 ]]; then
        warn "Node 20+ recomendado. Detectado: $nver. Use: brew install node@20"
      fi
    else
      err "node falhou ao executar"
      missing+=("node (brew install node@20)")
    fi
  else
    err "node nao encontrado"
    missing+=("node (brew install node@20)")
  fi

  # Android SDK
  if [[ -n "${ANDROID_SDK_ROOT:-}" && -d "${ANDROID_SDK_ROOT}" ]]; then
    ok "ANDROID_SDK_ROOT: $ANDROID_SDK_ROOT"
  elif [[ -n "${ANDROID_HOME:-}" && -d "${ANDROID_HOME}" ]]; then
    ok "ANDROID_HOME: $ANDROID_HOME (defina ANDROID_SDK_ROOT como mesmo valor)"
  else
    err "ANDROID_SDK_ROOT/ANDROID_HOME nao definidos"
    missing+=("Android SDK (instale Android Studio e exporte ANDROID_SDK_ROOT)")
  fi

  # Xcode
  if xcode-select -p >/dev/null 2>&1; then
    ok "Xcode CLT: $(xcode-select -p)"
  else
    err "Xcode Command Line Tools nao instalado"
    missing+=("Xcode CLT (xcode-select --install)")
  fi

  # CocoaPods (para builds iOS)
  if command -v pod >/dev/null 2>&1; then
    ok "CocoaPods: $(pod --version)"
  else
    warn "pod nao encontrado (necessario para iOS). Instale: brew install cocoapods"
  fi

  # gcloud (opcional, para deploy)
  if command -v gcloud >/dev/null 2>&1; then
    ok "gcloud: $(gcloud --version 2>&1 | head -1 || echo 'erro ao versionar')"
  else
    warn "gcloud nao encontrado (necessario para deploy). brew install google-cloud-sdk"
  fi

  # firebase CLI (opcional, para deploy)
  if command -v firebase >/dev/null 2>&1; then
    ok "firebase: $(firebase --version 2>&1 | head -1 || echo 'erro ao versionar')"
  else
    warn "firebase CLI nao encontrado. npm install -g firebase-tools"
  fi

  # curl
  if command -v curl >/dev/null 2>&1; then
    ok "curl: $(curl --version | head -1)"
  else
    err "curl nao encontrado"
    missing+=("curl")
  fi

  # tar
  if command -v tar >/dev/null 2>&1; then
    ok "tar: disponivel"
  else
    err "tar nao encontrado"
    missing+=("tar")
  fi

  if [[ ${#missing[@]} -gt 0 ]]; then
    err "Dependencias obrigatorias ausentes:"
    for m in "${missing[@]}"; do
      err "  - $m"
    done
    exit 1
  fi

  ok "Todas dependencias obrigatorias presentes"
}

# ---- Uninstall ---------------------------------------------------------------
uninstall_runner() {
  info "Desinstalando runner em ${RUNNER_DIR}..."
  if [[ ! -d "$RUNNER_DIR" ]]; then
    warn "Diretorio ${RUNNER_DIR} nao existe; nada a fazer."
    exit 0
  fi
  pushd "$RUNNER_DIR" >/dev/null
  if [[ -f svc.sh ]]; then
    info "Parando e removendo servico launchd..."
    sudo ./svc.sh stop  || true
    sudo ./svc.sh uninstall || true
  fi
  if [[ -n "$TOKEN" ]]; then
    info "Removendo registro do GitHub..."
    ./config.sh remove --token "$TOKEN" || warn "Falha ao remover via API; remova manualmente em $REPO_URL/settings/actions/runners"
  else
    warn "Sem token: pule a remocao do GitHub UI manualmente em $REPO_URL/settings/actions/runners"
  fi
  popd >/dev/null
  info "Removendo diretorio ${RUNNER_DIR}..."
  rm -rf "$RUNNER_DIR"
  ok "Runner desinstalado."
}

# ---- Install -----------------------------------------------------------------
download_runner() {
  info "Buscando ultima release do GitHub Actions Runner..."
  local url
  url="$(curl -fsSL "$GITHUB_API" \
    | grep -oE 'https://[^"]+actions-runner-osx-arm64-[0-9.]+\.tar\.gz' \
    | head -1)"
  if [[ -z "$url" ]]; then
    err "Falha ao localizar tarball osx-arm64. Verifique conectividade."
    exit 1
  fi
  ok "Encontrado: $(basename "$url")"
  mkdir -p "$RUNNER_DIR"
  pushd "$RUNNER_DIR" >/dev/null
  if [[ ! -f config.sh ]]; then
    info "Baixando runner..."
    curl -fsSL -o runner.tar.gz "$url"
    info "Extraindo..."
    tar xzf runner.tar.gz
    rm runner.tar.gz
    ok "Runner extraido em $RUNNER_DIR"
  else
    info "Runner ja extraido em $RUNNER_DIR (pulando download)"
  fi
  popd >/dev/null
}

configure_runner() {
  info "Configurando runner '${RUNNER_NAME}' com labels '${RUNNER_LABELS}'..."
  pushd "$RUNNER_DIR" >/dev/null
  if [[ -f .runner ]]; then
    warn "Runner ja configurado em $RUNNER_DIR. Use --uninstall primeiro para reconfigurar."
    popd >/dev/null
    return 0
  fi
  ./config.sh \
    --url "$REPO_URL" \
    --token "$TOKEN" \
    --name "$RUNNER_NAME" \
    --labels "$RUNNER_LABELS" \
    --work "_work" \
    --unattended \
    --replace
  ok "Runner configurado."
  popd >/dev/null
}

# launchd nao carrega ~/.zshrc, entao ANDROID_SDK_ROOT/JAVA_HOME ficariam ausentes.
# O actions-runner carrega automaticamente .env do diretorio de instalacao.
write_runner_env() {
  local env_file="$RUNNER_DIR/.env"
  info "Escrevendo env vars em $env_file..."

  # Determina JAVA_HOME se nao definido
  local java_home="${JAVA_HOME:-}"
  if [[ -z "$java_home" ]] && [[ -x /usr/libexec/java_home ]]; then
    java_home="$(/usr/libexec/java_home -v 17 2>/dev/null || /usr/libexec/java_home 2>/dev/null || echo '')"
  fi

  # Determina ANDROID_SDK_ROOT
  local android_sdk="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
  if [[ -z "$android_sdk" && -d "$HOME/Library/Android/sdk" ]]; then
    android_sdk="$HOME/Library/Android/sdk"
    warn "ANDROID_SDK_ROOT nao definido; assumindo $android_sdk"
  fi

  # Constroi PATH minimo necessario para os workflows
  local path_extra="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
  [[ -n "$java_home" ]] && path_extra="${java_home}/bin:${path_extra}"
  [[ -n "$android_sdk" ]] && path_extra="${path_extra}:${android_sdk}/platform-tools:${android_sdk}/cmdline-tools/latest/bin"

  : > "$env_file"
  {
    [[ -n "$android_sdk" ]] && echo "ANDROID_SDK_ROOT=$android_sdk"
    [[ -n "$android_sdk" ]] && echo "ANDROID_HOME=$android_sdk"
    [[ -n "$java_home" ]]   && echo "JAVA_HOME=$java_home"
    echo "PATH=$path_extra"
    echo "LANG=en_US.UTF-8"
    echo "LC_ALL=en_US.UTF-8"
  } >> "$env_file"

  ok "Runner env escrito ($env_file):"
  sed 's/^/    /' "$env_file"

  if [[ -z "$android_sdk" ]]; then
    warn "ANDROID_SDK_ROOT nao detectado. Builds Android falharao."
    warn "Edite $env_file e adicione: ANDROID_SDK_ROOT=/path/to/sdk"
  fi
  if [[ -z "$java_home" ]]; then
    warn "JAVA_HOME nao detectado. setup-java action injeta no PATH no run, mas variavel ausente em runtime."
  fi
}

install_service() {
  info "Instalando como servico launchd..."
  pushd "$RUNNER_DIR" >/dev/null
  sudo ./svc.sh install
  sudo ./svc.sh start
  ok "Servico instalado e iniciado."
  info "Status: sudo ./svc.sh status"
  info "Stop:   sudo ./svc.sh stop"
  info "Start:  sudo ./svc.sh start"
  popd >/dev/null
}

run_interactive() {
  info "Modo interativo (sem servico). Para parar: Ctrl+C."
  warn "O runner morrera quando esta sessao terminar. Para producao use --no-svc=0 (default)."
  pushd "$RUNNER_DIR" >/dev/null
  ./run.sh
  popd >/dev/null
}

print_sleep_warning() {
  cat <<'WARN'

==============================================================================
ATENCAO: Mac em sleep desconecta o runner!
==============================================================================
Para evitar que o Mac durma e mate o runner:

  # Desabilitar sleep enquanto na tomada (recomendado para runner dedicado):
  sudo pmset -c sleep 0 disksleep 0

  # OU rodar caffeinate em background (menos invasivo, processo morre se reboot):
  caffeinate -d -i -s &

Para reverter o pmset:
  sudo pmset -c sleep 10  # ou outro valor original

==============================================================================
WARN
}

# ---- Main --------------------------------------------------------------------
main() {
  check_platform

  case "$ACTION" in
    check)
      check_dependencies
      ok "Check completo. Para instalar runner: $0 <TOKEN>"
      exit 0
      ;;
    uninstall)
      uninstall_runner
      exit 0
      ;;
    install)
      check_dependencies
      if [[ -z "$TOKEN" ]]; then
        err "Token de registro nao fornecido."
        err "Gere em: ${REPO_URL}/settings/actions/runners/new"
        err "Uso:    $0 <TOKEN>"
        err "Ou:     GITHUB_RUNNER_TOKEN=AABBCC $0"
        exit 1
      fi
      download_runner
      configure_runner
      write_runner_env
      if [[ "$INSTALL_SVC" -eq 1 ]]; then
        install_service
        print_sleep_warning
        ok "Runner '${RUNNER_NAME}' rodando como servico."
        info "Verifique online em: ${REPO_URL}/settings/actions/runners"
      else
        print_sleep_warning
        run_interactive
      fi
      ;;
  esac
}

main "$@"
