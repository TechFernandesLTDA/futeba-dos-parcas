# BUGFIX: Web trata o novo contrato da callable `deleteAccount` (#4391)

> **Status:** `APPROVED`
> **Severidade:** `HIGH`
> **Autor:** Claude (agente web-frontend-dev)
> **Data:** 2026-10-31
> **PR:** a abrir (depende do PR #4416, que cria a callable `deleteAccount`)
> **Spec do backend:** `specs/BUGFIX_4391_DELETE_ACCOUNT.md` (branch `fix/delete-account-4391`)

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

`SettingsScreen.handleDeleteAccountConfirm` chama `deleteAccount()` e, em qualquer
resultado, executa `logout()` no `finally`. Se a callable recusa a exclusão, o usuário
é deslogado sem que a conta tenha sido apagada, e vê só a mensagem genérica
"Operação temporariamente indisponível" (`failed-precondition`).

### 1.2 Comportamento Esperado (Correto)

Contrato de erro da callable (HttpsError):

| Código | `details` | Comportamento na web |
|---|---|---|
| `failed-precondition` | `reason: 'requires-recent-login'` | Pede reautenticação (senha ou Google) e repete a chamada uma vez, automaticamente |
| `failed-precondition` | `reason: 'sole-owner-groups'`, `groups: [{id, name}]` | Lista os grupos com link para cada um e orienta transferir a posse ou remover os membros. **Sem logout** |
| `resource-exhausted` | - | Mensagem de limite (3 por hora). **Sem logout** |
| outros | - | Mensagem de erro. **Sem logout** |
| sucesso `{ success: true }` | - | Logout local, toast de sucesso, navega para `/login` |

### 1.3 Passos para Reproduzir

1. Entrar com uma conta cujo login tem mais de 10 minutos
2. Configurações, Excluir conta, confirmar o e-mail
3. Observar: erro genérico e logout, com a conta ainda existente

---

## 2. Análise de Causa Raiz

O `finally` da tela faz logout incondicional (escrito quando a callable não tinha
precondições) e não há leitura de `error.details`.

### 2.3 Arquivos Afetados

| Arquivo | Motivo |
|---|---|
| `web/src/pages/settings/SettingsScreen.tsx` | Passa a usar o hook e renderizar os diálogos novos |
| `web/src/hooks/useDeleteAccount.ts` (novo) | Máquina de estados do fluxo, reautenticação e retry |
| `web/src/utils/deleteAccountErrors.ts` (novo) | Classifica o erro da callable (`details.reason`) |
| `web/src/components/settings/DeleteAccountReauthDialog.tsx` (novo) | Diálogo de senha / botão Google |
| `web/src/components/settings/DeleteAccountBlockedGroupsDialog.tsx` (novo) | Lista de grupos bloqueantes com links |
| `web/src/i18n/locales/{pt-BR,en,es}.json` | Strings novas, com plural |
| `web/src/services/cloudFunctions.ts` | Sem mudança de contrato; só comentário do contrato de erro |
| Testes | `useDeleteAccount.test.ts`, `deleteAccountErrors.test.ts`, ajuste de `profileSavePayloads.test.ts` |

---

## 3. Solução Proposta

### 3.1 Abordagem

Hook `useDeleteAccount` com estados `idle | deleting | needs-reauth | reauthenticating | blocked-groups | error`.

- `requires-recent-login`: abre o diálogo de reautenticação. Provedor `password`:
  `EmailAuthProvider.credential` + `reauthenticateWithCredential`. Provedor `google.com`:
  `reauthenticateWithPopup(user, googleProvider)`. Depois da reautenticação força
  `getIdToken(true)` (o `auth_time` do token só é atualizado assim) e repete a
  `deleteAccount()` **uma única vez**; se o servidor pedir login recente de novo, mostra erro.
- `sole-owner-groups`: diálogo com a lista (`/group/:id`), sem logout.
- Demais erros: toast de erro, sem logout.
- Sucesso: `logout()` (falha local não mascara o sucesso; limpa o cache) + toast + `navigate('/login')`.

### 3.2 Alternativas Descartadas

| Alternativa | Por que não |
|---|---|
| Colocar reautenticação no `AuthContext` | Contexto já é grande; a reautenticação só serve a este fluxo |
| Deslogar e pedir novo login | Perde o contexto do usuário e dispara o limite de 3 por hora à toa |

### 3.3 Riscos

| Risco | Mitigação |
|---|---|
| Popup do Google bloqueado | Erro mostrado no diálogo, sem logout; usuário tenta de novo |
| Usuário só com telefone (sem senha/Google) | Mensagem pedindo sair e entrar de novo, sem logout automático |

---

## 4. Plano de Testes (Vitest, `httpsCallable` mockado)

1. Sucesso: logout, toast, navegação para `/login`
2. `requires-recent-login` com senha: reautentica, renova o token, repete e conclui
3. `sole-owner-groups`: estado `blocked-groups` com a lista, **sem** logout
4. Outros erros (`resource-exhausted`, `internal`): erro, **sem** logout
5. Classificador de erro (unitário)

## 5. Checklist de Verificação

- [ ] `npm run lint`, `npm run test -- --run` e `npm run build` verdes
- [ ] Estados loading/erro/sucesso presentes; hooks antes de qualquer `return`
- [ ] Strings em pt-BR, en e es; plural na contagem de grupos
- [ ] Sem cor hardcoded
