# Datasets de quadras (epic #4186)

Datasets curados para o importador `import-venues-dataset.ts`. Tudo entra no app como
`publication_status: DRAFT`, `is_verified: false`, dono `system-venue-import`.

| Arquivo | Rodada | Escopo | Venues |
|---|---|---|---|
| `venues-curitiba.json` | R1/R2 | Curitiba | 27 |
| `venues-rmc.json` | R3 (#4194) | São José dos Pinhais 6, Pinhais 7, Almirante Tamandaré 5, Campo Largo 7, Araucária 7, Colombo 8, Fazenda Rio Grande 3, Piraquara 2 | 45 |
| `venues-londrina.json` | R4 (#4195) | Londrina | 7 |
| `venues-porto-alegre.json` | R5 (#4195) | Porto Alegre | 9 |
| `venues-sao-paulo.json` | R6 (#4195) | São Paulo (capital) | 12 |
| `venues-florianopolis.json` | R7 (#4195), revisada em 08/10 | Florianópolis (fichas do Maps + site oficial) | 4 |
| `venues-joinville.json` | R8 (#4195) | Joinville | 13 |
| `venues-enriquecimento-r9.json` | R9 (#4195) | enriquecimento não destrutivo (`modo: enriquecimento`, `location_id` exato) de venues já importados | 33 |
| `venues-goiania.json` | R9 (coletor de cidades novas, #4186) | Goiânia | 5 |
| `venues-rio-de-janeiro.json` | R9 (coletor de cidades novas, #4186) | Rio de Janeiro (capital) | 4 |
| `venues-recife.json` | R9 (coletor de cidades novas, #4186, execução 8) | Recife | 5 |

## Regras dos dados

- Só dado público verificável. Telefone, preço, endereço e horário ausentes na fonte ficam `null`
  (`preco_hora` é `null` em todos os itens: nenhuma fonte publicou preço).
- Todo item tem ≥ 1 fonte com URL (`fontes[]`) descrevendo o dado extraído. `coordenadas` só existem
  quando vêm de um elemento OSM compatível ou de geocodificação com rua, número e município conferidos.
- `confidence`: `média` = 2+ fontes ou texto explícito de locação; `baixa` = uma única ficha de diretório.
  `finalidade`: `comercial_aluguel` (texto explícito) ou `comercial_indicado` (diretório de aluguel/campos).
- Candidatos só-OSM (clubes, praças, campos sem endereço/telefone) NÃO são importados: ficam em
  `osm-candidates/` (gerados por `build-venues-osm.mjs`) para cruzamento futuro.

## Validação

```bash
node scripts/data/validate-venues-dataset.js                          # datasets curados
node scripts/data/validate-venues-dataset.js scripts/data/osm-candidates/*.json
node --test scripts/data/validate-venues-dataset.test.js
```

Teste de idempotência contra o emulador (projeto `demo-*`, nunca produção):

```bash
firebase emulators:start --only firestore --project demo-venues-test      # porta 8099 no firebase.json de teste
FIRESTORE_EMULATOR_HOST=127.0.0.1:8099 VENUES_PROJECT_ID=demo-venues-test \
NODE_PATH=functions/node_modules VENUES_TEST_DATASETS=scripts/data/venues-rmc.json \
node scripts/data/test-venues-emulator.mjs
```

## Ordem de execução em produção (coordenador)

1. `repair-venues-snake-case.ts --plan-out reports/venues-repair-plan.json` (dry-run) → revisar → `--execute`.
   **Antes** de qualquer importação: o patch do importador lê as chaves snake_case e, sobre docs ainda
   camelCase, criaria chaves duplicadas divergentes.
2. Dry-run de cada dataset (`--dataset scripts/data/venues-<x>.json`), revisar `⚠ revisão manual`
   (inclui venues existentes reconhecidos por endereço/nome parecido).
3. `--execute --owner-uid system-venue-import` (idempotente: dedupe por cidade+nome, cidade+rua+número
   e nome contido no outro).

## Correção de números (#4193)

Leitura somente-leitura de produção em 07/10/2026: 27 locations importadas (25 camelCase DRAFT +
2 pré-existentes snake_case SUSPENDED) e **31** field docs sob elas — o corpo do PR #4206 dizia 37.

## Rodada R9: enriquecimento e revisão manual (08/10/2026)

- `venues-florianopolis.json` foi refeito: 7 itens de diretório → 4 confirmados (Estação da Bola com site oficial WebQuadras,
  Categeró, Floripa Society e Maria Chuteira com ficha do Maps). Removidos: Arena Futebol Indoor (Maps: permanentemente
  fechado) e Floripa Soccer, Show de Bola e Zingabool (endereço/telefone da ficha divergem do diretório).
- `venues-enriquecimento-r9.json` é gerado por `enrichment/build-venues-enrichment.py` a partir do snapshot de produção
  (`snapshot-venues.js`), das fichas do Google Maps (`enrichment/maps-evidence-r9.jsonl`), dos datasets curados e de páginas
  oficiais citadas em `fontes[]`. Aplicação: `import-venues-dataset.ts --dataset scripts/data/venues-enriquecimento-r9.json`
  (patch only; sem criar locations). O patch **só preenche vazios** (ou o horário padrão 08:00-23:59 do importador), acrescenta
  fontes sem apagar as existentes, cria as quadras que faltam e atualiza `field_count`/`has_active_fields`.
  Situação `permanentemente_fechado`/`temporariamente_fechado` da ficha do Maps vai para `external_data.operational_status`;
  tabelas de preço sem unidade explícita vão para `external_data.price_table` (nunca para `hourly_price`).
- Quantidade de quadras só entra com número explícito na fonte; descrição no singular vale 1 (mínimo) e está marcada no detalhe.
- Revisão manual: `resolve-venues-manual-review.ts` (RMC: Camisa 9 e Cancha do Corinthians, resolvidas pela fonte) e
  `repair-venues-snake-case.ts --only <ids> --include-divergent --backup-out` (as 2 legadas: snake_case é a verdade; backup em
  `enrichment/venues-legacy-backup.json`). O repair agora também converte `fullAddress`, `fieldTypeInferred` e `gpsInferred`.
- Verificação somente-leitura: `verify-venues-production.js` (relatório de 08/10 em `enrichment/venues-prod-verification-2026-10-08.json`).
