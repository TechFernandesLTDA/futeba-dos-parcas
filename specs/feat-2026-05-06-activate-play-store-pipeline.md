# Spec: Ativar Pipeline Automático de Publicação Android (Play Store)

**Status:** READY (executar quando o usuário pedir)
**Tipo:** chore (infra/CI)
**Owner:** @renankakinho69 (renan.fernandes@outlook.com)
**Created:** 2026-05-06
**Refs:** —

---

## Contexto

A infraestrutura de publicação automática **já existe no código** ([deploy-production.yml](.github/workflows/deploy-production.yml), [Fastfile](fastlane/Fastfile)) mas está **inativa** porque:

1. Nenhum dos 7 GitHub Secrets necessários está configurado (`gh secret list` mostra só `CLAUDE_CODE_OAUTH_TOKEN`)
2. Última execução de `deploy-production` (v1.7.2, 2026-02-01) falhou e nunca rodou de novo
3. Desde então, 13 tags `v*` foram criadas (v1.8.0 → v1.21.0) sem deploy automático
4. Pendência registrada na memória: cadastrar SHA-1 do App Signing key no Firebase (Phone Auth quebra senão)

## Objetivo

Após executar este spec, fazer `git tag v1.22.0 && git push --tags` deve resultar em:
1. Build do AAB assinado
2. Upload pra Play Store track `internal`
3. GitHub Release criado
4. App disponível pra teste interno em ~1h

## Tech Stack envolvido

- **GitHub Actions** ([deploy-production.yml](.github/workflows/deploy-production.yml))
- **Fastlane** ([Fastfile](fastlane/Fastfile)) - lanes `internal` (upload AAB) e `production` (promove com 10% rollout)
- **Google Play Console** (criar/verificar app + Service Account + 1 release manual)
- **Google Cloud Console** (Service Account com Play Developer API)
- **Firebase Console** (cadastrar SHA-1 release)

## Estado atual verificado (2026-05-06)

| Item | Status |
|------|--------|
| Workflow `deploy-production.yml` | ✅ existe, bem desenhado |
| Workflow `deploy-beta.yml` | ✅ existe |
| Workflow `version-bump.yml` | ✅ auto-bump em push master |
| Fastlane `internal` lane | ✅ pronto |
| Fastlane `production` lane | ✅ pronto (10% rollout) |
| GitHub Secrets necessários | ❌ 0 dos 7 setados |
| Service Account GCP | ❓ a verificar |
| App no Play Console | ❓ a verificar |
| Keystore release | ❌ não está no repo (esperado) |
| SHA-1 release no Firebase | ❌ pendente |

## Tools disponíveis no ambiente

- ✅ `gh` 2.92.0 (logged in: renanlocatizfernandes, ADMIN)
- ✅ `firebase` 15.16.0 (logged in: renankakinho69@gmail.com, project `futebadosparcas`)
- ✅ `gcloud` 566.0.0 (precisa rodar `gcloud auth login`)
- ✅ `keytool` (Java JDK 17)

## Constants

```bash
# IDs e nomes (vão pros scripts)
APPLICATION_ID="com.futebadosparcas"
FIREBASE_PROJECT_ID="futebadosparcas"
FIREBASE_PROJECT_NUMBER="490094091078"
FIREBASE_ANDROID_APP_ID="1:490094091078:android:4acb28d78734931db5a347"
GH_REPO="TechFernandesLTDA/futeba-dos-parcas"

# Convenções
KEYSTORE_LOCATION="$HOME/.android-keystores/futebadosparcas-release.jks"
KEY_ALIAS="futebadosparcas"
SA_NAME="github-actions-play-deploy"
SA_DISPLAY_NAME="GitHub Actions Play Store Deploy"
GCP_PROJECT="futebadosparcas"
```

## Plano de execução

### Fase 0 — Pré-requisitos manuais (~30min)

Coisas que **só você pode fazer** (criação de conta, agreement, pagamento):

