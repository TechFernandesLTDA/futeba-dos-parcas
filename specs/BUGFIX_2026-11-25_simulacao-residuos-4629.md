# BUGFIX: #4629 — itens restantes da simulação (texto de convite, tooltip, novato)

> **Status:** `IN_PROGRESS`
> **Severidade:** `LOW`
> **Autor:** opencode
> **Data:** 2026-11-25
> **PR:** (a abrir)
> **Issue:** #4629

---

## Verificação item a item (25/11/2026 sobre `origin/master`)

### P2 — atrapalham
| Item | Status no master |
|------|------------------|
| 8. XP <6 confirmados | ABERTO — pede spec de XP (decisão da regra) |
| 9. Web sem coordenadas | FEITO (#4634) |
| 10. Texto de convite (uso único) | **RESTAVA só o texto** — alinhado aqui (`generateInvitePrompt` "vale para 1 pessoa, 7 dias") |
| 11. Mensagem de voto | FEITO (`voterIneligibleMessage`, `VOTER_SUSPICIOUS_OVERLAP`/`VOTER_NO_PRESENCE`) |
| 12. Evolução zerada | FEITO (#4634) |
| 13. Card "0 jogos" | FEITO (#4634) |
| 14. Primeira tela do novato | **FEITO aqui** (permissões após 1º jogo + boas-vindas com CTAs) |

### P3 — acabamento
| Item | Status no master |
|------|------------------|
| 15. "assists"/7 dias | FEITO (#4630: `isInLastWeek` + chaves plurais) |
| 16. "1 jogos" | FEITO (#4630: `statistics.streakGames` plural) |
| 17. Data crua | FEITO (`formatGameDate`) |
| 18. Selo "Pendente" | FEITO (`PAYMENT_STATUS_CONFIG`: "Pagamento pendente") |
| 19. Raridade sem acento | FEITO (`rarityLabel`: Épico/Lendário) |
| 20. "Auto: 1.6" | FEITO (`autoRatingExplain`/`autoRatingNote`) |
| 21. Carona cancelada | FEITO (#4635) |
| 22. Pedir de novo | FEITO (#4636) |
| 23. Caixa recalcula | FEITO (#4637 Android) |
| 24. "R$ 15.71" | FEITO (`formatBRL` Intl) |
| 25. Botão dentro de botão | FEITO (comentário + testes de nesting) |
| 26. Tooltip em disabled | FEITO na tela principal; **resíduo aqui** no CommentsPanel delete |
| 27. Mini-ranking | FEITO (temporada + `group_ids` + seletor) |
| 28. `players[]` vazio | FEITO (web: sem escritas; Android #4637) |
| 29. Waitlist/emulador | FEITO (import modular `firebase-admin/firestore`) |

### Follow-ups "fora do escopo"
| Item | Status |
|------|--------|
| Saída/remoção (PENDING/WAITING) | FEITO (#4639–#4641) |
| `dateTime` Android não grava | ABERTO (trigger cobre; cliente gravar exige auditoria de rules) |
| Ordem dos times Android | FEITO (#4637, `orderBy(documentId)`) |
| XP retido: admin no app | ABERTO (feature própria, sem tela Android/iOS) |
| iOS não mostra análise | A VERIFICAR (separado) |
| Matriz de telas Android/iOS | Processo (QA, não código) |

## Este PR (só o que restava e era seguro)

1. **Item 10**: `groupDetail.generateInvitePrompt` → "para uma pessoa (uso único, válido por 7 dias)" em pt/en/es (alinhado a `DECISIONS.md` + `GROUP_INVITE_TTL_MS`). O `invite.*` pessoal (referral reutilizável de Embaixador) NÃO muda.
2. **Item 26**: `GameCommentsPanel` delete — Tooltip + disabled sem span → span (mesmo padrão já usado na GameDetailScreen).
3. **Item 14**: `HomeScreen` esconde `AppPermissionsPrompt` até `user.totalGames > 0`; `HomeTab` troca `HomeInviteCard` por cartão de boas-vindas (`/public-games` + `/game/create`) para novato (sem jogo, sem grupo) — chaves `home.welcome*` nos 3 idiomas.

## Verificação

- [x] `npx tsc --noEmit` (web)
- [x] `npx vitest run HomeScreen/HomeTab` (19 testes)
- [ ] `npm run build` + suíte completa (ver PR)
