# 📋 Guia Completo de Setup - Futeba dos Parças

## Índice
- [Pré-requisitos](#pré-requisitos)
- [Setup Android](#setup-android)
- [Setup Firebase](#setup-firebase)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Verificação de Saúde](#verificação-de-saúde)
- [Troubleshooting](#troubleshooting)
- [Próximos Passos](#próximos-passos)

---

## Pré-requisitos

### Ferramentas Globais (Obrigatório para Todos)

- **Git** (v2.30+): [https://git-scm.com/downloads](https://git-scm.com/downloads)
- **Terminal/PowerShell**: Windows PowerShell ou similar

### Setup Android

**Requisitos:**
- **Android Studio** Iguana ou posterior
  - Download: [https://developer.android.com/studio](https://developer.android.com/studio)
  - Durante instalação, aceite SDK tools padrão

- **JDK 17** (incluído com Android Studio moderno)
  - Se precisar instalação manual: [Amazon Corretto 17](https://aws.amazon.com/corretto/)
  - Ou via `JAVA_HOME` apontando para Android Studio JBR: `C:\Program Files\Android\Android Studio\jbr`

- **Android SDK**
  - Target API: 35 (Android 15)
  - Min API: 24 (Android 7.0)
  - Instalar via Android Studio: Tools → SDK Manager

- **Emulador Android ou Device Físico**
  - Emulador: Mínimo 2GB RAM, preferível 4GB
  - Physical Device: Android 7.0+ com USB Debug habilitado

### Setup Cloud Functions & Web

**Requisitos:**
- **Node.js** v22 (LTS obrigatório — ver `.nvmrc`)
  - Download: [https://nodejs.org](https://nodejs.org)
  - Recomendado: use `nvm` — `nvm use` na raiz já seleciona a versão correta
  - Verificar: `node --version && npm --version`

- **Firebase CLI** v13+
  - Install: `npm install -g firebase-tools`
  - Verificar: `firebase --version`

> **Nota:** O backend REST Express+PostgreSQL está **arquivado** em `archive/backend/` e não é usado em produção (decisão #1356). A stack de produção usa Firestore + Cloud Functions diretamente.

### Setup Firebase (Desenvolvimento)

**Requisitos:**
- **Firebase CLI** v13+
  - Install: `npm install -g firebase-tools`
  - Verificar: `firebase --version`

- **Emulator Suite** (opcional, para desenvolvimento local)
  - Instalado via `firebase-tools`
  - Puertos necessárias: 8085 (Firestore), 9099 (Auth), 9199 (Storage), 5001 (Functions)

---

## Setup Android

### Passo 1: Clonar Repositório

```bash
git clone https://github.com/seu-usuario/futeba-dos-parcas.git
cd "futeba-dos-parcas"
```

### Passo 2: Abrir em Android Studio

1. Abra Android Studio
2. Clique em **File → Open**
3. Navegue até a pasta clonada e selecione
4. Aguarde indexação completa (pode levar 3-5 minutos)

### Passo 3: Configurar google-services.json

**O arquivo é necessário para conectar ao Firebase.**

1. Acesse [Firebase Console](https://console.firebase.google.com)
2. Selecione o projeto `futebadosparcas`
3. Vá para Settings → Project Settings
4. Baixe `google-services.json` para **Android** (JSON, não SDK)
5. Coloque o arquivo em: `app/google-services.json`
6. Sync Gradle: Ctrl+Alt+S ou File → Sync Now

### Passo 4: Verificar Gradle

```bash
# Dentro da pasta do projeto
./gradlew --version  # Windows pode precisar de gradlew.bat --version

# Build debug
./gradlew assembleDebug
```

Se receber erro sobre JAVA_HOME, configure:

**Windows (PowerShell):**
```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
```

**Windows (CMD):**
```cmd
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
```

### Passo 5: Emulador ou Device

**Opção A: Emulador**
1. Android Studio → Tools → Device Manager
2. Clique em **Create Device**
3. Selecione Pixel 6 Pro (ou similar)
4. Selecione sistema: API 35
5. Clique em ▶ para iniciar

**Opção B: Device Físico**
1. Conecte via USB
2. Habilite USB Debugging: Settings → Developer Options → USB Debugging
3. Aceite o diálogo de fingerprint no device

### Passo 6: Rodar o App

```bash
# Terminal dentro do projeto
./gradlew installDebug  # Instala no emulador/device

# Ou use Android Studio: Run → Run 'app' (ou Shift+F10)
```

**Resultado esperado:** App abre na tela de login/splash.

---

---

## Setup Firebase

### Passo 1: Configurar Firebase CLI

```bash
firebase login
# Abrirá navegador para autenticação

firebase use futebadosparcas
# Ou configure em .firebaserc
```

### Passo 2: Download Service Account (para Cloud Functions/scripts)

1. Firebase Console → Settings → Service Accounts
2. Clique em **Generate New Private Key**
3. Arquivo JSON será baixado
4. Coloque em: `functions/service-account-key.json` (nunca versionado)
5. Use em scripts administrativos via variável de ambiente:
```bash
export GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
```

### Passo 3: Emulador Firestore (Desenvolvimento Local)

```bash
# De qualquer pasta
firebase emulators:start --only firestore,auth,storage

# Em outro terminal (backend)
cd backend
npm run dev

# Android Studio: Enable emulator toggle em FirebaseModule.kt (linha ~18)
```

**Portos do Emulador:**
- Firestore: 8085
- Auth: 9099
- Storage: 9199
- UI: http://localhost:4000

### Passo 4: Deploy das Regras (se modificar)

```bash
# Validar rules
firebase deploy --only firestore:rules --dry-run

# Fazer deploy real
firebase deploy --only firestore:rules
```

---

---

## Variáveis de Ambiente

### Android (`local.properties`)

```properties
sdk.dir=/path/to/android/sdk
MAPS_API_KEY=seu-google-maps-api-key
```

**Para obter Google Maps API Key:**
1. Google Cloud Console → APIs & Services → Credentials
2. Create OAuth 2.0 Key (Android)
3. Forneça SHA-1 fingerprint do APK (gerado via Gradle)

### Web (`web/.env` e `web/.env.production`)

```env
# Configuração Firebase para o web app
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=futebadosparcas
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

> **Atenção:** Esses arquivos são `.gitignore`d — copie-os antes de rodar o build. Ver `web/.env.example` se existir.

---

## Verificação de Saúde

### Android

```bash
# Build test
./gradlew assembleDebug

# Unit tests
./gradlew testDebug

# Emulator status
adb devices
```

### Cloud Functions (local)

```bash
# Iniciar emuladores com Functions
firebase emulators:start

# Checar logs
firebase functions:log
```

### Firebase

```bash
# Status do emulador
curl http://localhost:4000/api/status

# Logs das functions
firebase functions:log
```

---

## Troubleshooting

### Android

**Problema: "gradle-wrapper.jar not found"**
```bash
./gradlew wrapper --gradle-version=8.13.2
```

**Problema: "JAVA_HOME not set"**
```bash
# Defina em PowerShell (Windows)
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"

# Ou em CMD
setx JAVA_HOME "C:\Program Files\Android\Android Studio\jbr"
```

**Problema: Emulador não inicia**
```bash
# Aumentar RAM do emulador em Android Studio
# Device Manager → Edit Device → Memory: 4096 MB

# Ou usar device físico
adb devices
```

**Problema: google-services.json não encontrado**
- Arquivo deve estar em `app/google-services.json`
- Fazer Sync Gradle: Ctrl+Alt+S
- Rebuild: Ctrl+F9

### Firebase

**Problema: "Permission denied" ao fazer deploy**
```bash
firebase login
firebase use futebadosparcas
```

**Problema: Emulador não inicia na porta 8085**
```bash
# Verificar portos
netstat -ano | findstr 8085

# Usar porta diferente
firebase emulators:start --only firestore --port=8090
```

---

## Próximos Passos

1. **Explorar Documentação:**
   - [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) - Padrões de código e Git workflow
   - [KMP_QUICK_START.md](./KMP_QUICK_START.md) - Kotlin Multiplatform rápido

2. **Criar Primeiro Jogo:**
   - Rodar Android app
   - Registrar/fazer login
   - Criar um jogo
   - Verificar dados no Firestore Console

3. **Entender Fluxos:**
   - Leia [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md)
   - Explore código em `app/src/main/java/com/futebadosparcas`
   - Trace uma feature completa (ex.: criar jogo)

4. **Contribuir:**
   - Leia [CONTRIBUTING.md](../CONTRIBUTING.md)
   - Crie branch: `git checkout -b feat/sua-feature`
   - Commits Conventional: `git commit -m "feat: descrição"`
   - Abra PR (squash-merge para `master`)

---

## Contato & Suporte

- Issues: [GitHub Issues](https://github.com/seu-repo/issues)
- Email: seu@email.com
- Discord/Slack: [Link para comunidade]

**Última atualização:** Junho 2026
