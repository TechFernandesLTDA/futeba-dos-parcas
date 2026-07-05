# Monitoramento, Alertas e Rollback - #3300

Objetivo: garantir que falhas de produção gerem alerta acionável e que exista
caminho claro para rollback de web e Cloud Functions.

Referências existentes: [../MONITORING_GUIDE.md](../MONITORING_GUIDE.md),
[../FIREBASE_BUDGET_SETUP.md](../FIREBASE_BUDGET_SETUP.md) e
[../RELEASE_PROCESS.md](../RELEASE_PROCESS.md).

## Alertas mínimos

| Área | Sinal | Alerta inicial | Ação |
| --- | --- | --- | --- |
| Functions | Erros por função | >= 5 erros em 10 min ou erro em função crítica | Abrir incidente S1/S2 e ver logs. |
| Functions | Latência p95 | > 3 s por 15 min | Verificar região, cold start, dependências e Firestore. |
| Firestore | Reads | > 2x baseline diário ou pico acima do modelo de custo | Identificar tela/query e reduzir polling/listeners. |
| Firestore | Writes/deletes | > 2x baseline ou spikes fora de campanha | Verificar loops, retries e automações. |
| Billing | Custo diário | 50%, 80%, 100%, 120% do budget | Acionar playbook de custo. |
| Hosting | Erros 4xx/5xx | 5xx persistente ou alta incomum de 404 | Verificar deploy, rewrites e assets. |
| Web performance | LCP/INP/CLS | Regressão > 20% no p75 | Verificar bundle, Firebase queries e assets. |
| Auth | Falhas login/signup | Aumento súbito ou reclamações simultâneas | Validar provedores, domínio autorizado e regras. |

## Painel operacional

Dashboard mínimo no Google Cloud/Firebase:

- Cloud Functions v2: invocations, error count, p95 duration, memory usage por
  função crítica.
- Firestore: document reads, writes, deletes, active listeners e billed reads.
- Hosting: requests, response code class e bytes served.
- Cloud Billing: custo por serviço, custo diário e forecast mensal.
- Crashlytics/Analytics, quando aplicável: crashes, usuários afetados e eventos
  de onboarding/criação de jogo.

## Rollback web

Pré-condições:

- Identificar versão atual em `versions.json`, `web/package.json` e release
  notes.
- Confirmar se o problema é web-only ou depende de Functions/regras.
- Registrar incidente e owner antes de executar.

Procedimento:

1. Localizar o commit/tag da última versão estável.
2. Criar PR de reversão ou hotfix, mantendo Conventional Commit.
3. Rodar `cd web && npm run lint && npm run build`.
4. Após aprovação e merge, fazer deploy de Hosting pelo fluxo autorizado.
5. Validar rotas públicas, login, criação de grupo/jogo e About/Sobre.
6. Comunicar mitigação no canal de suporte.

Rollback emergencial só deve acontecer com registro explícito do incidente,
plataforma afetada, versão revertida e follow-up para recompor release notes,
changelog, tag/release e documentação.

## Rollback Functions

Pré-condições:

- Confirmar função, região e versão problemática.
- Verificar se há mudança de schema ou regra que impede simples reversão.
- Congelar novos deploys concorrentes.

Procedimento:

1. Identificar último commit/tag estável de `functions/`.
2. Preferir hotfix forward se a função tocou dados irreversíveis.
3. Rodar `cd functions && npm run build && npm run lint && npx jest --no-coverage`.
4. Deploy apenas das funções afetadas quando possível.
5. Validar logs por 30 minutos após deploy.
6. Registrar função, região, versão anterior, versão nova e evidência de
   recuperação.

## Critérios de incidente

| Severidade | Exemplo | SLA inicial |
| --- | --- | --- |
| S0 | App indisponível, login quebrado, perda/exposição de dados | Resposta imediata, rollback/hotfix prioritário. |
| S1 | Criação/entrada em jogos quebrada, custo em disparada | Resposta em até 30 min. |
| S2 | Funcionalidade importante instável com workaround | Resposta em até 4 h úteis. |
| S3 | Bug menor, texto, layout sem bloqueio | Backlog normal. |

Use o runbook completo em [../support/incident-runbook.md](../support/incident-runbook.md).
