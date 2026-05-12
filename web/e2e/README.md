# E2E Tests — Futeba dos Parças Web

Guia completo para configurar e rodar os testes E2E Playwright com suporte a
fixtures de autenticação por role (PLAYER, FIELD_OWNER, ADMIN).

---

## Pré-requisitos

- Node 20 (`.nvmrc` — rode `nvm use` na raiz do projeto)
- Firebase CLI instalado (`npm install -g firebase-tools`)
- Dependências instaladas: `cd web && npm install`

---

## 1. Iniciar o emulador Firebase

Os testes com fixtures de autenticação requerem o emulador Firebase Auth rodando
localmente. O emulador Auth escuta em `localhost:9099` por padrão.

```bash
# Na raiz do projeto (onde está firebase.json)
firebase emulators:start --only auth,firestore,functions
```

Deixe o emulador rodando em background enquanto executa os testes.

> **Dica:** Use `firebase emulators:start --import=./emulator-data` para importar
> dados persistidos de sessões anteriores.

---

## 2. Configurar o arquivo `.env.test`

Copie o template e preencha com as credenciais de teste:

```bash
cd web
cp .env.test.example .env.test
```

O arquivo `.env.test` já vem com os valores padrão que correspondem aos usuários
criados pelo seed. Modifique apenas se precisar de credenciais diferentes.

**Nunca commite `web/.env.test`** — ele está no `.gitignore`.

### Variáveis disponíveis

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `FIREBASE_AUTH_EMULATOR_HOST` | Host:porta do emulador Auth | `127.0.0.1:9099` |
| `VITE_USE_EMULATOR` | Habilita modo emulador no web app | `true` |
| `VITE_TEST_PLAYER_EMAIL` | Email do usuário PLAYER | `test.player@futeba.test` |
| `VITE_TEST_PLAYER_PASSWORD` | Senha do usuário PLAYER | `Test123!@#` |
| `VITE_TEST_FIELD_OWNER_EMAIL` | Email do usuário FIELD_OWNER | `test.fieldowner@futeba.test` |
| `VITE_TEST_FIELD_OWNER_PASSWORD` | Senha do usuário FIELD_OWNER | `Test123!@#` |
| `VITE_TEST_ADMIN_EMAIL` | Email do usuário ADMIN | `test.admin@futeba.test` |
| `VITE_TEST_ADMIN_PASSWORD` | Senha do usuário ADMIN | `Test123!@#` |

---

## 3. Executar o seed de usuários E2E

O seed cria (ou atualiza) os 3 usuários de teste no emulador Auth e define seus
Custom Claims (`role: PLAYER | FIELD_OWNER | ADMIN`). É idempotente — pode ser
reexecutado a qualquer momento sem efeitos colaterais.

```bash
# Na pasta web/ com FIREBASE_AUTH_EMULATOR_HOST definido
cd web
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npm run seed:e2e
```

O `globalSetup` do Playwright também executa o seed automaticamente antes do
primeiro teste, então você não precisa rodar manualmente se já tem o `.env.test`
configurado.

---

## 4. Wiring do emulador no web app {#emulator-wiring}

> **ATENÇÃO — Pendência:** O arquivo `web/src/services/firebase.ts` ainda **não**
> chama `connectAuthEmulator()` quando `VITE_USE_EMULATOR=true`. Isso significa
> que o web app, ao ser iniciado pelo Playwright (`npm run dev`), tentará
> autenticar contra o Firebase de produção mesmo com o emulador rodando.
>
> Os testes de fixture (`playerPage`, `fieldOwnerPage`, `adminPage`) vão falhar
> até que esse wiring seja implementado.
>
> **Fix necessário em `web/src/services/firebase.ts`:**
>
> ```typescript
> import { connectAuthEmulator } from 'firebase/auth';
> import { connectFirestoreEmulator } from 'firebase/firestore';
>
> if (import.meta.env.VITE_USE_EMULATOR === 'true') {
>   connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
>   connectFirestoreEmulator(db, '127.0.0.1', 8080);
> }
> ```
>
> Esse wiring será implementado em issue #XXXX (follow-up de #1079).

Os testes **sem fixture** (UI pública: tela de login, validações) funcionam
independente do emulador e podem ser rodados a qualquer momento.

---

## 5. Rodar os testes

### Todos os testes E2E

```bash
cd web
npm run test:e2e
```

### Apenas testes sem autenticação (não requerem emulador)

```bash
cd web
npx playwright test --grep "Authentication — UI pública"
```

### Apenas smoke tests de fixture (requerem emulador)

```bash
cd web
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
VITE_USE_EMULATOR=true \
npx playwright test --grep "fixtures por role"
```

### Com UI interativa (debug)

```bash
cd web
npm run test:e2e:ui
```

### Um spec específico

```bash
cd web
npx playwright test e2e/auth.spec.ts
```

---

## 6. Matriz de acesso por role (Issue #1080)

A matriz completa de testes de acesso (3 roles × 10 rotas) será implementada em
`web/e2e/access-matrix.spec.ts` como parte da issue #1080 (follow-up deste PR).

| Rota | PLAYER | FIELD_OWNER | ADMIN |
|------|--------|-------------|-------|
| `/` | ✅ | ✅ | ✅ |
| `/admin` | ❌ redirect | ❌ redirect | ✅ |
| `/locations/create` | ❌ redirect | ✅ | ✅ |
| `/game/create` | ✅ (verified) | ✅ | ✅ |
| ... | ... | ... | ... |

---

## 7. Estrutura dos arquivos

```
web/e2e/
├── fixtures/
│   ├── auth.ts        # loginAsPlayer(), loginAsFieldOwner(), loginAsAdmin()
│   └── index.ts       # test.extend<{ playerPage, fieldOwnerPage, adminPage }>
├── auth.spec.ts       # Testes de auth (UI pública + smoke fixtures)
├── navigation.spec.ts # Testes de navegação
├── globalSetup.ts     # Seed automático antes dos testes
└── README.md          # Este arquivo

scripts/
└── seed-e2e-users.ts  # Cria 3 usuários de teste no emulador (idempotente)

web/.env.test.example  # Template de variáveis (copiar para .env.test)
```

---

## 8. Usuários de teste

| Role | UID (fixo) | Email padrão |
|------|-----------|--------------|
| PLAYER | `e2e-test-player` | `test.player@futeba.test` |
| FIELD_OWNER | `e2e-test-field-owner` | `test.fieldowner@futeba.test` |
| ADMIN | `e2e-test-admin` | `test.admin@futeba.test` |

UIDs fixos garantem idempotência: re-rodar o seed não cria duplicatas.

---

## Troubleshooting

**`FIREBASE_AUTH_EMULATOR_HOST não definido`**
- Defina a variável antes de rodar: `export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`
- Ou use `web/.env.test` que é carregado pelo globalSetup

**Testes de fixture falham com erro de auth**
- Verifique se o emulador está rodando: `firebase emulators:start --only auth`
- Verifique o wiring em `firebase.ts` (seção [Emulator Wiring](#emulator-wiring) acima)
- Rode `npm run seed:e2e` para garantir que os usuários existem no emulador

**`auth/email-already-exists` no seed**
- É esperado em re-runs — o seed é idempotente e faz upsert
- Verifique os logs: deve mostrar "Usuário X já existe" sem erro fatal

**Playwright não encontra `globalSetup`**
- Confirme que `playwright.config.ts` tem `globalSetup: './e2e/globalSetup.ts'`
- A path é relativa ao diretório `web/`
