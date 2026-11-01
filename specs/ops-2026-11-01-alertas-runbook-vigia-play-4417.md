# SPEC: Alertas como código, Crashlytics, runbook de incidente e vigia da Play (#4417)

> **Status:** `APPROVED` (trabalho autorizado pelo dono em 01/11/2026)
> **Autor:** Claude Code (Opus 5.5)
> **Data:** 2026-11-01
> **PR:** a preencher
> **Parent:** #4398. Continua a #4396.

---

## 1. Requirements (Requisitos)

### 1.1 Problema / Oportunidade

A #4396 criou em produção, à mão, 1 canal de e-mail, 2 uptime checks, 3 políticas e o orçamento. Ficaram de fora:
Error Reporting e Crashlytics com alerta de regressão, alertas por schedule crítico, pico de leituras e escritas
no Firestore e um runbook escrito.

Dois incidentes mostram o custo da lacuna:

1. **Recusa da Play invisível por 17 dias.** A revisão da 1.41.0 foi recusada em 14/10/2026 ("falta de credenciais de
   login") e só foi vista em 01/11. Um comentário de 12/10 na #4201 dizia que "o auditor semanal abre uma issue
   quando isso acontecer". Esse auditor nunca existiu (seção 6.1).
2. **Temporada falhando 5 dias seguidos sem aviso.** Entre 03/10 e 07/10, `startNewSeason` e `archiveSeason`
   registraram 10 erros ("falha ao listar grupos"). O Error Reporting agrupou os erros, mas sem notificação ninguém viu.

Achados laterais em produção (01/11/2026, leitura apenas):
- A política "Push token registry: consulta canônica indisponível" existe **sem canal de notificação**: não avisa ninguém.
- Os alertas CRITICAL do `systemHealthCheck` (XP travado, falha de XP, cobrança) só vão para a coleção `alerts` do
  Firestore, que nenhum cliente lê.
- O job `cleanupOldAlerts` do Cloud Scheduler está com último status 13 (INTERNAL).

### 1.2 Casos de Uso

| ID | Ator | Ação | Resultado esperado |
|----|------|------|-------------------|
| UC1 | Dono | Um schedule de temporada falha | E-mail no canal "Futeba ops" em minutos |
| UC2 | Dono | `processNotificationBatch` falha 3+ vezes em 15 min ou para de rodar | E-mail |
| UC3 | Dono | Processamento de XP falha ou trava | E-mail |
| UC4 | Dono | Leituras ou escritas do Firestore disparam | E-mail |
| UC5 | Dono | Crashlytics detecta regressão, crash fatal novo ou pico (Android ou iOS) | E-mail |
| UC6 | Dono | Release de produção gravada na Play e app fora da loja | Issue no GitHub, lembrete a cada 7 dias |
| UC7 | Dono | Incidente em produção | Runbook com ação por alerta e rollback |

### 1.3 Critérios de Aceite

- [x] CA1: políticas e métricas de log descritas em arquivo (`monitoring/`) e aplicadas por script idempotente, com
  dry-run por padrão. Nada é criado em produção por este PR.
- [x] CA2: alertas para `processNotificationBatch`, reset/arquivamento de temporada e processamento de XP.
- [x] CA3: alerta de pico de leituras e de escritas/exclusões no Firestore, com limites baseados na medição de 14 dias.
- [x] CA4: Crashlytics (Android e iOS) com alerta de regressão, novo crash fatal e pico, entregue no mesmo canal.
- [x] CA5: Error Reporting: API ligada (já estava) e passo de notificação documentado (não há API para isso).
- [x] CA6: runbook curto em `docs/` apontando para a skill `futeba-rollback`, com tabela alerta → ação.
- [x] CA7: o vigia da Play abre issue no cenário de 14/10 (teste com o estado real), sem workflow novo.
- [x] CA8: `npm run build`, `npm run lint` e `npx jest` em `functions/`; `npm run test:scripts` na raiz.

### 1.4 Fora de Escopo

- Criar ou alterar recursos em produção (políticas, canais, deploy). Os comandos ficam no runbook para o dono.
- Uptime checks como código: os 2 checks da #4396 continuam manuais (a política de uptime cobre todos os checks).
- Detectar recusa de **atualização** depois que o app estiver público (a API não expõe; ver 3.7).
- Mudar o comportamento de commit da Play (`changesInReviewBehavior`) no `play-promote.js`: anotado como follow-up.

---

## 2. UX/UI Design

Não há tela. A "interface" é o e-mail do Cloud Monitoring (assunto = `displayName` da política, corpo =
`documentation.content` com a ação) e a issue do vigia da Play.

### 2.1 a 2.5 (Mobile DoD)

N/A: mudança só de backend, observabilidade e CI. Responsividade, acessibilidade, animações e estados de tela não se
aplicam. O comportamento offline equivalente é: falha de rede ao consultar a loja não abre nem fecha issue.

---

## 3. Technical Design

### 3.1 Arquitetura

```
Cloud Scheduler / Cloud Run logs ─┐
Firestore metrics ────────────────┼─> políticas (monitoring/*.json) ─> canal e-mail "Futeba ops"
systemHealthCheck (log CRITICAL) ─┤
Firebase Alerts → onCrashlytics*  ┘

play-track-status.yml (schedule diário) ─> Play API (trilhas) + página pública da loja ─> issue GitHub
```

### 3.2 Arquivos

| Arquivo | O que é |
|---|---|
| `monitoring/manifest.json` | Fonte da verdade: projeto, canal, métricas e políticas gerenciadas |
| `monitoring/log-metrics/*.json` | 2 métricas exportadas de produção + `notification_batch_scheduler_failures` |
| `monitoring/*-alert.json` | 4 políticas exportadas de produção + 8 novas |
| `scripts/monitoring/apply-monitoring.js` | Plano (padrão) ou `--apply`; casa por `displayName`/`name`; nunca apaga |
| `functions/src/monitoring/crashlytics-alerts.ts` | 3 functions do Firebase Alerts → log `crashlytics_alert` |
| `functions/src/monitoring/alerting.ts` | alerta CRITICAL do health check → log `health_check_critical_alert` |
| `scripts/ci/play-track-status.js` + workflow | modo `--audit` e schedule diário |
| `docs/production-launch/monitoring-rollback-runbook.md` | runbook de incidente |

### 3.3 Mapeamento "schedule crítico" → sinal

| Pedido na issue | Realidade no código | Sinal |
|---|---|---|
| `processNotificationBatch` | schedule `* * * * *` | métrica de log das falhas do Scheduler (> 2 em 15 min) e ausência de requisição em 15 min |
| reset de temporada | `startNewSeason` (01:00), `archiveSeason` (23:59), `checkSeasonEnd` (03:00) | log-match em falha do Scheduler ou ERROR nos 3 serviços |
| processamento de XP | **não é schedule**: trigger `onGameStatusUpdate`; o `systemHealthCheck` detecta `STALE_XP_PROCESSING` e `XP_PROCESSING_FAILURES` | log-match em ERROR do `ongamestatusupdate` ou log CRITICAL de XP do health check |

### 3.4 Limites do Firestore (medidos em 01/11/2026, 14 dias, soma horária)

| Métrica | Mediana | p99 | Máximo | Limite do alerta |
|---|---|---|---|---|
| `document/read_count` | 37 | 1.009 | 1.010 | > 20.000/h |
| `document/write_count` | 41 | 288 | 294 | > 5.000/h |
| `document/delete_count` | 1 | 871 | 871 | > 5.000/h |

### 3.5 Segurança

- O vigia usa `GITHUB_TOKEN` do próprio run (`issues: write`) e a service account de leitura já existente. Abre um edit
  e o descarta (`edits.delete`), como antes: nada é commitado na Play.
- O script de monitoramento usa o token do `gcloud` de quem roda; não lê nem grava segredo.

### 3.6 Performance / custo

- 3 functions novas, acionadas só quando o Crashlytics publica alerta (custo desprezível).
- Uma execução diária do workflow no runner pesado próprio (`RUNNER_LABELS_HEAVY`), ~1 min.

### 3.7 Observabilidade e limites conhecidos

- **A Play Developer API não expõe o status da revisão nem o Status da política.** Evidência (discovery do
  `androidpublisher` v3, revisão 20261029): `TrackRelease.status` só tem `draft`, `inProgress`, `halted`,
  `completed`; os 145 métodos não incluem leitura de revisão/política; `appstoreappsreview.*` é para apps hospedados
  em lojas alternativas (só criação/upload) e o `playdeveloperreporting` v1beta1 não tem nada de revisão. O único
  controle de revisão é na escrita (`edits.commit` com `changesNotSentForReview` e `changesInReviewBehavior`).
- Por isso o vigia é heurístico: produção gravada + loja 404. Depois do lançamento público a loja responde 200 e
  uma recusa de atualização volta a ser invisível pela API. Mitigação documentada: notificações por e-mail do Play
  Console para uma caixa monitorada.
- O vigia roda no runner próprio (`RUNNER_LABELS_HEAVY`); com o runner offline o run fica na fila sem avisar
  ninguém. Não há alerta sobre a ausência do próprio vigia.
- A página da loja foi conferida pelo mesmo caminho do script (Node `fetch`, `hl=pt_BR&gl=BR`): 404 para
  `com.futebadosparcas` e 200 para um app público de controle (01/11/2026).
- A recusa de 14/10 teria aberto issue já no primeiro run diário (a loja estava em 404 com a 1.41.0 gravada a 20%).
- Error Reporting: a API `clouderrorreporting` v1beta1 só tem `events`, `groups`, `groupStats` e `deleteEvents`; a
  notificação de erro novo só se liga no console.

---

## 4. Tasks (Breakdown)

- [x] T1: exportar as 4 políticas e 2 métricas de produção para `monitoring/` (leitura via API).
- [x] T2: políticas novas (temporada, notificações x2, XP, health check, Firestore x2, Crashlytics).
- [x] T3: `apply-monitoring.js` com validação, plano e `--apply`; testes.
- [x] T4: log estruturado dos alertas CRITICAL no `systemHealthCheck`; testes.
- [x] T5: functions de alerta do Crashlytics; testes.
- [x] T6: modo `--audit` no `play-track-status.js` e schedule no workflow; testes.
- [x] T7: runbook e `DECISIONS.md`.

---

## 5. Verification (Verificação)

### 5.1 Testes

- `node --test scripts/monitoring/apply-monitoring.test.js scripts/ci/play-track-status.test.js`
- `functions/`: `npm run build`, `npm run lint`, `npx jest --no-coverage`
- Dry-run do script contra produção (somente leitura): 3 métricas (1 a criar), 12 políticas (8 a criar, 4 a
  atualizar: documentação com link do runbook e canal na de push token).
- Filtros validados contra as APIs de Logging e Monitoring (somente leitura): todos aceitos; o de temporada casa os
  10 erros de 03 a 07/10.
- `actionlint` no workflow alterado.

### 5.2 Checklist de Revisão

- [x] Nenhum recurso criado em produção.
- [x] Nenhum workflow novo; nenhum runner registrado.
- [x] Nenhum segredo lido ou impresso.

### 5.3 Demo

Depois de aplicar (comandos no runbook), validar como na #4396: um log ERROR sintético num serviço `startnewseason`
de teste não é possível sem deploy, então o teste de aceite é o `--apply` seguido de "Test notification" no console
de cada política nova.

---

## 6. Notas e Referências

### 6.1 Por que o "auditor semanal" não avisou

- `play-track-status.yml` só tinha `workflow_dispatch`: nenhum `schedule`. A API do GitHub mostra 0 execuções.
- Nenhum outro workflow consulta a Play por agenda. As scheduled tasks do Claude no Mac são as 2 dailies de
  auditoria (desligadas desde 30/09) e a única automação do Codex é a de SEO mensal.
- Mesmo agendado, ele só listava as trilhas. Como a API não expõe recusa, ele teria mostrado
  `production: 1.41.0 [inProgress] 20%` todos os dias, sem acusar nada.

### 6.2 Follow-ups

- `play-promote.js` faz `edits.commit` sem `changesInReviewBehavior`. O padrão da API é
  `CANCEL_IN_REVIEW_AND_SUBMIT`, que cancela em silêncio uma revisão em andamento. Avaliar `ERROR_IF_IN_REVIEW`.
- `cleanupOldAlerts` com último status INTERNAL no Cloud Scheduler.
- Uptime checks como código.

## Histórico de Alterações

| Data | Autor | Mudança |
|------|-------|---------|
| 2026-11-01 | Claude Code | Criação (APPROVED) |
