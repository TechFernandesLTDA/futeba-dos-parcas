# BUGFIX: Permitir convite por administradores ativos do grupo

> **Status:** `APPROVED`
> **Severidade:** `MEDIUM`
> **Autor:** Codex
> **Data:** 2026-07-13
> **Issue:** #3613
> **PR:** Pendente

---

## 1. Requisitos

### 1.1 Comportamento atual

O checklist de primeiros passos permite que `OWNER` ou `ADMIN` abra o diálogo de convite, mas o botão permanente e a ação do empty state na aba Membros são restritos a `isOwner`. Depois que o checklist deixa de aparecer, um administrador ativo perde o acesso ao convite.

### 1.2 Comportamento esperado

- Dono do grupo e membro ativo com papel `OWNER` ou `ADMIN` podem abrir o diálogo e gerar o código de convite.
- Membros comuns e administradores inativos/bloqueados/removidos não recebem ações de convite.
- Checklist, botão, empty state, diálogo e geração do convite usam um único predicado de autoridade.
- A regra Firestore continua sendo a autoridade final para a criação em `invites/{code}`.

### 1.3 Critérios de aceite

1. ADMIN ativo vê o botão **Convidar** na aba Membros mesmo sem checklist.
2. ADMIN ativo recebe a ação de convite quando a lista de membros está vazia.
3. MEMBER e ADMIN não ativo não recebem essas ações.
4. O diálogo não abre nem gera convite quando o usuário não tem autoridade.
5. OWNER continua com o comportamento atual.
6. Testes Web cobrem papéis e estados; Rules prova ADMIN ativo permitido e ADMIN inativo negado.

---

## 2. UX/UI

- Preservar o botão, diálogo, textos traduzidos, responsividade e feedback existentes.
- Não adicionar uma segunda experiência de convite: todas as entradas convergem para o mesmo diálogo.
- Loading permanece representado por `CircularProgress`; erros de escrita continuam passando pelo toast existente.
- Retirar a ação por completo para usuários sem autoridade, evitando uma operação previsivelmente negada.

---

## 3. Design técnico

### 3.1 Invariante

O convite pertence à administração do grupo: owner canônico ou membro ativo com papel `OWNER`/`ADMIN`. A UI espelha essa regra, enquanto `firestore.rules` valida membership, papel, status, remetente e formato do documento.

### 3.2 Abordagem

- Criar um predicado puro e tipado para a autoridade de convite.
- Calcular `canInviteMembers` uma vez em `GroupDetailScreen`.
- Reutilizar o predicado no checklist, botão, empty state, diálogo e handler de geração.
- Não modificar a regra Firestore, que já exige `OWNER`/`ADMIN` e `ACTIVE`.
- Completar a cobertura de Rules para o papel ADMIN, ausente na suíte atual.

### 3.3 Arquivos afetados

| Arquivo | Alteração |
|---|---|
| `web/src/pages/group/GroupDetailScreen.tsx` | Gate único em todas as entradas do convite |
| `web/src/pages/group/GroupDetailScreen.inviteGate.test.tsx` | Regressão do botão para ADMIN, MEMBER e status inativo |
| `web/src/pages/group/groupInvitePermissions.ts` | Predicado de autoridade |
| `web/src/pages/group/groupInvitePermissions.test.ts` | Matriz de papel/status |
| `firestore-rules-tests/src/invites.test.ts` | ADMIN ativo permitido; inativo negado |

### 3.4 Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Expor convite a membro comum | Predicado exige papel gerencial e teste negativo |
| UI divergir das Rules | Teste de regras exercita os mesmos estados de ADMIN |
| Papel ser revogado com diálogo aberto | `open` e handler de geração revalidam `canInviteMembers` |

Não há nova decisão arquitetural; a mudança alinha entradas de UI com a regra de autorização já adotada.

---

## 4. Tarefas

- [x] REQUIREMENTS: descrever fluxo quebrado e autoridade esperada.
- [x] UX/UI: definir entradas, estados e comportamento sem permissão.
- [x] TECHNICAL DESIGN: predicado único e validação Rules.
- [x] TASKS: listar implementação e gates.
- [x] IMPLEMENTATION: alterar UI e adicionar testes.
- [x] VERIFY: executar testes, build, lint e diff-check.

---

## 5. Release

Correção visível da Web para incluir nas notas da próxima release consolidada. Sem bump, changelog, bundle, tag ou deploy isolado nesta frente.

---

## Histórico

| Data | Autor | Alteração |
|---|---|---|
| 2026-07-13 | Codex | Spec criada e aprovada para #3613 |
| 2026-07-13 | Codex | Gate unificado; testes Web e Rules, build e lint validados |
