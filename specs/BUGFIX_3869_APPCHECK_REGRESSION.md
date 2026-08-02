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
  carregar a login page. O teste só roda quando apontado para um host remoto
  (produção/preview), via `E2E_BASE_URL`/`BASE_URL`; em CI/local (localhost) é
  pulado porque a app roda em modo emulador (sem App Check).
- `monitoring/app-check-missing-invalid-alert.json` — alerta log-based do Cloud
  Monitoring que dispara quando uma callable protegida rejeita request por
  App Check ausente/inválido (`jsonPayload.verifications.app = MISSING|INVALID`).
  É o sinal precoce de regressão server-side antes de afetar usuários. (Aplicar
  via `gcloud alpha monitoring policies create` — ver seção 5.)
- `web/playwright.config.ts` — honra `E2E_BASE_URL`/`BASE_URL` para apontar os
  testes a um host remoto; nesse modo desliga o `webServer` local e o
  `globalSetup` (que exige emulador). Sem essas variáveis o comportamento é
  idêntico ao anterior (zero impacto em CI/local).

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
E2E_BASE_URL=https://futebadosparcas.web.app \
  npx playwright test app-check
```

Não é preciso passar `VITE_RECAPTCHA_SITE_KEY` — ela é build-time e já está
no bundle de produção. O gate do teste é por host (não-localhost).

## 5. Como aplicar o alerta de monitoramento (operação de console/gcloud)

O alerta em `monitoring/app-check-missing-invalid-alert.json` é um policy do
Cloud Monitoring. Aplicar uma única vez no projeto `futebadosparcas`:

```bash
gcloud alpha monitoring policies create \
  --policy-from-file=monitoring/app-check-missing-invalid-alert.json \
  --project=futebadosparcas \
  --notification-channels=<CHANNEL_ID>
```

Substitua `<CHANNEL_ID>` por um notification channel existente (liste com
`gcloud beta monitoring channels list --project=futebadosparcas`). Após a
primeira ativação real, refine o filtro (`conditionMatchedLog.filter`) conforme
o schema de log observado em Cloud Logging e re-aplique.
