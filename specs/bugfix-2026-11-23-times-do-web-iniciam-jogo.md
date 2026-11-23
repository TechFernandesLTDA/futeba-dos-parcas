# BUGFIX: Jogo com times formados no web não inicia

> **Status:** `PROPOSED` (correção pedida pela sessão Central TF em 2026-11-23; a aprovação é o merge deste PR)
> **Severidade:** `HIGH`
> **Autor:** Claude (sessão da simulação de uso)
> **Data:** 2026-11-23
> **Base:** `origin/master` em `dcf5ac08`
> **Origem:** simulação de 13 semanas no emulador (PR #4621), achado "iniciar com times do web" (11 de 11 jogos)

---

## 1. Problema

O web forma os times em `web/src/pages/games/TeamFormationScreen.tsx` e grava só no documento do jogo:
`team1_players`, `team2_players`, `team1_name`, `team2_name`. O app nativo grava documentos em `teams`
(`game_id`, `name`, `color`, `player_ids`, `score`).

`startGameLifecycle` (`functions/src/games/lifecycle.ts`) lê só `teams where game_id == id`. Com os times do
web, acha zero documentos e responde `failed-precondition` ("O jogo precisa ter pelo menos dois times para
iniciar."). O botão "Iniciar" do web e do app falha em todo jogo cujos times foram montados no web.

Gravar os documentos de `teams` no web não resolve sozinho: o web deixa co-organizador formar times
(`canUserFormTeams`), e a regra de `teams` (`canOwnerMutateGameRoster`) só deixa o dono e o admin gravarem.

## 2. Correção

No `startGameLifecycle`, dentro da mesma transação, quando o jogo não tem nenhum documento em `teams`:

- monta os dois times a partir de `team1_players` e `team2_players` (ids de texto, sem vazios nem repetidos; um
  jogador nos dois lados fica só no time 1);
- se um dos lados estiver vazio, continua recusando como hoje;
- grava `teams/{gameId}_team1` e `teams/{gameId}_team2` no formato do app nativo (`id`, `game_id`, `name`,
  `color` vazio, `player_ids`, `score: 0`, `created_at`, `created_by: "startGameLifecycle"`), com os nomes de
  `team1_name`/`team2_name` ou "Time A"/"Time B";
- segue o início normal: jogo em `LIVE` e `live_scores` com os ids desses times.

Quando já existe algum documento em `teams` (formação pelo app), nada muda. Os ids fixos fazem uma nova
tentativa sobrescrever os mesmos dois documentos, sem criar times repetidos.

Por que no servidor: vale para o web e os apps já publicados, e para co-organizadores, sem afrouxar a regra
de `teams`. Nenhuma regra do Firestore mudou e nenhum campo novo fica legível: `teams` já é lido por qualquer
usuário autenticado e os ids de jogador já estão no jogo.

## 3. Fora deste PR

- Placar que não chega aos documentos de `teams` ao terminar o jogo: PR próprio.
- Times formados no web e alterados depois no app (ou o contrário) continuam em dois lugares; unificar a
  formação é assunto do issue de achados não graves.

## 4. Testes

`functions/test/game-lifecycle.test.ts`, bloco "times formados no web":

- sem documentos em `teams`, cria os dois times e inicia (falha antes, passa depois);
- com documentos em `teams`, usa os do app e não grava outros;
- sem jogador num dos lados, continua recusando sem gravar nada;
- `teamsFromGameRoster` limpa ids vazios, repetidos e não texto e usa os nomes padrão (falha antes: a função
  não existia).

## 5. Verificação

- [ ] `npm run build`, `npm run lint` e `npx jest` em `functions` verdes
- [ ] Deploy de `startGameLifecycle` depois do merge (Renan)
