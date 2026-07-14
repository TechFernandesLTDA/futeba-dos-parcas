# BUGFIX: Acessibilidade e descoberta do pós-jogo no GameDetail Android

> **Status:** `VERIFIED`
> **Severidade:** `MEDIUM`
> **Autor:** Codex
> **Data:** 2026-07-14
> **Issues:** #3632, #3635, #3639, #3644

---

## 1. Requisitos

### Comportamento atual

- O nome do local e as linhas de jogadores dos times têm área tocável inferior
  aos 48dp exigidos pelo Mobile DoD.
- A exclusão reversível de um jogo é apresentada como “cancelamento”, divergindo
  da operação `softDeleteGame` e do Web.
- Em jogos finalizados, a votação fica escondida no menu de overflow e o estado
  `hasVoted` calculado pelo ViewModel não é apresentado.

### Comportamento esperado

1. Todo alvo de toque alterado nesta correção deve ter no mínimo 48dp; o nome
   do local deve abrir seu detalhe quando houver `locationId`.
2. A ação destrutiva deve ser chamada “Excluir jogo” e explicar que um
   administrador pode revertê-la.
3. Jogos finalizados devem mostrar um card pós-jogo: CTA direta quando o voto
   está pendente e confirmação persistente quando o usuário já votou.
4. O atalho secundário no overflow deve refletir o mesmo estado de votação.

## 2. UX/UI

- O card de votação usa somente cores semânticas de `MaterialTheme.colorScheme`.
- Pendente: ícone de estrela, explicação curta e botão “Votar agora”.
- Concluído: ícone de confirmação e texto “Você já votou”. O item do overflow
  continua acessível para consultar o fluxo de votação.
- Textos novos existem em PT-BR, inglês e espanhol.
- Sem mudança nos estados loading/error/empty/success da tela; o card faz parte
  do estado success de um jogo `FINISHED`.

## 3. Desenho técnico

- Propagar `Success.hasVoted` para `GameDetailTopBar` e `GameDetailContent`.
- Encaminhar o `locationId` pelo callback de navegação canônico do `AppNavGraph`.
- Centralizar a decisão de apresentação em uma função pura testável que só
  produz estado pós-jogo para `GameStatus.FINISHED`.
- Adicionar `minimumInteractiveComponentSize()` ao local e `heightIn(min =
  48.dp)` às linhas dos times.
- Usar novas resources específicas de exclusão sem renomear resources legadas
  que possam representar cancelamento em outros fluxos.

### Offline, erro e segurança

Nenhuma escrita, permissão ou contrato de dados muda. A votação segue na tela
existente e a exclusão continua no `softDeleteGame`; esta correção apenas melhora
a entrada e descreve corretamente a reversibilidade administrativa.

## 4. Tarefas

- [x] Requisitos e UX aprovados
- [x] Implementar card/overflow orientados por `hasVoted`
- [x] Corrigir touch targets e navegação ao local
- [x] Alinhar nomenclatura de exclusão e feedback
- [x] Adicionar testes focados
- [x] Validar compile, lint/detekt e diff

## 5. Verificação prevista

- [x] Teste unitário da resolução `SCHEDULED/LIVE/FINISHED` e `hasVoted`.
- [x] `./gradlew :app:testDebugUnitTest --tests "*.GameDetailVotingPresentationTest"`
- [x] `./gradlew :app:compileDebugKotlin`
- [x] `./gradlew lint` (passou; dívida preexistente permanece coberta pelo baseline)
- [x] `./gradlew detekt` (passou; achados preexistentes fora do escopo permanecem)
- [x] `git diff --check`

## 6. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Card aparecer antes do fim | Função pura exige status canônico `FINISHED` |
| `hasVoted` temporariamente nulo | Tratar como voto pendente, mantendo CTA recuperável |
| Regressão de tradução | Resources explícitas nos três catálogos suportados |
| Texto implicar exclusão permanente | Confirmação informa recuperação por administrador |
