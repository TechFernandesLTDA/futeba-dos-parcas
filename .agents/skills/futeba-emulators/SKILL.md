---
name: futeba-emulators
description: Inicia/para Firebase Emulators para dev local — Firestore, Auth, Storage, Functions, UI. Use quando o usuário pedir "rodar local", "emulador", "testar functions sem deploy", ou antes de mudar firestore.rules.
---

# Futeba Firebase Emulators

Ambiente local completo Firebase para dev sem custo + sem risco prod.

## Configuração (firebase.json)

| Serviço | Porta |
|---------|-------|
| Firestore | 8085 |
| Auth | 9099 |
| Storage | 9199 |
| Functions | 5001 |
| UI | 4000 |

## Comandos

```bash
# Start todos
firebase emulators:start --project futebadosparcas

# Start seletivo
firebase emulators:start --only firestore,auth --project futebadosparcas

# Start + import seed data
firebase emulators:start --import=./emulator-data --export-on-exit --project futebadosparcas

# Stop: Ctrl+C no terminal

# Background mode (sai do terminal)
firebase emulators:start --project futebadosparcas &
EMULATOR_PID=$!
# Para depois: kill $EMULATOR_PID
```

## UI

http://localhost:4000 — visualizar Firestore, Auth users, Storage, logs Functions.

## Functions local

Cloud Functions rodam automaticamente quando emulator started. Mudanças em `functions/src/` precisam recompilar:
```bash
cd functions && npm run build
# Functions emulator hot-reloads .js (não .ts source)
```

Para hot reload TypeScript:
```bash
cd functions && npm run build -- --watch &  # Em terminal separado
```

## Firestore rules testing

```bash
# Após editar firestore.rules:
firebase deploy --only firestore:rules --project futebadosparcas-dev  # NUNCA em prod sem testar

# OU testar via emulator:
firebase emulators:start --only firestore --project futebadosparcas
# Conectar SDK app a localhost:8085 + testar fluxos
```

## Seed data

```bash
# Export atual emulator pra arquivo
firebase emulators:export ./emulator-data --project futebadosparcas

# Import depois
firebase emulators:start --import=./emulator-data --project futebadosparcas
```

## Conectar app Android ao emulator

`FirestoreInstance` em `FutebaApplication.kt`:
```kotlin
if (BuildConfig.DEBUG) {
    Firebase.firestore.useEmulator("10.0.2.2", 8085)  // Android emulator host IP
    Firebase.auth.useEmulator("10.0.2.2", 9099)
    Firebase.storage.useEmulator("10.0.2.2", 9199)
}
```

## Conectar web local ao emulator

`web/src/services/firebase.ts`:
```ts
if (import.meta.env.DEV) {
  connectFirestoreEmulator(db, 'localhost', 8085);
  connectAuthEmulator(auth, 'http://localhost:9099');
  connectStorageEmulator(storage, 'localhost', 9199);
}
```

## Troubleshoot

### Port already in use
```bash
lsof -i :8085 | grep LISTEN
kill <pid>
```

### Functions emulator não recarrega
- Apaga `functions/lib/` e rebuilda: `cd functions && rm -rf lib/ && npm run build`
- Restart emulator
