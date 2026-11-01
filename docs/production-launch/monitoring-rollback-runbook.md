# Runbook de incidente: alertas, Play e rollback (#3300, #4417)

Objetivo: cada alerta de produção chega por e-mail com uma ação clara, e existe um
caminho curto para mitigar ou reverter.

- Severidade, comunicação e checklist de incidente: [../support/incident-runbook.md](../support/incident-runbook.md).
- Rollback detalhado: skill `futeba-rollback` (`.claude/skills/futeba-rollback/SKILL.md`, local, não versionada).
  O essencial está na seção [Rollback](#rollback) abaixo.
- Spec: [../../specs/ops-2026-11-01-alertas-runbook-vigia-play-4417.md](../../specs/ops-2026-11-01-alertas-runbook-vigia-play-4417.md).

## Primeiros 10 minutos

1. Abrir o e-mail do alerta: o corpo traz a ação da política (campo `documentation`).
2. Registrar o incidente (horário, severidade S0 a S3, dono) conforme o runbook de suporte.
3. Se o alerta começou logo depois de um deploy: **rollback primeiro, diagnóstico depois**.
4. Congelar deploys concorrentes até fechar o incidente.

## Alerta → ação

Canal: e-mail "Futeba ops (e-mail do dono)", `projects/futebadosparcas/notificationChannels/12807806903750069265`.
Os arquivos ficam em [`monitoring/`](../../monitoring/), listados em `monitoring/manifest.json`.

| Alerta (assunto do e-mail) | Arquivo | Primeira ação |
| --- | --- | --- |
| Site fora do ar (uptime) | `uptime-site-alert.json` | Firebase Hosting → Versões. Se foi deploy, rollback de Hosting (1 clique). |
| Cloud Functions com erros | `functions-errors-alert.json` | Error Reporting e Logs Explorer `severity>=ERROR`; identificar a função. |
| Query do Firestore sem índice | `firestore-failed-precondition-alert.json` | `firebase deploy --only firestore:indexes --project futebadosparcas`. |
| Push token registry indisponível | `push-token-registry-canonical-lookup-alert.json` | Envio está em fail-closed; ver Firestore e permissões. |
| Schedule crítico falhou: temporada | `schedule-season-failed-alert.json` | Logs dos serviços `startnewseason`, `archiveseason`, `checkseasonend`; corrigir e rodar o job de novo. |
| processNotificationBatch: 3+ falhas | `schedule-notification-batch-failed-alert.json` | Logs de `processnotificationbatch`; fila `notification_queue`. |
| processNotificationBatch parado | `schedule-notification-batch-stopped-alert.json` | `gcloud scheduler jobs describe firebase-schedule-processNotificationBatch-southamerica-east1 --location southamerica-east1`. |
| Processamento de XP com falha | `xp-processing-failed-alert.json` | Logs de `ongamestatusupdate`; jogos com `xp_processing_error`; skill `futeba-xp-validate`. |
| Health check: alerta CRITICAL | `health-check-critical-alert.json` | Coleção `alerts` do Firestore (detalhe em `metadata`). |
| Firestore: pico de leituras | `firestore-reads-spike-alert.json` | Uso do Firestore por `module`; se veio com deploy de web, rollback de Hosting. |
| Firestore: pico de escritas/exclusões | `firestore-writes-spike-alert.json` | Procurar trigger em loop; rollback de Functions. |
| Crashlytics: regressão, crash novo ou pico | `crashlytics-alert.json` | Abrir a issue no Crashlytics; pausar o rollout da Play se for release nova. |
| Orçamento (Billing, 50/90/100%) | console de Billing | Ver custo por serviço; a política de pico do Firestore costuma disparar antes. |

Para rodar de novo um job agendado depois do fix:
`gcloud scheduler jobs run <job> --location southamerica-east1 --project futebadosparcas`.

## Aplicar ou mudar alertas (infra como código)

Nada é criado no deploy normal. Quem tem papel de editor do projeto roda:

```bash
# 1. Validar os arquivos (sem rede)
node scripts/monitoring/apply-monitoring.js --validate-only

# 2. Ver o plano (somente leitura: lista o que cria/atualiza, não mexe em nada)
gcloud auth login   # se o token tiver expirado
node scripts/monitoring/apply-monitoring.js

# 3. Aplicar
node scripts/monitoring/apply-monitoring.js --apply
```

- Casa política por `displayName` e métrica de log por `name`: rodar de novo não duplica.
- O canal vem do manifesto; para outro canal: `--channel projects/futebadosparcas/notificationChannels/<id>`.
- Nunca apaga. O que existe em produção e não está no manifesto aparece como "fora do manifesto".
- Para mudar um alerta: editar o JSON, rodar o passo 2, revisar, rodar o passo 3, commitar via PR.
- Depois de aplicar uma política nova: Cloud Monitoring → Alerting → a política → **Send test notification**.

## Error Reporting e Crashlytics

**Error Reporting.** A API está ligada e já agrupa erros com stack trace das Cloud Functions (em 01/11/2026 havia 4
grupos abertos, entre eles 10 erros do `archiveseason` de 03 a 07/10). A notificação de erro novo **não tem API**:
ligar uma vez no console.

1. Console do Google Cloud → Error Reporting (projeto `futebadosparcas`).
2. **Configure notifications** → marcar o canal "Futeba ops (e-mail do dono)" → salvar.

**Crashlytics (Android e iOS).** As functions `onCrashlyticsRegressionAlert`, `onCrashlyticsNewFatalIssueAlert` e
`onCrashlyticsVelocityAlert` recebem os alertas do Firebase e gravam o log `crashlytics_alert`; a política
`crashlytics-alert.json` manda o e-mail com tipo, app e título da issue. Deploy:

```bash
cd functions && npm ci && npm run build && cd ..
firebase deploy --only functions:onCrashlyticsRegressionAlert,functions:onCrashlyticsNewFatalIssueAlert,functions:onCrashlyticsVelocityAlert,functions:systemHealthCheck --project futebadosparcas
```

O `systemHealthCheck` entra no mesmo deploy porque é ele que passa a gravar o log `health_check_critical_alert`
usado pelas políticas de XP e de health check. Como reforço (opcional), cada pessoa pode ligar os e-mails nativos do Crashlytics
(regressão e "velocity") nas configurações de alertas do Firebase Console; essa preferência é por usuário.

## Recusa da Play (revisão e Status da política)

A Play Developer API **não expõe** o status da revisão nem o Status da política (evidência na spec, seção 3.7).
Dois mecanismos cobrem o buraco:

1. **Vigia diário** (`.github/workflows/play-track-status.yml`, schedule 12:17 UTC). Se há release de produção
   gravada e a página pública da loja responde 404, abre a issue
   "Play: release de produção gravada, mas o app não está publicado na loja" e comenta a cada 7 dias. Fecha sozinha
   quando a loja responder 200. Para rodar na hora: Actions → Play Track Status → Run workflow com `audit` marcado.
2. **E-mail do Play Console** (manual, uma vez): nas preferências de notificação do Play Console (por usuário),
   ligar o e-mail para avisos de política e de status da publicação, e garantir que esse e-mail cai numa caixa
   lida (a recusa de 14/10/2026 ficou 17 dias sem ser vista). Depois do lançamento público é o **único** aviso de recusa de atualização,
   porque a loja continua respondendo 200 com a versão anterior.

Quando houver recusa:

1. Play Console → **Status da política**: ler o motivo e o problema apontado.
2. Corrigir. Casos já vistos:
   - "falta de credenciais de login" (14/10/2026): Conteúdo do app → **Acesso ao app** → informar conta de
     demonstração. No Android a conta precisa do claim `verified == true` para não cair na verificação por SMS/CPF.
   - Auto App Quality / crashes (19/05/2026): ver Android Vitals e o alerta do Crashlytics antes de reenviar.
   - targetSdk abaixo do mínimo: tirar do pacote releases antigas (ex.: release 45 com targetSdk 35).
3. Visão geral da publicação → **Enviar mudanças para revisão**.
4. Com a publicação gerenciada ligada, depois de aprovado é preciso clicar em **Publicar** em
   "Alterações prontas para publicação". Até lá a issue do vigia continua aberta.
5. Promover rollout só depois de publicado e de 48 h sem regressão (workflow `play-promote.yml`).

## Rollback

Resumo da skill `futeba-rollback`. Regra: rollback atômico, sem "fix em cima do fix" sem causa conhecida.

| Componente | Caminho mais rápido |
| --- | --- |
| Hosting (web) | Firebase Console → Hosting → Versões → versão estável → "Rollback" (30 s, sem build). |
| Firestore/Storage rules | Firebase Console → Rules → histórico → versão anterior → "Use this version". |
| Cloud Functions | `git revert` do commit ruim em PR (squash), depois deploy a partir da master num worktree limpo. |
| Android | Play Console → Produção → **Interromper lançamento**; nova versão com hotfix (não há rollback de APK). |

Deploy de Functions a partir da master (depois do PR de revert mergeado):

```bash
DEPLOY_DIR=$(mktemp -d)/futeba-rollback
git worktree add "$DEPLOY_DIR" origin/master
cd "$DEPLOY_DIR/functions" && npm ci && npm run build && npm run lint && npx jest --no-coverage
cd "$DEPLOY_DIR" && firebase deploy --only functions --project futebadosparcas
git worktree remove --force "$DEPLOY_DIR"
```

Preferir hotfix para a frente quando a função já escreveu dados que não voltam (migração, XP processado).

Validação pós-rollback (30 minutos):

- `curl -sI https://futebadosparcas.com.br | head -1`
- `firebase functions:log --only <função> --project futebadosparcas`
- O alerta que abriu o incidente fecha sozinho (auto-close) ou fica sem novos disparos.
- Registrar no incidente: o que foi revertido (link do PR), versão anterior e nova, causa raiz em issue de follow-up.

## Critérios de incidente

| Severidade | Exemplo | Resposta |
| --- | --- | --- |
| S0 | App indisponível, login quebrado, perda/exposição de dados | Imediata; rollback/hotfix prioritário. |
| S1 | Criar/entrar em jogo quebrado, custo disparando, temporada ou XP parados | Até 30 min. |
| S2 | Funcionalidade importante instável com contorno, push atrasado | Até 4 h úteis. |
| S3 | Bug menor, texto, layout | Backlog normal. |

Referências: [../MONITORING_GUIDE.md](../MONITORING_GUIDE.md),
[../FIREBASE_BUDGET_SETUP.md](../FIREBASE_BUDGET_SETUP.md),
[../RELEASE_PROCESS.md](../RELEASE_PROCESS.md).
