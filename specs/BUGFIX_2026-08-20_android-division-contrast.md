# BUGFIX: Tokens de divisao e contraste Android

> **Status:** `APPROVED`
> **Severidade:** `HIGH`
> **Autor:** OpenCode
> **Data:** 2026-08-20
> **PR:** a criar
> **Issues:** #4063, #4064, #4065

---

## 1. Descricao do Bug

### 1.1 Comportamento Atual (Errado)

- O badge da divisao na Liga usa a cor de identidade como texto e falha WCAG AA no tema claro.
- Liga, Ranking e estatisticas usam tabelas divergentes para as mesmas divisoes.
- O enum Android duplica o enum KMP e mantem `colorHex` sem uso consistente.
- O contador de cartoes reduz `labelSmall` para 8.8sp e o token RedCard nao oferece candidato de texto com contraste AA.
- Os testes do `ContrastHelper` nao cobrem todos os fundos reais, incluindo `MatchEventColors`.

### 1.2 Comportamento Esperado (Correto)

- Uma tabela de tokens de identidade e uma funcao de foreground theme-aware servem todos os componentes Android.
- O texto sobre veus de divisao passa contraste minimo de 4.5:1 em light e dark.
- O enum de dominio KMP permanece compativel e nao ha enum Android concorrente para a mesma divisao.
- Os contadores usam pelo menos `labelSmall` e todos os fundos reais testados atendem AA.

### 1.3 Criterios de Aceite

1. `divisionColor` e `divisionTextColor` sao a unica fonte de cores de divisao na UI Android.
2. Cada divisao passa contraste parametrizado em ambos os temas sobre o fundo composto pelo veu usado nas telas.
3. `LeagueScreen`, `RankingList`, `PlayerEvolutionCard` e demais consumidores nao mantem tabelas inline de divisao.
4. `ContrastHelperTest` cobre fundos reais de times, cartoes e divisoes e verifica a escolha do melhor candidato e AA.
5. O projeto compila sem alterar o contrato do modulo `shared`.

---

## 2. Analise de Causa Raiz

As cores de divisao foram declaradas no enum KMP, no modelo Android e em tres locais de UI. Algumas telas usavam variantes escuras para texto e outras usavam tokens claros de identidade. O helper de contraste escolhe o melhor candidato, mas nao pode garantir AA quando ambos falham; o token RedCard era um desses casos. O tamanho tipografico foi reduzido abaixo do menor papel Material 3.

Arquivos principais: `Color.kt`, `ContrastHelper.kt`, `LeagueScreen.kt`, `RankingList.kt`, `PlayerEvolutionCard.kt`, `LiveStatsScreen.kt`, os modelos de liga Android/KMP e seus testes.

---

## 3. Solucao Tecnica

1. Manter o enum de dominio em `shared` como contrato KMP e remover a copia do modelo Android, ajustando imports/conversoes somente onde necessario.
2. Criar tokens/funcoes em `ui/theme/DivisionColors.kt`, com identidade fixa e foreground selecionado por tema. Nenhum hex novo sera espalhado nos consumidores.
3. Aplicar o foreground ao badge da Liga, Ranking e cards de evolucao.
4. Escurecer `MatchEventColors.RedCard` para um token que passe AA com branco e remover a reducao `* 0.8f` dos dois contadores.
5. Ampliar testes parametrizados de contraste, paridade dos quatro enums e ausencia de tabela concorrente na UI.

### Riscos e Mitigacoes

| Risco | Mitigacao |
|------|-----------|
| Quebra de mapeamento Firestore/KMP | Compilar modulo Android e testar conversores |
| Mudanca visual de prata/diamante | Teste de identidade dos tokens e revisao dos consumidores |
| Novo fundo sem AA | Lista parametrizada de todos os call sites conhecidos |

---

## 4. Verificacao

- [ ] `./gradlew :app:compileDebugKotlin`
- [ ] `./gradlew :app:testDebugUnitTest`
- [ ] `./gradlew lint`
- [ ] `./gradlew detekt`
- [ ] Revisao de diff e busca por fontes concorrentes de cor

---

## Historico

| Data | Autor | Alteracao |
|------|-------|-----------|
| 2026-08-20 | OpenCode | Spec aprovada para implementacao das issues #4063-#4065 |
