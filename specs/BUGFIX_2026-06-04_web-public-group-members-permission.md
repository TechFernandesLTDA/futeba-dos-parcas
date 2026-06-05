# BUGFIX — Não-membro recebe "sem permissão" ao abrir grupo público (web)

- **Issue:** #2519
- **Status:** APPROVED
- **Data:** 2026-06-04
- **Plataforma:** Web (React)
- **Escopo:** client-only (sem mudança de security rules)

## Sintoma

No web, abrir um grupo **público** como **não-membro** mostra um `ErrorScreen`
bloqueante ("você não tem permissão") e o usuário não consegue entrar — o botão
"Solicitar entrada" nunca é renderizado.

## Causa-raiz

`useGroupDetail` (`web/src/hooks/useGroups.ts`) monta dois listeners ao abrir o
detalhe do grupo:

1. `groups/{id}` — permitido para grupo público (`is_public == true`).
2. `groups/{id}/members` (**list query**) — a rule de leitura de members (**#1035**)
   só libera o list para `isGroupMember`/`isAdmin`. Um não-membro recebe
   `PERMISSION_DENIED`.

O callback de erro do listener (2) chamava `setError(...)`. `GroupDetailScreen:215`
renderiza qualquer `error` como `ErrorScreen` de tela cheia → esconde o conteúdo do
grupo e o botão de entrada.

A negação da **lista** de members para não-membro é **esperada** (proteção de PII /
#1035), não um erro fatal. Só a leitura do **grupo** deveria ser fatal.

## Correção

No listener de members do `useGroupDetail`, tratar a falha como **não-fatal**:
`logger.warn` + `setMembers([])`, **sem** `setError`. O estado de erro bloqueante
fica exclusivo do listener do grupo.

### Por que o caminho de entrada volta a funcionar

`GroupDetailScreen` deriva membership do array: `members.find(m => m.userId === uid)`.
Para não-membro em grupo público, `members` vazio →
`isMember = false` → `shouldTrackJoinRequest = !isMember && group.isPublic === true`
→ `true` → botão "Solicitar entrada" renderiza. Membro real continua lendo a lista
(rule permite `isGroupMember`), então `isMember = true` se mantém correto.

## Não-regressão / fora de escopo

- **Não** afrouxa a rule #1035 (lista de members continua restrita — sem exposição de PII).
- Membro vê a lista normalmente; só o caso negado degrada para vazio.
- Independente do deploy de invite-join (#2518): bug pré-existente no bundle web +
  rule #1035 antiga. O deploy de hoje (functions + rules comment-only) não causou isto.

## Verificação

- [ ] Lint/build web verde.
- [ ] Não-membro abre grupo público → vê grupo + "Solicitar entrada" (sem ErrorScreen).
- [ ] Membro abre o grupo → lista de membros normal.
- [ ] Erro de leitura do **grupo** (ex.: grupo privado alheio) ainda mostra ErrorScreen.
- [ ] Deploy: `cd web && npm run build && firebase deploy --only hosting`.
