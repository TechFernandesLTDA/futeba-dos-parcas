# Go/No-Go Público - Futeba dos Parças

Status: checklist operacional para fechar a preparação de produção no repo.

## Evidência entregue no repositório

| Issue | Evidência |
| --- | --- |
| #3281 | `scripts/deploy/build-web-hosting.js` substitui o predeploy frágil do Hosting e valida Node 22, `npm ci --include=dev`, `tsc` e `vite` via entrypoints de pacote. |
| #3299 | `docs/production-launch/domain-email-plan.md` define domínio recomendado, e-mails, DNS, redirects e evidência pública. |
| #3300 | `docs/production-launch/monitoring-rollback-runbook.md` define sinais, severidade, dashboards e rollback web/functions. |
| #3301 | `docs/privacy/lgpd-terms-deletion-checklist.md` mapeia URLs públicas, links, exclusão e revisão LGPD. |
| #3308 | `docs/production-launch/performance-readiness.md` registra build, chunks e preload; `firebase.json` mantém cache imutável para JS/CSS e PWA. |
| #3310 | `docs/production-launch/firebase-cost-model.md` estima 100, 1.000 e 10.000 usuários e riscos por tela/função. |
| #3312 | `docs/support/incident-runbook.md` define canal, severidade, comunicação e smoke mínimo. |
| #3313 | `docs/production-launch/beta-go-no-go.md` define beta, métricas, relatório e critérios de no-go. |
| #3314 | `/launch` entrega landing mínima pública com CTAs e links legais. |

## Bloqueios externos antes de campanha ampla

- DNS e Firebase Hosting custom domain verificados para `futebadosparcas.com.br`.
- SPF, DKIM e DMARC ativos para os e-mails oficiais.
- Budgets e alertas criados no Google Cloud/Firebase.
- Revisão jurídica/privacidade aprovada para termos e política.
- Beta controlado executado com grupos reais e relatório preenchido.

## Decisão

O repositório fica pronto para deploy técnico após CI verde. A campanha pública
deve aguardar a conclusão dos bloqueios externos acima ou registrar aceite de
risco explícito pelo release owner.
