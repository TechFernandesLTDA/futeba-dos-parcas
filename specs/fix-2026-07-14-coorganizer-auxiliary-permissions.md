# BUGFIX: Permissões auxiliares do coorganizador

> **Status:** `VERIFIED`
> **Severidade:** `HIGH`
> **Autor:** Codex
> **Data:** 2026-07-14
> **Issue:** #3687

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

A tela de detalhes considera `co_organizers` gestores do jogo e habilita chat,
caronas e recados pós-jogo. As regras dessas coleções, porém, reconhecem apenas
admin global, dono ou jogador confirmado. Um coorganizador ainda não confirmado
recebe `permission-denied` ao usar os controles apresentados pela própria UI.

### 1.2 Comportamento Esperado (Correto)

Coorganizador autenticado pode ler e executar as ações próprias habilitadas pela
UI apenas no jogo em que consta em `co_organizers`. Outsiders e confirmações
`PENDING` continuam sem acesso; autoria, vínculo ao jogo e campos imutáveis
continuam protegidos.

### 1.3 Passos para Reproduzir

1. Criar um jogo com um usuário em `co_organizers`, sem confirmação `CONFIRMED`.
2. Entrar como esse coorganizador na tela de detalhes.
3. Abrir/enviar no chat, criar carona ou registrar recado após o jogo.
4. Observar `permission-denied` apesar de os controles estarem habilitados.

## 2. Análise de Causa Raiz

`GameDetailScreen` deriva `canManage` de owner, admin global ou
`coOrganizers.includes(uid)`. `firestore.rules` usa `isGameOwner` e
`isConfirmedPlayer` nos três recursos auxiliares, sem reutilizar
`canManageGame`, que já representa owner/coorganizador.

Arquivos afetados:

- `firestore.rules`
- `firestore-rules-tests/src/game-chat.test.ts`
- `firestore-rules-tests/src/game-rides.test.ts`
- `firestore-rules-tests/src/post-game-messages.test.ts`

## 3. Solução Aprovada

Adicionar um helper por ID que carrega o jogo e delega a `canManageGame`.
Aplicá-lo somente aos gates de chat, caronas e recados pós-jogo que correspondem
aos controles expostos pela UI. Preservar whitelists, identidade do autor,
document IDs, vínculo do jogo, timestamps, status e bloqueio de hard delete.

## 4. Verificação

- Testes do emulador positivos para leitura/query e escrita do coorganizador.
- Testes negativos para outsider/PENDING, autoria falsa, pivô de jogo/campos
  imutáveis e hard delete.
- Suítes direcionadas de chat, caronas e recados pós-jogo verdes.

Resultado: 56/56 testes direcionados e 958/958 testes da suíte completa de
Firestore/Storage aprovados no emulador.

## 5. Riscos e Mitigações

| Risco | Mitigação |
| --- | --- |
| Coorganizador acessar outro jogo | Regras consultam o jogo indicado pelo path/documento e testes negativos cobrem outsider |
| Falsificação de autoria | `sender_id`/`user_id` continuam iguais a `request.auth.uid` |
| Alteração de vínculo ou auditoria | Whitelists, `fieldUnchanged`, IDs determinísticos e hard delete permanecem intactos |
