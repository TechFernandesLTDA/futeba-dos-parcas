# BUGFIX: App Check — teste de regressão para emissão (#3869)

> **Status:** `IN_PROGRESS` (critério #5 entregue; #1-4, #6 bloqueados)
> **Severidade:** `MEDIUM`
> **Issue:** #3869
> **Data:** 2026-07-28

---

## 1. Estado atual

A causa raiz do HTTP 403 (`appCheck/fetch-status-error`) **não foi identificada**
(3 comentários na issue). Tudo que é inspecionável pela API está consistente:
chave, registro, domínios e provider batem. A investigação precisa ir para os
logs de runtime do Console Firebase, que requer acesso direto.

`confirmPlayerAsManager` mantém `enforceAppCheck: false` (proteção temporariamente
desativada — #3868). As demais proteções (Auth, autorização, rate limit, transação,
audit log) seguem ativas.

## 2. O que este PR entrega

**Critério de aceite #5**: "Adicionar monitoramento/regressão que detecte
`app: MISSING` antes de afetar usuários."

- `web/e2e/app-check.spec.ts` — teste Playwright que captura erros de console
  (`appCheck/fetch-status-error`, `app/missing`, `[firebase/app-check]`) ao
  carregar a login page. O teste só roda quando App Check está ativo (não em
  modo emulador), e deve ser executado contra produção como parte do smoke
  test do critério #2.

## 3. O que permanece bloqueado

| Critério | Estado | Bloqueador |
|---|---|---|
| #1 Causa do 403 | Aberto | Requer logs do Console Firebase |
| #2 Emissão em prod | Parcial (teste existe, execução é manual) | Requer confirmar #1 |
| #3 Smoke callables | Pendente | Depende de #2 |
| #4 Reativar enforce | Pendente | Depende de #2+#3 |
| #5 Monitoramento | **Entregue** | — |
| #6 Release Functions | Pendente | Depende de #4 |

## 4. Como executar o teste contra produção

```bash
BASE_URL=https://futebadosparcas.web.app \
VITE_RECAPTCHA_SITE_KEY=<key> \
npx playwright test app-check
```
