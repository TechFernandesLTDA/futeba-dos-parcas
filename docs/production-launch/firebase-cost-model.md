# Modelo de Custos Firebase - #3310

Objetivo: estimar custo para lançamento público e apontar os principais vetores
de gasto antes de escalar para 100, 1.000 e 10.000 usuários ativos.

Valores unitários devem ser revisados no Google Cloud Pricing Calculator antes
do go-live. As fórmulas abaixo servem para planejamento e alerta, não para
faturamento contábil.

## Assunções de uso mensal

| Métrica por usuário ativo/mês | Cenário base |
| --- | ---: |
| Sessões | 12 |
| Telas com leitura/listener | 8 por sessão |
| Reads por sessão | 120 |
| Writes por sessão | 12 |
| Deletes por sessão | 1 |
| Invocações Functions | 20 |
| Uploads de mídia | 0,3 |
| Tamanho médio por mídia | 1,5 MB original + thumbnail |
| Hosting transfer | 20 MB |

## Fórmulas

| Serviço | Fórmula |
| --- | --- |
| Firestore reads | `usuários * sessões * reads_por_sessão` |
| Firestore writes | `usuários * sessões * writes_por_sessão` |
| Firestore deletes | `usuários * sessões * deletes_por_sessão` |
| Functions invocations | `usuários * invocações_por_usuário_mês` |
| Storage GB adicionados | `usuários * uploads_por_usuário * MB_por_upload / 1024` |
| Hosting transfer GB | `usuários * MB_transfer_por_usuário / 1024` |
| Custo estimado | `uso_billable * preço_unitário_do_serviço` |

## Estimativa de volume mensal

| Usuários ativos | Reads | Writes | Deletes | Functions | Storage novo | Hosting transfer |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 144.000 | 14.400 | 1.200 | 2.000 | 44 MB | 2 GB |
| 1.000 | 1.440.000 | 144.000 | 12.000 | 20.000 | 439 MB | 20 GB |
| 10.000 | 14.400.000 | 1.440.000 | 120.000 | 200.000 | 4,4 GB | 195 GB |

## Queries/telas com maior risco

| Área | Risco de custo | Mitigação |
| --- | --- | --- |
| Home/próximo jogo | Listener amplo por usuário ativo | Limitar filtros, paginar e evitar refetch em foco excessivo. |
| Listagem de jogos públicos | Muitos reads em exploração anônima/logada | Paginação, filtros por data/local e cache client-side. |
| Detalhe do jogo | Confirmações, comentários, chat, mídia e eventos ao vivo | Separar listeners, limitar subcoleções e carregar abas sob demanda. |
| Grupos | Membros, convites e mural | Chunk em `whereIn` até 10, paginação e listener apenas no grupo aberto. |
| Rankings/gamificação | Leituras agregadas e XP logs | Preferir agregados persistidos e limpeza TTL. |
| Admin/revisão | Listas amplas | Acesso restrito, paginação e filtros obrigatórios. |

## Functions de maior volume

| Função/fluxo | Vetor de volume | Atenção |
| --- | --- | --- |
| Criação/atualização de jogo | Pico por organizadores | Evitar writes duplicados e retries sem idempotência. |
| Confirmação de presença | Pico próximo ao horário do jogo | Monitorar writes e notificações derivadas. |
| Gamificação/XP | Pós-finalização de partida | Transações atômicas e logs enxutos. |
| Exclusão de conta | Baixo volume, alto impacto | Logs sem PII e validação de cleanup. |
| Cleanup TTL | Agendado | Batches de 500 e custo previsível. |
| Notificações | Dependente de grupos grandes | Medir fan-out e limitar reenvios. |

## Storage

Pontos de atenção:

- Fotos de perfil, fotos de grupo, fotos/vídeos de jogo e recibos de quadras
  devem ter limite de tamanho no cliente e no backend/regras.
- Thumbnail reduz custo de download, mas dobra número de objetos.
- Definir retenção para mídia órfã quando upload falha após criar documento.
- Monitorar storage por prefixo: `profile_photos/`, `group_photos/`,
  `game_photos/`, `game_videos/`, `thumbnails/`.

## Budgets e limites

Configuração inicial recomendada:

- Budget diário: USD 10 com alertas 50%, 80%, 100%, 120%.
- Budget semanal: USD 50 com alertas 50%, 80%, 100%, 120%.
- Budget mensal: USD 200 com alertas 50%, 75%, 90%, 100%, 110%.

Playbook quando bater 80%:

1. Abrir incidente S1 se o consumo estiver fora de campanha/beta.
2. Ver custo por serviço no Billing.
3. Comparar reads/writes com baseline dos últimos 7 dias.
4. Identificar tela/função por logs e Analytics.
5. Desativar campanha, limitar feature ou aplicar hotfix se houver loop.
6. Registrar causa, impacto financeiro estimado e ação preventiva.
