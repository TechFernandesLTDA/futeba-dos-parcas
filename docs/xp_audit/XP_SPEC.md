# XP_SPEC.md - Especificação Formal de XP

## O que é XP no Futeba dos Parças?

O XP (Experience Points) é a unidade fundamental de progresso e engajamento do usuário no ecossistema Futeba dos Parças. Ele quantifica a performance técnica, a participação e o sucesso competitivo de cada jogador de forma individual e meritocrática.

## Quando XP pode ser Gerado?

A geração de XP ocorre única e exclusivamente através de eventos validados dentro de uma partida (Match) que atinja o estado de ciclo de vida **FINALIZADA**. Nenhum XP existe juridicamente no sistema antes da transição do estado da partida para `FINISHED`.

## Quando XP NUNCA pode ser Gerado?

1. Partidas em estado `SCHEDULED`, `CONFIRMED` ou `LIVE`.
2. Partidas em estado `CANCELLED`.
3. Eventos inseridos manualmente fora de um contexto de partida.
4. Reprocessamento de partidas já finalizadas.

## Relação XP → Nível → Liga → Ranking

* **XP (Átomo):** Acúmulo bruto resultante de ações em campo.
* **Nível (Progresso):** Calculado com base no XP total acumulado (Lifetime XP). Define a "patente" do jogador.
* **Liga (Status):** Agrupamento sazonal (mensal/anual) baseado no XP acumulado no período.
* **Ranking (Competição):** A posição relativa do jogador em comparação a outros, ordenada prioritariamente pelo XP (e secundariamente por critérios de desempate como vitórias).

## Backend como Fonte Única de Verdade

O cálculo, a validação e a persistência do XP são responsabilidades exclusivas do backend (ou camada de serviço de domínio via transação atômica). O aplicativo (Mobile UI) atua estritamente como um visor de dados persistidos, sendo proibido de realizar qualquer lógica aritmética de soma de XP para fins de persistência.
