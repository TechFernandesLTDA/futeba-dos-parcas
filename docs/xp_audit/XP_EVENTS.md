# XP_EVENTS.md - Catálogo de Eventos de XP

Este documento lista todos os gatilhos operacionais que resultam na atribuição de XP.

| Evento | Disparador (Trigger) | Pré-condições | Bloqueios | Gera XP? | Valor |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Gol** | Finalização da Partida | Jogador deve estar na lista de participantes | Partida deve estar `FINISHED` | Sim | +10 XP |
| **Assistência** | Finalização da Partida | Jogador deve estar na lista de participantes | Partida deve estar `FINISHED` | Sim | +7 XP |
| **Defesa (Goleiro)** | Finalização da Partida | Jogador deve ter a posição `GOALKEEPER` | Partida deve estar `FINISHED` | Sim | +5 XP |
| **Vitória** | Finalização da Partida | Time do jogador deve ter Score > Time adversário | Partida deve estar `FINISHED` | Sim | +20 XP |
| **Empate** | Finalização da Partida | Score Time A == Score Time B | Partida deve estar `FINISHED` | Sim | +10 XP |
| **MVP** | Finalização da Partida | Jogador deve ser selecionado como Melhor da Partida | Apenas 1 por partida | Sim | +30 XP |
| **Cancelamento** | Mudança de Estado | Partida movida para `CANCELLED` | Impede qualquer cálculo posterior | Não | 0 XP |
| **Finalização** | Ação de Admin/Dono | Partida movida de `LIVE` para `FINISHED` | Bloqueia edição de eventos pós-trigger | N/A | Gatilho |

## Observações de Fluxo

* Todos os eventos acima são agregados no momento da **Finalização**.
* Se um jogador marca 2 gols e o time vence, o trigger de Finalização processa: `(2 * 10) + 20 = 40 XP`.
