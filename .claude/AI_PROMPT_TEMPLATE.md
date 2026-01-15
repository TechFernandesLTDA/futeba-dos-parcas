# AI PROMPT TEMPLATE - Padrão Ouro

> Template para pedir mudanças ao Claude/LLM com contexto completo.
> Última atualização: 2025-01-10

---

## ESTRUTURA DO PROMPT

```
┌─────────────────────────────────────────────────────────────┐
│  1. CONTEXTO DO PROJETO                                     │
│  ─────────────────────────────────────────────────────────  │
│  - Nome do app, tech stack                                  │
│  - Arquitetura MVVM + Clean                                 │
│  - Híbrido XML + Compose                                    │
├─────────────────────────────────────────────────────────────┤
│  2. OBJETIVO VERIFICÁVEL                                    │
│  ─────────────────────────────────────────────────────────  │
│  - O que quero (ação)                                       │
│  - Resultado esperado                                       │
├─────────────────────────────────────────────────────────────┤
│  3. RESTRIÇÕES                                              │
│  ─────────────────────────────────────────────────────────  │
│  - Seguir RULES.md                                          │
│  - Não reescrever tudo                                      │
│  - Mudança incremental                                      │
├─────────────────────────────────────────────────────────────┤
│  4. ARQUIVOS ÂNCORA                                         │
│  ─────────────────────────────────────────────────────────  │
│  - Arquivos específicos para ler/modificar                  │
├─────────────────────────────────────────────────────────────┤
│  5. CHECKLIST DE ACEITE                                    │
│  ─────────────────────────────────────────────────────────  │
│  - Critérios de sucesso                                     │
├─────────────────────────────────────────────────────────────┤
│  6. COMANDOS DE VALIDAÇÃO                                   │
│  ─────────────────────────────────────────────────────────  │
│  - Como verificar o resultado                               │
├─────────────────────────────────────────────────────────────┤
│  7. O QUE NÃO MUDAR                                        │
│  ─────────────────────────────────────────────────────────  │
│  - Exclusões e preservações                                │
└─────────────────────────────────────────────────────────────┘
```

---

## TEMPLATE COMPLETO

### PARTE 1: CONTEXTO (copiar e colar)

```
CONTEXTO DO PROJETO:
====================

Nome: Futeba dos Parças
Stack: Kotlin 2.0 + Jetpack Compose (híbrido com XML) + Firebase + Hilt
Arquitetura: MVVM + Clean Architecture

Estrutura:
- app/src/main/java/com/futebadosparcas/ui/        → UI Layer (Fragments + Screens)
- app/src/main/java/com/futebadosparcas/data/      → Data Layer (Repositories)
- shared/src/commonMain/kotlin/...domain/          → Domain Layer (KMP)

UI State: Usar StateFlow<UiState> com sealed classes
Navigation: nav_graph.xml (Android Navigation Component)
DI: Hilt com @HiltViewModel

Regras críticas:
- SEMPRE usar stringResource() para textos
- Job tracking obrigatório em ViewModels
- .catch {} em coleções de Flow
- collectAsStateWithLifecycle() no Compose
- NUNCA LazyVerticalGrid dentro de LazyColumn (usar FlowRow)

Documentação disponível em:
- .claude/RULES.md (regras completas)
- .claude/RULES_SHORT.md (referência rápida)
- .claude/PROJECT_MAP.md (mapa do projeto)
```

### PARTE 2: OBJETIVO (personalizar)

```
OBJETIVO:
=========

Quero: [descrição clara da ação]

Resultado esperado: [o que deve funcionar após a mudança]
```

### PARTE 3: RESTRIÇÕES (personalizar)

```
RESTRIÇÕES:
===========

OBRIGATÓRIO:
- Seguir RULES.md completamente
- Sem strings hardcoded
- Adicionar testes se lógica nova
- Preservar funcionalidade existente

MODO:
- Mudança incremental (não reescrever tudo)
- Usar padrões existentes
- Mantenha coexistência XML + Compose se aplicável
```

### PARTE 4: ARQUIVOS ÂNCORA (personalizar)

```
ARQUIVOS ENVOLVIDOS:
====================

Principal: [caminho/main/arquivo.kt]
Relacionados:
- [caminho/arquivo1.kt]
- [caminho/arquivo2.kt]
- [strings.xml] se novos textos
```

### PARTE 5: CHECKLIST (personalizar)

