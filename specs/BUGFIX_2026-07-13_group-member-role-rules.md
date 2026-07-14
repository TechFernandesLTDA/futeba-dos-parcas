# BUGFIX: Regras de papéis e transferência de propriedade de grupos

> **Status:** `APPROVED`
> **Severidade:** `CRITICAL`
> **Autor:** Codex
> **Data:** 2026-07-13
> **Issues:** #3589, #3592, #3601
> **PR:** pendente

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

A regra de update de `groups/{groupId}/members/{memberId}` consulta o papel
anterior do membro na condição destinada ao OWNER. Com isso, o OWNER não
consegue promover `MEMBER -> ADMIN`, rebaixar `ADMIN -> MEMBER` nem executar a
transferência de propriedade já atômica nos clientes. Separadamente, o ADMIN
não-owner não consegue marcar um MEMBER comum como `REMOVED`, embora esse seja
o soft-delete canônico usado pelo repositório Android e pelo web.

### 1.2 Comportamento Esperado (Correto)

- somente o OWNER atual pode promover ou rebaixar papéis;
- uma troca comum de papel só transita entre `MEMBER` e `ADMIN`;
- promover alguém a `OWNER` exige, no mesmo batch/transação, atualizar
  `groups/{groupId}.owner_id`, promover o novo dono e rebaixar o dono antigo;
- não pode existir segundo OWNER, demissão isolada do OWNER atual nem
  autoelevação;
- ADMIN global autenticado não pode pivotar `owner_id` isoladamente pelo
  cliente; recovery excepcional permanece disponível via Admin SDK;
- ADMIN não-owner pode remover (`status = REMOVED`) MEMBER comum, mas não pode
  remover OWNER nem outro ADMIN.

### 1.3 Passos para Reproduzir

1. Autenticar como OWNER de um grupo ativo.
2. Atualizar o papel de outro membro de `MEMBER` para `ADMIN`.
3. Observar `PERMISSION_DENIED`.
4. Autenticar como ADMIN não-owner e marcar um MEMBER como `REMOVED`.
5. Observar `PERMISSION_DENIED`.

### 1.4 Contexto

| Item | Valor |
|------|-------|
| Plataforma | Firestore Rules; clientes Web e Android |
| Frequência | Sempre |
| Impacto | Gestão básica de grupos bloqueada |

---

## 2. Análise de Causa Raiz

### 2.1 Investigação

Os clientes já usam batch/transação para sincronizar a transferência entre o
documento do grupo, os dois documentos canônicos de membership e as referências
denormalizadas em `users/{uid}/groups/{groupId}`. A regra, porém, condiciona a
mudança de papel a `resource.data.role == 'OWNER'`, bloqueando membros comuns.
O ramo de moderação por ADMIN aceita apenas `ACTIVE`, `INACTIVE` e `BANNED` e
também não distingue MEMBER de outro ADMIN.

### 2.2 Causa Raiz

A regra não modela explicitamente as transições válidas de papel nem vincula as
transições que envolvem `OWNER` ao `owner_id` pós-escrita com `getAfter()`.
Além disso, o enum de status do soft-delete ficou incompleto.

### 2.3 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `firestore.rules` | Autorização e coerência atômica de ownership |
| `firestore-rules-tests/src/groups.test.ts` | Cobertura positiva e negativa das transições |
| `specs/DECISIONS.md` | Registro da política de ownership e moderação |

---

## 3. Solução Aprovada

### 3.1 Abordagem

1. Restringir o ramo de moderação do ADMIN não-owner a alvos `MEMBER`, incluindo
   `REMOVED` no conjunto de status permitido.
2. Permitir ao OWNER atual transições comuns apenas entre `MEMBER` e `ADMIN`.
3. Permitir transições de/para `OWNER` somente quando `getAfter()` comprovar que
   o `owner_id` pós-escrita aponta para o único membership `OWNER`, enquanto o
   membership do antigo dono deixa de ser `OWNER` no mesmo commit.
4. Reforçar a própria mudança de `groups.owner_id` com os dois documentos de
   membership pós-escrita.
5. Manter a moderação de metadados pelo ADMIN global, mas impedir que esse
   bypass altere `owner_id` diretamente no cliente.

### 3.2 Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Afrouxar papel e criar segundo OWNER | Testes negativos para promoção isolada, autoelevação e segundo OWNER |
| Transferência parcial | `getAfter()` no grupo e nos dois memberships; teste de batch completo e batches incompletos |
| ADMIN remover autoridade equivalente | Ramo de ADMIN restrito a alvo com papel anterior `MEMBER` |
| Regressão de promoção/rebaixamento | Testes positivos para `MEMBER -> ADMIN -> MEMBER` pelo OWNER |

---

## 4. Verificação Planejada

- [x] OWNER promove MEMBER para ADMIN.
- [x] OWNER rebaixa ADMIN para MEMBER.
- [x] transferência atômica troca `owner_id`, promove novo OWNER e rebaixa antigo.
- [x] troca isolada de `owner_id` falha.
- [x] ADMIN global não pivota `owner_id` isoladamente pelo cliente.
- [x] segundo OWNER, autoelevação e demissão isolada do OWNER falham.
- [x] ADMIN não-owner remove MEMBER comum.
- [x] ADMIN não-owner não remove OWNER nem ADMIN.
- [x] suíte direcionada `groups.test.ts` passa: 66/66.
- [x] suíte completa de Firestore Rules passa: 54 arquivos, 922/922 testes.
- [x] `git diff --check` passa.

---

## 5. Release

É uma correção user-visible de autorização compartilhada por Web e Android e
exige deploy de Firestore Rules. A versão e as release notes serão consolidadas
pela release final; este subtrabalho não faz bump, deploy, tag nem release.

---

## Histórico

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-07-13 | Codex | Spec criada, analisada e aprovada antes da implementação |
| 2026-07-13 | Codex | Implementação verificada nas suítes direcionada e completa |
