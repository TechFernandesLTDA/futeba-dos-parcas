# XP_RULES.md - Regras de cálculo e composição

## Fórmulas de Soma

O XP total de uma partida para um jogador `P` é a soma linear de seus méritos:
`XP_Partida(P) = (Gols * 10) + (Assists * 7) + (Defesas * 8) + (Resultado) + (MVP) + (Presença) + (Bônus_Sequência) + (CLEAN_SHEET)`

Onde `Resultado` é:

* `20` se ganhou.
* `10` se empatou.
* `0` se perdeu.

Onde `MVP` é:

* `30` se foi eleito.
* `0` caso contrário.

Onde `CLEAN_SHEET` é:

* `15` se a defesa não sofreu gols.
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
    * 5 jogos seguidos: +35 XP EXTRA.
    * 7 jogos seguidos: +50 XP EXTRA.
    * 10+ jogos seguidos: +100 XP EXTRA.
6. **Persistência Atômica:** Gravação no perfil e Log.

## Casos especiais

1. **Empate e MVP:** Se um jogo termina empatado e um jogador é MVP, ele recebe `10 (Empate) + 30 (MVP) + Atributos Técnicos`.
2. **Goleiro artilheiro:** Se um jogador na posição de goleiro marcar um gol, ele recebe o XP do gol (+10) e o XP das defesas (+8 por defesa). A posição não anula o mérito de artilharia.
3. **Partida sem eventos:** Se um jogador participou da partida mas não registrou gols, assistências ou defesas, e seu time perdeu, ele recebe **10 XP** (presença). A participação sempre gera +10 XP.

## Limites

* XP máximo por partida: **500 XP** (`MAX_XP_PER_GAME`).
* Penalidade Bola Murcha: -10 XP.
