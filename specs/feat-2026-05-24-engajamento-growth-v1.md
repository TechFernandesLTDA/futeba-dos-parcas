# feat: Engajamento & Growth v1 — Epics e Histórias

> Data: 2026-05-24 | Status: Planejamento | Prioridade: Alta

---

## Resumo

Pacote de funcionalidades criativas e de baixo custo para incentivar o uso orgânico do app, inspirado em mecânicas do Cartola FC: grupos oficiais abertos, ranking semanal estilo fantasy, badges, ligas de temporada, peladas públicas, convites virais, time dos sonhos e desafios inter-grupos.

**Base atual: 3 usuários reais, 13 contas de QA.**

---

## Épicos

| # | Épico | Complexidade | Impacto | Dependências |
|---|-------|:---:|:---:|---|
| E1 | Grupos Oficiais Abertos | 3 | Alto | — |
| E2 | Ranking Semanal "Cartola da Pelada" | 4 | Altíssimo | E1 |
| E3 | Badges e Conquistas | 3 | Alto | — |
| E4 | Liga de Temporada | 4 | Alto | E1, E2 |
| E5 | Pelada Pública / Feed Aberto | 4 | Altíssimo | — |
| E6 | Convite Viral + Embaixador | 2 | Médio | — |
| E7 | Time dos Sonhos / Scout | 3 | Médio | — |
| E8 | Desafios Inter-Grupos | 4 | Alto | E1 |

---

## Épico 1: Grupos Oficiais Abertos

**Meta**: Usuário novo entra no app e já tem grupos pra se juntar em 1 clique, sem precisar ser convidado. Igual entrar numa liga do Cartola.

### História 1.1 — Descoberta de Grupos Oficiais

**Como** jogador novo no app,
**Quero** ver uma lista de grupos oficiais abertos categorizados,
**Para** encontrar rapidamente onde me encaixar e já começar a competir.

#### Critérios de Aceite
- [ ] Tela "Descobrir Grupos" acessível da home (CTA principal)
- [ ] Grupos exibidos em cards com: nome, ícone, descrição, número de membros, ranking resumido (top 3)
- [ ] Categorias: `Região`, `Dia da Semana`, `Tipo de Campo`, `Faixa Etária`, `Empresa`
- [ ] Filtro por proximidade (se localização liberada)
- [ ] Busca textual por nome de grupo
- [ ] Botão "Entrar" em cada grupo (instantâneo, sem aprovação)
- [ ] Loading → Shimmer, Empty → "Novos grupos em breve!", Error → retry

#### Issues Técnicas
- `E1-01` Criar subcoleção `official-groups` no Firestore com estrutura: `{ name, category, region, icon, description, memberCount, createdAt }`
- `E1-02` Seed inicial: criar 6-8 grupos oficiais (Zona Sul, Zona Norte, Zona Leste, Zona Oeste, Quarta de Ouro, Sabadão, Society Raiz, Master 35+)
- `E1-03` Tela `DiscoverGroupsScreen` (web) + `useDiscoverGroups` hook
- `E1-04` Ação "Entrar no grupo" → `writeBatch` adiciona `users/{uid}/groups/{groupId}` + incrementa `memberCount`
- `E1-05` Listar grupos oficiais na home com ranking interno resumido (top 3)
- `E1-06` Testes: join group idempotente, não duplica, trata erro

### História 1.2 — Ranking Interno do Grupo Oficial

**Como** membro de um grupo oficial,
**Quero** ver o ranking dos jogadores do grupo por XP/rating,
**Para** competir com a galera da minha região/dia.

#### Critérios de Aceite
- [ ] Dentro do grupo oficial, aba "Ranking" com lista ordenada por XP
- [ ] Colunas: Posição, Foto, Nome, XP, Rating, Jogos
- [ ] Destaque visual pro usuário logado (cor primária)
- [ ] Períodos: Semanal / Mensal / Geral (tabs)

#### Issues Técnicas
- `E1-07` Query agregada: `users` com `is_searchable: true` que pertencem ao grupo, ordenada por XP
- `E1-08` Cache do ranking (atualiza a cada 10 min)

---

## Épico 2: Ranking Semanal "Cartola da Pelada"

**Meta**: Todo domingo à noite o app gera automaticamente o ranking da semana com pontuação estilo fantasy, e notifica todo mundo. Igual a rodada do Cartola.

### História 2.1 — Pontuação Automática da Rodada

