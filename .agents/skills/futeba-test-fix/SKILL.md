---
name: futeba-test-fix
description: Diagnostica e corrige testes falhando no projeto Futeba — Android (JUnit/MockK), Cloud Functions (Jest), Web (Vitest/Playwright). Use quando teste falhar localmente OU em CI, ou após API changes que podem quebrar testes.
---

# Futeba Test Fix

Triage de testes falhando, com padrões comuns por stack.

## Comandos por stack

### Android (JUnit + MockK)
```bash
./gradlew :app:testDebugUnitTest --no-daemon                       # Todos
./gradlew :app:testDebugUnitTest --tests "*ViewModel*"             # Por padrão
./gradlew :app:testDebugUnitTest --tests "com.futebadosparcas.YourTest.method"
./gradlew :app:compileDebugUnitTestKotlin --no-daemon              # Só compile (rápido)
```

### Cloud Functions (Jest)
```bash
cd functions
npx jest --no-coverage                                              # Todos
npx jest path/to/file.test.ts                                       # Single file
npx jest --testNamePattern="test name"                              # Por nome
npx jest --listFailingTests                                         # Só falhas
```

### Web (Vitest + Playwright)
```bash
cd web
npm run test                                                        # Vitest unit
npx playwright test                                                 # E2E
npx playwright test --headed                                        # E2E com browser visible
```

### KMP Shared
```bash
./gradlew :shared:testDebugUnitTest --no-daemon                     # commonTest (JVM)
./gradlew :shared:iosSimulatorArm64Test --no-daemon                 # iosTest
```

## Padrões de falha comuns

### Android: API mismatch após refactor
Sintoma: `Argument type mismatch: actual type is 'String', but 'NotificationType' was expected`

Causa: model mudou (ex: `String` virou enum). Teste usa API antiga.

Fix:
1. Ler model atual
2. Ler teste
3. Atualizar teste pra API atual
4. NUNCA mudar produção pra acomodar teste antigo

### Functions: mock não captura nova call
Sintoma: `mockSet not called` mas produção usa `.create()` (atomic)

Fix: trocar `mockSet` → `mockCreate` no setup do teste.

### Functions: TS2451 redeclaration cross-file
Sintoma: `Cannot redeclare block-scoped variable 'mockDocGet'`

Fix: `jest.config.js` adicionar `isolatedModules: true` em ts-jest config.

### Functions: callable function sem rate-limiter mock
Sintoma: `Cannot read property 'check' of undefined` em rate-limiter

Fix: novo test file precisa `jest.mock("../src/middleware/rate-limiter")` no topo.

### KMP: opt-in faltando
Sintoma: `This declaration needs opt-in. Its usage must be marked with '@OptIn(kotlinx.cinterop.ExperimentalForeignApi::class)'`

Fix: `shared/build.gradle.kts`:
```kotlin
kotlin {
    sourceSets.all {
        languageSettings.optIn("kotlinx.cinterop.ExperimentalForeignApi")
    }
}
```

### Cache Gradle corrompido em CI
Sintoma: `Could not load module metadata from .../descriptor.bin`

Fix:
```bash
rm -rf ~/.gradle/caches/modules-2/metadata-*
```

## Workflow de fix

1. `futeba-ci-triage` se CI falhou — identificar test file
2. Reproduzir local: `cd <module> && <test-cmd> --tests "*FailingClass*"`
3. Diagnosticar: ler test + ler produção
4. Aplicar fix mínimo (só no teste, não na produção)
5. Validar: rodar teste local — deve passar
6. PR via `futeba-pr-flow`

## Anti-pattern

❌ NÃO desabilitar/skipar testes pra deixar CI passar  
❌ NÃO mudar lógica de produção só pra teste passar  
✅ Investigar root cause primeiro

## Localmente em ambiente sem Android SDK

Testes JVM (`:app:testDebugUnitTest`) precisam Android SDK + `local.properties`. Se faltar:
```bash
echo "sdk.dir=$ANDROID_SDK_ROOT" > local.properties
# OU pular e rodar só Functions/Web tests local + Android no CI
```
