# ⚡ Firebase Cloud Functions

Serverless backend functions para Futeba dos Parças. Roda em Node.js 20, disparada por eventos do Firestore.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Local development
npm run dev

# Build
npm run build

# Deploy to production
firebase deploy --only functions

# View logs
firebase functions:log
```

## 📂 Estrutura

```
functions/
├── src/
│   └── index.ts              # Todas as functions (onGameComplete, onBadgeUnlock, etc)
├── package.json
├── tsconfig.json
└── README.md
```

## 🔧 Funções Disponíveis

| Função | Trigger | Descrição |
|--------|---------|-----------|
| `onGameComplete` | Firestore: games/{gameId} | Processa XP, badges, ranking pós-jogo |
| `onBadgeUnlock` | Firestore: users/{userId}/badges | Envia notificação de badge |
| `onSeasonEnd` | Pub/Sub Schedule | Finaliza season, reseta rankings |

**Documentação completa:** [FUNCTIONS.md](./FUNCTIONS.md)

## 📋 Pré-requisitos

- Node.js 20+
- Firebase CLI v13+
- firebase-functions v7+

## ⚙️ Configuração

### 1. Instalar Firebase CLI

```bash
npm install -g firebase-tools@latest
firebase login
```

### 2. Selecionar Projeto

```bash
firebase use futebadosparcas
# Ou verificar qual está ativo
firebase projects:list
```

### 3. Instalar Dependências

```bash
npm install
```

## 🏃 Development

### Rodando Localmente

```bash
# Terminal 1: Emulator
firebase emulators:start --only firestore,auth,functions

# Terminal 2: Watch TypeScript
npm run dev

# Terminal 3: Testar (curl ou cliente)
curl http://localhost:5001/futebadosparcas/us-central1/myFunction
```

### Emulator Ports

- Firestore: 8085
- Auth: 9099
- Functions: 5001
- UI: http://localhost:4000

### Triggering Functions Manually

```bash
# Via Cloud Functions UI (localhost:4000)
# Ou via curl
curl -X POST http://localhost:5001/futebadosparcas/us-central1/onGameComplete \
  -H "Content-Type: application/json" \
  -d '{"gameId": "test-game"}'
```

## 🔍 Testing

```bash
# Run tests
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

## 📤 Deployment

### Pre-deployment Check

```bash
# Build
npm run build

# Lint
npm run lint

# List functions
firebase functions:list
```

### Deploy

```bash
# Deploy only functions
firebase deploy --only functions

# Deploy with verbose output
firebase deploy --only functions --debug

# Deploy specific function
firebase deploy --only functions:onGameComplete
```

### Staging/Production

```bash
# Deploy to staging project
firebase use staging
firebase deploy --only functions

# Deploy to production
firebase use production
firebase deploy --only functions
```

## 📊 Monitoring

### View Logs

```bash
# Real-time logs
firebase functions:log --follow

# Last 50 logs
firebase functions:log --limit 50

# Specific function
firebase functions:log --function onGameComplete

# Via Cloud Console
# https://console.firebase.google.com/project/futebadosparcas/functions
```

### Common Errors

**Error: "Function process terminated with exit code 1"**
- Checar logs: `firebase functions:log`
- Verificar imports: todos os módulos instalados?
- Verificar timeout: aumentar em `runWith({ timeoutSeconds: 300 })`

**Error: "Permission denied when accessing Firestore"**
- Verificar Firestore Rules
- Usar `admin.firestore()` (bypass rules)
- Checar IAM permissions no Cloud Console

## 🧪 Testing Locally

### Test Game Completion

```bash
# 1. Create a game in Firestore (emulator)
# Via Emulator UI (localhost:4000)

# 2. Update game status to FINISHED
# Update the document:
{
  status: 'FINISHED',
  stats: [
    { userId: 'test-user-1', goals: 2, assists: 1, saves: 0, isMvp: false }
  ]
}

# 3. Watch logs
firebase functions:log --function onGameComplete --follow

# 4. Verify XP was updated
# Check users/{test-user-1} document in Firestore
```

## 🔐 Security & Best Practices

- ✅ Use admin SDK to bypass Firestore rules (functions have full access)
- ✅ Validate input before processing
- ✅ Handle errors gracefully
- ✅ Log important operations
- ✅ Set appropriate memory/timeout limits
- ❌ Don't hardcode secrets (use environment config)
- ❌ Don't process too much data in one function

## 📚 Veja Também

- [FUNCTIONS.md](./FUNCTIONS.md) - Documentação detalhada das functions
- [../ARCHITECTURE.md](../ARCHITECTURE.md) - Como functions se integram
- [Firebase Docs](https://firebase.google.com/docs/functions)

## 📝 Environment

**Node.js:** 20+
**Runtime:** 60s default, configurável
**Memory:** 256MB default, até 8GB
**Cold start:** ~1-3 segundos

---

**Última atualização:** Dezembro 2025
