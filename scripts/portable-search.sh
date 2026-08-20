#!/usr/bin/env bash

# Keep CI searches usable on WSL runners without Homebrew or ripgrep.
portable_search() {
  local pattern="$1"
  shift

  if command -v rg >/dev/null 2>&1; then
    rg --no-heading --line-number --color=never \
      --glob '!.git' --glob '!node_modules' --glob '!*.lock' \
      --glob '!dist/**' --glob '!lib/**' --glob '!.claude/**' \
      --glob '!build/**' --glob '!.gradle/**' --glob '!.firebase/**' \
      --glob '!scripts/archive/**' --glob '!scripts/migrations/**' \
      "$pattern" "$@"
    return
  fi

  # git grep is available on both macOS and WSL and only searches tracked files,
  # matching the CI secret-audit contract without host-specific grep flags.
  git grep -nE --no-color "$pattern" -- "$@" \
    ':(exclude)**/*.lock' ':(exclude)dist/**' ':(exclude)lib/**' \
    ':(exclude).claude/**' ':(exclude)build/**' ':(exclude).gradle/**' \
    ':(exclude).firebase/**' ':(exclude)scripts/archive/**' \
    ':(exclude)scripts/migrations/**'
}
