# BUGFIX: defeitos de web e regras achados pela bateria (#4571, #4572, #4573, #4574)

> **Status:** `APPROVED` → `IN_PROGRESS`
> **Severidade:** `HIGH` (#4572 esconde todos os jogos da aba Jogos em produção)
> **Autor:** Claude Code (pedido do Renan em 15/11/2026)
> **Data:** 2026-11-15
> **Origem:** `specs/feat-2026-11-15-bateria-de-testes.md`

---

## 1. Descrição dos bugs

| Issue | Comportamento errado | Esperado |
|---|---|---|
| #4572 | Aba Jogos do web vazia para todo mundo. Produção tem 8 jogos e a aba mostra 0. | A aba lista os jogos públicos. |
| #4571 | Fila de revisão de jogos do admin (`/admin/game-reviews`) dá `PERMISSION_DENIED`. | O admin vê os jogos com XP retido ou encerramento automático em revisão. |
| #4573 | Membro do grupo que ainda não confirmou vê "4/12" no cabeçalho e a lista de confirmados vazia. | Membro ativo do grupo do jogo vê quem confirmou. |
| #4574 | Jogador vê o botão e o formulário de criar grupo; ao enviar, o web barra ("só dono de quadra e admin"). | Jogador cria grupo, como as regras e o Android já permitem. |

Reprodução: os quatro eram falha esperada na bateria (`web/e2e-bateria`, `test.fail` com `PENDENCIAS`).

## 2. Causa raiz

- **#4572**: `buildGamesQuery` (`web/src/hooks/useGames.ts`) filtrava `where('deleted_at', '==', null)`. Nenhum
  escritor grava `deleted_at: null` na criação (web, Android e as regras de `create` não aceitam o campo) e o
  Firestore não casa `== null` com campo ausente. Em produção, 0 de 8 jogos têm o campo. Android e iOS não fazem
  essa consulta.
- **#4571**: na regra de `list` de `games`, `isAdmin()` era o último operando do `||`. As filas do admin não filtram
  `visibility`, `owner_id` nem `group_id`; a avaliação estourava em `resource.data.group_id` (documento sem o campo)
  antes de chegar em `isAdmin()`, e erro de avaliação nega a consulta.
- **#4573**: a regra de leitura de `confirmations` só aceitava a própria confirmação, admin, dono do jogo e quem já
  confirmou. O hook `useGameDetail` espelhava a mesma restrição e nem abria o listener da lista.
- **#4574**: `CreateGroupScreen.handleSubmit` tinha uma trava de papel que as regras (`isProfileComplete()`) e o
  Android não têm.

## 3. Solução

- **#4572**: tirar o filtro do servidor. Os apagados já saem no cliente (`!game.deletedAt`, em `fetchGames` e no
  listener). Sem backfill e sem índice novo: sonda só de leitura em produção mostrou que os formatos de consulta
  usados por `GamesTab` e `GroupDetailScreen` já têm índice sem `deleted_at`.
- **#4571**: `isAdmin()` passa a ser o primeiro operando da regra de `list` de `games`.
- **#4573**: novo helper `isMemberOfGameGroup(gameId)` nas regras, somado à leitura de `confirmations`; no web,
  `useGameDetail` escuta o vínculo `groups/{groupId}/members/{uid}` e libera a lista para membro ativo.
  Visitante de jogo público e jogo sem grupo continuam restritos (a confirmação carrega dados de pagamento).
- **#4574**: remover a trava de papel e a chave de i18n `groups.onlyOwnersCanCreate`.

### Arquivos

- `web/src/hooks/useGames.ts`
- `firestore.rules`
- `web/src/pages/group/CreateGroupScreen.tsx` (+ teste)
- `web/src/i18n/locales/{pt-BR,es,en}.json`
- `firestore-rules-tests/src/bateria-4571-4573.test.ts` (novo)
- `web/e2e-bateria/{02-grupos,03-jogos,05-dono-e-admin}.spec.ts`, `web/e2e-bateria/pendencias.ts`

### Riscos

| Risco | Mitigação |
|---|---|
| Jogo apagado voltar a aparecer | Filtro no cliente já existia nos dois caminhos; teste unitário de `useGames` cobre. |
| Regra de `confirmations` abrir demais | Só membro ativo do grupo do jogo; teste de controle com não membro e com membro `REMOVED`. |
| Um `get()` a mais por leitura de confirmação | Só é avaliado quando os operandos anteriores falham (membro que não confirmou). |

## 4. Verificação

- [x] `firestore-rules-tests`: suíte inteira verde (88 arquivos, 1553 testes). Os 3 testes novos de permissão falham
      com as regras da master e passam com as novas.
- [x] Web: `tsc`, ESLint e Vitest dos arquivos tocados.
- [x] Bateria: as quatro falhas esperadas viraram teste normal; `PENDENCIAS` do web ficou vazio.
- [x] `scripts/bateria/rodar.sh rapida` e testes de contrato (`node --test`).

## 5. Publicação

Precisa de deploy de **Firestore rules** (#4571, #4573) e de **hosting do web** (#4572, #4573, #4574). Sem functions,
sem índices e sem backfill. As regras devem ir antes do web, ou junto: com o web novo e as regras antigas, o membro
que não confirmou veria um erro na lista de confirmados em vez da lista vazia.

## 6. Fora do escopo

- Aba Jogos não lista os jogos `GROUP_ONLY` dos grupos do usuário (#4578).
- #4575 e #4576 (Android), em outro PR.

## 7. Prevenção

Os quatro casos ficam como regressão na bateria e, para as regras, em `firestore-rules-tests`. Regra geral que sai
daqui: em regra de `list`, o operando que não depende de campo do documento (`isAdmin()`) vem primeiro.
