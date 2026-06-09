# Guia de CI/CD — Futeba dos Parças

> Para detalhes completos dos workflows em produção, consulte os arquivos em `.github/workflows/`.

## GitHub Actions

Os workflows já existem em `.github/workflows/`. O exemplo abaixo é um ponto de partida para novos workflows:

```yaml
name: Android CI

on:
  push:
    branches: [ master ]
  pull_request:
    branches: [ master ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Set up JDK 17
      uses: actions/setup-java@v4
      with:
        java-version: 17
        distribution: temurin
    - name: Build
      run: ./gradlew assembleDebug
    - name: Test
      run: ./gradlew test
```

## Secrets Necessários

No GitHub: Settings > Secrets and variables > Actions

- `FIREBASE_TOKEN`: Token do Firebase CLI (gerado via `firebase login:ci`)
- `KEYSTORE_FILE`: Base64 do keystore de release
- `KEYSTORE_PASSWORD`: Senha do keystore
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`: JSON da Service Account do Play Store

> Ver skill `/futeba-gh-secrets` para o padrão correto de injeção de secrets (evitar `$digit` no nome).

## Geração do Token Firebase

```bash
firebase login:ci
# Copiar o token gerado e salvar como secret FIREBASE_TOKEN
```

## Deploy Manual

```bash
# Firestore rules + indexes
firebase deploy --only firestore

# Cloud Functions
cd functions && npm run build && cd ..
firebase deploy --only functions

# Web Hosting
cd web && npm run build && cd ..
firebase deploy --only hosting
```

## Workflows em produção

| Workflow | Arquivo | Trigger |
|----------|---------|---------|
| Android CI | `android-ci.yml` | Push/PR a `master` |
| Cloud Functions CI | `functions-ci.yml` | Push/PR a `master` |
| Beta deploy | `deploy-beta.yml` | Manual ou tag |
| Play Store deploy | `deploy-production.yml` | Release tag `v*` |
| iOS build (KMP) | `ios-build.yml` | Push/PR (macOS runner) |
