# Setup do pipeline de publicação Play Store

Scripts pra ativar `deploy-production.yml` (que está pronto mas inativo por falta de secrets).

**Spec completa:** [specs/feat-2026-05-06-activate-play-store-pipeline.md](../../../specs/feat-2026-05-06-activate-play-store-pipeline.md)

## Pré-requisitos

- macOS ou Linux
- gh CLI logado (`gh auth status`)
- firebase CLI logado (`firebase login`)
- gcloud CLI logado (`gcloud auth login`)
- keytool (vem com JDK)
- Permissão Owner no GCP project `futebadosparcas`
- Permissão Admin no Play Console (https://play.google.com/console)
- App `com.futebadosparcas` JÁ existe no Play Console com pelo menos 1 release manual

## Ordem de execução

```bash
cd scripts/setup/play-store
chmod +x *.sh

./00-overview.sh                  # mostra checklist e abre URLs
./01-generate-keystore.sh         # gera keystore release (interativo, IRREVERSÍVEL)
./02-create-play-sa.sh            # cria Service Account no GCP
./03-set-github-secrets.sh        # seta os 7 secrets via gh CLI
./04-cadastrar-sha-firebase.sh    # adiciona SHA-1 do release no Firebase
./05-validate.sh                  # smoke test local + checklist final
./06-trigger-deploy.sh            # dispara primeiro deploy
```

## ⚠️ AVISOS CRÍTICOS

### Antes de rodar 01-generate-keystore.sh

Se o app **já está publicado** no Play Store com um keystore antigo:
- **NÃO** gere um novo. Recupere o `.jks` original.
- **A MENOS QUE** Play App Signing esteja ativado (default desde 2021): aí o upload key pode ser substituído via Play Console → Settings → App integrity → Upload key reset.

Se o app **nunca foi publicado** ou se Play App Signing está ATIVO:
- Pode gerar novo upload key tranquilo.

### Antes de rodar 03-set-github-secrets.sh

Confirma que estes arquivos existem e têm conteúdo correto:
- `~/.android-keystores/futebadosparcas-release.jks`
- `~/.android-keystores/futebadosparcas-release.creds`
- `~/.android-keystores/play-sa.json`
- `app/google-services.json` (já está no repo, gitignored)

### Storage seguro

Os arquivos em `~/.android-keystores/` têm permissão `600` (só você lê).
**Faça backup** em local seguro (1Password, etc.) — perda do keystore = perda do controle do app no Play Store (a menos que Play App Signing esteja ativo).

## Manual no meio do caminho

Dois pontos que **só você pode fazer no browser**:

### Após `02-create-play-sa.sh`:
1. Abrir https://play.google.com/console/u/0/developers/api-access
2. Link o projeto `futebadosparcas` se ainda não estiver linkado
3. Encontrar a SA `github-actions-play-deploy@futebadosparcas.iam.gserviceaccount.com`
4. Conceder permissão **"Release Manager"** (ou superior)

### Após `04-cadastrar-sha-firebase.sh`:
1. Pegar SHA-1 do **App Signing Key** no Play Console → Setup → App integrity
2. Adicionar em https://console.firebase.google.com/project/futebadosparcas/settings/general
3. Em "Your apps" → Android `com.futebadosparcas` → "Add fingerprint"
4. Re-baixar `google-services.json` e substituir `app/google-services.json` (gitignored, mas precisa pra build local funcionar)

## Validação no fim

Depois de tudo:

```bash
./05-validate.sh
```

Output esperado: `✅ ALL CHECKS PASSED`

## Trigger primeiro deploy

```bash
./06-trigger-deploy.sh
# ou manualmente:
gh workflow run deploy-production.yml -R TechFernandesLTDA/futeba-dos-parcas
```

Acompanhar:
- GitHub Actions: https://github.com/TechFernandesLTDA/futeba-dos-parcas/actions/workflows/deploy-production.yml
- Play Console (Internal Testing): https://play.google.com/console

## Rollback de emergência

Se algo der errado em produção:

```bash
# Despublica release Internal Testing (NÃO toca Production)
# UI Play Console: Release → Internal Testing → "Discard" no release ativo
```

Para Production rollout (já promovido):
- Play Console → Production → Halt rollout
