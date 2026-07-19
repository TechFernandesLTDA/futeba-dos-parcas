# SPEC: Gamificação 2.0 — XP por Performance e Aderência

> **Status:** APPROVED
> **Autor:** Codex (Sol, Luna e Terra)
> **Data:** 2026-07-19
> **Epic:** #3846

---

## 1. Objetivo

Rebalancear a economia de XP para valorizar performance em campo, reconhecer
trabalho operacional e criar mecanismos positivos de retorno e frequência sem
abrir caminhos simples de farming.

Esta entrega cobre #3847 a #3856. O backend permanece como fonte única de
verdade; web, Android e iOS/CMP somente exibem o breakdown persistido.

## 2. Decisões normativas

1. `xp_logs` continua agregado em um documento determinístico por
   `gameId + userId`. Cada bônus é persistido como campo do breakdown do mesmo
   documento; não serão criados documentos independentes por ação.
2. Calendário mensal, streaks e janelas de retorno usam
   `America/Sao_Paulo`, seguindo o pipeline existente.
3. O bônus de primeira partida do mês incrementa XP global. A competição
   sazonal existente não é redefinida nesta entrega.
4. O processamento acontece somente na primeira transição válida para
   `FINISHED`, dentro da transação idempotente existente. Não haverá backfill.
5. `MAX_XP_PER_GAME = 500` continua sendo o teto absoluto depois da soma de
   todos os componentes.
6. Estatísticas confirmadas do jogo são a autoridade para gols, assistências e
   defesas. Eventos live são usados apenas onde a ordem temporal ou o tipo do
   evento é necessário.
7. Overrides de `app_settings/gamification` devem receber defaults novos de
   forma compatível; configurações administrativas explícitas continuam sendo
   respeitadas.

## 3. Regras de XP

### 3.1 Valores base (#3847)

| Ação | XP |
|---|---:|
| Participação | 10 |
| Gol | 25 |
| Assistência | 20 |
| Defesa | 15 |
| Vitória | 30 |
| MVP | 50 |

Empate, clean sheet e Bola Murcha permanecem inalterados.

### 3.2 Performance (#3848, #3851 e #3856)

| Bônus | Regra | XP |
|---|---|---:|
| Artilheiro do jogo | Maior total de gols confirmado; empate premia todos | 15 |
| Hat-trick | Pelo menos 3 gols confirmados | 30 |
| Primeiro gol | Autor do primeiro GOAL por minuto/timestamp | 5 |
| Gol do goleiro | Autor do gol jogava como `GOALKEEPER` | 20 |
| Fair Play | Participou e não recebeu cartão amarelo/vermelho | 5 |

Partida sem gols não concede artilheiro nem primeiro gol. Eventos inválidos ou
disputados não concedem bônus derivados.

### 3.3 Retenção (#3849, #3850 e #3855)

| Bônus | Regra | XP |
|---|---|---:|
| Retorno 14 dias | Primeiro retorno após pelo menos 14 dias | 10 extras |
| Retorno 30 dias | Primeiro retorno após pelo menos 30 dias | 20 extras |
| Primeira do mês | Primeira participação do mês BRT | 15 |
| Streak mensal | Participação em meses consecutivos conforme marcador mensal | 50 |

Retorno é limitado a uma concessão por mês BRT. Marcadores mensais e de
recência são atualizados na mesma transação do `xp_log`.

### 3.4 Contribuição (#3852 e #3853)

| Bônus | Regra | XP |
|---|---|---:|
| Registrador | 2 por evento válido, mínimo 3, cap 20 | 2–20 |
| Confirmação antecipada | Confirmou pelo menos 48h antes | 5 |
| Pontualidade | Check-in até 10 min após o início | 5 |
| Salvou a pelada | Confirmou vaga necessária faltando menos de 24h | 15 |
| Veio da waitlist | Foi promovido e participou | 10 |

O registrador não recebe XP quando houver disputa de estatísticas. O badge
`Mesa Oficial` é avaliado na mesma transação que incrementa o contador de
jogos registrados e só considera eventos válidos aceitos pelo servidor.

## 4. Notificações e apresentação (#3854)

- Cron diário envia alerta de streak em risco apenas para usuário com streak
  ativo de pelo menos três jogos, jogo elegível aberto e ainda não confirmado.