```
CHECKLIST DE ACEITE:
====================

Após concluir, verificar:
- [ ] Código compila: ./gradlew compileDebugKotlin
- [ ] Testes passam: ./gradlew test
- [ ] Lint aprova: ./gradlew lint
- [ ] Sem strings hardcoded
- [ ] Job tracking no ViewModel (se aplicável)
- [ ] .catch {} nos Flows (se aplicável)
- [ ] collectAsStateWithLifecycle() no Compose (se aplicável)
- [ ] Teste manual funcional: [descrever o que testar]
```

### PARTE 6: VALIDAÇÃO (personalizar)

```
COMO VALIDAR:
==============

1. Compilar: ./gradlew compileDebugKotlin
2. Rodar testes: ./gradlew test
3. Teste manual: [passos para testar manualmente]
4. Verificar: [o que inspecionar para confirmar]

Logs de erro esperados: [se houver, descrever]
```

### PARTE 7: O QUE NÃO MUDAR (personalizar)

```
O QUE NÃO MUDAR:
=================

NÃO modificar:
- [arquivo/componente a preservar]
- [outra coisa a não mexer]

Manter comportamento de:
- [funcionalidade existente]
```

---

## EXEMPLOS DE PROMPT

### Exemplo 1: Adicionar Nova Feature

```
CONTEXTO DO PROJETO:
[Usar PARTE 1 acima]

OBJETIVO:
=========
Quero: Adicionar um filtro de data na tela de Caixa (Cashbox)

Resultado esperado:
- Usuário pode filtrar entradas por período (hoje, semana, mês, custom)
- Filtro deve aparecer como dropdown ou chips na tela
- Lista atualiza conforme seleção

RESTRIÇÕES:
===========
OBRIGATÓRIO:
- Seguir RULES.md
- Usar Compose para UI (já existe CashboxScreen)
- Adicionar strings ao strings.xml
- Preservar funcionalidade existente

ARQUIVOS ENVOLVIDOS:
====================
Principal: app/src/main/java/com/futebadosparcas/ui/groups/CashboxScreen.kt
Relacionados:
- app/src/main/java/com/futebadosparcas/ui/groups/CashboxViewModel.kt
- app/src/main/java/com/futebadosparcas/domain/model/CashboxModels.kt
- app/src/main/res/values/strings.xml

CHECKLIST DE ACEITE:
====================
- [ ] Compila sem erros
- [ ] Testes passam
- [ ] Filtro aparece na tela
- [ ] Ao selecionar, lista atualiza
- [ ] Strings em strings.xml
- [ ] collectAsStateWithLifecycle usado

COMO VALIDAR:
==============
1. ./gradlew compileDebugKotlin test
2. Abrir tela de Caixa
3. Selecionar cada filtro
4. Verificar se lista atualiza corretamente

O QUE NÃO MUDAR:
=================
NÃO modificar:
- Estrutura do CashboxEntry model
- Integração com Firebase
```

### Exemplo 2: Corrigir Bug

```
CONTEXTO DO PROJETO:
[Usar PARTE 1 acima]

OBJETIVO:
=========
Quero: Corrigir crash ao confirmar presença em jogo

Resultado esperado:
- Confirmar presença funciona sem crash
- Estado atualiza corretamente
- Loading aparece durante operação

RESTRIÇÕES:
===========
- Mudança mínima para corrigir o bug
- Adicionar teste regression se possível

ARQUIVOS ENVOLVIDOS:
====================
Principal: app/src/main/java/com/futebadosparcas/ui/games/GameDetailViewModel.kt
Relacionados:
- app/src/main/java/com/futebadosparcas/data/repository/GameConfirmationRepositoryImpl.kt

CHECKLIST DE ACEITE:
====================
- [ ] Compila sem erros
- [ ] Testes passam (incluindo novo)
- [ ] Bug corrigido
- [ ] Sem regressão

COMO VALIDAR:
==============
1. ./gradlew compileDebugKotlin test
2. Abrir detail de um jogo
3. Clicar em "Confirmar Presença"
4. Verificar se confirma sem crash

O QUE NÃO MUDAR:
=================
NÃO modificar:
- UI do GameDetailScreen
- Outras operações de confirmação
```

### Exemplo 3: Migrar para Compose

