# SPEC: Reacoes e comentarios no resultado de votacoes

> **Status:** `APPROVED`
> **Autor:** Codex
> **Data:** 2026-07-04
> **Issue:** #3239
> **Epico:** #3240 (Rede social da pelada)

## Decisoes

- Reacoes usam o proprio doc `games/{gameId}` no campo `vote_result_reactions`.
- Comentarios reutilizam `games/{gameId}/comments` com `context: 'vote_result'`.
- Janela de escrita: 72h apos `voting_concluded_at`; depois read-only.
- Nenhuma escrita em `mvp_votes` ou contagens de votacao e aberta ao cliente.
- Top zoeiras fica fora da v1; comentarios seguem ordenacao cronologica.

## Implementacao

- Firestore Rules liberam somente `vote_result_reactions` no game doc, para participantes/gestores/admin e dentro da janela de 72h.
- Rules de comentarios aceitam `context` e limitam `vote_result` a 200 caracteres dentro da mesma janela.
- Web estende `VoteResultScreen.tsx` com `ReactionBar` e `GameCommentsPanel` contextual.
- Android estende `VoteResultScreen.kt` com `SocialReactionBar` e `GameCommentsSection(context = "vote_result")`.

## Validacao

- ✅ `cd web && npm run build`
- ✅ `cd web && npm run lint`
- ✅ `./gradlew :app:compileDebugKotlin`
- ✅ `firebase emulators:exec --only firestore --project futebadosparcas "cd firestore-rules-tests && npx vitest run src/vote-result-social.test.ts"` (5/5)
- ✅ `git diff --check`
