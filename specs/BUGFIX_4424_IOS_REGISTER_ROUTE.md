# BUGFIX: "Criar conta" no Login do iOS abre o perfil, não o cadastro (#4424)

> **Status:** `APPROVED` (trabalho autorizado pelo dono em 01/11/2026; iOS só recebe correção de bugs)
> **Severidade:** `HIGH`
> **Autor:** Claude Code
> **Data:** 2026-11-01
> **PR:** a definir

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

No Login do iOS, "Não tem uma conta? Cadastre-se" abre o setup de perfil
(`PROFILE_SETUP`). Quem não tem conta não consegue se cadastrar por e-mail.

### 1.2 Comportamento Esperado (Correto)

O link abre o cadastro (`RegisterScreen`). Depois de criar a conta, o usuário segue para
o setup de perfil e não volta para cadastro/login com o gesto de voltar.

### 1.3 Passos para Reproduzir

1. Abrir o app sem sessão: Welcome, Começar, Continuar.
2. No Login, tocar em "Cadastre-se".
3. Observar que abre o setup de perfil.

---

## 2. Análise de Causa Raiz

### 2.2 Causa Raiz

`App.kt` ligava `onNavigateToRegister` a `AppRoutes.PROFILE_SETUP`. A tela
`ui/auth/RegisterScreen.kt` e o `RegisterViewModel` existiam, mas não havia rota nem
binding Koin para eles.

### 2.3 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `composeApp/.../compose/navigation/AppRoutes.kt` | Nova rota `REGISTER` |
| `composeApp/.../compose/di/ComposeAppModule.kt` | `viewModel { RegisterViewModel(get()) }` |
| `composeApp/.../compose/App.kt` | `composable(REGISTER)` e navegação do Login |
| `composeApp/.../composeResources/values/strings.xml` | Mensagem do estado indisponível |

---

## 3. Solução

### 3.1 Abordagem

- "Cadastre-se" navega para `REGISTER` (`launchSingleTop`).
- A rota segue o padrão das rotas que dependem do Firebase (`DELETE_ACCOUNT`,
  `THEME_SETTINGS`): `koinViewModelOrNull`; sem `AuthRepository` (modo smoke-test) mostra
  `UnavailableRouteScreen` com "Tentar novamente".
- "Já tenho conta" faz `popBackStack()` para o Login.
- Sucesso: `PROFILE_SETUP` limpando a pilha (`popUpTo(graph.id) { inclusive = true }`).
  O documento do usuário é criado pela Cloud Function `onUserCreated`, como no Android.

### 3.3 Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Mensagem de erro do Firebase em inglês | Mesmo comportamento do `LoginViewModel`; fora do escopo deste bug |

---

## 4. Verificação

- Compilação iOS e Android do `composeApp` passa.
- Simulador (sem `GoogleService-Info.plist`, modo smoke-test): Login, "Cadastre-se" abre a
  rota "Criar Conta" (estado indisponível, porque não há Firebase); "Voltar" retorna ao Login.
- Não foi enviado cadastro real: criar conta no Firebase de produção está fora do que foi
  autorizado. O fluxo com Firebase precisa ser conferido num build com a configuração.
