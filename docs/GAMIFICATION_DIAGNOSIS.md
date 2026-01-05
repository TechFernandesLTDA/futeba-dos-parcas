# Diagnóstico e Validação: Sistema de Gamificação e Pontuação

## 1. Visão Geral da Arquitetura

O sistema de gamificação do "Futeba dos Parças" é robusto e modular, seguindo uma arquitetura orientada a serviços no domínio (`domain/ranking`).

* **Principal Orquestrador**: `MatchFinalizationService`
  * Responsável por calcular XP, atualizar estatísticas, verificar milestones, e atualizar ligas atomicamente.
  * Usa transações do Firestore para garantir integridade dos dados (evita XP duplicado).
* **Calculadora de XP**: `XPCalculator`
  * Lógica determinística e bem definida para pontuação de partidas (Gols, Assistências, Vitórias, MVP, Streaks).
* **Gerenciador de Conquistas**: `MilestoneChecker`
  * Verifica marcos históricos (10 Jogos, 50 Gols, etc.) de forma eficiente.
* **Sistema de Ligas**: `LeagueService`
  * Gerencia divisões (Bronze a Diamante) com lógica de promoção, rebaixamento e proteção.

## 2. Validação das Regras de Negócio

### 2.1. Pontuação e XP

As regras atuais estão balanceadas para um ambiente de futebol amador:

* **Vitória**: 20 XP | **Empate**: 10 XP
* **Gol**: 10 XP | **Assistência**: 7 XP | **Defesa**: 5 XP
* **MVP**: 30 XP (Bônus significativo)
* **Sequências (Streaks)**: Bônus progressivo (20/50/100 XP) para fidelidade.
* **Bola Murcha**: Penalidade de -10 XP (mecanismo divertido de balanceamento).

### 2.2. Progressão de Nível (`LevelTable`)

* Sistema exponencial variando do Nível 0 (Novato) ao 10 (Imortal).
* **Atenção**: Os valores estão "hardcoded" no código (`LevelTable.kt`).
  * *Recomendação*: Implementar `Firebase Remote Config` para ajustar a curva de dificuldade sem precisar atualizar o app.

### 2.3. Ligas e Temporadas

* O sistema usa um "League Rating" inteligente que considera "Momentum" (jogos recentes).
* **Ponto de Atenção**: O sistema lê/escreve em `SeasonParticipationV2`, mas a estrutura `SeasonFinalStanding` (definida em `Gamification.kt`) parece ser usada apenas para histórico congelado.
  * *Lacuna Identificada*: Não foi encontrado o código responsável por "fechar" a temporada e converter `Participation` em `FinalStanding`. Isso provavelmente deve ser uma Cloud Function ou um Job agendado.

## 3. Consistência de Dados

* **Atomicidade**: O uso de `firestore.runTransaction` no `MatchFinalizationService` é excelente. Atualiza User, Stats, Streak, e XP Log em uma única operação.
* **Idempotência**: O sistema verifica `xp_processed` antes de rodar, prevenindo contagem dupla se o app falhar ou reiniciar.

## 4. Diagnóstico de Problemas Potenciais

| Componente | Status | Observação / Risco |
| :--- | :--- | :--- |
| **Cálculo de XP** | ✅ Seguro | Lógica sólida e centralizada. |
| **Milestones** | ✅ Seguro | Verifica duplicatas antes de premiar. |
| **Ligas** | ⚠️ Atenção | Falta lógica clara de "Fechamento de Temporada" no código cliente. |
| **Ranking** | ✅ Otimizado | Otimizado com leituras paralelas (`fetchUserDataParallel`). |
| **Níveis** | ⚠️ Rígido | Valores hardcoded dificultam ajustes de balanceamento. |

## 5. Próximos Passos Recomendados

1. **Criar Job de Fechamento de Temporada**: Implementar lógica para finalizar a temporada ativa, gerar `SeasonFinalStanding` e resetar (ou migrar com momentum) para a próxima.
2. **Remote Config para Níveis**: Migrar a lista de níveis de `LevelTable.kt` para ser carregada de uma configuração remota.
3. **UI de Feedback de Temporada**: Garantir que o usuário veja visualmente sua promoção/rebaixamento (o backend gera o log, mas a UI precisa mostrar animação).

---
Gerado por Antigravity (DeepSeek Module)
