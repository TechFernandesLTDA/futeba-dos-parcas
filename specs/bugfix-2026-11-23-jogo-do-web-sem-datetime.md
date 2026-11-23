# BUGFIX: Jogo criado no web (e no Android) fica sem `dateTime`

> **Status:** `PROPOSED` (correção pedida pela sessão Central TF em 2026-11-23; a aprovação é o merge deste PR)
> **Severidade:** `HIGH`
> **Autor:** Claude (sessão da simulação de uso)
> **Data:** 2026-11-23
> **Base:** `origin/master` em `dcf5ac08`
> **Origem:** simulação de 13 semanas no emulador (PR #4621), achado "jogo sem dateTime" (14 jogos)

---

## 1. Problema

`games/{id}.dateTime` (Timestamp) é o campo que as listas de próximos jogos, os lembretes, o fechamento
automático, a recorrência e o chat do jogo usam para filtrar e ordenar. Quem grava hoje:

| Cliente | Criação | Edição |
|---------|---------|--------|
| Web (`web/src/hooks/useGames.ts`, `createGame`) | só `date` e `time` em texto; `dateTime` só se o formulário mandasse pronto (não manda) | `useUpdateGame` não mexe na data |
| Web, duplicar jogo | grava `dateTime` (hora local do navegador) | - |
| Android `:app` (`GameRepositoryImpl.gameToClientWriteMap`) | só `date` e `time` | `updateGame` faz `set(merge)` de `date`/`time` sem `dateTime` |
| Shared/iOS (`FirebaseGamesDataSource.createGame`) | grava `dateTime` pelo fuso do aparelho | - |

Jogo sem `dateTime` some das consultas `where("dateTime", ...)`/`orderBy("dateTime")`, não recebe lembrete,
não fecha sozinho e, até o PR do chat (#4623), negava o chat. Na simulação, 14 de 14 jogos criados pelo web
ficaram assim. Uma edição de data feita no Android deixa o `dateTime` antigo, então o jogo aparece no dia errado.

## 2. Correção

1. **Web** grava `dateTime` na criação, montado de `date` + `time` na hora local do navegador (mesmo critério
   do "duplicar jogo"). Data impossível (ex.: 31/02) é recusada com "Confira a data e a hora do jogo." antes
   de gravar. O campo legado `date_time` não é mais gravado.
2. **Trigger `onGameWrittenFillDateTime`** (`functions/src/games/game-datetime.ts`, `games/{gameId}`,
   southamerica-east1), para os apps já instalados:
   - jogo sem `dateTime` nem `date_time` em Timestamp: preenche;
   - `date` ou `time` mudaram e `dateTime` não mudou junto (edição do Android): recalcula;
   - em qualquer outro caso, inclusive quando o cliente gravou `dateTime`: não faz nada. O valor do cliente vale.
   - fuso: `locations/{location_id}.time_zone` quando é um fuso IANA válido; sem quadra ou fuso, America/Sao_Paulo
     (o mesmo padrão de `getGameDateTime` em `reminders.ts`);
   - grava só `dateTime`, numa transação que relê o documento e desiste se `date`/`time` já mudaram ou se o valor
     já está certo. A própria escrita não dispara outro cálculo.
3. **Aviso "Jogo atualizado"** (`onGameUpdatedNotification`): o preenchimento de `dateTime` (ausente para
   presente) não conta como remarcação, e a chave de deduplicação passa a ser `local|data|hora` (antes era
   `local|data|instante`). Assim o recálculo feito pelo trigger depois de uma remarcação não gera um segundo
   aviso. Efeito colateral bom: mudar só o horário no Android agora avisa os confirmados (antes não avisava,
   porque o Android não mexia em `dateTime`).
4. **Backfill** `scripts/migrations/backfill-game-datetime.js` para os jogos antigos. Só leitura por padrão;
   `--apply` grava só `dateTime` em quem não tem `dateTime` nem `date_time`. Quem roda em produção é o Renan.

Por que no servidor, e não só nos apps: o Android corrigido só chega com uma versão nova na loja, e os
aparelhos com versões antigas continuariam criando jogos sem o campo.

Sobre o fuso: o web usa a hora do navegador, o trigger e o backfill usam o fuso da quadra. Para quem marca jogo
no mesmo fuso da quadra, dá o mesmo instante. Se divergir, o valor do cliente vale, como hoje no iOS.

Nenhuma regra do Firestore mudou e nenhum campo novo fica legível.

## 3. Fora deste PR

- O Android `:app` continua sem gravar `dateTime` no cliente; o trigger cobre. Ajustar o cliente vai no issue
  dos achados não graves.
- `temporal-overlap.ts` usa só `date` quando falta `dateTime`; fica com o PR do XP retido.

## 4. Testes

- `web/src/utils/gameDateTime.test.ts`: montagem da data local e recusa de data impossível.
- `web/src/hooks/useGames.test.ts`: a criação grava `dateTime` e não `date_time`; mantém `dateTime` pronto;
  recusa 31/02 sem chamar `addDoc`.
- `functions/test/games/game-datetime.test.ts`: `zonedDateTime` (São Paulo, Manaus, Noronha, meia-noite, formatos
  inválidos) e `shouldComputeDateTime` (criação sem data, criação com data, legado, edição do Android, edição
  completa, escrita do próprio trigger, escrita sem mudança de data).
- `functions/test/notifications/game-notifications.test.ts`: preenchimento não avisa; mudar só o horário avisa;
  recálculo depois de uma remarcação já avisada não avisa de novo.
- `scripts/migrations/backfill-game-datetime.test.js` e uma rodada no emulador local (dry-run e `--apply`).

## 5. Verificação

- [ ] Testes do web, das functions e do script verdes
- [ ] Deploy da function `onGameWrittenFillDateTime` e de `onGameUpdatedNotification`, e do hosting, depois do merge (Renan)
- [ ] Backfill em produção: dry-run, conferir a contagem, depois `--apply` (Renan)
