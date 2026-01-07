# CI/CD SETUP GUIDE

## GitHub Actions

Criar arquivo `.github/workflows/ci.yml`:

```yaml
name: Android CI/CD

on:
  push:
    branches: [ master, develop ]
  pull_request:
    branches: [ master ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Set up JDK 17
      uses: actions/setup-java@v3
      with:
        java-version: 17
        distribution: temurin
    - name: Build
      run: ./gradlew assembleDebug
    - name: Test
      run: ./gradlew test
```

## Secrets Necessarios

No GitHub: Settings > Secrets > Actions

- FIREBASE_TOKEN: Token do Firebase CLI
- KEYSTORE_FILE: Base64 do keystore de release
- KEYSTORE_PASSWORD: Senha do keystore

## Geracao do Firebase Token

```bash
firebase login:ci
# Copiar token gerado
```

## Deploy Manual

```bash
# Rules
firebase deploy --only firestore:rules,storage

# Functions
cd functions && npm run build && cd ..
firebase deploy --only functions

# Hosting (se existir)
firebase deploy --only hosting
```
