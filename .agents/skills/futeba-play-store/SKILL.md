---
name: futeba-play-store
description: Deploy do app Android pro Google Play Store via GitHub Actions deploy-production.yml. Inclui setup inicial dos secrets, gates manuais, troubleshooting comum, e disparo de releases. Use quando "publicar Android", "subir Play Store", "novo release Android", ou após bumpar versão.
---

# Futeba Play Store Deploy

Pipeline `deploy-production.yml` builda AAB assinado e sobe pro track Internal Testing. Configurado e testado 2026-05-07.

## Status atual (2026-05-07)

- ✅ 8/8 GitHub Secrets configurados
- ✅ SHA-1 release cadastrado no Firebase
- ✅ SA `firebase-adminsdk-fbsvc@futebadosparcas.iam.gserviceaccount.com` com Release Manager no Play Console
- ✅ App `com.futebadosparcas` no Play Console com release manual
- ✅ Run 25473394288 success — pipeline funcional

## Disparar deploy

**Opção A — manual via GitHub UI:**
- Actions → "Deploy to Google Play Store" → Run workflow

**Opção B — via gh CLI:**
```bash
gh workflow run deploy-production.yml -R TechFernandesLTDA/futeba-dos-parcas --ref master
```

**Opção C — via tag (release oficial):**
```bash
git tag v1.X.Y
git push origin v1.X.Y
# Auto Version Bump pode também criar tag em push pra master
```

## Promover para Production

Track inicial sempre é `internal`. Pra production usar fastlane:
```bash
cd fastlane
bundle exec fastlane production  # 10% staged rollout
```

Ou Play Console UI → Production → Promote release.

## Secrets configurados (8 total)

| Secret | Conteúdo | Notas |
|--------|----------|-------|
| `KEYSTORE_BASE64` | keystore .jks em base64 | wrapped multiline OK |
| `KEYSTORE_PASSWORD_B64` | senha do store em base64 | **B64 obrigatório** — `$1`, `$10` etc são expandidos pelo shell |
| `KEY_ALIAS` | `futebadosparcaskey` | string puro |
| `KEY_PASSWORD_B64` | senha da key em base64 | mesma razão B64 |
| `GOOGLE_SERVICES_JSON` | conteúdo de `app/google-services.json` | JSON multiline |
| `PLAY_STORE_SERVICE_ACCOUNT_JSON` | SA Firebase Admin SDK JSON | reaproveitada como deploy SA |
| `KEYSTORE_PATH` | (legado) | hardcode em workflow agora — `$RUNNER_TEMP/release.jks` |
| `KEYSTORE_PASSWORD`/`KEY_PASSWORD` | (legado) | substituídos pelas versões `_B64` |

Local de origem: `~/Library/CloudStorage/GoogleDrive-renankakinho69@gmail.com/Meu Drive/Projetos/Futeba/`

## Como o workflow funciona

```
1. checkout master
2. JDK 17 + setup-gradle
3. Decode KEYSTORE_PASSWORD_B64 → STORE_PW
4. Escrever local.properties (printf '%s\n' pra evitar shell expansion)
5. Decode KEYSTORE_BASE64 → $RUNNER_TEMP/release.jks (verifica SHA + keytool list)
6. Decode google-services.json → app/google-services.json
7. ./gradlew bundleRelease --no-configuration-cache --rerun-tasks
8. r0adkll/upload-google-play@v1 → track: internal
9. softprops/action-gh-release@v2 → cria release no GitHub
```

## Troubleshooting

| Sintoma | Causa | Fix |
|---------|-------|-----|
| `Malformed root json at app/google-services.json` | shell injection em `echo '${{ secrets.X }}'` | usar env + `printf '%s'` (já fixado em master) |
| `Keystore file 'app/***' not found` | `KEYSTORE_PATH` como secret = mascarado | hardcode `$RUNNER_TEMP/release.jks` (fixado) |
| `keystore password was incorrect` | senha com `$digit` foi expandida ao setar secret | usar `_B64` versions |
| `No key with alias '***' found` | KEY_ALIAS errado/empty | re-set via `gh secret set KEY_ALIAS` com stdin file |
| `caller does not have permission` | SA não tem Release Manager no Play Console | adicionar via Play Console → Usuários e permissões |
| `Google Play API has not been used` | API não habilitada no GCP | https://console.developers.google.com/apis/api/androidpublisher.googleapis.com/overview?project=490094091078 → Enable |
| `App not found by API` | App ainda não publicou release manual | Play Console → primeiro release pela UI |

## Reset/setar secrets se precisar

Senhas com `$` exigem b64 encoding:
```bash
DRIVE="$HOME/Library/CloudStorage/GoogleDrive-renankakinho69@gmail.com/Meu Drive/Projetos/Futeba"
STORE_PW=$(awk -F= '/^STORE_PASSWORD=/{ sub(/^STORE_PASSWORD=/,""); print }' "$DRIVE/local.properties")

TMP=$(mktemp)
printf '%s' "$STORE_PW" | base64 > "$TMP"
gh secret set KEYSTORE_PASSWORD_B64 -R TechFernandesLTDA/futeba-dos-parcas < "$TMP"
rm -f "$TMP"
```

NUNCA: `gh secret set KEYSTORE_PASSWORD --body "$STORE_PW"` — `$1`, `$10` etc viram positional args, senha vira len=1.

## Validar SA tem permissão (sem rodar workflow)

```bash
DRIVE="$HOME/Library/CloudStorage/GoogleDrive-renankakinho69@gmail.com/Meu Drive/Projetos/Futeba"
gcloud auth activate-service-account --key-file="$DRIVE/futebadosparcas-firebase-adminsdk-fbsvc-33e32233c6.json" --quiet
TOKEN=$(gcloud auth print-access-token --scopes=https://www.googleapis.com/auth/androidpublisher)
curl -s -X POST "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.futebadosparcas/edits" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Resposta esperada:
```json
{ "id": "...", "expiryTimeSeconds": "..." }
```

Se `"caller does not have permission"` → SA perdeu acesso, refazer Play Console permissions.

## Gates manuais (se SA precisar reconfigurar)

1. **API enable** (uma vez): https://console.developers.google.com/apis/api/androidpublisher.googleapis.com/overview?project=490094091078
2. **Play Console permissions** (importante: 2026 mudou, agora é via "Usuários e permissões"):
   - https://play.google.com/console/u/0/developers/4966237927930283252/users-and-permissions
   - "Convidar novos usuários"
   - Email: `firebase-adminsdk-fbsvc@futebadosparcas.iam.gserviceaccount.com`
   - Permissões de conta: View app information + Manage releases
   - Permissões de app: "Futeba dos Parças" → Admin
   - Salvar (auto-aceita pra SA)

## Próximos releases

```bash
# Bumpar versionCode em app/build.gradle.kts (ou auto via Auto Version Bump)
# Push pra master → Auto Version Bump cria tag → tag dispara deploy
git push origin master
```

## Refs

- Spec: [specs/feat-2026-05-06-activate-play-store-pipeline.md](../../../specs/feat-2026-05-06-activate-play-store-pipeline.md)
- Setup scripts: [scripts/setup/play-store/](../../../scripts/setup/play-store/)
- Workflow: [.github/workflows/deploy-production.yml](../../../.github/workflows/deploy-production.yml)
- PRs do setup: #524, #530, #531, #533, #537
- Memory: `project_play_store_secrets_set.md`
