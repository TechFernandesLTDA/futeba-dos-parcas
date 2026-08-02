# BUGFIX: adiar XP de votação em jogo retido (#3940)

> **Status:** `APPROVED`
> **Severidade:** `CRITICAL`
> **Data:** 2026-08-01

## 1. Descrição do Bug

Votação concluída enquanto um jogo está `HELD_FOR_REVIEW` paga MVP/Bola Murcha.
Uma aprovação posterior paga novamente no pipeline principal; uma rejeição deixa
o pagamento indevido definitivo.

## 2. Causa Raiz

O fluxo de votação não consultava `xp_reward_status`. O pipeline principal tinha
guarda apenas para seu próprio `xp_log`, não para os logs determinísticos da
votação.

## 3. Solução Proposta

Adiar a aplicação de XP de votação quando o jogo estiver retido ou rejeitado,
registrando `voting_xp_pending`. Na aprovação, o pipeline principal paga uma vez.
Também consultar os logs da votação antes de aplicar MVP/Bola Murcha no pipeline,
como defesa em profundidade.

## 4. Verificação

- [x] Regressões: HELD, REJECTED, ELIGIBLE e replay da votação retida
- [x] `functions`: build, lint e Jest completo
- [ ] Validação em emulator do fluxo reter/aprovar/rejeitar
- [ ] Revisão XP e deploy de Functions

## 5. Riscos

O XP de votação fica pendente até a decisão administrativa, comportamento exigido
pelo gate antifraude. IDs determinísticos e transações existentes são preservados.