- Home e breakdown mostram quase-nível quando faltarem menos de 100 XP.
- Home mostra quase-badge ao atingir pelo menos 80% de um milestone de gols,
  assistências, defesas ou vitórias.
- Templates são PT-BR, respeitam preferências de notificação e não repetem o
  mesmo alerta para usuário/alvo/janela.
- Clientes exibem os novos campos do breakdown sem recalcular XP.

## 5. Modelo de dados

O `xp_log` agregado pode receber campos opcionais:

```text
xp_top_scorer
xp_hat_trick
xp_first_goal
xp_goalkeeper_goal
xp_fair_play
xp_comeback
xp_first_game_month
xp_monthly_streak
xp_recorder
xp_early_confirmation
xp_on_time_checkin
xp_last_minute_saver
xp_waitlist_promoted
```

Campos opcionais ausentes equivalem a zero para compatibilidade com histórico.
O total gravado é sempre o valor final após o clamp.

Marcadores server-owned podem ser adicionados ao documento de streak/usuário
para mês da primeira partida, último comeback e sequência mensal. Eles nunca
podem ser escritos diretamente pelo cliente.

## 6. Segurança e idempotência

- Um retry do mesmo jogo reutiliza o `xp_log` determinístico e não concede XP,
  badges ou notificações novamente.
- Reads usados nas decisões e writes de XP/marcadores pertencem à mesma
  transação sempre que a consistência depender deles.
- Limites existentes de gols, eventos e XP continuam ativos.
- O registrador não pode se beneficiar de eventos rejeitados ou disputados.
- Fair Play exige ausência de cartões válidos; falta de dados não permite
  inferir evento positivo quando a partida não suporta o contrato.
- Nenhuma função cliente recebe permissão para escrever breakdown ou markers.

## 7. Plano de implementação

1. Sincronizar constantes e testes base (#3847).
2. Expandir modelos e breakdown agregado.
3. Adicionar bônus determinísticos sem estado: #3848, #3851 e #3856.
4. Adicionar marcadores mensais/transacionais: #3850, #3849 e #3855.
5. Adicionar contribuição e comportamento: #3852 e #3853.
6. Adicionar notificações e progresso nos clientes: #3854.
7. Validar Functions, KMP/Android, web e release alignment.

## 8. Critérios de aceite

- [x] JSONs canônicos e todos os consumers usam os valores novos.
- [x] O teto de 500 XP por jogo continua aplicado.
- [x] Empate de artilharia premia todos; 0x0 não premia.
- [x] Hat-trick e primeiro gol cobrem ausência de minuto com fallback seguro.
- [x] Retorno cobre boundaries de 13, 14, 29 e 30 dias e cap mensal.
- [x] Primeira partida e streak mensal cobrem virada de mês BRT.
- [x] Registrador respeita mínimo, disputa e cap.
- [x] Bônus comportamentais usam timestamps server-authoritative.
- [x] Gol do goleiro e Fair Play cobrem posições e cartões.
- [x] Retry/concurrency não duplica XP, badge ou notificação.
- [x] Web e mobile exibem os novos campos sem aritmética de persistência.
- [x] Alertas respeitam preferências, deduplicação e critérios de proximidade.
- [x] Não existe reprocessamento retroativo.

## 9. Validação

- Functions: testes de constantes, finalização, retry/dedup, badges,
  notificações, lint e build.
- Shared/Android: testes dos dois calculadores, modelos/breakdown, recursos e
  compile/build.
- Web: testes de constantes, i18n, breakdown/progresso, lint e build.
- Release: validação de notas, changelog, bundles e alinhamento por plataforma.

## 10. Rollout e rollback

O rollout ocorre após merge e deploy das Functions, seguido de Hosting. Os
clientes tratam campos novos como opcionais, permitindo deploy gradual.

Rollback de Functions restaura o cálculo anterior sem apagar `xp_logs` já
gerados. Não há backfill reverso. Caso um default administrativo precise ser
revertido, a alteração deve preservar configurações customizadas e ser
registrada operacionalmente.

## Histórico

- 2026-07-19: spec criada a partir do épico #3846 e issues #3847–#3856.
- 2026-07-19: critérios validados; segurança, concorrência e contratos
  cross-platform revisados; status aprovado para release.
