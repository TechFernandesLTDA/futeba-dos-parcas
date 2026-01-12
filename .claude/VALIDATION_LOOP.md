# VALIDATION LOOP - Futeba dos Parças

> Pipeline de validação: local → CI → humano → merge.
> Última atualização: 2025-01-10

---

## 1. PIPELINE DE VALIDAÇÃO

```
┌─────────────────────────────────────────────────────────────────┐
│                      1. DESENVOLVIMENTO                         │
│  IA/Humano escreve código → commit local                       │
└─────────────────────────────┬───────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      2. VALIDAÇÃO LOCAL                         │
│  ./gradlew compileDebugKotlin test lint                        │
└─────────────────────────────┬───────────────────────────────────┘
                              ↓ (passou?)
┌─────────────────────────────────────────────────────────────────┐
│                      3. PUSH & PR                               │
│  git push → criar/ atualizar PR                                 │
└─────────────────────────────┬───────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      4. CI AUTOMÁTICO                           │
│  build + test + lint + security checks                         │
└─────────────────────────────┬───────────────────────────────────┘
                              ↓ (passou?)
┌─────────────────────────────────────────────────────────────────┐
│                      5. CODE REVIEW                            │
│  Humano revisa → aprova ou pede changes                        │
└─────────────────────────────┬───────────────────────────────────┘
                              ↓ (aprovado?)
┌─────────────────────────────────────────────────────────────────┐
│                      6. MERGE                                  │
│  Squash merge → main → branch deletado                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. VALIDAÇÃO LOCAL (ANTES DE PUSH)

### 2.1 Comandos Obrigatórios

```bash
# 1. Compilar (verifica erros Kotlin)
./gradlew compileDebugKotlin

# 2. Rodar testes unitários
./gradlew test

# 3. Lint (verifica qualidade)
./gradwarz lint
```

### 2.2 Script Completo

```bash
#!/bin/bash
# validate-local.sh

echo "🔨 Validando código localmente..."

echo "1️⃣ Compilando..."
./gradlew compileDebugKotlin
if [ $? -ne 0 ]; then
    echo "❌ Falha na compilação"
    exit 1
fi

echo "2️⃣ Rodando testes..."
./gradlew test
if [ $? -ne 0 ]; then
    echo "❌ Falha nos testes"
    exit 1
fi

echo "3️⃣ Rodando lint..."
./gradlew lint
if [ $? -ne 0 ]; then
    echo "❌ Falha no lint"
    exit 1
fi

echo "✅ Validação local completa!"
echo "📦 Pode fazer push e criar PR."
```

**Uso:**
```bash
chmod +x validate-local.sh
./validate-local.sh
```

### 2.3 Validação Rápida (Draft PR)

```bash
# Versão rápida para desenvolvimento
./gradlew compileDebugKotlin test
```

---

## 3. DEFINITION OF DONE

### 3.1 Para Uma Mudança

**Automation:**
- ✅ `./gradlew compileDebugKotlin` passa
- ✅ `./gradlew test` passa (100% dos testes)
- ✅ `./gradlew lint` passa (0 errors, 0 warnings críticos)

**Manual:**
- ✅ Código segue RULES.md
- ✅ Sem strings hardcoded
- ✅ Job tracking em ViewModels
- ✅ `.catch {}` em Flows
- ✅ `collectAsStateWithLifecycle()` no Compose
- ✅ `key` em LazyColumn items
- ✅ Testes para lógica nova
- ✅ Comentários PT-BR onde necessário

**Code Review:**
- ✅ Requisito atendido
- ✅ Edge cases tratados
- ✅ Performance OK
- ✅ Acessibilidade considerada

---

## 4. CICLO DE FEEDBACK

### 4.1 Quando Validação Falha

```
┌──────────────────┐
│  Validação falha │
└─────────┬────────┘
          ↓
    ┌─────────┐
    │  Qual?  │
    └────┬────┘
         │
    ┌────┴─────────────────────────────┐
    │                               │
    ↓                               ↓
┌─────────────┐               ┌─────────────┐
│ Compilação  │               │   Teste     │
│             │               │             │
│ - Ver erro  │               │ - Ver log   │
│ - Corrigir  │               │ - Corrigir  │
│ - Repetir   │               │ - Repetir   │
└─────────────┘               └─────────────┘
    │                               │
    └───────────────┬───────────────┘
                    ↓
            ┌───────────────┐
            │  Valida OK    │
            └───────┬───────┘
                    ↓
            ┌───────────────┐
            │ Continuar     │
            └───────────────┘
```

### 4.2 IA Feedback Loop

```
Humano pede mudança
      ↓
IA escreve código
      ↓
