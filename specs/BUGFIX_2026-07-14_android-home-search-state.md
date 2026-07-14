# BUGFIX: Estados reais de carregamento, atualização e busca no Android

> **Status:** `VERIFIED`
> **Severidade:** `MEDIUM`
> **Autor:** Codex
> **Data:** 2026-07-14
> **Issues:** #3619, #3622, #3627

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

- A Home coleta o progresso granular emitido pelo ViewModel, mas renderiza apenas
  shimmers genéricos.
- A Home declara um estado local de refresh que nunca é usado e não oferece o
  gesto Material 3 de puxar para atualizar.
- A busca global possui ViewModel e persistência DataStore, porém a tela usa um
  estado paralelo com histórico e sugestões fictícias iguais para todos.

### 1.2 Comportamento Esperado (Correto)

- O loading inicial combina skeleton com mensagem e progresso reais.
- O conteúdo carregado aceita pull-to-refresh, preserva os dados durante a
  atualização e encerra o indicador tanto em sucesso quanto em falha.
- A busca consome o ViewModel canônico, apresenta somente o histórico persistido
  do usuário atual e não inventa sugestões populares sem fonte real.

### 1.3 Passos para Reproduzir

1. Abrir a Home em uma conexão lenta e observar que as fases emitidas não aparecem.
2. Com a Home carregada, puxar a lista para baixo e observar que nada acontece.
3. Abrir a busca global e observar termos fictícios antes de executar qualquer busca.

### 1.4 Contexto

| Item | Valor |
|------|-------|
| Versão do app | Android 1.37.0 |
| Dispositivo | Phones e tablets suportados |
| Android version | 7.0+ (API 24+) |
| Frequência | Sempre |
| Impacto em usuários | Todos que acessam Home ou busca global |

---

## 2. Análise de Causa Raiz

### 2.1 Investigação

`HomeScreen` descartava `loadingState` e mantinha `isRefreshing` sem conexão com
o ViewModel. `GlobalSearchScreen` duplicava query, filtro e estado de resultados,
sem coletar `GlobalSearchViewModel.recentSearches`.

### 2.2 Causa Raiz

As UIs foram criadas antes das respectivas infraestruturas de estado e não foram
integradas quando progresso, refresh e DataStore foram adicionados.

### 2.3 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `ui/home/HomeScreen.kt` | Render de progresso e `PullToRefreshBox` |
| `ui/home/HomeViewModel.kt` | Estado de refresh preservando conteúdo |
| `ui/search/GlobalSearchScreen.kt` | Remoção dos mocks e integração com ViewModel |
| `ui/search/GlobalSearchViewModel.kt` | Histórico DataStore isolado por usuário |
| `res/values*/strings.xml` | Estado vazio localizado |
| `app/src/test/...` | Regressão do refresh e histórico real |

---

## 3. Solução Aprovada

### 3.1 Abordagem

1. Passar `LoadingState` para o conteúdo de loading e exibir barra determinada
   quando houver `LoadingProgress`.
2. Expor `isRefreshing` no HomeViewModel e adicionar `refreshHomeData()`, usando
   o mesmo pipeline de três fases sem trocar o conteúdo atual por full-screen loading.
3. Tornar `GlobalSearchViewModel` a única fonte de query, filtro, resultados e
   histórico da tela.
4. Namespear a preferência pelo UID. Sem usuário autenticado, não carregar nem
   salvar histórico.
5. Remover a seção de buscas populares até existir fonte confiável; mostrar um
   estado vazio localizado quando ainda não houver histórico.

### 3.2 Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Refresh falhar e apagar conteúdo útil | Restaurar o último `Success` e encerrar indicador em `finally` |
| Histórico vazar entre contas | Chave DataStore derivada do UID autenticado |
| Estado da tela divergir do ViewModel | Remover estado local duplicado e mapear apenas modelos de apresentação |
| Regressão de compilação Compose | Testes focados e `:app:compileDebugKotlin` |

---

## 4. Verificação

- [x] Teste unitário: refresh preserva conteúdo e encerra indicador.
- [x] Teste unitário: histórico é carregado/salvo/limpo na chave do usuário.
- [x] Teste de regressão HomeViewModel (11 casos; 0 falhas).
- [x] `./gradlew :app:compileDebugKotlin`.
- [x] `./gradlew detekt` e `./gradlew :app:lintDebug`.
- [x] Diff-check sem mocks ou strings fictícias remanescentes.

---

## 5. Mobile Definition of Done

- [x] Layout usa componentes adaptativos existentes para phone/tablet.
- [x] Pull-to-refresh usa Material 3 e mantém alvos existentes de 48dp.
- [x] Estados loading, empty, error e success estão definidos.
- [x] Histórico é local/offline e falhas de persistência têm fallback vazio.
- [x] Não há nova coleta ou recomposição desnecessária.

---

## Histórico

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-07-14 | Codex | Spec aprovada antes da implementação |
| 2026-07-14 | Codex | Implementação, testes e análise estática verificados |
