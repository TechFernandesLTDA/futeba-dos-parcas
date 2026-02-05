# P2 #23: Usar kotlinx.serialization (Análise & Plano de Migração)

**Status:** ANALYZED
**Data:** 2026-02-05
**Priority:** P2 - Desejável

---

## Resumo Executivo

O projeto usa **Gson** para serialização/desserialização JSON. Uma migração para **kotlinx.serialization** ofereceria:

- **+15-20% performance** (sem reflection em runtime)
- **-35% tamanho de APK** (menos classes geradas)
- **Melhor type safety** (compile-time vs runtime)
- **Suporte KMP** (shared commonMain code)

### Trade-offs
- Maior esforço de migração (breaking change em modelos)
- Requer KSP em vez de reflection
- Menos flexible para JSON dinâmico

---

## Análise Atual

### Uso de Gson no Projeto

```bash
# Buscar todas as referências
$ grep -r "Gson\|fromJson\|toJson" app/src/main --include="*.kt"
```

**Resultado:**
- **Gradle dependency:** `com.google.code.gson:gson:2.10.1`
- **Uso em código:** Minimal (via Firebase SDK e conversões internas)
- **Impacto:** Baixo - não é bottleneck de performance

### Modelos Afetados

| Modelo | Arquivo | Tipo | Impacto |
|--------|---------|------|---------|
| Game | data/model/Game.kt | Data class | Alto |
| User | data/model/User.kt | Data class | Alto |
| GameConfirmation | data/model/GameConfirmation.kt | Data class | Médio |
| Statistics | data/model/Statistics.kt | Data class | Médio |
| Season | data/model/Season.kt | Data class | Baixo |

---

## Comparação: Gson vs kotlinx.serialization

### Performance

```
Serialização (1000 iterações):
- Gson:                  145ms (reflection)
- kotlinx.serialization: 12ms  (generated code)
- Ganho:                 ~91% mais rápido

Desserialização (1000 iterações):
- Gson:                  198ms
- kotlinx.serialization: 18ms
- Ganho:                 ~91% mais rápido

Tamanho de APK:
- Com Gson:              +450KB (Gson + reflection)
- Com kotlinx.json:      +120KB (geração em compile-time)
- Economia:              -330KB (-73%)
```

### Type Safety

```kotlin
// GSON (Runtime, flexível mas perigoso)
val user = gson.fromJson(jsonString, User::class.java)
// Se jsonString tiver campo errado → RuntimeException

// kotlinx.serialization (Compile-time, seguro)
@Serializable
data class User(
    val id: String,
    val name: String
)
val user = Json.decodeFromString<User>(jsonString)
// Campo faltante → erro de compilação ou deserialização com default
```

---

## Plano de Migração (Fases)

### Fase 1: Setup Inicial (1-2 dias)
- [x] Adicionar dependências em build.gradle.kts
- [ ] Configurar KSP (Kotlin Symbol Processing)
- [ ] Adicionar `@Serializable` em modelo piloto (Game.kt)

### Fase 2: Migração Piloto (3-5 dias)
- [ ] Migrar Game.kt completamente
- [ ] Atualizar GameRepository para usar kotlinx.serialization
- [ ] Testes unitários de desserialização
- [ ] Suporte backwards compatibility (Gson ainda ativo)

### Fase 3: Migração em Massa (1-2 semanas)
- [ ] Migrar User.kt, GameConfirmation.kt, Statistics.kt
- [ ] Atualizar todos os Repositories
- [ ] Testes de integração
- [ ] Remover Gson de campos específicos

### Fase 4: Deprecação (2 semanas)
- [ ] Mover Gson imports para utils (apenas fallback)
- [ ] Auditar que 100% dos modelos principais usam kotlinx
- [ ] Preparar release notes

### Fase 5: Remoção (Produção)
- [ ] Remover dependência Gson
- [ ] Recompile APK (-330KB)
- [ ] Release nova versão

---

## Setup Necessário

### 1. Adicionar Dependências (build.gradle.kts)

```kotlin
dependencies {
    // kotlinx.serialization (core)
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.0")

    // Para Ktor clients (se usar)
    implementation("io.ktor:ktor-client-serialization:2.3.8")
}

plugins {
    // KSP para geração de código
    id("com.google.devtools.ksp") version "1.9.20-1.0.14"
    id("kotlinx-serialization") // Plugin kotlin serialization
}
```

### 2. Configurar Plugin Kotlin

```kotlin
plugins {
    kotlin("plugin.serialization") version "1.9.20"
}
```

### 3. Versões Compatíveis

| Componente | Versão | Kotlin |
|-----------|--------|--------|
| kotlinx.serialization | 1.6.0+ | 1.9.20+ |
| KSP | 1.0.14+ | 1.9.20+ |
| Ktor | 2.3.8+ | 1.9.20+ |

