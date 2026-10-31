# BUGFIX: Exclusão de conta no Android ignora reautenticação e grupos sem dono (#4391)

> **Status:** `APPROVED` (épico #4398 aprovado pelo dono)
> **Severidade:** `HIGH`
> **Autor:** Claude Code
> **Data:** 2026-10-31
> **PR:** Refs #4391 (callable em #4416, web em #4419)

---

## 1. Descrição do Bug

### 1.1 Comportamento atual (errado)
`AuthRepository.deleteAccount()` chama a callable `deleteAccount` e devolve um `Result.failure` genérico. Quando o servidor bloqueia a exclusão, o diálogo fica em "excluindo" sem feedback.

### 1.2 Comportamento esperado
Contrato de erro da callable (`FAILED_PRECONDITION` + `details.reason`):

| `reason` | Significado | UX no Android |
|---|---|---|
| `requires-recent-login` | Login com mais de 10 min | Diálogo de reautenticação (Google e/ou senha, conforme os provedores da conta) e nova tentativa automática |
| `sole-owner-groups` (`details.groups` = `[{id, name}]`) | Dono de grupo com outros membros ativos | Diálogo listando os grupos e orientando a transferir a posse ou remover os membros |
| qualquer outro | Falha genérica | Mensagem de erro no diálogo de confirmação, com nova tentativa possível |

## 2. Solução

- `AuthRepository`: `DeleteAccountError` (sealed: `RequiresRecentLogin`, `SoleOwnerGroups`, `Generic`) e `mapDeleteAccountError`; `reauthenticateWithGoogle/Password` (renovam o ID token para atualizar `auth_time`) e `getReauthProviders`.
- `DeleteAccountViewModel` (Koin) com `DeleteAccountUiState`; substitui o `LaunchedEffect` do `AppNavGraph`.
- `DeleteAccountDialogs.kt`: diálogos de reauth e de grupos bloqueantes (cores do MaterialTheme, alvos de toque >= 48dp, textos em `strings.xml` pt-BR/en/es).

### Arquivos afetados

| Arquivo | Motivo |
|---|---|
| `data/repository/AuthRepository.kt` | Erro tipado e reautenticação |
| `ui/about/DeleteAccountViewModel.kt` (novo) | Estado e orquestração |
| `ui/about/DeleteAccountDialogs.kt` (novo) | Diálogos |
| `ui/about/AboutScreen.kt`, `ui/navigation/AppNavGraph.kt`, `di/koin/ViewModelKoinModule.kt` | Integração |
| `res/values*/strings.xml` | Textos |

## 3. Mobile DoD

- [x] Estados: loading (barra de progresso), erro (mensagem), sucesso (vai ao login)
- [x] Acessibilidade: ícones decorativos com `contentDescription = null`, botões >= 48dp
- [x] Offline/erros: falha genérica permite repetir
- [ ] Teste manual em dispositivo (login Google e senha) pendente

## 4. Testes

`DeleteAccountViewModelTest` (MockK, 11 casos): mapeamento dos três erros e o ViewModel (sucesso, reauth + repetição, falha de reauth, bloqueio por grupos, erro genérico).
