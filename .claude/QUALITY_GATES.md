# QUALITY GATES - Futeba dos Parças

> Portas de qualidade para garantir entregas consistentes.
> Última atualização: 2025-01-10

---

## 1. GATES LOCAIS (OBRIGATÓRIO)

### 1.1 Gate de Compilação

**Comando:**
```bash
./gradlew compileDebugKotlin
```

**Critério:** Deve compilar sem erros ou warnings ignoráveis.

**Tempo estimado:** 30-60 segundos

---

### 1.2 Gate de Testes Unitários

**Comando:**
```bash
./gradlew test
```

**Critério:** Todos os testes devem passar.

**Cobertura mínima:**
- Domain layer: 70%
- Data layer: 50%
- UI layer: 30% (ViewModels)

**Tempo estimado:** 2-5 minutos

---

### 1.3 Gate de Lint

**Comando:**
```bash
./gradlew lint
```

**Critério:** Zero erros, zero warnings críticos.

**Tempo estimado:** 1-3 minutos

---

### 1.4 Gate de Build Debug

**Comando:**
```bash
./gradlew assembleDebug
```

**Critério:** APK gerado com sucesso.

**Tempo estimado:** 1-2 minutos

---

## 2. GATES CI (AUTOMÁTICO)

### 2.1 Pipeline de PR

```yaml
# Exemplo de pipeline (GitHub Actions / GitLab CI)
stages:
  - build
  - test
  - lint
  - security

build:
  stage: build
  script: ./gradlew assembleDebug

test:
  stage: test
  script: ./gradlew test

lint:
  stage: lint
  script: ./gradlew lint

security:
  stage: security
  script:
    - ./gradlew dependencyCheckAnalyze
    - ./scripts/check-secrets.sh
```

### 2.2 Gate de Segurança

**Comandos:**
```bash
# Verificar secrets no código
git diff origin/main | grep -i "password\|api_key\|secret"

# Dependency check (vulnerabilidades)
./gradlew dependencyCheckAnalyze
```

**Critério:**
- Zero secrets expostos
- Zero vulnerabilidades críticas

---

## 3. DEFINITION OF DONE

### 3.1 Para uma Task/Feature

- [ ] Código compila sem erros
- [ ] Testes unitários passando
- [ ] Lint sem erros
- [ ] Sem strings hardcoded
- [ ] Job tracking nos ViewModels
- [ ] `.catch {}` nos Flows
- [ ] `key` em LazyColumn items
- [ ] Comentários PT-BR onde necessário
- [ ] Code review aprovado
- [ ] Documentation atualizada (se aplicável)

### 3.2 Para um Bugfix

- [ ] Código compila
- [ ] Testes passando
- [ ] Reproduzir bug → confirmar fix
- [ ] Teste regression adicionado
- [ ] Code review aprovado

### 3.3 Para um Refactor

- [ ] Código compila
- [ ] Testes passando (sem quebra)
- [ ] Lint aprovado
- [ ] Comportamento idêntico ao anterior
- [ ] Code review aprovado

---

## 4. CHECKLIST PRÉ-MERGE

### 4.1 Automático (CI)

- ✅ Build sucesso
- ✅ Testes passam
- ✅ Lint aprova
- ✅ Sem secrets
- ✅ Zero vulnerabilidades críticas

### 4.2 Manual (Reviewer)

- ✅ Requisito atendido
- ✅ Segue RULES.md
- ✅ Edge cases tratados
- ✅ Performance OK
- ✅ Acessibilidade considerada
- ✅ Tests adequados
- ✅ Changeset atualizado

---

## 5. MÉTRICAS DE QUALIDADE

### 5.1 Cobertura de Testes

| Camada | Mínimo | Atual | Meta |
|--------|--------|-------|------|
| Domain | 70% | ~60% | 80% |
| Data | 50% | ~40% | 70% |
| UI | 30% | ~20% | 50% |

### 5.2 Performance

