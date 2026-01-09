# 📋 Guia Completo de Setup - Futeba dos Parças

## Índice
- [Pré-requisitos](#pré-requisitos)
- [Setup Android](#setup-android)
- [Setup Backend](#setup-backend)
- [Setup Firebase](#setup-firebase)
- [Setup do Banco de Dados](#setup-do-banco-de-dados)
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

### Setup Backend

**Requisitos:**
- **Node.js** v18+ (LTS recomendado: v20)
  - Download: [https://nodejs.org](https://nodejs.org)
  - Verificar: `node --version && npm --version`

- **PostgreSQL** v15+
  - Download: [https://www.postgresql.org/download](https://www.postgresql.org/download)
  - Ou Docker: `docker run --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:15`
  - Verificar: `psql --version`

- **npm ou yarn**
  - Incluído com Node.js (npm)
  - Ou install yarn: `npm install -g yarn`

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

## Setup Backend

### Passo 1: Entrar na Pasta Backend

```bash
cd backend
```

### Passo 2: Instalar Dependências

```bash
npm install
# ou
yarn install
```

### Passo 3: Configurar Variáveis de Ambiente

1. Copie o arquivo exemplo:
```bash
cp .env.example .env
```

2. Edite `.env` com suas configurações:

```env
# Node
NODE_ENV=development
PORT=3000
HOST=localhost

# Database (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=futeba_db

# JWT
JWT_SECRET=sua-chave-secreta-min-32-caracteres-mudeme-produção
JWT_EXPIRATION=7d

# Firebase (Será configurado depois)
FIREBASE_PROJECT_ID=futebadosparcas
FIREBASE_PRIVATE_KEY=seu-private-key-aqui
FIREBASE_CLIENT_EMAIL=seu-email@projeto.iam.gserviceaccount.com
FIREBASE_DATABASE_URL=https://futebadosparcas.firebaseio.com
FIREBASE_STORAGE_BUCKET=futebadosparcas.appspot.com

# Cron Jobs
GAME_GENERATION_DAYS_AHEAD=30
AUTO_CLOSE_CONFIRMATIONS_HOURS=2

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080
```

### Passo 4: Criar Banco de Dados PostgreSQL

**Opção A: Com PostgreSQL Local**

```bash
# Abra psql
psql -U postgres

# Dentro do psql
CREATE DATABASE futeba_db;
\q  # Sair
```

**Opção B: Com Docker**

```bash
docker run -d \
  --name postgres-futeba \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=futeba_db \
  -p 5432:5432 \
  postgres:15
```

Verificar: `psql -h localhost -U postgres -d futeba_db -c "SELECT 1"`

### Passo 5: Executar Migrações do Banco

```bash
# De dentro da pasta backend

# Gerar migrações (se houver mudanças em entities)
npm run migration:generate -- -n InitialSchema

# Executar todas as migrações
npm run migration:run

# Verificar status
psql -h localhost -U postgres -d futeba_db -c "\dt"  # Listar tabelas
```

### Passo 6: Rodar Backend

```bash
# Desenvolvimento (com hot reload)
npm run dev

# Deve exibir algo como:
# ✓ Server running at http://localhost:3000
# ✓ Health check: GET http://localhost:3000/health
```

**Teste o backend:**
```bash
curl http://localhost:3000/health
# Resultado esperado: {"status":"ok","timestamp":"2024-01-01T00:00:00Z"}
```

---

## Setup Firebase

### Passo 1: Configurar Firebase CLI

```bash
firebase login
# Abrirá navegador para autenticação

firebase use futebadosparcas
# Ou configure em .firebaserc
```

### Passo 2: Download Service Account (para Backend)

1. Firebase Console → Settings → Service Accounts
2. Clique em **Generate New Private Key**
3. Arquivo JSON será baixado
4. Coloque em: `backend/firebase-key.json`
5. Atualize `.env`:
```env
FIREBASE_CREDENTIALS_PATH=./firebase-key.json
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

## Setup do Banco de Dados

### Opção 1: Migrations Automáticas

```bash
cd backend

# TypeORM sincroniza automaticamente em desenvolvimento
# (configurado em src/config/database.ts)
npm run dev
```

### Opção 2: Seed Data (Dados de Teste)

```bash
cd scripts

# Adicionar locais e campos de exemplo
node seed.js

# Ou com dados reais
python populate_real_data.py
```

### Verificar Integridade

```bash
# Verificar duplicatas
node check_duplicates.js

# Validar estrutura de dados
node validate_data.js
```

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

### Backend (`.env`)

```env
# Desenvolvimento
NODE_ENV=development
DEBUG=true

# Produção (Never commit!)
NODE_ENV=production
JWT_SECRET=sua-chave-super-secreta-min-32-chars
ALLOWED_ORIGINS=https://seu-dominio.com
```

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

### Backend

```bash
# Health check
curl http://localhost:3000/health

# Test a rota
curl -X GET http://localhost:3000/api/locations

# Logs
npm run dev  # Verá logs em tempo real
```

### Firebase

```bash
# Status do emulador
curl http://localhost:4000/api/status

# Logs das functions
firebase functions:log
```

### Database

```bash
# Verificar tabelas
psql -h localhost -U postgres -d futeba_db -c "\dt"

# Contar registros por tabela
psql -h localhost -U postgres -d futeba_db -c "SELECT tablename FROM pg_tables WHERE schemaname='public';"
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

### Backend

**Problema: "Port 3000 already in use"**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :3000
kill -9 <PID>

# Ou mudar porta em .env: PORT=3001
```

**Problema: "Database connection refused"**
```bash
# Verificar PostgreSQL rodando
psql -U postgres

# Se não funcionar, iniciar PostgreSQL
# Windows: Services → postgresql-x64-15 → Start
# macOS: brew services start postgresql
# Linux: sudo systemctl start postgresql

# Com Docker
docker start postgres-futeba
```

**Problema: "Cannot find module 'dotenv'"**
```bash
npm install  # Reinstalar dependências
```

**Problema: Migrations falhando**
```bash
# Revert última migration
npm run migration:revert

# Ou droppar schema (CUIDADO - perde dados!)
npm run migration:revert -- --all

# Recriar
npm run migration:generate -- -n FreshStart
npm run migration:run
```

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
   - [ARCHITECTURE.md](./ARCHITECTURE.md) - Visão geral da arquitetura
   - [API_REFERENCE.md](./API_REFERENCE.md) - Endpoints disponíveis
   - [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) - Schema do banco

2. **Criar Primeiro Jogo:**
   - Rodar Android app
   - Registrar/fazer login
   - Criar um jogo
   - Verificar dados em backend

3. **Entender Fluxos:**
   - Leia [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md)
   - Explore código em `app/src/main/java/com/futebadosparcas`
   - Trace uma feature completa (e.g., criar jogo)

4. **Contribuir:**
   - Fork do repositório
   - Criar branch: `git checkout -b feature/sua-feature`
   - Fazer commits: `git commit -m "feat: descrição"`
   - Push e PR

---

## Contato & Suporte

- Issues: [GitHub Issues](https://github.com/seu-repo/issues)
- Email: seu@email.com
- Discord/Slack: [Link para comunidade]

**Última atualização:** Dezembro 2025
