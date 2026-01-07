# Kotlin Code Style

Regras de estilo para código Kotlin no projeto Futeba dos Parças.

## Naming Conventions

- **Classes**: `PascalCase` (e.g., `GameRepository`)
- **Interface/Impl**: `GameRepository` → `GameRepositoryImpl`
- **Variables**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Files**: Match class name (e.g., `Game.kt`)

## Imports

- Preferir imports específicos sobre wildcards para classes principais
- Wildcards OK para extensions e operadores (`import kotlinx.coroutines.flow.*`)

## Null Safety

- Evitar `!!` - usar `?.let {}`, `?: return`, ou `requireNotNull()`
- Usar `orEmpty()` para listas/strings nullable

## Coroutines

- Usar `viewModelScope` em ViewModels
- Usar `withContext(Dispatchers.IO)` para operações de I/O
- Sempre cancelar jobs anteriores antes de iniciar novos
- Usar `async/awaitAll` para operações paralelas

## Comments

- Escrever em **Português (PT-BR)**
- Documentar APIs públicas
- Explicar lógica de negócio complexa

## Strings

- **SEMPRE** usar `strings.xml` - nunca hardcode strings no código
- Formato: `@string/screen_element_description`
