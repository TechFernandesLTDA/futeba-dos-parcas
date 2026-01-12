# Unificacao do Sistema de League Rating

## Data: 2025-01-11

## Problema Identificado

Existiam DOIS sistemas diferentes de calculo de League Rating no projeto:

1. **Android (Ranking.kt)**: Sistema 0-100 em producao
   - Formula: `LR = (PPJ * 40%) + (WR * 30%) + (GD * 20%) + (MVP_Rate * 10%)`
   - Escala: 0-100
   - Thresholds: Bronze (0-29), Prata (30-49), Ouro (50-69), Diamante (70-100)

2. **Shared (LeagueRatingCalculator.kt)**: Sistema Elo modificado (NAO utilizado)
   - Formula Elo modificado (K-factor)
   - Escala: 100-3000
   - Thresholds: Bronze (100-999), Silver (1000-1499), Gold (1500-1999), Diamond (2000+)

## Decisao

**Manter o sistema 0-100 em producao e mover para o shared module (KMP)**

### Justificativa

1. **Ja esta em producao**: O sistema 0-100 e usado pelo app Android e todos os dados
   no Firestore estao baseados nele.

2. **Simplicidade**: O sistema de media ponderada e mais simples de entender para os
   usuarios do que um sistema Elo.

3. **Consistencia**: Manter um unico sistema evita confusao e duplicidade de codigo.

4. **KMP Ready**: Mover para o shared module permite que o iOS use a mesma logica
   quando o app iOS for desenvolvido.

## Alteracoes Realizadas

### 1. Shared Module

#### `LeagueDivision.kt`
- Atualizado para usar escala 0-100 (em vez de 100-3000)
- Adicionados metodos `getNextDivision()`, `getPreviousDivision()`
- Adicionados metodos `getNextDivisionThreshold()`, `getPreviousDivisionThreshold()`
- Nomes em portugues: `PRATA`, `OURO`, `DIAMANTE` (compativel com Android)

#### `LeagueRatingCalculator.kt`
- **Substituido** o sistema Elo pelo sistema 0-100
- Mantido objeto `LeagueRatingCalculatorElo` como `@Deprecated` para compatibilidade
- Adicionado `RecentGameData` como data class no shared module

#### `CalculateLeagueRatingUseCase.kt`
- Atualizado para usar o novo calculador 0-100

### 2. Android Module

#### `Ranking.kt`
- Marcado `LeagueRatingCalculator` como `@Deprecated`
- Adicionada documentacao apontando para o shared module

#### `LeagueService.kt`
- Atualizado para usar `com.futebadosparcas.domain.ranking.LeagueRatingCalculator`
- Adicionados metodos auxiliares `toSharedDivision()` e `toAndroidDivision()` para
  conversao entre os dois tipos de enum

#### `SeasonMapper.kt`
- Atualizado para converter entre os enums Android e Shared (nomes sao iguais)

#### `GetLeagueStandingsUseCase.kt`
- Adicionado metodo `toSharedDivision()` para conversao

## Thresholds de Divisao

| Divisao  | Rating Minimo | Rating Maximo |
|----------|---------------|---------------|
| Bronze   | 0.0           | 29.99         |
| Prata    | 30.0          | 49.99         |
| Ouro     | 50.0          | 69.99         |
| Diamante | 70.0          | 100.0         |

## Formula de Calculo

```
LR = (PPJ * 0.4) + (WR * 0.3) + (GD * 0.2) + (MVP_Rate * 0.1)
```

Onde:
- **PPJ**: Media de XP por jogo (max 200 XP = 100 pontos)
- **WR**: Win Rate (100% = 100 pontos)
- **GD**: Media de Goal Difference (+3 = 100, -3 = 0)
- **MVP_Rate**: Taxa de MVP (50% = 100 pontos, com cap)

## Compatibilidade

- O sistema Elo foi mantido como `@Deprecated` para permitir migracao gradual
- O calculador Android foi marcado como `@Deprecated` mas ainda funciona
- Conversores foram adicionados para garantir compatibilidade entre os tipos

## Proximos Passos

1. **Remover codigo deprecated**: Em versao futura, remover:
   - `LeagueRatingCalculatorElo` do shared module
   - `LeagueRatingCalculator` do Android module

2. **Migrar chamadas restantes**: Verificar se ha outros lugares usando o
   calculador Android e migrar para o shared

3. **Atualizar documentacao**: Garantir que toda a documentacao reflete o
   sistema 0-100

## Arquivos Modificados

```
shared/src/commonMain/kotlin/com/futebadosparcas/domain/model/LeagueDivision.kt
shared/src/commonMain/kotlin/com/futebadosparcas/domain/ranking/LeagueRatingCalculator.kt
shared/src/commonMain/kotlin/com/futebadosparcas/domain/usecase/CalculateLeagueRatingUseCase.kt
app/src/main/java/com/futebadosparcas/data/model/Ranking.kt
app/src/main/java/com/futebadosparcas/domain/ranking/LeagueService.kt
app/src/main/java/com/futebadosparcas/data/mapper/SeasonMapper.kt
app/src/main/java/com/futebadosparcas/domain/usecase/ranking/GetLeagueStandingsUseCase.kt
```
