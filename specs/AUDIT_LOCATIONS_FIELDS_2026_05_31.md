# Auditoria — Locations & Fields (Firestore prod) — 2026-05-31

Status: DIAGNÓSTICO COMPLETO. Aguardando decisões do dono antes de qualquer write em prod.

## Acesso
Diagnóstico read-only rodado contra `futebadosparcas` (Firestore prod) via SA temporário.
Scripts: `/tmp/loc-audit/{diagnose,join,parse-seed}.js`. Relatório bruto: `/tmp/loc-audit/report.json`.

## Estado geral
- **58 locations**, todas `is_active=true`.
- **Integridade estrutural OK**: `field_count` bate com fields reais em 58/58; nenhum field órfão; nenhum field duplicado em root+subcoleção; todos os fields na subcoleção `locations/{id}/fields` (root `fields/` vazio).
- Cada location tem exatamente **1 field** chamado "Quadra Principal", `hourly_price=0`.

## Descoberta central
A fonte de verdade é `app/.../data/seeding/LocationsSeed.kt` (52 entradas, Curitiba/PR).
**O prod já reflete fielmente o seed.** Onde o prod está vazio (telefone, amenities, descrição,
horário), **o seed também está vazio**. Cross-tab: 0 lacunas preenchíveis a partir do seed.
→ Não existe fonte de dados mais rica. Preços/telefones/amenities ausentes **não podem ser
inventados** sem dados do mundo real.

## Lacunas SEM fonte (precisam de dado real do dono — não dá pra fabricar)
- **Preços**: 58/58 fields com `hourly_price=0`. Nenhuma fonte tem preço (seed não tem campo de preço;
  migração Android hardcoda 100; form web e enrich script gravam 0). 0 e 100 são ambos fake.
- **Telefone**: 45 sem telefone (seed também não tem p/ esses).
- **Descrição**: 36 sem. **Amenities**: 34 sem. **Coordenadas**: 12 sem (46/58 têm). Sem `placeId`,
  sem API key Google Places no repo → sem enriquecimento automático.

## Problemas REAIS e corrigíveis (têm fonte)
### A. Tipo de quadra errado — 5 casos (BUG do enrich script)
O `enrich-all-locations-with-fields.ts` inferiu o tipo pelo NOME do local, casando a palavra
"campo" no nome da CIDADE:
- **Arena Society Campo Largo**: prod=`CAMPO` → correto `SOCIETY` (cidade Campo Largo, não é campo)
- **Arena Society Campo Magro**: prod=`CAMPO` → correto `SOCIETY` (cidade Campo Magro)
- **JB Esportes & Eventos**: prod=`SOCIETY` → seed tem Futsal+Society
- **Arena Alto da XV**: prod=`SOCIETY` → seed tem Society+Futsal
- **Centro Esportivo Mendes**: prod=`SOCIETY` → seed tem Society+Futsal

### B. Contagem de quadras achatada — 19 locais
O enrich colapsou locais multi-quadra para 1 field. Seed documenta mais:
JB 8→1, Goleadores 7→1, Top Sports 6→1, Brasil Soccer 5→1, Premium 4→1, Copacabana 3→1,
Meia Alta 3→1, Baldan/Duga/Tarumã/Alto XV 2→1, etc. (Decisão de produto — todos ainda seriam preço 0.)

### C. Dados de TESTE em prod — 5 locais
IDs hardcoded `loc_*`, donos `seed*`, cidade **São Paulo** (todas as reais são Curitiba/PR):
- `loc_arena_fernandes` "Arena Fernandes" (SP, owner LmclkYX...)
- `loc_arena_leste` "Arena Leste" (SP, owner seed059...)
- `loc_arena_sul` "Arena Sul" (SP, owner seed004...)
- `loc_gramado_real` "Gramado Real" (SP, owner seed025...)
- `loc_vila_futebol` "Vila Futebol Clube" (SP, owner seed065...)
Provável fixture de teste vazada pra prod. (+ "Area Fernandes" Curitiba, owner real, `is_verified=false`
— possível typo de "Arena", ou local real de usuário.)

## Fluxo de criação de jogo (web/Android)
Lógica OK pós-#2438: carrega sub+root, faz merge dedup, e quando há 1 field auto-seleciona e
copia `hourlyPrice`→custo do jogo. **Sintoma real**: como todo field é preço 0, o custo do jogo
auto-preenche **R$0**. Não é bug de display — é o dado (preço) que não existe.
Gap de código: o **form web de criar local não tem campo de preço** (`LocationFormScreen.tsx:293`
grava `hourly_price:0` fixo).

## Verificação de CORRETUDE (não só preenchimento)
- Diff prod×seed em 52 locais matched (cep/rua/número/bairro/cidade/UF/telefone/horário):
  **0 divergências** — todo valor presente no prod bate exatamente com o seed. Endereços/nomes
  já existentes estão **corretos**.
- Games referenciando os 5 locais de teste SP: **0 games** cada → remoção é segura.
- "Area Fernandes" (gWXeh..., owner real): **2 games** referenciam → local REAL em uso, manter.
  Único ponto: nome "Area" pode ser typo de "Arena".

## EXECUTADO (aprovado pelo dono 2026-05-31)
### 1. Tipos de quadra — 5 corrigidos
Campo Largo/Campo Magro CAMPO→SOCIETY (bug city-name match); JB/Alto XV/Mendes →FUTSAL (seed).
### 2. Dados de teste — 5 deletados
`loc_arena_fernandes`, `loc_arena_leste`, `loc_arena_sul`, `loc_gramado_real`, `loc_vila_futebol`
(SP, donos seed*, 0 games). Prod: 58→53 locations.
### 3. Enriquecimento por pesquisa web — 9 agentes, 53 venues, dados com fonte+confiança
17 locais enriquecidos (só campos VAZIOS, additive, nunca sobrescreve). Sem regressão (0 perdas).
- **Contagem real de quadras** (11): JB 1→8, Apollo 1→9, Top Sports 1→7, Brasil 1→3, Premium/Amigos
  da Bola/Baldan/Eco/Duga/Camisa 9 1→2, Meia Praia 2→4. field_count consistente (drift=0).
