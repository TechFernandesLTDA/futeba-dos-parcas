# BUGFIX: barra inferior do iOS empilha telas em vez de trocar de aba (#4425)

> **Status:** `APPROVED` (trabalho autorizado pelo dono em 01/11/2026; iOS só recebe correção de bugs)
> **Severidade:** `MEDIUM`
> **Autor:** Claude Code
> **Data:** 2026-11-01
> **PR:** a definir

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

Cada toque na barra inferior do Início, nos atalhos do Início, no FAB de Jogos e nas ações
dos hubs de Grupos fazia `navigate` simples. As abas se empilhavam (Início, Grupos, Jogos,
Grupos, Jogos...) e o gesto de voltar percorria tudo. Depois do login, o welcome e o
onboarding ficavam embaixo do Início. Sair do setup de perfil empilhava um segundo Início.

### 1.2 Comportamento Esperado (Correto)

Início, Jogos, Grupos e Perfil se comportam como abas: trocar de aba não empilha, e voltar
de uma aba leva ao Início. Voltar no Início não reabre welcome/login.

### 1.3 Passos para Reproduzir

1. Início, aba Grupos, ação "Jogos da rodada", FAB "+" (vai para Grupos).
2. Voltar: abria Jogos, depois Grupos, depois Início.

---

## 2. Análise de Causa Raiz

### 2.2 Causa Raiz

`App.kt` navegava para as rotas de aba sem `popUpTo`, `launchSingleTop`, `saveState` e
`restoreState`. O login fazia `popUpTo(LOGIN)`, que deixa o `WELCOME` na pilha.
`PROFILE_SETUP` navegava para `HOME` em vez de voltar à tela de origem.

### 2.3 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `composeApp/.../compose/App.kt` | Navegação das abas, do login e do setup de perfil |

---

## 3. Solução

### 3.1 Abordagem

- `navigateToTopLevel(route)`: `popUpTo(HOME) { saveState = true }`, `launchSingleTop`,
  `restoreState`. Usado em toda ida a Jogos/Grupos/Perfil (barra, atalhos, FAB, hubs).
  O alvo do `popUpTo` é `HOME`, não `graph.findStartDestination()`, porque o destino
  inicial é `WELCOME` quando não há sessão.
- `navigateToHomeClearingBackStack()` no sucesso do login: `popUpTo(graph.id) { inclusive = true }`.
- `leaveProfileSetup()`: volta para a tela de origem; sem origem (logo após o cadastro),
  entra no Início limpando a pilha.
- Fora do escopo (recurso novo): barra persistente nas outras abas.

---

## 4. Verificação

- Compilação iOS e Android do `composeApp` passa.
- Simulador, com `startDestination = HOME` temporário (não commitado): Início, Grupos,
  "Jogos da rodada", FAB "+" e Voltar levam direto ao Início, sem passar por Jogos/Grupos.