- [ ] **Play Console** — Verificar que `com.futebadosparcas` existe lá (https://play.google.com/console/u/0/developers)
  - Se NÃO existir: criar app (precisa pagar US$25 de taxa única se nunca pagou)
  - Se existir mas SEM nenhum release: fazer 1 upload manual primeiro (Play exige antes de aceitar API)
- [ ] **GCP IAM** — Confirmar que tem permissão `roles/owner` ou equivalente em `futebadosparcas` (https://console.cloud.google.com/iam-admin/iam?project=futebadosparcas)
- [ ] **gcloud CLI auth** — rodar `gcloud auth login` (browser abre)
- [ ] **gcloud project set** — rodar `gcloud config set project futebadosparcas`

### Fase 1 — Keystore (~5min) 🔑 IRREVERSÍVEL

⚠️ **CRÍTICO**: Se app já tem release no Play Store assinado com keystore antigo, NÃO gerar novo. Recuperar o `.jks` original ou usar Play App Signing (se ativado, podemos gerar nova upload key).

```bash
./scripts/setup/play-store/01-generate-keystore.sh
# Pergunta interativamente. Salva em ~/.android-keystores/
```

Output esperado:
- Keystore em `~/.android-keystores/futebadosparcas-release.jks`
- SHA-1 e SHA-256 impressos (anotar pra Fase 4)
- Senhas em arquivo separado `~/.android-keystores/futebadosparcas-release.creds` (chmod 600)

### Fase 2 — Service Account GCP (~5min)

```bash
./scripts/setup/play-store/02-create-play-sa.sh
# Cria SA, gera key JSON, salva em ~/.android-keystores/play-sa.json
```

Output:
- SA criada: `github-actions-play-deploy@futebadosparcas.iam.gserviceaccount.com`
- Key JSON em `~/.android-keystores/play-sa.json`
- Roles concedidos: `roles/serviceusage.serviceUsageConsumer`

⚠️ **Manual depois**: ir no Play Console → Settings → API access → Link Cloud project `futebadosparcas` → conceder permissão "Release Manager" pro SA. URL: https://play.google.com/console/u/0/developers/api-access

### Fase 3 — GitHub Secrets (~3min)

```bash
./scripts/setup/play-store/03-set-github-secrets.sh
# Lê os arquivos das fases 1-2 e seta 7 secrets via gh secret set
```

Secrets que serão setados:
- `KEYSTORE_BASE64` — keystore .jks em base64
- `KEYSTORE_PATH` — path onde a workflow vai escrever (`/tmp/release.jks`)
- `KEYSTORE_PASSWORD` — senha do keystore
- `KEY_ALIAS` — `futebadosparcas`
- `KEY_PASSWORD` — senha da key
- `GOOGLE_SERVICES_JSON` — conteúdo de `app/google-services.json`
- `PLAY_STORE_SERVICE_ACCOUNT_JSON` — conteúdo do JSON da SA

Validação:
```bash
gh secret list -R TechFernandesLTDA/futeba-dos-parcas
# Deve listar 8 secrets (CLAUDE_CODE_OAUTH_TOKEN + 7 novos)
```

### Fase 4 — Cadastrar SHA-1 no Firebase (~2min)

Resolve a pendência registrada em memory `project_play_store_sha_release.md`.

```bash
./scripts/setup/play-store/04-cadastrar-sha-firebase.sh
# Lê SHA-1 do keystore + chama gcloud firebase apps android:create-fingerprint
```

⚠️ **Manual também**: ir no Firebase Console → Project Settings → seu app Android → "Add fingerprint" e colar SHA-1 do **App Signing key do Play Console** (NÃO o upload key local). URL: https://console.firebase.google.com/project/futebadosparcas/settings/general

### Fase 5 — Validação (~5min, sem downtime)

```bash
./scripts/setup/play-store/05-validate.sh
# Roda smoke test local: bundleRelease + verifica AAB + mostra checklist
```

Checklist final:
- [ ] `./gradlew bundleRelease` builda local com keystore
- [ ] `gh secret list` mostra 8 secrets
- [ ] Play Console mostra SA com permissão "Release Manager"
- [ ] Firebase Console mostra SHA-1 release cadastrado

### Fase 6 — Trigger primeiro deploy (~10min)

```bash
./scripts/setup/play-store/06-trigger-deploy.sh
# Opção A: gh workflow run deploy-production.yml (não usa tag)
# Opção B: git tag v1.22.0 && git push --tags
```

Monitorar em: https://github.com/TechFernandesLTDA/futeba-dos-parcas/actions/workflows/deploy-production.yml

Esperado: success em ~10-15min, AAB visível em Play Console → Internal Testing.

## Decisões já tomadas

1. **Track inicial**: `internal` (não `production`). Promoção pra produção é manual via fastlane lane `production` (10% rollout).
2. **Keystore separado por ambiente**: NÃO. Um único keystore release usado em CI + dev local.
3. **Play App Signing**: assumimos ATIVADO (default Google). Se ativo, perda do upload key é recuperável.
4. **Storage de credenciais locais**: `~/.android-keystores/` com chmod 600. Backup manual recomendado em local seguro.
5. **Self-hosted runner**: workflow já roda em `["self-hosted","macOS","ARM64"]` (com fallback via `vars.RUNNER_LABELS`). Confirmar que pool tá UP antes do deploy via `/futeba-runner`.

## Pegadinhas conhecidas

- **Play Console + GCP linkagem**: precisa fazer 1x manual em Play Console → API access → Link Project. Sem isso, o SA não vê o app.
- **First release manual**: Google EXIGE que o primeiro release seja feito pela UI do Play Console. API só funciona a partir do 2º.
- **SHA-1 dual**: tem dois SHAs — upload key (local) e App Signing key (Play Console gerencia). **Phone Auth precisa do App Signing key SHA-1**, não do upload key.
- **`r0adkll/upload-google-play@v1`**: action usa serviceAccountJsonPlainText (não path). Garantir que o secret tem o JSON completo, não path.

## Rollback

Se algo der errado em produção:
1. Despublicar release no Play Console (track Internal): https://play.google.com/console
2. Não há deploy revert via gh — Play Console controla
3. Bug crítico em prod: usar `fastlane halt_rollout` ou despublicar via UI

## Próximos passos pós-ativação

- [ ] Configurar `deploy-beta.yml` (Firebase App Distribution) com mesmos secrets + `FIREBASE_APP_ID` + `FIREBASE_SERVICE_ACCOUNT_JSON`
- [ ] Adicionar lane `fastlane production` no workflow (promoção internal → production com staged rollout)
- [ ] Configurar Slack webhook em `Fastfile.rb:55` (linha comentada)
- [ ] Auto-criar release notes a partir de Conventional Commits desde último tag
