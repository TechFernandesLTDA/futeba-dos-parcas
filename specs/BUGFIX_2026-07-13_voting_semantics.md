# BUGFIX: Semântica consistente na votação MVP e Bola Murcha

> **Status:** `APPROVED`
> **Severidade:** `MEDIUM`
> **Autor:** Codex
> **Data:** 2026-07-13
> **Issues:** #3590, #3598
> **PR:** pendente

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

O fechamento da votação usa o mesmo desempate alfabético para categorias
positivas e para `WORST`. Assim, um empate exato em Bola Murcha escolhe um UID
arbitrariamente e aplica `-10 XP`. A submissão também aceita que o mesmo eleitor
aponte um jogador como `WORST` e como `MVP` ou `BEST_GOALKEEPER` no mesmo ballot.

### 1.2 Comportamento Esperado (Correto)

- Empate exato em `WORST` não elege Bola Murcha, não marca confirmação e não
  aplica penalidade de XP.
- Categorias positivas preservam o desempate determinístico atual.
- O mesmo jogador pode ser `MVP` e `BEST_GOALKEEPER`, preservando a elegibilidade
  legítima de goleiros a MVP.
- Um ballot não pode combinar `WORST` com qualquer categoria positiva para o
  mesmo jogador, inclusive quando as categorias chegam em chamadas separadas.
- A Function é a autoridade; a Web previne o conflito e fornece feedback
  acessível e traduzido.

### 1.3 Passos para Reproduzir

1. Encerrar um jogo com um voto `WORST` para A e um voto `WORST` para B.
2. Concluir a votação e observar A ou B escolhido pelo UID e penalizado.
3. Em outra votação, selecionar o mesmo jogador como MVP e Bola Murcha.
4. Enviar e observar o ballot contraditório aceito.

### 1.4 Contexto

| Item | Valor |
|------|-------|
| Platforms | Functions e Web |
| Frequência | Sempre que há empate/conflito descrito |
| Impacto | Justiça da gamificação e integridade do ballot |

---

## 2. Análise de Causa Raiz

### 2.1 Investigação

`resolveWinner` sempre ordena empates por `playerId`. Os callables validam
categoria, participação e auto-voto, mas não a coerência entre categorias do
ballot. O cliente apresenta as três listas sem exclusão entre positiva e
negativa.

### 2.2 Causa Raiz

Uma política genérica de desempate foi reutilizada para uma penalidade, e a
validação foi modelada por voto isolado em vez do ballot completo.

### 2.3 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `functions/src/voting/mvp-voting.ts` | Autoridade de validação, resolução e XP |
| `functions/test/mvp-voting.test.ts` | Regressões de payload, empate e penalidade |
| `web/src/pages/game/MVPVoteScreen.tsx` | Exclusão mútua e feedback |
| `web/src/pages/game/mvpVoteSemantics.ts` | Regra pura compartilhada pela UI/testes |
| `web/src/pages/game/MVPVoteScreen.test.tsx` | Comportamento acessível da UI |
| `web/src/i18n/locales/*.json` | Feedback em PT-BR, inglês e espanhol |

---

## 3. Solução Aprovada

### 3.1 Abordagem

1. Representar o ballot efetivo (votos persistidos + novos) dentro da mesma
   transação e rejeitar conflito `WORST` versus `MVP`/`BEST_GOALKEEPER`.
2. Aplicar a validação aos callables individual e em lote para impedir bypass.
3. Resolver `WORST` com uma variante que retorna `null` em empate; manter
   `resolveWinner` atual para categorias positivas.
4. Na Web, desabilitar candidatos conflitantes, limpar seleção recém-invalidada,
   bloquear submit defensivamente e explicar a restrição por texto acessível.

### 3.2 Regras de Compatibilidade

- `MVP` e `BEST_GOALKEEPER` podem apontar para o mesmo goleiro.
- Ballots válidos existentes não mudam.
- Ballots contraditórios legados não são migrados nesta correção; novas escritas
  passam a ser bloqueadas e o fechamento continua contabilizando dados já
  persistidos.

### 3.3 Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Chamada parcial contornar validação | Ler as três categorias na transação |
| Goleiro deixar de ser elegível a MVP | Permitir coincidência MVP/BEST_GOALKEEPER e testar |
| Regressão na contagem positiva | Manter `resolveWinner` inalterado para positivas |
| Penalidade em empate | Testar resultado, flags, updates e ausência de XP WORST |

---

## 4. Verificação

- [x] Functions: rejeita conflito no lote.
- [x] Functions: rejeita conflito com voto persistido em chamada individual/lote.
- [x] Functions: permite MVP e melhor goleiro para o mesmo jogador.
- [x] Functions: empate em WORST produz `null`, zero votos vencedores e nenhum XP.
- [x] Web: opções conflitantes ficam desabilitadas com descrição acessível.
- [x] Web: submit defensivo bloqueia conflito antes de chamar a Function.
- [x] Testes focados Functions e Web passam.
- [x] Builds, lints e suítes relevantes passam em Node 22.
- [x] `git diff --check` passa.

---

## 5. Release

Mudança visível em Web e mudança de regra em Functions. Deve integrar o próximo
release consolidado dessas duas plataformas, com release notes, changelog,
versões e deploys alinhados pelo fluxo de release do repositório.

---

## Histórico

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-07-13 | Codex | Spec criada e aprovada antes da implementação |
| 2026-07-13 | Codex | Implementação verificada com builds, lints e suítes completas |
