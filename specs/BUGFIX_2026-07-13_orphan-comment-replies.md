# BUGFIX: Replies recentes sem comentário-pai na página

> **Status:** `VERIFIED`
> **Severidade:** `MEDIUM`
> **Autor:** Codex
> **Data:** 2026-07-13
> **Issue:** #3599

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

A consulta em tempo real limita os comentários aos 30 documentos mais recentes. Como comentários-raiz e respostas compartilham a mesma coleção, uma resposta recente pode chegar sem seu pai antigo. O painel agrupa respostas por `parentId`, mas só renderiza grupos cujo pai está carregado; por isso a resposta desaparece silenciosamente.

### 1.2 Comportamento Esperado (Correto)

Toda resposta da página recente deve ser visível. Pais ausentes devem ser hidratados sem alterar cursor, `hasMore`, ordem ou contagem da página. Se o pai não existir ou estiver indisponível por moderação, a resposta deve aparecer em um agrupamento de fallback. Pais soft-deleted devem preservar a thread sem expor o conteúdo removido.

### 1.3 Passos para Reproduzir

1. Criar mais de 30 comentários em um jogo.
2. Responder a um comentário-raiz que ficou fora da primeira página.
3. Abrir o painel de comentários.
4. Observar que a resposta recente não aparece até carregar páginas antigas.

### 1.4 Contexto

| Item | Valor |
|------|-------|
| Plataforma | Web |
| Versão | 1.53.12 |
| Frequência | Sempre que o pai fica fora da janela recente |
| Impacto | Respostas novas somem sem feedback |

---

## 2. Análise de Causa Raiz

### 2.1 Investigação

`useGameComments` escuta 30 documentos ordenados por `created_at desc`. `GameCommentsPanel` cria `rootComments` apenas com itens sem `parentId` e lê `repliesByParent` somente durante o `map` desses pais.

### 2.2 Causa Raiz

A paginação é baseada em documentos individuais, enquanto a renderização depende da integridade de threads. Não existe uma etapa que resolva referências `parentId` ausentes na janela atual nem fallback para referências inexistentes.

### 2.3 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `web/src/hooks/useGameComments.ts` | Listener, paginação e hidratação dos pais |
| `web/src/pages/game/GameCommentsPanel.tsx` | Projeção e fallback das threads |
| `web/src/pages/game/gameCommentThreads.ts` | Projeção pura e testável das threads |
| `web/src/hooks/useGameComments.test.ts` | Regressões de hidratação, chunks, dedupe e erro |
| `web/src/pages/game/GameCommentsPanel.test.tsx` | Fallback e soft-delete/moderação |

---

## 3. Solução Aprovada

### 3.1 Abordagem

1. Detectar `parentId`s ausentes na página recebida.
2. Consultar os pais pela ID do documento em lotes de no máximo 10.
3. Deduplicar pais e comentários antes de atualizar o estado.
4. Manter cursor e `hasMore` derivados exclusivamente da consulta paginada original.
5. Ignorar respostas assíncronas após cleanup ou quando um snapshot mais novo já tiver vencido a corrida.
6. Manter callback de erro no listener e propagar falhas de hidratação pelo estado `error`.
7. Projetar threads com placeholder para pai soft-deleted e agrupamento visível quando o pai realmente não existir.

### 3.2 Decisões

- A hidratação usa `documentId()` + `where(..., 'in', chunk)` com `chunk.length <= 10`, respeitando o limite conservador documentado do projeto.
- Pais hidratados são dados auxiliares: não entram na contagem da página e não movem `oldestDocRef`.
- Uma referência ausente não é erro de consulta; o painel exibe fallback para não perder a resposta.
- Falha de Firestore ao hidratar é um erro de carregamento e pode ser tentada novamente pelo próximo snapshot/remount.

### 3.3 Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Consultas extras para muitas threads antigas | Deduplicação e chunks de 10; somente IDs ausentes |
| Snapshot antigo sobrescrever o novo | Token de sequência + flag de cleanup |
| Cursor alterado por pais auxiliares | Cursor calculado apenas dos docs da query principal |
| Conteúdo removido reaparecer | Placeholder para pai soft-deleted; conteúdo não renderizado |

---

## 4. Verificação

- [x] Pai fora da primeira página é carregado e a reply renderiza.
- [x] Mais de 10 pais são consultados em vários chunks.
- [x] IDs repetidos são deduplicados.
- [x] Falha da consulta auxiliar atualiza `error` sem atualização tardia após cleanup.
- [x] Pai inexistente mantém a reply visível em fallback.
- [x] Pai soft-deleted mantém a thread sem revelar o texto removido.
- [x] Paginação, ordem, cursor e `hasMore` permanecem inalterados.
- [x] Testes focados, lint e build Web passam com Node 22.

---

## 5. Release

Mudança visível na Web. A correção deve constar na próxima release Web consolidada; este trabalho não altera versão nem realiza deploy isoladamente.

## Histórico

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-07-13 | Codex | Spec criada e aprovada para implementação da #3599 |
| 2026-07-13 | Codex | Implementação verificada com 13 testes focados, lint e build Web |
