# XP_INVARIANTS.md - Invariantes de integridade do sistema

As regras abaixo são invioláveis. Qualquer desvio detectado em auditoria técnica é considerado um **Bug Crítico (P0)**.

1. **Imutabilidade Pós-Finalização:** Uma vez que uma partida atinge o estado `FINISHED`, nenhum dado relacionado a ela (placar, gols, assistências, MVP) pode ser alterado.
2. **Unicidade de Processamento:** O cálculo de XP de uma partida deve ocorrer exatamente **UMA VEZ**. O sistema deve possuir travas contra reprocessamento (Idempotência).
3. **Atomicidade:** O incremento do XP do jogador e a criação do registro de log de XP devem ocorrer em uma única transação atômica. Nunca deve haver XP adicionado sem um log correspondente.
4. **Isolamento de Estado:** Partidas em estado `CANCELLED` obrigatoriamente resultam em `0 XP` para todos os participantes, independentemente de eventos registrados antes do cancelamento.
5. **Propriedade de Escrita:** Somente o serviço de finalização (autorizado por Admin ou FieldOwner) pode disparar o cálculo de XP. O usuário comum não tem permissão de escrita em seus próprios campos de XP no Firestore diretamente.
6. **Breakdown Agregado:** Todos os componentes de XP de um jogo pertencem ao mesmo `xp_log` determinístico por jogo e jogador. Bônus não criam ledgers paralelos que possam escapar do guard idempotente.
7. **Teto Pós-Soma:** O clamp de 500 XP é aplicado ao total depois de somar valores base e bônus; nenhum componente pode contornar esse limite.
8. **Calendário Único:** Markers de retorno, primeira partida e streak mensal usam `America/Sao_Paulo` e são atualizados atomicamente com o log correspondente.
9. **Compatibilidade Histórica:** Campos novos do breakdown são opcionais e equivalem a zero quando ausentes. Nenhuma entrega de regra nova reprocessa jogos antigos automaticamente.
