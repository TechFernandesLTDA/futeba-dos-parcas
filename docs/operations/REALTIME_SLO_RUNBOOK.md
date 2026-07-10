# Realtime SLO runbook

## Contrato e retenção

Clientes enviam somente `platform`, `flow`, `phase`, `duration` e `release`
para `reportRealtimeSloMetric`. A callable exige Auth e App Check, limita 120
eventos por minuto por chave opaca e rejeita campos desconhecidos. UID, nomes,
rotas, paths, mensagens e IDs de documentos não entram nas amostras.

Cada evento cria um documento aleatório em `realtime_slo_samples`; não existe
contador compartilhado ou documento quente. `expires_at` vence após 72 horas.
Antes do rollout, habilite a política TTL desse campo no collection group
`realtime_slo_samples` pelo console ou CLI do Firestore. A configuração deve ser
verificada novamente após mudanças de projeto/ambiente.

O job `aggregateRealtimeSloMetrics` roda a cada 15 minutos e grava um rollup
imutável em `realtime_slo_rollups`. Ele correlaciona por `flow` e `release`,
calcula p50/p95/p99 e taxa de erro, e adiciona trigger lag e contagens
`ABORTED`/`RESOURCE_EXHAUSTED` somente quando esses sinais existem nos logs.

## SLOs e alertas

| Sinal | Limite por janela de 15 min |
|---|---:|
| Bootstrap p95 | 2.500 ms |
| Apply p95 | 300 ms |
| Reconnect p95 | 5.000 ms |
| Taxa de erro | 2% |
| Trigger lag p95 | 2.000 ms |
| ABORTED | 10 |
| RESOURCE_EXHAUSTED | 5 |

O arquivo `monitoring/realtime-slo-dashboard.json` é a fonte de configuração do
dashboard. Alertas devem filtrar o log estruturado `metric_type =
realtime_slo_rollup` e abrir incidente quando `violations` não estiver vazio.
Sempre separar release nova da anterior para evitar regressão mascarada.

## Budget de custo/leitura/escrita

Modelo conservador por sessão de uma hora: query de jogos com 50 documentos,
enquetes com 5 documentos, `N` membros e `N` votos no bootstrap, 24 alterações
por cliente/hora e 26 eventos elegíveis para telemetria. Sampling é estável em
5%. O limite de escrita inclui amostra, rate limit e quatro rollups por hora.

| Clientes | Reads do app/h | Reads monitoring/h | Writes monitoring/h (máx.) |
|---:|---:|---:|---:|
| 10 | 990 | 13 | 30 |
| 100 | 27.900 | 130 | 264 |
| 1.000 | 2.079.000 | 1.300 | 2.604 |

Converta essas unidades usando a tarifa vigente do projeto antes de aprovar o
rollout. O cenário de 1.000 clientes evidencia o custo quadrático do bootstrap
de membros/votos; interrompa o rollout se o budget real superar esta tabela.

## Rollout 500/50/5

1. Validar Auth, App Check, TTL, dashboard e ausência de PII no emulador/staging.
2. Liberar para no máximo **500 clientes concorrentes**, distribuídos em
   **50 grupos**, mantendo sampling em **5%** por 24 horas.
3. Comparar p95, erro, contenção e reads/writes por release a cada 15 minutos.
4. Pausar se qualquer SLO falhar por duas janelas ou o budget exceder 20%.
5. Avançar somente após 24 horas sem regressão versus a release anterior.

## Resposta a incidente

- `apply` alto: verificar volume do snapshot, render/cache e documentos grandes.
- `bootstrap` alto: verificar índices, tamanho inicial e reconexões repetidas.
- `ABORTED`: procurar contenção transacional e retries na mesma janela.
- `RESOURCE_EXHAUSTED`: pausar rollout e verificar quotas/rate limits.
- Erro isolado por release: reverter/mitigar essa release; não misturar séries.
- Cloud Logging indisponível: percentis das amostras continuam válidos, mas lag e
  códigos ficam ausentes; não interpretar zero como confirmação de saúde.
