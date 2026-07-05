# Beta Controlado - #3313

Objetivo: validar o app com grupos reais antes de campanha pública, medindo
adoção, retenção, bugs e dúvidas de uso.

## Desenho do beta

| Item | Definição |
| --- | --- |
| Duração mínima | 14 dias corridos. |
| Participantes | 5 a 10 grupos de pelada reais. |
| Perfil | Misturar organizadores experientes, jogadores frequentes e grupos novos. |
| Plataforma | Web mobile/desktop e Android se incluído no release. |
| Suporte | Canal oficial definido em [../support/incident-runbook.md](../support/incident-runbook.md). |
| Escopo | Onboarding, criação de grupo, criação de jogo, confirmação, ranking e feedback. |

## Métricas mínimas

| Métrica | Como medir | Meta inicial |
| --- | --- | --- |
| Grupos criados | Eventos/Firestore `groups` | >= 5 grupos ativos. |
| Jogos criados | Eventos/Firestore `games` | >= 1 jogo por grupo no período. |
| Confirmações | `confirmations` por jogo | >= 50% dos jogadores convidados confirmam. |
| Retorno D7 | Usuários ativos no dia 7 após cadastro | >= 35%. |
| Retorno D14 | Usuários ativos no dia 14 | >= 20%. |
| Falhas críticas | Incidentes S0/S1 | 0 abertos no go/no-go. |
| Dúvidas recorrentes | Tickets/feedbacks categorizados | Top 5 dúvidas com resposta/runbook. |
| Tempo até criar primeiro jogo | Evento signup -> game_created | Medir baseline; meta < 10 min para organizador. |

## Checklist de execução

- [ ] Lista de grupos e organizadores cadastrada fora do repo, sem dados
  pessoais sensíveis em Markdown.
- [ ] Termos, privacidade e exclusão revisados antes de convidar usuários.
- [ ] Canal de suporte comunicado no convite.
- [ ] Mensagem de convite explica que é beta e pede feedback.
- [ ] Métricas de onboarding, grupo, jogo e confirmação verificáveis.
- [ ] Daily check rápido durante o beta: erros, custos, tickets e feedbacks.
- [ ] Relatório final preenchido.

## Relatório go/no-go

Preencher ao fim do beta:

| Campo | Valor |
| --- | --- |
| Período | `AAAA-MM-DD` a `AAAA-MM-DD` |
| Grupos convidados |  |
| Grupos ativos |  |
| Usuários ativos |  |
| Jogos criados |  |
| Confirmações |  |
| Retenção D7 |  |
| Retenção D14 |  |
| Bugs S0/S1 |  |
| Top 5 dúvidas |  |
| Custo Firebase no período |  |
| Decisão | Go / No-go / Go condicionado |

## Critérios de no-go

- Qualquer incidente S0 aberto.
- Incidente S1 sem mitigação ou sem owner.
- Exclusão de conta/dados falhando.
- Login/onboarding com falha recorrente.
- Custo projetado acima do budget sem explicação.
- Organizadores não conseguem criar grupo e jogo sem suporte manual.

## Go condicionado

Usar quando o beta foi saudável, mas há pendências pequenas:

- Bugs S2 com workaround claro.
- Ajustes de texto/FAQ/suporte.
- Métricas abaixo da meta por amostra pequena, sem bug crítico.
- Landing/campanha ainda pendente, sem impacto no app.
