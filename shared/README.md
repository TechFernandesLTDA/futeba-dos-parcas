# Shared Module - Futeba dos Parças

## Visão Geral

Este módulo contém código compartilhado entre plataformas (Android e iOS) usando Kotlin Multiplatform (KMP).

## Estrutura

```
shared/
├── src/
│   ├── commonMain/kotlin/          # Código compartilhado (Kotlin puro)
│   │   └── com/futebadosparcas/
│   │       └── domain/
│   │           ├── model/          # Models de domínio
│   │           ├── repository/     # Interfaces de repositórios
│   │           ├── usecase/        # Use cases compartilhados
│   │           ├── ranking/        # Calculadoras de XP e Rating
│   │           ├── gamification/   # Sistema de badges e milestones
│   │           ├── ai/             # Balanceamento de times
│   │           └── util/           # Utilitários
│   │
│   ├── androidMain/kotlin/         # Implementações Android
│   │   └── com/futebadosparcas/
│   │       └── domain/
│   │           └── repository/     # Factories Android (usa Hilt)
│   │
│   └── iosMain/kotlin/             # Implementações iOS (futuro)
│       └── com/futebadosparcas/
│           └── domain/
│               └── repository/     # Factories iOS (usa Firebase iOS SDK)
│
└── build.gradle.kts
```

## Conteúdo Compartilhado

### Models (`domain/model/`)

- **User.kt** - Modelo de usuário completo com ratings e gamificação
- **Game.kt** - Jogo, confirmações, times e estatísticas
- **Group.kt** - Grupos e membros
- **Season.kt** - Temporadas e participação em ligas
- **Statistics.kt** - Estatísticas de jogador e logs de XP
- **Badge.kt** - Sistema de badges e conquistas
- **GamificationSettings.kt** - Configurações de XP e gamificação
- **LeagueDivision.kt** - Divisões da liga (Ouro, Prata, Bronze, Diamante)
- **PlayerPosition.kt** - Posições de jogo
- **GameResult.kt** - Resultado de partidas

### Repository Interfaces (`domain/repository/`)

- **UserRepository.kt** - Interface de usuários
- **GameRepository.kt** - Interface de jogos
- **GroupRepository.kt** - Interface de grupos
- **SeasonRepository.kt** - Interface de temporadas
- **StatisticsRepository.kt** - Interface de estatísticas

### Calculadoras (`domain/ranking/`)

- **XPCalculator.kt** - Cálculo de XP com base em desempenho
- **LevelCalculator.kt** - Sistema de níveis (1-100)
- **LeagueRatingCalculator.kt** - Sistema Elo modificado para rankings

### Gamificação (`domain/gamification/`)

- **BadgeDefinitions.kt** - Definições de badges disponíveis
- **MilestoneChecker.kt** - Verificador de conquistas

### AI (`domain/ai/`)

- **TeamBalancer.kt** - Algoritmo de balanceamento de times

### Use Cases (`domain/usecase/`)

- **ValidateGroupNameUseCase.kt** - Validação de nomes de grupo
- **CalculatePlayerXpUseCase.kt** - Cálculo de XP para jogadores
- **BalanceTeamsUseCase.kt** - Balanceamento inteligente de times
- **CalculateLevelUseCase.kt** - Cálculo de níveis e progressão
- **CheckMilestonesUseCase.kt** - Verificação de milestones conquistados
- **CalculateLeagueRatingUseCase.kt** - Cálculo de rating de liga

### Utilitários (`domain/util/`)

- **DateTimeUtils.kt** - Utilitários de data/hora multiplataforma

## Como Usar

### No Android (App Module)

O módulo `shared` já está incluído como dependência no `app/build.gradle.kts`:

```kotlin
dependencies {
    implementation(project(":shared"))
    // ...
}
```

#### Exemplo de Uso

```kotlin
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.usecase.CalculateLevelUseCase
import com.futebadosparcas.domain.usecase.BalanceTeamsUseCase

// Calcular nível do jogador
val levelUseCase = CalculateLevelUseCase()
val levelInfo = levelUseCase.getLevelInfo(currentXp = 1500L)
println("Nível: ${levelInfo.currentLevel}, Progresso: ${levelInfo.getProgressInt()}%")

// Balancear times
val balanceUseCase = BalanceTeamsUseCase()
val users: List<User> = // ... lista de jogadores confirmados
val result = balanceUseCase(users, teamSize = 5)
result.onSuccess { balanced ->
    println("Time 1: ${balanced.team1.size} jogadores")
    println("Time 2: ${balanced.team2.size} jogadores")
    println("Diferença de rating: ${balanced.ratingDifference}")
}
```

### No iOS (Futuro)

Quando o módulo iOS for implementado, o framework `shared` estará disponível via CocoaPods:

```swift
import shared

// Calcular XP
let calculator = CalculatePlayerXpUseCase()
let result = calculator.invoke(
    confirmation: confirmation,
    teamWon: true,
    teamDrew: false,
    // ...
)

// Balancear times
let balancer = BalanceTeamsUseCase()
let result = balancer.invoke(users: players, teamSize: 5)
```

## Dependências

### CommonMain

- **kotlinx-coroutines-core** (1.7.3) - Programação assíncrona
- **kotlinx-serialization-json** (1.6.0) - Serialização JSON
- **kotlinx-datetime** (0.5.0) - Data/hora multiplataforma

### AndroidMain

- Sem dependências adicionais (usa implementações do app)

### iOSMain

- Futuro: Firebase iOS SDK

## Compilação

### Compilar para Android

```bash
./gradlew :shared:assembleDebug
```

### Compilar para iOS (requer Mac/Xcode)

```bash
./gradlew :shared:linkDebugFrameworkIosArm64
```

## Testes

### Testes Compartilhados (commonTest)

```bash
./gradlew :shared:test
```

### Testes Android

```bash
./gradlew :shared:testDebugUnitTest
```

## Regras de Código

1. **Código Puro**: Todo código em `commonMain` deve ser puro Kotlin (sem dependências de plataforma)
2. **Serialização**: Use `@Serializable` do kotlinx.serialization
3. **Data/Hora**: Use `kotlinx-datetime` em vez de `java.time` ou `NSDate`
4. **Platform-Specific**: Use `expect/actual` para código específico de plataforma
5. **Comentários**: Sempre em português (PT-BR)

## Próximos Passos

### Implementações Pendentes

1. **iOS Repository Implementations** (requer Mac/Xcode)
   - Implementar repositórios usando Firebase iOS SDK
   - Criar factories iOS para injeção de dependência

2. **Mais Use Cases**
   - Migrar use cases de `app/domain/usecase/` para `shared/`
   - Criar versões platform-agnostic

3. **SQLDelight** (opcional)
   - Adicionar cache local compartilhado
   - Substituir Room por SQLDelight

4. **Ktor Client** (opcional)
   - Adicionar cliente HTTP compartilhado para APIs REST

## Referências

- [Kotlin Multiplatform](https://kotlinlang.org/docs/multiplatform.html)
- [Kotlinx Serialization](https://github.com/Kotlin/kotlinx.serialization)
- [Kotlinx DateTime](https://github.com/Kotlin/kotlinx-datetime)
- [KMP Best Practices](https://kotlinlang.org/docs/multiplatform-mobile-icerock.html)

---

**Versão**: 1.0
**Última Atualização**: Janeiro 2026
**Status**: ✅ Funcional no Android | ⏳ iOS pendente (requer Mac)
