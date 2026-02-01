# Guia de Contribuição - Futeba dos Parças

Obrigado por considerar contribuir! 🎉

## 📋 Índice

- [Code of Conduct](#code-of-conduct)
- [Como Contribuir](#como-contribuir)
- [Desenvolvimento Local](#desenvolvimento-local)
- [Padrões de Código](#padrões-de-código)
- [Processo de Pull Request](#processo-de-pull-request)
- [Reportando Bugs](#reportando-bugs)

---

## Code of Conduct

Este projeto segue um código de conduta. Ao participar, você concorda em seguir estas diretrizes.

---

## Como Contribuir

### 1. Fork o Repositório

```bash
# Faça fork via GitHub UI
# Clone seu fork
git clone https://github.com/SEU-USUARIO/futeba-dos-parcas.git
cd futeba-dos-parcas

# Adicione o upstream
git remote add upstream https://github.com/TechFernandesLTDA/futeba-dos-parcas.git
```

### 2. Crie uma Branch

```bash
# Sempre trabalhe em uma branch separada
git checkout -b feature/minha-feature
# ou
git checkout -b fix/meu-bugfix
```

Convenção de nomes:
- `feature/nome-da-feature` - Novas funcionalidades
- `fix/nome-do-bug` - Correções de bugs
- `docs/descricao` - Documentação
- `refactor/descricao` - Refatorações
- `test/descricao` - Testes

### 3. Faça Suas Mudanças

Siga os [Padrões de Código](#padrões-de-código) abaixo.

### 4. Commit

Use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Formato
<type>(<scope>): <description>

# Exemplos
feat(games): add MVP voting screen
fix(auth): resolve login crash on Android 14
docs(readme): update installation instructions
refactor(profile): simplify stats calculation
test(games): add unit tests for GameViewModel
```

**Types:**
- `feat` - Nova feature
- `fix` - Bug fix
- `docs` - Documentação
- `style` - Formatação
- `refactor` - Refatoração
- `test` - Testes
- `chore` - Configurações, build

### 5. Push e Pull Request

```bash
git push origin feature/minha-feature
```

Abra um PR no GitHub seguindo o [template](.github/pull_request_template.md).

---

## Desenvolvimento Local

### Pré-requisitos

- JDK 17+
- Android Studio Ladybug (2024.2.1+)
- Android SDK 35
- Git
- Firebase CLI (para Functions)

### Setup

```bash
# 1. Clone
git clone https://github.com/TechFernandesLTDA/futeba-dos-parcas.git
cd futeba-dos-parcas

# 2. Configure Firebase
# Baixe google-services.json do Firebase Console
cp google-services.json app/

# 3. Configure local.properties
echo "MAPS_API_KEY=sua_chave" >> local.properties

# 4. Build
./gradlew build

# 5. Rodar testes
./gradlew test

# 6. Instalar no device
./gradlew installDebug
```

### Firebase Functions

```bash
cd functions
npm install
npm run build
firebase emulators:start
```

---

## Padrões de Código

### Kotlin

- **Style Guide:** [Kotlin Coding Conventions](https://kotlinlang.org/docs/coding-conventions.html)
- **Formato:** 4 espaços (não tabs)
- **Max line length:** 120 caracteres
- **Imports:** Sempre use imports específicos (não wildcards para classes principais)
- **Nomes:** `camelCase` para variáveis, `PascalCase` para classes
- **Comentários:** Em Português (PT-BR)

### Compose

- Stateless composables sempre que possível
- Use `remember {}` para cálculos caros
- Evite recomposições desnecessárias
- Sempre use `MaterialTheme.colorScheme.*` (nunca hardcode cores)

### Arquitetura

```
UI (Compose) → ViewModel (StateFlow) → UseCase → Repository → DataSource
```

- **MVVM** com Clean Architecture
- **Hilt** para DI
- **StateFlow** para estados (não LiveData em código novo)
- **Repository pattern** para dados

### Testes

- Cobertura mínima: 70% para ViewModels e UseCases
- Naming: `methodName_condition_expectedResult`
- Use MockK para mocking
- Testes em `src/test/` (unit) e `src/androidTest/` (instrumented)

---

## Processo de Pull Request

1. **Spec First** - Para features grandes, crie uma spec em `/specs/` antes
2. **Pequenos PRs** - PRs menores são mais fáceis de revisar
3. **Descrição clara** - Use o template e preencha todas as seções
4. **Screenshots** - Se houver mudanças visuais
5. **Testes** - Adicione testes para sua mudança
6. **CI deve passar** - Todos os checks do GitHub Actions devem estar ✅

### Revisão

- Espere pelo menos 1 aprovação
- Responda aos comentários
- Faça as mudanças solicitadas
- Mantenha a branch atualizada com `master`

---

## Reportando Bugs

Use o [Bug Report Template](https://github.com/TechFernandesLTDA/futeba-dos-parcas/issues/new?template=bug_report.yml).

**Informações importantes:**
- Versão do app
- Plataforma (Android/iOS)
- Passos para reproduzir
- Logs/screenshots
- Severidade

---

## Dúvidas?

- 💬 [Discussions](https://github.com/TechFernandesLTDA/futeba-dos-parcas/discussions)
- 📧 [Email](mailto:techfernandesltda@gmail.com)
- 📖 [Documentação](https://futebadosparcas.web.app)

---

**Obrigado por contribuir! ⚽**
