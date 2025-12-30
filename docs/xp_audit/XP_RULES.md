# XP_RULES.md - Regras de Cálculo e Composição

## Fórmulas de Soma

O XP total de uma partida para um jogador `P` é a soma linear de seus méritos:
`XP_Partida(P) = (Gols * 10) + (Assists * 7) + (Defesas * 5) + (Resultado) + (MVP) + (Presença) + (Bônus_Sequência)`

Onde `Resultado` é:

* `20` se ganhou.
* `10` se empatou.
* `0` se perdeu.

Onde `MVP` é:

* `30` se foi eleito.
* `0` caso contrário.

Onde `Presença` é:

* `10` fixo por participar de uma partida FINALIZADA.

## Ordem de Aplicação

1. Quantificação de Atributos Técnicos (Gols, Assistências, Defesas).
2. Aplicação de Bônus Coletivo (Resultado da Partida).
3. **Bônus Especial (MVP):** +30 XP.
4. **Bônus de Presença (Fidelidade):** +10 XP.
5. **Bônus de Sequência (Streak):**
    * 3 jogos seguidos: +20 XP EXTRA.
    * 7 jogos seguidos: +50 XP EXTRA.
    * 10+ jogos seguidos: +100 XP EXTRA.
6. **Persistência Atômica:** Gravação no perfil e Log.

## Casos Especiais

1. **Empate e MVP:** Se um jogo termina empatado e um jogador é MVP, ele recebe `10 (Empate) + 30 (MVP) + Atributos Técnicos`.
2. **O Goleiro Artilheiro:** Se um jogador na posição de Goleiro marcar um gol, ele recebe o XP do Gol (+10) e o XP das Defesas (+5 por defesa). A posição não anula o mérito de artilharia.
3. **Partida sem Eventos:** Se um jogador participou da partida mas não teve gols, assistências ou defesas, e seu time perdeu, ele recebe **0 XP**. A participação per se não gera XP automático (anti-AFK).

## Limites

* Não há teto máximo de XP por partida, desde que os eventos sejam reais e validados.
* XP nunca pode ser negativo.