```
CONTEXTO DO PROJETO:
[Usar PARTE 1 acima]

OBJETIVO:
=========
Quero: Migrar CreateFragment para Compose (CreateScreen)

Resultado esperado:
- CreateScreen em Compose funcionando
- Preservar todas as features do Fragment atual
- Manter wrapper CreateFragment hospedando a Screen

RESTRIÇÕES:
===========
- Mudança incremental: não quebrar navegação
- Seguir padrão Screen/Content separados
- Usar Material3 components
- Adicionar strings ao strings.xml

ARQUIVOS ENVOLVIDOS:
====================
Principal: app/src/main/java/com/futebadosparcas/ui/games/CreateGameFragment.kt
Novo: app/src/main/java/com/futebadosparcas/ui/games/CreateGameScreen.kt
Relacionados:
- app/src/main/java/com/futebadosparcas/ui/games/CreateGameViewModel.kt
- app/src/main/res/layout/fragment_create_game.xml (não modificar)

CHECKLIST DE ACEITE:
====================
- [ ] Compila sem erros
- [ ] CreateScreen funcional
- [ ] Todos os campos presentes
- [ ] Validações funcionando
- [ ] Navegação funcionando
- [ ] collectAsStateWithLifecycle usado
- [ ] key em LazyColumn items

COMO VALIDAR:
==============
1. ./gradlew compileDebugKotlin
2. Abrir tela de Criar Jogo
3. Preencher todos os campos
4. Verificar se cria o jogo
5. Comparar com versão XML (deve ser idêntico)

O QUE NÃO MUDAR:
=================
NÃO modificar ainda:
- fragment_create_game.xml (manter por segurança)
- Navegação (continuar usando nav_graph.xml)
```

---

## DICAS DE USO

### 1. Ser Específico

❌ RUIM:
```
Melhorar a tela de jogos
```

✅ BOM:
```
Quero: Adicionar filtro de status (abertos/confirmados) na tela de jogos
```

### 2. Dar Contexto Suficiente

❌ RUIM:
```
O ViewModel não está funcionando
```

✅ BOM:
```
GamesViewModel não está atualizando o estado quando repository.getGames() retorna erro.
O estado fica em Loading para sempre. Preciso tratar o caso de erro.
```

### 3. Definir Sucesso Claramente

❌ RUIM:
```
Fazer funcionar
```

✅ BOM:
```
Resultado esperado:
- Ao clicar no botão, diálogo abre
- Ao confirmar, repository chamado
- Estado atualiza para Success
```

### 4. Limitar Escopo

❌ RUIM:
```
Migrar tudo para Compose
```

✅ BOM:
```
Migrar apenas CreateGameScreen para Compose
Manter CreateGameFragment como wrapper
Não migrar outras telas neste PR
```

---

## PROMPTS RÁPIDOS (copy-paste)

### Para Correção Rápida

```
CONTEXT: Futeba dos Parças app, Kotlin + Compose + Hilt, MVVM architecture.
Files: .claude/RULES.md defines the coding standards.

ISSUE: [descrever o problema brevemente]

FILES INVOLVED:
- [caminho/arquivo.kt]

ACCEPTANCE:
- [ ] ./gradlew compileDebugKotlin passes
- [ ] ./gradlew test passes
- [ ] Issue resolved
- [ ] No strings hardcoded

DO NOT CHANGE:
- [preservar algo específico]
```

### Para Feature Nova

```
CONTEXT: Futeba dos Parças app, Kotlin + Compose + Hilt.
See .claude/PROJECT_MAP.md for project structure.

FEATURE REQUEST: [descriver a feature]

FILES TO MODIFY:
- [arquivos prováveis]

ACCEPTANCE CRITERIA:
- [ ] Feature works as described
- [ ] Follows RULES.md
- [ ] Tests added if applicable
- [ ] No strings hardcoded
- [ ] ./gradlew compileDebugKotlin test passes

HOW TO TEST:
[passos manuais de teste]
```

### Para Bugfix

```
CONTEXT: Futeba dos Parças app

BUG REPORT: [descrever o bug]
STEPS TO REPRODUCE:
1. [passo 1]
2. [passo 2]

EXPECTED: [o que deveria acontecer]
ACTUAL: [o que acontece]

FILES INVOLVED:
- [arquivos prováveis]

ACCEPTANCE:
- [ ] Bug fixed
- [ ] Regression test added
- [ ] ./gradlew test passes
```

---

## ANEXO: CHECKLIST RÁPIDO

Ao pedir mudança à IA, verificar se:

- [ ] Contexto do projeto fornecido
- [ ] Objetivo claro e verificável
- [ ] Arquivos âncora identificados
- [ ] Restrições explicitadas
- [ ] Critérios de aceite definidos
- [ ] Comandos de validação incluídos
- [ ] O que NÃO mudar especificado
