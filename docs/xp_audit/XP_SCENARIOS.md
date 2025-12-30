# XP_SCENARIOS.md - Matriz de Cenários de Teste e Validação

## Cenário 1: Vitória com Performance Sólida

* **Entrada:** Jogador A, Time Ganhou, 2 Gols, 1 Assistência.
* **Ação:** Finalizar Partida.
* **Resultado Esperado:**
  * Vitória: 20 XP
  * 2 Gols: 20 XP
  * 1 Assistência: 7 XP
  * **Total:** 47 XP.
* **Invariantes:** Unicidade de Processamento, Atomicidade.

## Cenário 2: Empate sem Eventos Individuais

* **Entrada:** Jogador B, Time Empatou, 0 Gols, 0 Assists.
* **Ação:** Finalizar Partida.
* **Resultado Esperado:** 10 XP (Bônus de Empate).
* **Invariantes:** XP depende do estado FINISHED.

## Cenário 3: MVP em Time Perdedor

* **Entrada:** Jogador C, Time Perdeu, 1 Gol, Eleito MVP.
* **Ação:** Finalizar Partida.
* **Resultado Esperado:**
  * Derrota: 0 XP
  * 1 Gol: 10 XP
  * MVP: 30 XP
  * **Total:** 40 XP.
* **Invariantes:** MVP é independente do resultado da vitória.

## Cenário 4: Jogo Cancelado com Gols Registrados

* **Entrada:** Partida com 3 gols registrados.
* **Ação:** Cancelar Partida.
* **Resultado Esperado:** 0 XP para todos. Os gols não são contabilizados para XP.
* **Invariantes:** CANCELADO gera 0 XP.

## Cenário 5: Tentativa de Reprocessamento (Ajuste de Placar)

* **Entrada:** Partida já no estado `FINISHED`.
* **Ação:** Tentar editar gols para disparar novo cálculo.
* **Resultado Esperado:** **ERRO/BLOQUEIO**. A UI não deve permitir edição e o backend deve rejeitar a transação.
* **Invariantes:** Jogo FINALIZADO é imutável, XP nunca é recalculado.

## Cenário 6: Goleiro com Defesas e Vitória

* **Entrada:** Jogador D (Goleiro), 4 Defesas, Time Ganhou.
* **Ação:** Finalizar Partida.
* **Resultado Esperado:**
  * Vitória: 20 XP
  * 4 Defesas: 20 XP
  * **Total:** 40 XP.