IA roda validação (ou humano roda)
      ↓
Passou?
  ↓ SIM        ↓ NÃO
  Merge    IA corrige
             ↓
        Repete validação
```

---

## 5. COMANDOS DE VALIDAÇÃO

### 5.1 Por Tipo de Mudança

| Tipo | Comandos Mínimos | Comandos Completos |
|------|------------------|-------------------|
| **Feature nova** | `compileDebugKotlin + test` | `+ lint + assembleDebug` |
| **Bugfix** | `compileDebugKotlin + test` | `+ lint` |
| **Refactor** | `compileDebugKotlin + test` | `+ lint` |
| **UI Compose** | `compileDebugKotlin + test` | `+ lint` |
| **Release** | TODOS | `+ assembleRelease + dependencyCheck` |

### 5.2 Comandos Detalhados

```bash
# ===== COMPILAÇÃO =====
# Rápido (sintaxe)
./gradlew compileDebugKotlin --console=plain

# Completo
./gradlew assembleDebug

# Release
./gradlew assembleRelease

# ===== TESTES =====
# Todos unitários
./gradlew test

# Específico
./gradlew test --tests "com.futebadosparcas.ui.games.*"

# Com cobertura
./gradlew testDebugUnitTestCoverage

# Instrumented (precisa device/emulator)
./gradlew connectedAndroidTest

# ===== LINT =====
# Android lint
./gradlew lint

# Relatório HTML em: app/build/reports/lint-results.html

# ===== LIMPEZA =====
# Limpar e rebuild
./gradlew clean compileDebugKotlin

# ===== DEPENDÊNCIAS =====
# Verificar atualizações
./gradlew dependencyUpdates

# ===== BUILD INFO =====
# Ver tarefas disponíveis
./gradlew tasks --group="build"
```

---

## 6. CI CONFIGURAÇÃO

### 6.1 GitHub Actions (Exemplo)

```yaml
name: Validation

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  validate:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up JDK
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'

      - name: Grant execute permission for gradlew
        run: chmod +x gradlew

      - name: Compile
        run: ./gradlew compileDebugKotlin

      - name: Test
        run: ./gradlew test

      - name: Lint
        run: ./gradlew lint

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: app/build/reports/tests/
```

### 6.2 GitLab CI (Exemplo)

```yaml
stages:
  - build
  - test
  - lint

build:
  stage: build
  script:
    - ./gradlew assembleDebug

test:
  stage: test
  script:
    - ./gradlew test

lint:
  stage: lint
  script:
    - ./gradlew lint
```

---

## 7. SOLUÇÃO DE PROBLEMAS

### 7.1 Build Falha

```
Erro: Compilation error
Solução:
1. Verificar mensagem de erro
2. ./gradlew clean
3. Verificar se dependências mudaram
4. ./gradlew compileDebugKotlin --stacktrace
```

### 7.2 Teste Falha

```
Erro: Test failure
Solução:
1. ./gradlew test --info
2. Identificar teste que falhou
3. Rodar apenas esse teste com --debug
4. Verificar se é código ou teste
```

### 7.3 Lint Falha

```
Erro: Lint error
Solução:
1. Abrir app/build/reports/lint-results.html
2. Corrigir issues marcados como ERROR
3. Para warnings, avaliar se deve corrigir
```

---

## 8. FERRAMENTAS ÚTEIS

### 8.1 Pre-commit Hooks (Opcional)

```bash
#!/bin/bash
# .git/hooks/pre-commit

./gradlew compileDebugKotlin
if [ $? -ne 0 ]; then
    echo "❌ Compilação falhou. Commit abortado."
    exit 1
fi

./gradlew test
if [ $? -ne 0 ]; then
    echo "❌ Testes falharam. Commit abortado."
    exit 1
fi

echo "✅ Pre-commit validado!"
```

### 8.2 IDE Integration

**Android Studio:**
- Run → 'app' Tests
- Analyze → Inspect Code
- Build → Rebuild Project

**VS Code:**
- Extensão: Test Runner
- Tasks: configurar no tasks.json

---

## 9. TEMPOS DE VALIDAÇÃO

| Etapa | Tempo Esperado | Tempo Máximo |
|-------|----------------|---------------|
| Compilação | 30-60s | 2 min |
| Testes unitários | 1-3 min | 5 min |
| Lint | 30-90s | 3 min |
| Build completo | 1-2 min | 5 min |
| CI full | 5-10 min | 15 min |

---

## 10. SLA DE FEEDBACK

| Atividade | SLA |
|-----------|-----|
| Validação local | Imediato |
| CI completion | < 15 min |
| Code review | 24-48h |
| Merge after approve | < 4h |