**Como** jogador,
**Quero** ganhar pontos automaticamente por cada pelada que jogo na semana (gols, assistências, MVP, presença),
**Para** acompanhar minha performance semanal e competir com os amigos.

#### Critérios de Aceite
- [ ] Cloud Function roda todo domingo 23:59 (scheduled)
- [ ] Pontuação por evento na semana:
  - Presença: +3 pts
  - Gol: +5 pts
  - Assistência: +3 pts
  - MVP da pelada: +8 pts
  - Vitória: +2 pts
  - Empate: +1 pt
  - Bola Murcha: -3 pts
- [ ] Ranking consolidado salvo em `weekly-rankings/{yyyy-ww}`
- [ ] Notificação push para todos: "Rodada #23 fechada! Você ficou em Xº lugar. Veja o ranking."

#### Issues Técnicas
- `E2-01` Cloud Function `processWeeklyRanking` (scheduled, pubsub)
- `E2-02` Coleção `weekly-rankings/{yyyy-ww}` com `{ rankings: [{userId, name, photoUrl, points, goals, assists, mvp, presence}] }`
- `E2-03` Notificação push em massa (tópico `all-users`)
- `E2-04` Testes: idempotência (rodar 2x não duplica), semana vazia não quebra

### História 2.2 — Time da Semana na Home

**Como** qualquer usuário,
**Quero** ver o "Time da Semana" (melhores 5 da rodada) em destaque na tela inicial,
**Para** me inspirar a jogar melhor e aparecer lá.

#### Critérios de Aceite
- [ ] Card "Time da Semana" no topo da home (abaixo do header)
- [ ] Exibe 5 avatares com nome, XP semanal, badge de posição (1º 🥇, 2º 🥈, 3º 🥉)
- [ ] Swipe horizontal ou carrossel
- [ ] Estado vazio: "A próxima rodada começa segunda. Jogue e apareça aqui!"

#### Issues Técnicas
- `E2-05` Hook `useWeeklyRanking` → lê `weekly-rankings/{current-week}`
- `E2-06` Componente `TeamOfTheWeekCard` (web) + `TeamOfTheWeek` (Compose)
- `E2-07` Widget na home com fallback para semana atual vazia

### História 2.3 — Troféu "Mito da Rodada"

**Como** melhor jogador da semana,
**Quero** receber um troféu especial de "Mito da Rodada" visível no meu perfil,
**Para** ter reconhecimento social e gerar competição saudável.

#### Critérios de Aceite
- [ ] Badge "Mito da Rodada #23" aparece no perfil do #1 da semana
- [ ] Badge temporário (dura 7 dias, até próxima rodada)
- [ ] Notificação personalizada: "Você é o Mito da Rodada! Seu troféu já está no perfil."

#### Issues Técnicas
- `E2-08` Subcoleção `users/{uid}/badges` com TTL de 7 dias
- `E2-09` Exibição de badges ativos no perfil (web + Android)

---

## Épico 3: Badges e Conquistas

**Meta**: Sistema leve de badges temáticos de futebol que reconhecem comportamento real, sem gamificação artificial. Visíveis no perfil, geram curiosidade e competição.

### História 3.1 — Conquistas por Comportamento Real

**Como** jogador frequente,
**Quero** ganhar badges automaticamente por feitos reais (presença, gols, vitórias),
**Para** ter reconhecimento e motivação pra continuar jogando.

#### Critérios de Aceite
- [ ] Badges disparados automaticamente por triggers:
  | Badge | Gatilho |
  |-------|---------|
  | Rei das Quartas | 10 quartas-feiras com presença confirmada (não consecutivas) |
  | Carrasco | Venceu o mesmo adversário 5x (head-to-head) |
  | Onipresente | Jogou em 3+ campos diferentes no mês |
  | Garçom | Mais assistências do mês no grupo |
  | Artilheiro | Mais gols do mês no grupo |
  | Paredão | Goleiro com mais defesas no mês |
  | 100 Jogos | 100 peladas com presença confirmada |
  | Imbatível | 10 vitórias seguidas |
- [ ] Badge aparece no perfil com ícone, nome e data de conquista
- [ ] Notificação push ao conquistar
- [ ] Badges são permanentes (não expiram)

#### Issues Técnicas
- `E3-01` Cloud Function `checkBadgeTriggers` — roda após cada `onGameStatusUpdate`
- `E3-02` Subcoleção `users/{uid}/badges` com estrutura `{ badgeId, name, icon, earnedAt }`
- `E3-03` Componente `BadgeGrid` no perfil (web + Android)
- `E3-04` Lógica de detecção: "10 quartas-feiras", "carrasco 5x", "onipresente", etc.
- `E3-05` Testes unitários para cada gatilho de badge