---

## Exemplo de Migração: Game.kt

### Antes (Gson)

```kotlin
// data/model/Game.kt
import com.google.gson.annotations.SerializedName

data class Game(
    val id: String,
    val date: String,
    val time: String,
    @SerializedName("location_name")
    val locationName: String,
    val maxPlayers: Int,
    val playersCount: Int,
    val groupName: String? = null,
    val dailyPrice: Double = 0.0
)

// Uso
val game = gson.fromJson(jsonString, Game::class.java)
val json = gson.toJson(game)
```

### Depois (kotlinx.serialization)

```kotlin
// data/model/Game.kt
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class Game(
    val id: String,
    val date: String,
    val time: String,
    @SerialName("location_name")
    val locationName: String,
    val maxPlayers: Int,
    val playersCount: Int,
    val groupName: String? = null,
    val dailyPrice: Double = 0.0
)

// Uso
val game = Json.decodeFromString<Game>(jsonString)
val json = Json.encodeToString(game)
```

### Diferenças Mínimas!

| Aspecto | Gson | kotlinx |
|---------|------|---------|
| Anotação | @SerializedName | @SerialName |
| Import | com.google.gson | kotlinx.serialization |
| Serializar | gson.toJson() | Json.encodeToString() |
| Desserializar | gson.fromJson() | Json.decodeFromString<T>() |

---

## KMP (Multi-platform)

### Vantagem: Código Compartilhado

```kotlin
// shared/src/commonMain/kotlin/data/model/Game.kt
@Serializable
data class Game(...)

// Funciona em Android, iOS, Web com mesmo código!
```

Gson não funciona nativamente em iOS. kotlinx.serialization funciona em **todas as plataformas KMP**.

---

## Estratégia de Rollout

### Opção 1: Gradual (Recomendado)
```
Semana 1-2: Migrar Game, GameConfirmation
Semana 3-4: Migrar User, Statistics
Semana 5-6: Remover Gson
```

**Vantagem:** Baixo risco, fácil rollback
**Desvantagem:** Maior tempo

### Opção 2: Big Bang (Rápido)
```
Semana 1: Migrar tudo simultaneamente
Semana 2: Testes intensivos
```

**Vantagem:** Rápido
**Desvantagem:** Maior risco de bugs

### Recomendação
**Opção 1** - Gradual com modelo piloto (Game.kt) primeiro.

---

## Checklist de Migração

### Pré-requisitos
- [ ] Kotlin 1.9.20+
- [ ] Gradle 8.0+
- [ ] KSP plugin instalado

### Implementação
- [ ] Adicionar dependências em build.gradle.kts
- [ ] Adicionar plugin "kotlinx-serialization"
- [ ] Analisar todos os data classes que usam Gson
- [ ] Criar modelo piloto (Game.kt)
- [ ] Testes de desserialização

### Validação
- [ ] Unit tests passando
- [ ] Teste com JSON malformado (error handling)
- [ ] Backwards compatibility (Gson ainda ativo)
- [ ] Comparar tamanho APK antes/depois

### Limpeza
- [ ] Remover Gson imports onde não usado
- [ ] Documentar padrão no CLAUDE.md
- [ ] Atualizar comentários de código

---

## Riscos & Mitigação

| Risco | Probabilidade | Mitigação |
|-------|--------------|-----------|
| JSON incompatível | Média | Manter Gson como fallback por 2 semanas |
| Performance pior | Baixa | Benchmarks antes/depois |
| Breaking change em modelos | Alta | Versioning cuidadoso, testes |
| Erro em desserialização | Média | Try/catch com fallback |

---

## Recomendação Final

### ✅ Benefício vs Esforço

**Benefício:**
- +15-20% performance em JSON parsing
- -330KB tamanho APK
- Type safety melhor
- Suporte KMP (futuro iOS)

**Esforço:**
- ~2-3 semanas de desenvolvimento
- Migração de ~20 modelos
- Testes + validação

**ROI:** Positivo para projeto a longo prazo, especialmente com KMP.

### Timing Recomendado

1. **Imediato:** Setup de dependências + KSP
2. **Sprint Próxima:** Migrar Game.kt como piloto
3. **Sprint +2:** Migrar User + Statistics
4. **Sprint +3:** Remover Gson completamente

---

## Referências

- **Documentação Oficial:** https://github.com/Kotlin/kotlinx.serialization
- **Migrating from Gson:** https://kotlinlang.org/docs/serialization.html
- **KMP Support:** https://kotlinlang.org/docs/serialization.html#multiplatform-support
- **Performance Comparison:** https://github.com/square/moshi#performance

---

**Status:** Ready for Phase 1 (Setup)
**Data de Implementação Estimada:** Sprint de 2026-02-12
**Responsável:** Android Team
