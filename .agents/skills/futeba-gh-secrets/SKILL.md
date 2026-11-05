---
name: futeba-gh-secrets
description: Setar GitHub Secrets corretamente, com workarounds para shell injection (`$digit` em senhas), paths como secrets (mascarados pelo GH viram empty), e JSON multi-line. Use quando "setar secret", "configurar secret CI", "secret não funciona", "password incorrect no CI".
---

# Futeba GitHub Secrets

Aprendi via 13 deploys falhando que GitHub Secrets têm armadilhas não-óbvias. Esta skill consolida.

## Regra #1 — NUNCA passar secret via `--body "$VAR"` em command-line

```bash
# ✗ ERRADO — bash expande $1, $10 etc dentro do valor antes do gh receber
gh secret set MY_PWD --body "$PWD_VAR"  # Se PWD_VAR=VAN$14foo, vira "VAN<empty>foo"
```

```bash
# ✓ CERTO — stdin via file ou redirect
TMP=$(mktemp); printf '%s' "$PWD_VAR" > "$TMP"
gh secret set MY_PWD < "$TMP"
rm -f "$TMP"

# ✓ CERTO — stdin via process substitution
gh secret set MY_PWD < <(printf '%s' "$PWD_VAR")
```

**Sintoma diagnóstico no workflow:**
```yaml
- run: |
    echo "len=${#MY_PWD}"  # se mostra 1 ao invés do esperado, foi expansão
```

## Regra #2 — Senhas com `$digit` devem ir em base64

Ainda que o set funcione corretamente, no workflow pode haver re-expansão. Mais seguro:

```bash
# Set
TMP=$(mktemp)
printf '%s' "$PWD_VAR" | base64 > "$TMP"
gh secret set MY_PWD_B64 -R "$REPO" < "$TMP"
rm -f "$TMP"

# Workflow
env:
  MY_PWD_B64: ${{ secrets.MY_PWD_B64 }}
run: |
  PW=$(printf '%s' "$MY_PWD_B64" | base64 --decode)
```

Base64 não tem chars sensíveis a shell.

## Regra #3 — Paths e nomes de arquivo NÃO devem ser secrets

Se o secret é `/tmp/release.jks`, o GH mascara o valor inteiro nos logs como `***`. Aí erros tipo:

```
Keystore file '/Users/.../app/***' not found
```

ficam impossíveis de diagnosticar. **Hardcode paths não-sensíveis no workflow:**

```yaml
# ✓ Bom
env:
  KEYSTORE_BASE64: ${{ secrets.KEYSTORE_BASE64 }}
run: |
  printf '%s' "$KEYSTORE_BASE64" | base64 --decode > "$RUNNER_TEMP/release.jks"
```

```yaml
# ✗ Ruim — KEYSTORE_PATH virou secret e ficou mascarado
env:
  KEYSTORE_PATH: ${{ secrets.KEYSTORE_PATH }}
run: |
  ... > "$KEYSTORE_PATH"  # Path some dos logs, debug fica impossivel
```

## Regra #4 — JSON multi-line vai com env + printf

```yaml
# ✗ ERRADO — quebra com aspas/parens dentro do JSON
- run: echo '${{ secrets.GOOGLE_SERVICES_JSON }}' > app/google-services.json
```

```yaml
# ✓ CERTO
- env:
    GOOGLE_SERVICES_JSON: ${{ secrets.GOOGLE_SERVICES_JSON }}
  run: |
    printf '%s' "$GOOGLE_SERVICES_JSON" > app/google-services.json
```

`printf '%s'` preserva linhas e chars especiais sem interpretar.

## Regra #5 — Chamadas a comandos que escrevem em arquivo: usar env, sempre

```yaml
# ✗ Vulnerável a injection se algum secret tiver chars especiais
run: |
  echo "STORE_PASSWORD=${{ secrets.PWD }}" >> file
```

```yaml
# ✓ Seguro
env:
  PWD: ${{ secrets.PWD }}
run: |
  printf 'STORE_PASSWORD=%s\n' "$PWD" >> file
```

## Setar 8 secrets do projeto Futeba (template)

```bash
DRIVE="$HOME/Library/CloudStorage/GoogleDrive-renankakinho69@gmail.com/Meu Drive/Projetos/Futeba"
REPO="TechFernandesLTDA/futeba-dos-parcas"

# Helpers
set_secret_file() { gh secret set "$1" -R "$REPO" < "$2"; }
set_secret_b64()  { local tmp=$(mktemp); printf '%s' "$2" | base64 > "$tmp"; gh secret set "$1" -R "$REPO" < "$tmp"; rm -f "$tmp"; }
set_secret_str()  { local tmp=$(mktemp); printf '%s' "$2" > "$tmp"; gh secret set "$1" -R "$REPO" < "$tmp"; rm -f "$tmp"; }

# Extrair de local.properties
STORE_PW=$(awk -F= '/^STORE_PASSWORD=/{ sub(/^STORE_PASSWORD=/,""); print }' "$DRIVE/local.properties")
KEY_PW=$(awk -F= '/^KEY_PASSWORD=/{ sub(/^KEY_PASSWORD=/,""); print }' "$DRIVE/local.properties")
KEY_AL=$(awk -F= '/^KEY_ALIAS=/{ sub(/^KEY_ALIAS=/,""); print }' "$DRIVE/local.properties")

# Set
TMP=$(mktemp); base64 -i "$DRIVE/futebadosparcas_keystore/keystore" > "$TMP"
gh secret set KEYSTORE_BASE64 -R "$REPO" < "$TMP"; rm -f "$TMP"

set_secret_b64 KEYSTORE_PASSWORD_B64 "$STORE_PW"
set_secret_b64 KEY_PASSWORD_B64 "$KEY_PW"
set_secret_str KEY_ALIAS "$KEY_AL"
set_secret_file GOOGLE_SERVICES_JSON "$DRIVE/google-services.json"  # ou do worktree main
set_secret_file PLAY_STORE_SERVICE_ACCOUNT_JSON "$DRIVE/futebadosparcas-firebase-adminsdk-fbsvc-33e32233c6.json"

# NUNCA: gh secret set KEYSTORE_PATH "/tmp/..."  ← não faça
# Hardcode em workflow: $RUNNER_TEMP/release.jks
```

## Validar secret está correto sem expor

```yaml
# Em workflow, debug step:
env:
  MY_PWD_B64: ${{ secrets.MY_PWD_B64 }}
run: |
  PW=$(printf '%s' "$MY_PWD_B64" | base64 --decode)
  PW_LEN=${#PW}
  PW_SHA=$(printf '%s' "$PW" | shasum -a 256 | head -c 16)
  echo "::notice::pwd len=$PW_LEN sha8=$PW_SHA"
```

Comparar SHA8 com local: `printf '%s' "$LOCAL_PWD" | shasum -a 256 | head -c 16`

## Listar secrets atuais

```bash
gh secret list -R TechFernandesLTDA/futeba-dos-parcas
```

## Refs

- Skill `futeba-play-store` — uso prático destes secrets
- PRs com bug fixes: #527, #530, #531, #533
- Memory: `project_play_store_secrets_set.md`