### História 3.2 — Vitrine de Badges no Perfil

**Como** visitante do perfil de outro jogador,
**Quero** ver todos os badges que ele conquistou,
**Para** saber quem é brabo e criar rivalidade.

#### Critérios de Aceite
- [ ] Seção "Conquistas" no perfil público (abaixo do avatar/rating)
- [ ] Grid de badges com tooltip (nome + descrição)
- [ ] Badges não conquistados aparecem em cinza com "?" (gera curiosidade)
- [ ] Contador "X/15 conquistas desbloqueadas"

#### Issues Técnicas
- `E3-06` `useBadges` hook → lê `users/{uid}/badges`
- `E3-07` Componente `AchievementShowcase` no perfil
- `E3-08` Lista completa de badges disponíveis (15) com ícones

---

## Épico 4: Liga de Temporada

**Meta**: Grupos oficiais viram "ligas" com temporadas mensais. Ao fim, o MVP ganha destaque e o último lugar ganha zoação. Reinício automático gera engajamento cíclico.

### História 4.1 — Temporada Mensal com Início e Fim

**Como** membro de grupo oficial,
**Quero** participar de uma liga com início e fim definidos (mensal),
**Para** ter um objetivo claro e competir em ciclos.

#### Critérios de Aceite
- [ ] Cada temporada dura 1 mês (dia 1 ao último dia do mês)
- [ ] Ranking da temporada visível na página do grupo
- [ ] Ao fim da temporada:
  - MVP recebe badge "MVP da Liga [Mês]"
  - Último colocado recebe badge "Lanterninha" (zoeira leve)
  - Ranking é arquivado em `season-archive/{groupId}/{yyyy-mm}`
  - Nova temporada começa automaticamente no dia 1

#### Issues Técnicas
- `E4-01` Cloud Function `startNewSeason` — scheduled no dia 1 de cada mês 00:01
- `E4-02` Cloud Function `archiveSeason` — salva ranking final
- `E4-03` Estrutura `season-archive/{groupId}/{yyyy-mm}` com ranking final
- `E4-04` Tela "Temporada Atual" dentro do grupo com contagem regressiva (dias restantes)

### História 4.2 — Hall da Fama da Liga

**Como** jogador,
**Quero** ver o histórico de MVPs passados da liga,
**Para** saber quem dominou as temporadas anteriores.

#### Critérios de Aceite
- [ ] Aba "Hall da Fama" no grupo oficial
- [ ] Timeline com: mês, MVP (foto + nome), pontos, badge
- [ ] "X vezes MVP" — se o mesmo jogador ganhou mais de uma vez

#### Issues Técnicas
- `E4-05` Query `season-archive/{groupId}` ordenado por mês
- `E4-06` Componente `HallOfFame` (web + Android)

---

## Épico 5: Pelada Pública / Feed Aberto

**Meta**: Resolver o problema de "não tenho grupo fixo" com um feed de peladas abertas. Qualquer um cria, qualquer um se inscreve. Perfeito pra aquisição de novos usuários.

### História 5.1 — Criar Pelada Aberta ao Público

**Como** dono de grupo ou campo,
**Quero** criar uma pelada e marcá-la como "Aberta ao Público",
**Para** preencher vagas com jogadores que não são do meu grupo.

#### Critérios de Aceite
- [ ] Checkbox "Abrir ao público" no formulário de criação de pelada
- [ ] Se marcado: pelada aparece no feed público com vagas restantes visíveis
- [ ] Campo `publicGame: true` + `vacancies: number` + `autoConfirm: boolean`
- [ ] Dono pode remover inscritos, fechar inscrições a qualquer momento

#### Issues Técnicas
- `E5-01` Campo `publicGame`, `vacancies`, `confirmedPlayers[]` no documento do jogo
- `E5-02` UI: checkbox + campo de vagas no formulário de criação
- `E5-03` Cloud Function `onPublicGameCreated` — indexa em `public-games/{gameId}` pra busca rápida

### História 5.2 — Feed de Peladas Perto de Você

**Como** jogador sem grupo ou querendo jogar mais,
**Quero** ver um feed de peladas públicas próximas com vagas abertas,
**Para** encontrar onde jogar essa semana.