- website 10, instagram 7, operating_days 7, phone 5, amenities 4, horário 3, coords 0.
- **Preço: 0 encontrados** — confirmado que preço/hora NÃO é público (reserva via WhatsApp).
  Todos os fields seguem `hourly_price=0`. Não há fonte para fabricar.
- Cobertura pós: phone 18/53, instagram 16/53, amenities 23/53.

### Verificação create-game (data layer)
Replicada a query exata do CreateGameScreen (sub+root merge, ativos): lista 53/53 locais ativos;
JB mostra 8 quadras, Apollo 9, Eco 2. ⚠️ NÃO verificado em runtime UI (auth/grupo) — só data layer.

## SEGUNDA RODADA (aprovado "completar tudo" 2026-06-01)
Re-pesquisa profunda (7 agentes) dos 37 venues não-encontrados/endereço-errado → 6 real, 26
placeholder, 4 incerto.
- **6 endereços corrigidos** (seed estava errado, real confirmado c/ fonte): Meia Praia (R. Durval
  Jungles 98, Pinheirinho), Centro Esportivo Mendes (R. Uganda 43, Pineville/Pinhais), Tijucas do Sul
  (R. da Raia 49), Arena Ceschin (R. Rio Piraquara 350, Weissópolis/Pinhais), Baldan (R. Pôrto Rico 487,
  Sítio Cercado), Meia Alta (R. Affife Mansur 698, Novo Mundo) +ig/coords/phone onde achado.
- **16 placeholders DESATIVADOS** (is_active=false, REVERSÍVEL): template "Arena Society [Município]"
  (Campina Grande do Sul, Cerro Azul, Campo Magro, Rio Branco do Sul, Araucária, Fazenda Rio Grande,
  Adrianópolis, Piên, São José dos Pinhais, Quatro Barras, Balsa Nova, Campo Largo, Doutor Ulysses,
  Colombo, Itaperuçu, Contenda) — nome genérico + endereço de número redondo + CEP final 000 +
  ZERO presença web em 2 rodadas + 0 games.
- **NÃO mexidos** (presença web ausente ≠ falso; mantidos ativos p/ revisão humana): bairros de Curitiba
  com nome específico (Arena Bairro Alto, Santa Quitéria, Xaxim, Hauer, Orleans, Quadra Society
  Cajuru/Sta Cândida/Barreirinha, Alto da XV) + incertos (Tatuquara, Piraquara, Tarumã, Mandirituba).
  ⚠️ "Area Fernandes" foi flagado placeholder PORÉM é REAL (2 games, dono real) — prova de falso-positivo
  do heurístico → por isso NÃO deletei em massa.

## ESTADO FINAL EM PROD
53 locations total | **37 ativos** (aparecem no criar-jogo) | 16 desativados (filler) | drift=0 |
11 venues multi-quadra | phone 18 | instagram 17 | amenities 23 | coords 41. Preço: 0 (sem fonte pública).

## CÓDIGO PENDENTE (follow-up task — não no escopo de dados, evita regressão)
1. `LocationsSeed.kt`: remover os 16 entries fabricados + corrigir os 5 endereços errados (senão uma
   migração manual futura recria/sobrescreve). Lista exata acima.
2. `web/.../LocationFormScreen.tsx`: adicionar input de preço/hora por quadra (hoje grava 0 fixo);
   paridade Android no FieldDialog. Spec própria.

## PENDENTE DE DECISÃO DO DONO

### Correções de ENDEREÇO (research achou divergência vs seed — NÃO aplicado, overwrite arriscado)
- **Arena Ceschin Fut7**: seed "Rua Europa 800, Centro, Pinhais" → real **Rua Rio Piraquara 350/370,
  Weissópolis, Pinhais** (site oficial).
- **Baldan Sports Futsal**: seed "Izaac Ferreira da Cruz" → real **R. Porto Rico 487, Sítio Cercado** (diretórios).
- **Centro Esportivo Mendes**: → real **R. Líbia 161-283, Pineville, Pinhais** (CNPJ 04.023.155/0001-02).
- **Meia Praia Sport Bar**: → real **R. Durval Jungles 98, Pinheirinho, CEP 81870-340** (site oficial).
- **Meia Alta Society**: divergência CIC vs outro endereço — incerto, precisa confirmação.
(Aplicar exige endereço estruturado completo + novas coords. Confirmar antes.)

### ~33 venues SEM presença online (possível placeholder do seed — NÃO deletado)
Maioria "Arena Society [Cidade]" com nomes genéricos, números redondos e CEPs genéricos (final 000)
em municípios da RMC. Ausência de presença web ≠ prova de inexistência (venues pequenos podem não
ter web). Decisão do dono: manter / desativar / investigar caso a caso. Lista completa em
`/tmp/loc-audit/aggregate.js` output (NOT FOUND ONLINE).

### Gap de código (não tocado — fora do escopo de dados)
`web/.../LocationFormScreen.tsx:293` grava `hourly_price:0` fixo — o form de criar local não tem
campo de preço. E create-game auto-preenche custo R$0 quando o field tem preço 0 (engana o usuário).
Sugerido: spec própria para (a) input de preço no form, (b) não auto-preencher R$0.
