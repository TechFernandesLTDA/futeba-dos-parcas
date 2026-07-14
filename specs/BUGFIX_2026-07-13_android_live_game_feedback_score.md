# BUGFIX: Exibir feedback e impedir placar associado ao time errado

> **Status:** `APPROVED`
> **Severidade:** `HIGH`
> **Autor:** Codex
> **Data:** 2026-07-13
> **Issues:** #3600, #3602
> **PR:** Pendente

---

## 1. Requisitos

### 1.1 Comportamento atual

- `LiveGameScreen` coleta `userMessage`, mas o `LaunchedEffect` não executa nenhuma ação. O `SnackbarHost` usa outra instância de estado, nunca acionada.
- Se `team1Id` ou `team2Id` do placar não existe na lista atual, o ViewModel mantém dois times ordenados por nome e associa os scores por posição, podendo inverter o resultado exibido.

### 1.2 Comportamento esperado

- Cada mensagem emitida pelo ViewModel aparece uma vez no Snackbar, inclusive quando duas mensagens consecutivas têm o mesmo texto.
- `SnackbarHost` e coletor compartilham a mesma instância estável de `SnackbarHostState`.
- Um placar só chega a `Success` quando `team1Id` e `team2Id` resolvem para dois times distintos.
- Vínculo ausente ou duplicado produz estado de erro explícito e não renderiza score potencialmente incorreto.
- Autoridade existente é preservada: somente owner vê a ação de finalizar; esta correção não amplia mutações.

### 1.3 Critérios de aceite

1. Sucesso e erro de eventos ao vivo são exibidos no Snackbar.
2. O mesmo texto emitido duas vezes resulta em dois eventos consumíveis.
3. IDs válidos continuam determinando a ordem dos times, independentemente do nome.
4. ID inexistente ou ambos os lados apontando para o mesmo time resultam em `LiveGameUiState.Error`.
5. Loading, erro com retry e sucesso continuam representados na tela.

---

## 2. UX/UI

- Feedback aparece no Snackbar Material 3 já existente, com cores do tema e sem sobrepor conteúdo do Scaffold.
- Inconsistência de dados usa o ErrorContent atual, com retry, em vez de mostrar um resultado possivelmente falso.
- Não adicionar diálogos ou ações novas.
- A tela continua responsiva para portrait, landscape e tablet por usar o Scaffold e os componentes existentes.
- Acessibilidade do Snackbar e do estado de erro permanece fornecida pelos componentes Material.

---

## 3. Design técnico

### 3.1 Invariantes

- Score de `team1Score` pertence exclusivamente ao time cujo ID é `team1Id`; o mesmo vale para o lado 2.
- Mensagens em `MutableSharedFlow` são eventos, não estado persistente. Devem ser coletadas diretamente no ciclo da composição, sem conversão para `State` ou método de limpeza.

### 3.2 Abordagem

- Criar `SnackbarHostState` com `remember` antes dos efeitos e passá-lo ao host do Scaffold.
- Extrair um coletor suspenso pequeno, testável, que ignora mensagens vazias e chama `showSnackbar` para cada emissão.
- No ViewModel, resolver os dois times por ID antes de montar `Success`; falhar de forma segura quando o vínculo não for íntegro.
- Manter a ordenação por ID persistido nos snapshots válidos e preservar os filtros de jogadores.

### 3.3 Arquivos afetados

| Arquivo | Alteração |
|---|---|
| `app/src/main/java/com/futebadosparcas/ui/livegame/LiveGameScreen.kt` | Estado/coleção correta do Snackbar |
| `app/src/main/java/com/futebadosparcas/ui/livegame/LiveGameViewModel.kt` | Fail-safe para IDs de time inconsistentes |
| `app/src/test/java/com/futebadosparcas/ui/livegame/LiveGameViewModelTest.kt` | Regressões de mapeamento do placar |
| `app/src/test/java/com/futebadosparcas/ui/livegame/LiveGameSnackbarTest.kt` | Entrega e repetição de mensagens |

### 3.4 Riscos e mitigação

| Risco | Mitigação |
|---|---|
| SharedFlow perder mensagem antes do coletor | Efeito de coleta é iniciado antes do efeito que carrega o jogo; eventos de ações ocorrem com tela composta |
| Snackbar bloquear a próxima mensagem | `showSnackbar` serializa a fila; teste cobre consumo e repetição |
| Inconsistência transitória durante atualização dos times | Falhar de forma explícita é mais seguro que exibir score trocado; qualquer novo snapshot válido restaura `Success` |

Não há decisão arquitetural nova; o fluxo passa a seguir a semântica já escolhida (`SharedFlow` para eventos e IDs persistidos como fonte de verdade).

---

## 4. Tarefas

- [x] REQUIREMENTS: registrar sintomas e critérios das duas issues.
- [x] UX/UI: definir feedback e erro seguro.
- [x] TECHNICAL DESIGN: coleta de eventos e resolução estrita por ID.
- [x] TASKS: listar arquivos e validações.
- [x] IMPLEMENTATION: corrigir tela/ViewModel e adicionar testes.
- [x] VERIFY: executar testes, compile, detekt e diff-check.

---

## 5. Release

Correção Android visível para incluir na próxima release consolidada. Sem bump, changelog, bundle, tag ou deploy isolado nesta frente.

---

## Histórico

| Data | Autor | Alteração |
|---|---|---|
| 2026-07-13 | Codex | Spec criada e aprovada para #3600 e #3602 |
| 2026-07-13 | Codex | Snackbar e vínculo do placar corrigidos; testes, compile e detekt validados |
