# BUGFIX: Web de produção conectado aos emuladores locais (outage total)

> **Status:** `APPROVED` — hotfix de outage de produção (autoridade: usuário reportou prod-down 2026-05-17, autonomia ampla p/ restaurar prod)
> **Severidade:** `CRITICAL` (outage total do web de produção)
> **Autor:** Claude (diagnóstico via console do usuário 2026-05-17)
> **Data:** 2026-05-17
> **Issue:** _(a criar no PR)_

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

`https://futebadosparcas.web.app` (produção) conecta a **emuladores locais** (`127.0.0.1:9099` Auth, `:8085` Firestore, `:9199` Storage, `:5001` Functions). O emulador não roda na máquina do usuário final → `net::ERR_CONNECTION_REFUSED` → `auth/network-request-failed`. Manifestação mais visível: tela de CPF (`/onboarding/cpf`) — `getIdToken(true)` falha 3× → "Não foi possível renovar sua sessão. Verifique sua conexão e tente novamente." Mas afeta **todo o app** (AuthContext offline, Firestore offline).

Console do usuário (smoking gun):
```
127.0.0.1:9099/securetoken.googleapis.com/v1/token  net::ERR_CONNECTION_REFUSED
FirebaseError: auth/network-request-failed
@firebase/firestore: Could not reach Cloud Firestore backend ... offline mode
[AuthContext] client is offline
```

### 1.2 Comportamento Esperado (Correto)

Build de produção **nunca** conecta emuladores; usa os backends Firebase reais. E2E (Playwright, `npm run dev`) e dev local continuam usando emulador quando `VITE_USE_EMULATOR=true`.

### 1.3 Passos para Reproduzir

Abrir `https://futebadosparcas.web.app/onboarding/cpf`, console aberto → requests pra `127.0.0.1:9099`.

---

## 2. Análise de Causa Raiz

Trap de precedência de env do Vite:

- `web/src/services/firebase.ts:72` ativa emuladores quando `import.meta.env.VITE_USE_EMULATOR === 'true'`.
- `web/.env` (carregado em **TODOS** os modos, inclusive `build` de produção): `VITE_USE_EMULATOR=true` (setado 15/mai p/ teste local de emulador).
- `web/.env.production` (override de produção) **NÃO** define `VITE_USE_EMULATOR` → não sobrescreve o `.env`.

Resultado: o `true` do `.env` base vaza pro bundle de produção. O comentário `firebase.ts:71` ("produção nunca toca esses hosts") era factualmente falso. Deploy de hosting após 15/mai envenenou prod (web hosting não tem auto-deploy — gap conhecido).

### 2.1 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `web/src/services/firebase.ts` | Gate de emulador sem imunidade estrutural a vazamento de env |
| `web/.env.production` | Falta override explícito `VITE_USE_EMULATOR=false` |

---

## 3. Solução Proposta

Defense-in-depth, 2 camadas (ambas seguras p/ E2E — Playwright usa `npm run dev` = Vite dev mode, `import.meta.env.DEV === true`):

1. **Imunidade estrutural** — `firebase.ts:72`: adicionar `import.meta.env.DEV &&` ao gate. Em `vite build` (produção), `import.meta.env.DEV` é substituído estaticamente por `false` e o bloco inteiro de emulador é eliminado por dead-code — produção fica imune **independente** de qualquer vazamento de `.env`. Corrigir comentário enganoso.
2. **Override explícito de env** — `web/.env.production`: adicionar `VITE_USE_EMULATOR=false`.

Reverter o `.env` base p/ `false` NÃO é a correção (quebraria fluxo de dev/E2E local de quem usa emulador); a imunidade estrutural é a raiz.

### 3.1 Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Quebrar E2E Playwright | E2E usa `npm run dev` (DEV=true) → gate `import.meta.env.DEV` permanece true; verificado em `playwright.config` webServer |
| Outro deploy poluído no futuro | Imunidade estrutural elimina o bloco no build de prod permanentemente |

---

## 4. Verificação

- [ ] `cd web && npm run build` sem erro
- [ ] Bundle de produção **não** contém `127.0.0.1:9099` / `connectAuthEmulator` ativo (grep no `dist/`)
- [ ] Deploy hosting → `https://futebadosparcas.web.app/onboarding/cpf` não faz request pra `127.0.0.1`
- [ ] Fluxo CPF chega ao `verifyCpf` real (token renova contra backend real)
- [ ] E2E local com `VITE_USE_EMULATOR=true` + `npm run dev` ainda conecta emulador

## 5. Prevenção Futura

- Gate de emulador SEMPRE com guarda estrutural (`import.meta.env.DEV`/`PROD`), nunca só por env var.
- Checklist de deploy de hosting: grep `dist/` por `127.0.0.1`/`localhost` antes de `firebase deploy --only hosting`.

## Histórico

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-05-17 | Claude | Diagnóstico via console do usuário; spec + hotfix |