#### Critérios de Aceite
- [ ] Tela "Peladas Abertas" acessível da home (CTA)
- [ ] Cards com: nome do campo, data/hora, vagas (X/Y), distância, nível médio
- [ ] Ordenação: data mais próxima primeiro
- [ ] Filtro: data, distância, nível
- [ ] Botão "Quero Jogar" → confirmação instantânea (se `autoConfirm: true`) ou pendente
- [ ] Push notification quando confirmado

#### Issues Técnicas
- `E5-04` Coleção `public-games` com índice composto `[date, location]`
- `E5-05` Tela `PublicGamesScreen` + `usePublicGames` hook
- `E5-06` Ação "Quero Jogar" → adiciona UID ao array `confirmedPlayers`, decrementa `vacancies`
- `E5-07` Filtro por proximidade (se localização do usuário disponível)
- `E5-08` Testes: vagas esgotadas não permite inscrição, sem duplicata

### História 5.3 — Feed de Jogadores Disponíveis

**Como** dono de pelada com vagas,
**Quero** ver jogadores próximos disponíveis pra jogar,
**Para** convidar ativamente e preencher a pelada.

#### Critérios de Aceite
- [ ] Opção no perfil: "Disponível pra jogar" (toggle)
- [ ] Feed "Jogadores Disponíveis" mostra quem está com toggle ativo por perto
- [ ] Botão "Convidar" envia notificação push pro jogador

#### Issues Técnicas
- `E5-09` Campo `availableToPlay: boolean` + `availableUntil: timestamp` no perfil
- `E5-10` Tela `AvailablePlayersScreen` + `useAvailablePlayers` hook
- `E5-11` Lógica de expiração automática do `availableToPlay` (12h)

---

## Épico 6: Convite Viral + Embaixador

**Meta**: Sistema simples de código de convite com badges de status social (níveis bronze/prata/ouro). Zero custo, puro ego.

### História 6.1 — Gerar e Compartilhar Código de Convite

**Como** usuário engajado,
**Quero** ter um código de convite único pra compartilhar com amigos,
**Para** trazê-los pro app e ganhar reconhecimento.

#### Critérios de Aceite
- [ ] Cada usuário tem um `inviteCode` único (gerado no cadastro)
- [ ] Tela de perfil mostra código com botão "Copiar" e "Compartilhar"
- [ ] Deep link: `https://futebadosparcas.web.app/invite/{inviteCode}`
- [ ] Tela de cadastro tem campo opcional "Código de convite"
- [ ] Ao cadastrar com código, `invitedBy` é salvo no perfil do novo usuário

#### Issues Técnicas
- `E6-01` Campo `inviteCode` (6 chars alfanuméricos, único) gerado no `onCreate` do usuário
- `E6-02` Deep link + rota `/invite/:code` no web
- `E6-03` Deep link no Android (App Links / Dynamic Links)
- `E6-04` Campo `invitedBy: uid` + `inviteCount` no perfil

### História 6.2 — Badge de Embaixador

**Como** usuário que trouxe vários amigos,
**Quero** receber badges de Embaixador (bronze/prata/ouro),
**Para** ter status e reconhecimento na comunidade.

#### Critérios de Aceite
- [ ] Badges automáticos:
  - Embaixador Bronze: 3 convidados cadastrados
  - Embaixador Prata: 10 convidados
  - Embaixador Ouro: 30 convidados
  - Embaixador Lenda: 100 convidados
- [ ] Badge visível no perfil com destaque (borda dourada/prateada)
- [ ] Notificação ao subir de nível

#### Issues Técnicas
- `E6-05` Cloud Function `onUserCreated` → incrementa `inviteCount` do `invitedBy`
- `E6-06` Cloud Function `checkAmbassadorBadge` — verifica thresholds
- `E6-07` Badge com estilo especial no perfil (ícone + cor por nível)

---

## Épico 7: Time dos Sonhos / Scout

**Meta**: Usuário monta um time fictício com os melhores jogadores reais que já enfrentou. Ranking paralelo de "melhor olheiro", gerando vontade de jogar com mais gente.

### História 7.1 — Montar Time dos Sonhos

**Como** jogador,
**Quero** montar um time fictício escolhendo entre jogadores reais da plataforma que já joguei contra,
**Para** competir no ranking de "melhor scout" e me divertir.

#### Critérios de Aceite
- [ ] Tela "Meu Time dos Sonhos" (formação 2-2-1 futsal ou 3-3-1 society)
- [ ] Só pode escalar jogadores com quem já jogou pelo menos 1 pelada
- [ ] Cada jogador tem "preço" baseado no rating (rating * 10 = preço)
- [ ] Orçamento fixo de 100 moedas
- [ ] Time salvo em `users/{uid}/dream-team`

