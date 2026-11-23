# BUGFIX: Chat do jogo nega toda mensagem

> **Status:** `PROPOSED` (correção pedida pela sessão Central TF em 2026-11-23; a aprovação é o merge deste PR)
> **Severidade:** `HIGH`
> **Autor:** Claude (sessão da simulação de uso)
> **Data:** 2026-11-23
> **Base:** `origin/master` em `dcf5ac08`
> **Origem:** simulação de uso no emulador (PR #4621): 0 de 37 mensagens de chat aceitas, em duas rodadas

---

## 1. Problema

Jogador confirmado manda mensagem no chat do jogo e recebe `PERMISSION_DENIED`
("Property date_time is undefined on object").

A regra de create de `games/{gameId}/chat/{messageId}` confere o arquivamento (7 dias depois do jogo) lendo
`games/{gameId}.date_time`. Os jogos não têm esse campo: os apps, a recorrência e as functions gravam
`dateTime` (camelCase). A leitura de um campo ausente é erro na regra, e o create é negado sempre. O teste de
regras passava porque o fixture semeava `date_time`, formato que nenhum app grava.

## 2. Correção

Função `isGameChatOpen(gameId)` em `firestore.rules`, usada no create do chat:

- lê `dateTime` e, se não houver, `date_time` (documento antigo), como os leitores do web já fazem;
- data em Timestamp: aceita até 7 dias depois da data do jogo, como antes;
- sem nenhuma das duas datas: aceita. São os jogos criados pelo web antes da correção do `dateTime` (achado
  5, PR próprio). É o mesmo tratamento de `isFutureGameDate`. O arquivamento é regra de produto; quem pode
  escrever continua limitado a confirmado, gestor do jogo ou admin do grupo;
- data em outro formato (texto): nega.

Leitura, update (soft-delete) e delete não mudam. Nenhum campo novo fica legível.

## 3. Testes

`firestore-rules-tests/src/game-chat.test.ts`:

- os fixtures passam a gravar `dateTime`, o formato real; o caso de jogo arquivado usa `dateTime`;
- bloco novo: escrita com `dateTime`, documento antigo só com `date_time` (recente aceita, arquivado nega),
  jogo sem data aceita, data em texto nega, quem não está confirmado continua negado.

Com a regra atual, as escritas com `dateTime` falham; com a correção, passam (saídas no PR).

## 4. Verificação

- [ ] `npm test` em `firestore-rules-tests` verde
- [ ] Deploy de `firestore:rules` depois do merge (fica com o Renan)
