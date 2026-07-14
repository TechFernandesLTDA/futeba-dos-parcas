# BUGFIX: Mutações seguras de presença no detalhe do jogo

> **Status:** `APPROVED`
> **Severidade:** `CRITICAL`
> **Autor:** Codex
> **Data:** 2026-07-13
> **Issues:** #3642, #3643, #3645

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

- Remover jogador confirmado ocorre com um toque, sem confirmação, e o `Result`
  do repositório é ignorado.
- “Recusar” convite pendente chama o toggle genérico; como `PENDING` não é
  confirmado, o fluxo tenta confirmar novamente e falha com mensagem incoerente.
- Confirmar/cancelar/aceitar não expõe submissão nem bloqueia toques concorrentes.

### 1.2 Comportamento Esperado (Correto)

Cada ação deve corresponder ao texto apresentado, ficar bloqueada enquanto está
em andamento e preservar o estado visível até o backend retornar sucesso.
Falhas devem informar o usuário e oferecer retry. Remoções exigem confirmação.

### 1.3 Passos para Reproduzir

1. Abrir um jogo com convite `PENDING` e tocar em Recusar: o app tenta confirmar.
2. Em conexão lenta, tocar repetidamente no CTA de presença: múltiplas coroutines
   são iniciadas.
3. Como organizador, tocar na lixeira de um confirmado: remoção imediata e falha
   silenciosa quando o repositório retorna erro.

### 1.4 Impacto

Convites não podem ser recusados, operações concorrentes geram resultados
ambíguos e uma remoção acidental perde a ordem de chegada do jogador.

---

## 2. Análise de Causa Raiz

- `toggleConfirmation` reduz `PENDING` e ausência de confirmação ao mesmo estado.
- Jobs de mutação não são guardados e a UI não recebe flags de submissão.
- `removePlayer` descarta `Result<Unit>`.
- O card chama a ação destrutiva diretamente.
- O listener de detalhes reconstrói `Success`; flags transitórias precisam ser
  preservadas entre snapshots para não reabilitar botões prematuramente.

---

## 3. Solução Aprovada

1. Adicionar `isPresenceSubmitting`, `removingPlayerIds` e
   `canRetryLastMutation` ao estado de sucesso.
2. Rastrear um job de presença e jobs de remoção por usuário; ignorar duplicatas
   enquanto ativos e cancelá-los em `onCleared`.
3. Modelar mutações explicitamente: confirmar, aceitar convite, cancelar/recusar
   e remover jogador.
4. `declineInvitation` sempre chama `cancelConfirmation`; o toggle também trata
   `PENDING` defensivamente como cancelamento.
5. Em falha, manter dados anteriores, mostrar snackbar localizado com Retry e
   reabilitar a ação. Em sucesso de remoção, retirar localmente somente depois do
   `Result.success`, enquanto o snapshot autoritativo converge.
6. Exigir `AlertDialog` com nome do jogador antes da remoção.
7. Exibir progresso in-place e desabilitar CTAs durante a operação.

### Autoridade e idempotência

`confirmPresence` já usa a callable `confirmGamePresence` e o documento
determinístico `${gameId}_${userId}`. A callable/Rules permanecem autoridade;
o lock do ViewModel impede repetição por gesto e não substitui validação servidor.
Cancelamento e remoção mantêm as permissões Firestore existentes.

### Offline/erro/retry

Não há remoção otimista antes do sucesso. Ao falhar, o snackbar oferece Retry
da mesma mutação, o estado original permanece e o botão volta a ficar disponível.

### Arquivos

| Arquivo | Alteração |
|---|---|
| `GameDetailViewModel.kt` | Estado, jobs, mutações explícitas, erro/retry |
| `GameDetailScreen.kt` | Dialog, loading e bloqueios |
| `values*/strings.xml` | PT-BR/EN/ES |
| `GameDetailViewModelTest.kt` | Regressões e concorrência |

---

## 4. Verificação

- [x] Testes focados do ViewModel
- [x] `:app:compileDebugKotlin`
- [x] `detekt`
- [x] `git diff --check`

---

## 5. Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Snapshot apagar flag transitória | Preservar campos de mutação ao reconstruir `Success` |
| Retry repetir operação já concluída | Só oferecer após `Result.failure`; callable/doc ID determinístico |
| Dialog fechar sem sucesso | Fechar apenas quando o confirmado sair do estado após sucesso |
| Concorrência entre remoções distintas | Job separado por `userId`; duplicata do mesmo alvo é ignorada |

---

## Histórico

| Data | Autor | Alteração |
|---|---|---|
| 2026-07-13 | Codex | Investigação, desenho e aprovação |
| 2026-07-13 | Codex | Implementação concluída e gates focados validados |
