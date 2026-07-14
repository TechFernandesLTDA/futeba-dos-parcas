# BUGFIX: Integridade do mapa de reações sociais

> **Status:** `APPROVED`
> **Severidade:** `LOW`
> **Autor:** Codex
> **Data:** 2026-07-13
> **Issue:** #3593
> **PR:** pendente

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

Os ramos de update de comentários, mural, fotos, vídeos e highlights
validam apenas que `reactions` é um mapa. Um participante autorizado consegue
substituir o mapa e apagar ou fabricar UIDs de terceiros.

### 1.2 Comportamento Esperado (Correto)

Cada cliente pode adicionar, trocar ou remover somente a própria reação.
As entradas dos demais usuários devem ser preservadas e o mapa deve seguir o
schema canônico `{ emoji: [uid, ...] }`, com os oito emojis permitidos e no
máximo uma reação ativa por usuário.

### 1.3 Reprodução

1. Persistir um conteúdo social com uma reação de outro jogador.
2. Como participante/membro diferente, enviar um update do mapa inteiro.
3. Observar que as Rules atuais aceitam apagar a reação alheia ou inserir um
   UID arbitrário.

### 1.4 Escopo

| Alvo | Campo |
|------|-------|
| `games/{gameId}/comments/{commentId}` | `reactions` |
| `groups/{groupId}/wall_posts/{postId}` | `reactions` |
| `game_photos/{photoId}` | `reactions` |
| `game_videos/{videoId}` | `reactions` |
| `post_game_highlights/{gameId}` | `reactions` |
| `games/{gameId}` | `vote_result_reactions` |

O campo `vote_result_reactions` é incluído porque usa o mesmo schema, o
mesmo writer (`useReactions`) e apresentava a mesma falha. Outros sistemas de
reação com modelos diferentes ficam fora do escopo.

---

## 2. Análise de Causa Raiz

### 2.1 Investigação

Web e Android escrevem paths `reactions.<emoji>` com `arrayUnion(uid)` e
`arrayRemove(uid)`. O ADR vigente define mapa de emoji para lista de UIDs,
não mapa indexado por UID.

### 2.2 Causa Raiz

`onlyAllowedFields(['reactions'])` protege apenas os campos de topo do
documento. A checagem `reactions is map` não compara o conteúdo anterior com o
novo nem vincula a diferença a `request.auth.uid`.

### 2.3 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `firestore.rules` | Helper e aplicação da invariante |
| `firestore-rules-tests/src/*.test.ts` | Regressão dos seis alvos sociais |

---

## 3. Solução Aprovada

### 3.1 Abordagem

Adicionar helpers reutilizáveis que:

1. aceitam somente os oito emojis canônicos e valores do tipo lista sem
   duplicatas;
2. comparam cada lista antes/depois como conjunto e permitem que somente o UID
   autenticado entre ou saia;
3. impedem que o UID autenticado permaneça em mais de um emoji;
4. em creates client-side, aceitam mapa vazio ou apenas a reação do autor.

Aplicar os helpers aos cinco campos `reactions` e ao equivalente
`vote_result_reactions`, mantendo inalterados os gates atuais de membro,
participante, gestor, janela temporal e campos permitidos.

### 3.2 Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Quebrar toggle atômico | Testar add, troca e remoção via paths aninhados |
| Apagar reações alheias | Testar mapas com dois usuários e tentativa de remoção |
| Aceitar spoofing/shape inválido | Testar UID alheio, emoji desconhecido, escalar e UID duplicado |
| Divergir entre superfícies | Reusar o mesmo helper em todos os alvos equivalentes |

---

## 4. Verificação

- [x] Adicionar/trocar/remover a própria reação funciona.
- [x] Reações alheias não podem ser apagadas nem fabricadas.
- [x] Shapes inválidos e múltiplas reações do mesmo UID são negados.
- [x] Testes direcionados dos alvos passam (9/9 novos; 107/107 com suítes sociais).
- [x] Suíte completa de Firestore/Storage Rules passa (918/918).
- [x] `git diff --check` passa.

---

## 5. Prevenção Futura

Novos documentos que reutilizem o schema social embutido devem aplicar os
mesmos helpers de create/update e incluir testes de autoria interna do mapa;
validar somente o campo de topo não é suficiente.