#### Issues Técnicas
- `E7-01` Coleção `users/{uid}/dream-team` com `{ formation, players: [{userId, position}], createdAt }`
- `E7-02` Tela `DreamTeamScreen` + `useDreamTeam` hook
- `E7-03` Lógica de orçamento e restrição "já jogou contra"

### História 7.2 — Ranking de Scout

**Como** dono de time dos sonhos,
**Quero** ver como meu time se compara com o de outros usuários,
**Para** competir pelo título de melhor olheiro.

#### Critérios de Aceite
- [ ] Pontuação do time = soma dos pontos semanais reais dos jogadores escalados
- [ ] Ranking "Top Scouts" atualizado junto com ranking semanal (Épico 2)
- [ ] Badge "Olheiro de Ouro" pro #1 do ranking de scout

#### Issues Técnicas
- `E7-04` Cloud Function estendida do `processWeeklyRanking` para calcular score do dream team
- `E7-05` Ranking de scout na home (abaixo do Time da Semana)

---

## Épico 8: Desafios Inter-Grupos

**Meta**: Dois grupos oficiais se enfrentam em pelada combinada. Gera conexão entre quem nunca jogou junto e rivalidade saudável.

### História 8.1 — Criar Desafio Inter-Grupos

**Como** capitão/líder de grupo oficial,
**Quero** desafiar outro grupo oficial pra uma pelada,
**Para** criar rivalidade e integração entre grupos.

#### Critérios de Aceite
- [ ] Botão "Desafiar Grupo" na página de outro grupo oficial
- [ ] Formulário: data, horário, local, formato (futsal/society)
- [ ] Grupo desafiado recebe notificação: "{Grupo A} te desafiou pra uma pelada!"
- [ ] Aceitar/Recusar/Propor nova data
- [ ] Ao aceitar: cria pelada normal vinculada aos 2 grupos

#### Issues Técnicas
- `E8-01` Coleção `group-challenges/{challengeId}` com `{ challengerGroupId, challengedGroupId, status, proposedDate, gameId }`
- `E8-02` Notificação push para membros do grupo desafiado
- `E8-03` Tela "Desafios" no grupo com histórico

### História 8.2 — Placar Inter-Grupos

**Como** membro de grupo,
**Quero** ver o histórico de confrontos do meu grupo contra outros,
**Para** acompanhar a rivalidade.

#### Critérios de Aceite
- [ ] Aba "Confrontos" no grupo oficial
- [ ] Card: Grupo A vs Grupo B, placar, data, MVP da pelada
- [ ] Estatísticas agregadas: vitórias, derrotas, empates, aproveitamento

#### Issues Técnicas
- `E8-04` Campo `interGroupGame: true` + `groupIds: [id1, id2]` no jogo
- `E8-05` Query agregada de confrontos entre dois grupos
- `E8-06` Componente `HeadToHeadGroups` (web + Android)

---

## Ordem de Execução Recomendada

```
Fase 1 (2-3 semanas) — Fundação
  ├── E1: Grupos Oficiais Abertos
  ├── E6: Convite Viral + Embaixador
  └── E5: Pelada Pública

Fase 2 (2-3 semanas) — Engajamento Core
  ├── E2: Ranking Semanal "Cartola"
  ├── E3: Badges e Conquistas
  └── E4: Liga de Temporada

Fase 3 (2-3 semanas) — Viralidade
  ├── E7: Time dos Sonhos / Scout
  └── E8: Desafios Inter-Grupos
```

**Total estimado**: 6-9 semanas com 1-2 devs dedicados.

---

## Métricas de Sucesso

| Métrica | Baseline | Alvo (30 dias) | Alvo (90 dias) |
|---------|----------|----------------|----------------|
| Usuários reais | 3 | 30 | 100 |
| DAU (daily active) | 0 | 5 | 20 |
| Grupos oficiais ativos | 0 | 8 | 15 |
| Peladas/semana | ~2 (QA) | 10 | 25 |
| Convites convertidos | 0 | 5 | 20 |

---

## Riscos

- **Seed de grupos oficiais**: sem massa crítica inicial, grupos ficam vazios → mitigar com seed bem pensado (geolocalizado) e destaque na home
- **Pelada pública sem adesão**: risco de criar e nunca preencher → mitigar com notificações agressivas e "jogadores disponíveis"
- **Ranking semanal vazio**: se ninguém jogar na semana → fallback elegante ("A próxima rodada começa segunda!")