| Métrica | Limite | Como medir |
|---------|--------|------------|
| Cold start | < 3s | Android Studio Profiler |
| Frame time | < 16ms (60fps) | Profiler |
| APK size | < 30MB | ./gradlew assembleRelease |
| TTI (Time to Interactive) | < 5s | Manual |

### 5.3 Estabilidade

| Métrica | Meta | Como medir |
|---------|------|------------|
| Crash-free users | > 99% | Firebase Crashlytics |
| ANR rate | < 0.5% | Firebase Crashlytics |
| Lint warnings | 0 | ./gradlew lint |

---

## 6. COMANDOS DE VALIDAÇÃO

### 6.1 Validação Completa Local

```bash
# Script completo
#!/bin/bash
echo "🔨 Compilando..."
./gradlew compileDebugKotlin || exit 1

echo "🧪 Rodando testes..."
./gradlew test || exit 1

echo "🔍 Rodando lint..."
./gradlew lint || exit 1

echo "✅ Todos os gates passaram!"
```

### 6.2 Validação Rápida (Draft PR)

```bash
./gradlew compileDebugKotlin test
```

### 6.3 Validação de Release

```bash
# Full validation + build release
./gradlew clean test lint assembleRelease
```

---

## 7. FERRAMENTAS

### 7.1 Lint

**Detekt (Kotlin):**
```bash
./gradlew detekt
```

**Android Lint:**
```bash
./gradlew lint
```

### 7.2 Formatação

**ktlint:**
```bash
./gradlew ktlintFormat
```

### 7.3 Análise Estática

**SonarQube (se configurado):**
```bash
./gradlew sonarqube
```

---

## 8. PROCESSO QUANDO GATE FALHA

### 8.1 Build Falha

```
1. Verificar erro no log
2. Corrigir código
3. ./gradlew clean
4. ./gradlew compileDebugKotlin
5. Repetir até passar
```

### 8.2 Teste Falha

```
1. Identificar teste quebrado
2. Verificar se é código ou teste
3. Corrigir
4. ./gradlew test --tests NomeDoTeste
5. Rodar todos novamente
```

### 8.3 Lint Falha

```
1. ./gradlew lint
2. Abrir relatório: app/build/reports/lint-results.html
3. Corrigir issues
4. Repetir
```

---

## 9. QUALITY GATES POR TIPO DE MUDANÇA

### 9.1 Feature Nova

| Gate | Obrigatório? |
|------|--------------|
| Compilação | ✅ |
| Testes unitários | ✅ |
| Lint | ✅ |
| Testes UI | ⚠️ Recomendado |
| Performance | ⚠️ Se aplicável |
| Segurança | ✅ |

### 9.2 Bugfix

| Gate | Obrigatório? |
|------|--------------|
| Compilação | ✅ |
| Testes afetados | ✅ |
| Lint | ✅ |
| Full tests | ⚠️ Recomendado |

### 9.3 Refactor

| Gate | Obrigatório? |
|------|--------------|
| Compilação | ✅ |
| Full tests | ✅ |
| Lint | ✅ |
| Comportamento idêntico | ✅ (manual) |

---

## 10. SLA DE QUALIDADE

| Gate | Tempo máximo |
|------|--------------|
| Compilação local | 2 min |
| Testes locais | 5 min |
| Lint local | 3 min |
| CI full pipeline | 15 min |
| Code review | 24-48h |

---

## 11. ALERTAS E THRESHOLDS

### 11.1 Quando Bloquear Merge

- Build falhando
- Testes falhando
- Lint errors
- Secrets expostos
- Vulnerabilidade crítica

### 11.2 Quando Avisar (Warning)

- Cobertura abaixo da meta
- Lint warnings (não errors)
- Performance degradada
- APK size > 25MB

---

## 12. MELHORIA CONTÍNUA

### 12.1 Revisar Gates Trimestralmente

- Adotar novas ferramentas
- Ajustar thresholds
- Simplificar processo

### 12.2 Feedback Loop

- Engenheiros podem sugerir mudanças
- Gates devem ter ROI positivo
- Remover gates que não agregam valor
