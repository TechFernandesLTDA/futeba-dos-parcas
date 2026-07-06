# Lançamento Público - Plano Operacional

Status: pacote operacional repo-ready para as issues #3299, #3300, #3301,
#3310, #3312, #3313 e #3314.

Este pacote concentra os pré-requisitos de produção para abrir o Futeba dos
Parças ao público sem misturar trabalho de release, deploy ou campanha final.
Docs-only não exige deploy; qualquer mudança futura de UI, domínio Firebase
Hosting ou e-mails transacionais deve passar pelo fluxo normal de PR e release.

## Mapa das issues

| Issue | Tema | Documento principal |
| --- | --- | --- |
| #3299 | Domínio principal e e-mails | [domain-email-plan.md](domain-email-plan.md) |
| #3300 | Monitoramento, alertas e rollback | [monitoring-rollback-runbook.md](monitoring-rollback-runbook.md) |
| #3301 | LGPD, termos e exclusão | [../privacy/lgpd-terms-deletion-checklist.md](../privacy/lgpd-terms-deletion-checklist.md) |
| #3308 | Performance de primeira abertura | [performance-readiness.md](performance-readiness.md) |
| #3310 | Custos Firebase e escala | [firebase-cost-model.md](firebase-cost-model.md) |
| #3312 | Suporte e incidentes | [../support/incident-runbook.md](../support/incident-runbook.md) |
| #3313 | Beta controlado | [beta-go-no-go.md](beta-go-no-go.md) |
| #3314 | Landing e campanha | [campaign-landing-plan.md](campaign-landing-plan.md) |

## Status de prontidão

| Área | Status no repo | Dependência externa |
| --- | --- | --- |
| Domínio/e-mails | Plano e contatos definidos em `domain-email-plan.md`. | Registrar/verificar domínio, DNS, SPF, DKIM e DMARC. |
| Monitoramento/rollback | Runbook e critérios documentados. | Criar dashboards/alertas no Google Cloud/Firebase. |
| LGPD/exclusão | URLs públicas e links no app mapeados. | Revisão jurídica e teste operacional com conta descartável. |
| Custos Firebase | Modelo 100/1.000/10.000 usuários documentado. | Confirmar preços atuais no Billing Calculator e ativar budgets. |
| Suporte | Canal atual e severidades documentados. | Criar caixas no domínio próprio. |
| Beta | Métricas, critérios e relatório definidos. | Executar beta com grupos reais. |
| Landing/campanha | Rota pública `/launch` e plano de campanha definidos. | Atualizar domínio oficial após DNS. |

## Go/no-go de produção

Use esta lista antes de qualquer campanha pública:

- [x] Domínio recomendado definido: `futebadosparcas.com.br`.
- [ ] DNS documentado e domínio verificado no
  Firebase Hosting.
- [ ] Redirecionamentos entre domínio principal, `web.app` e domínios
  institucionais testados.
- [x] E-mails de suporte e transacionais em domínio próprio definidos.
- [ ] SPF,
  DKIM e DMARC.
- [x] Termos, privacidade e exclusão publicados e acessíveis em onboarding,
  configurações/Sobre e URLs públicas.
- [ ] Exclusão de conta testada em web desktop e mobile, com evidência do antes
  e depois no Firebase Auth/Firestore/Storage.
- [ ] Budgets do Google Cloud ativos com alertas em 50%, 80%, 100% e 120%.
- [ ] Painel mínimo de erros, performance, Functions, Firestore, Hosting e
  Billing revisado pela equipe.
- [ ] Runbook de incidente e rollback conhecido por quem ficará de plantão.
- [ ] Beta com 5 a 10 grupos rodou por pelo menos 14 dias.
- [ ] Relatório beta concluiu go/no-go sem bloqueadores severidade 0 ou 1.
- [x] Landing mínima e CTAs publicados no app web em `/launch`.
- [x] Plano de posts e abordagem de quadras/organizadores documentado.

## Responsáveis sugeridos

| Papel | Responsabilidade |
| --- | --- |
| Release owner | Decide go/no-go, abre PRs de release e impede deploy silencioso. |
| Ops owner | Mantém budgets, alertas, rollback e resposta a incidentes. |
| Privacy owner | Revisa termos, privacidade, base legal e pedidos LGPD. |
| Support owner | Triage de tickets, comunicação de instabilidade e pós-incidente. |
| Growth owner | Landing, campanha, beta e relacionamento com quadras/organizadores. |

## Evidências mínimas

Para fechar as issues, anexar no PR ou nas issues:

- Links das URLs públicas e prints de acesso mobile/desktop.
- Print ou export dos budgets/alerts no Google Cloud.
- Print dos domínios verificados no Firebase Hosting e dos registros DNS.
- Checklist beta preenchido com datas, grupos, métricas e decisão go/no-go.
- Registro de teste de exclusão de conta sem dados pessoais reais.
- Matriz de custos com assunções revisadas.
