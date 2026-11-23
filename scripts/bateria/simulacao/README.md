# Simulação de uso

Contas de teste do emulador agem como pessoas num grupo de pelada por várias
semanas comprimidas. Elas criam grupos, convidam, aceitam, criam jogos,
confirmam, fazem check-in, marcam gols, votam, usam o caixa, o mural, o chat,
as enquetes e as caronas. Toda ação declara o resultado esperado. A cada
semana, um conferidor lê o banco e compara contagens de membros, vagas, XP,
estatísticas e MVP com o que deveria haver.

Roda só no emulador local (projeto `demo-futebadosparcas`). Nada vai para
produção.

## Arquivos

| Arquivo | O que faz |
|---|---|
| `nucleo.ts` | Sorteio reproduzível, registro em JSONL, login de cada pessoa no SDK cliente, `agir()` com o resultado esperado |
| `simular.ts` | Grupos, perfis e o roteiro semanal. Grava `<saida>.jsonl` e `<saida>.ids.json` |
| `invariantes.ts` | Conferências com o Admin SDK (só leitura) |
| `sonda-saida.ts` | Reproduz isoladamente a saída e a remoção de membro do grupo |
| `agregar.py` | Agrupa os achados de um JSONL e mostra a cobertura por ação |
| `formatos-do-web.md` | Formato de cada gravação do web, levantado de `web/src`, que o simulador imita |
| `../../../web/e2e-sim/tour.spec.ts` | Passada visual: abre 17 telas como 3 perfis e guarda captura, texto e erros |

## Como rodar

1. Suba os emuladores da bateria (Auth 19099, Firestore 18085, Functions 15001):

   ```bash
   scripts/bateria/rodar.sh subir
   ```

2. Rode a simulação. `--semanas` define a duração (cerca de 1 min por semana de
   grupo, com os grupos em paralelo). `--grupos` limita a alguns grupos,
   `--max` força a lotação dos jogos e `--semente` muda o sorteio:

   ```bash
   NODE_PATH=functions/node_modules:web/node_modules \
   FIRESTORE_EMULATOR_HOST=127.0.0.1:18085 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:19099 \
   FUNCTIONS_EMULATOR_HOST=127.0.0.1:15001 GCLOUD_PROJECT=demo-futebadosparcas \
   web/node_modules/.bin/tsx scripts/bateria/simulacao/simular.ts --semanas 13 \
     --saida scripts/bateria/simulacao/saida/sim.jsonl
   ```

3. Agrupe os achados:

   ```bash
   python3 scripts/bateria/simulacao/agregar.py scripts/bateria/simulacao/saida/sim.jsonl
   ```

4. Passada visual no web, com o mesmo emulador e os ids da simulação:

   ```bash
   cd web && SIM_IDS=../scripts/bateria/simulacao/saida/sim.ids.json \
     SIM_TOUR_SAIDA=../scripts/bateria/simulacao/saida/tour \
     npx playwright test -c playwright.sim.config.ts
   ```

A pasta `saida/` é ignorada pelo git.

## Como ler o resultado

- `achado: true` quer dizer resultado diferente do esperado ou invariante
  quebrado.
- `ritmo: true` é o limitador de chamadas reagindo à simulação acelerada. O
  núcleo espera e tenta de novo, e isso não conta como achado.
- Os invariantes são conferidos toda semana, então o mesmo problema aparece
  uma vez por semana. Conte jogos ou pessoas distintas, não linhas.
- Jogos com menos de 6 confirmados não dão XP de participação, por regra
  (`functions/src/xp/on-game-status-update.ts`). Por isso aparecem em
  `xp_jogo` e `estatisticas_jogos`.

## O que não é coberto

O relógio é real e comprimido: cada jogo nasce no futuro e o Admin SDK traz o
horário para perto de agora. Ficam de fora a virada de temporada no dia 1, as
sequências entre dias reais, os lembretes e as tarefas agendadas, e as telas
do Android e do iOS. Os apps nativos passam pelas mesmas regras e funções.
