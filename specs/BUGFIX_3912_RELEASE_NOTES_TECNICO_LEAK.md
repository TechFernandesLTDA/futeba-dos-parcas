# BUGFIX #3912 — Seção "Técnico" vaza para a UI do usuário e a crase aparece literal

| Campo | Valor |
|---|---|
| **Issue** | #3912 |
| **Status** | APPROVED |
| **Tipo** | Bugfix |
| **Camadas** | `scripts/release-notes.js` (pipeline) + arquivos-fonte `release-notes/**` + bundles gerados |
| **Spec violada** | `specs/feat-2026-05-22-version-control-release-notes.md` L134 e L257-258 |
| **Relacionadas** | #3876 (PR #3888, `**` na web), #3898 (PR #3907, `**` em Kotlin) |

## 1. Problema

São **dois defeitos distintos** com uma causa comum: nada no pipeline separa o que é
conteúdo de desenvolvedor do que é conteúdo de usuário, nem verifica se o texto que chega
à tela usa alguma marcação que os renderizadores entendam.

### Defeito 1 — a subseção `### Fixed` do bloco `## Técnico` é concatenada na lista "Correções" da UI

`scripts/release-notes.js:326`, em `toClientNote()`:

```js
fixed: uniqueNonEmpty([...(user.Correções || []), ...(tech.Fixed || [])]),
```

A spec aprovada é explícita nos dois pontos:

> **L134:** "O conteúdo técnico e os números de issue **não** aparecem na UI do usuário
> (ficam no `CHANGELOG.md` e no campo `technicalSummary`/`issueRefs` do documento)."
>
> **L257-258:** "a seção **'Para o usuário'** é PT-BR amigável e alimenta o Firestore/UI;
> a seção **'Técnico'** alimenta o `CHANGELOG.md`."

`toClientNote()` é o transform **único**: alimenta `buildBundlePayload()` (o JSON
embarcado nas 3 plataformas, L331-341) e o payload de `publish` do Firestore (L530-531).
O vazamento atinge o caminho online e o offline ao mesmo tempo.

Que é descuido e não intenção fica claro em `cmdPublish()`: o payload do Firestore **já
tem** um campo `technicalSummary` (L534, montado de todas as 6 subseções técnicas). O
conteúdo técnico é entregue duas vezes — e uma das entregas é a UI do usuário.

Só `tech.Fixed` vaza. `Added`, `Changed`, `Deprecated`, `Removed` e `Security` já respeitam
a separação: não são lidos por `toClientNote()`.

### Defeito 2 — `` `código` `` chega literal à tela

Os quatro renderizadores implementam **um** token — `**negrito**`:
`web/src/utils/markdownLite.ts` (`BOLD_PATTERN`) e
`shared/src/commonMain/kotlin/com/futebadosparcas/domain/markdown/MarkdownLite.kt`
(consumido por `:app` e `:composeApp`). Acento grave não é marcação para eles: passa como
caractere comum e aparece na tela.

### Por que recorre — a parte que importa

`validateNote()` (L204-251) valida `platform`, `version`, semver, `type`, `showPopup`,
`date`, `buildNumber`, `issues`/`prs`, `milestone`, a presença das duas seções e os nomes
das subseções. **Não valida uma única coisa sobre o texto dos itens.** Sem esse portão,
todo token que os renderizadores não implementam chega ao usuário em silêncio — foi `**`
duas vezes (#3876, #3898), agora é `` ` ``.

### Alcance real (medido, não estimado)

Contagem sobre os **assets buildados** (só campos renderizados: `headline`, `highlights`,
`added`, `improved`, `fixed`), no HEAD `c1c5d55e`:

| Plataforma | Asset | Itens com crase | Notas afetadas | Com `published + showPopup` |
|---|---|---|---|---|
| web | `web/public/release-notes.json` | **208** | 88/168 | 64 |
| android | `app/src/main/assets/release-notes.json` | **19** | 9/22 | 7 |
| iOS | `iosApp/iosApp/release-notes.json` | **0** | 0/5 | 0 — **latente** |

Distribuição por campo na web: `fixed` 196, `improved` 9, `added` 2, `headline` 1.
No Android: `fixed` 18, `added` 1.

#### Correção ao número da issue — o residual é 37, não ~12

A issue estima que, depois de estancar o vazamento, "os ~12 itens restantes com `` ` `` em
campos genuinamente de usuário (`improved` 9, `added` 2, `headline` 1)" precisariam de
reescrita. **Está subestimado**, e o motivo é estrutural: `fixed` é a **união** de
`user.Correções` com `tech.Fixed`. Remover `tech.Fixed` não zera `fixed` — sobram os itens
de `Correções` que já usavam crase.

Contagem sobre os **arquivos-fonte**, apenas em subseções de `## Para o usuário`:

| Plataforma | Headline | Novidades | Melhorias | Correções | **Total** | Arquivos |
|---|---|---|---|---|---|---|
| web | 1 | 2 | 9 | 21 | **33** | 20 |
| android | 0 | 1 | 0 | 3 | **4** | 4 |
| iOS | 0 | 0 | 0 | 0 | **0** | 0 |
| functions | 0 | 2 | 1 | 9 | **12** | 10 |

Ou seja:

- O fix do vazamento remove **190** itens de jargão puro da UI (175 web + 15 android) —
  **91,4%** dos 208+19 itens com crase.
- Restam **37** itens com crase em plataformas com renderizador (33 web + 4 android),
  escritos em subseções de usuário. É esse o volume de reescrita textual real, não 12.
- O total de itens removidos de `fixed` é maior que 190: `tech.Fixed` tem 260 itens na web,
  36 no android e 3 no iOS (com ou sem crase). Todos saem da UI e continuam no
  `CHANGELOG.md`.

## 2. Decisões de design

### D1 — `fixed` passa a ler só `user.Correções`

`scripts/release-notes.js:326` vira:

```js
fixed: uniqueNonEmpty(user.Correções || []),
```

Mantido o `uniqueNonEmpty()` de propósito: ele também remove vazios e duplicatas dentro da
própria lista do usuário. Trocar por `user.Correções || []` (como a issue sugere) mudaria
silenciosamente a forma da saída além do escopo do vazamento.

O conteúdo técnico continua chegando aos três destinos previstos pela spec: `CHANGELOG.md`
(via `buildAutogen()`, que lê só `SECTION_TECH`), `technicalSummary` no Firestore (L534) e
as GitHub Releases.

### D2 — Portão de marcação em `validateNote()`, restrito às subseções de usuário

Nova checagem: qualquer item de `## Para o usuário` que use marcação **não implementada
pelos renderizadores** vira erro de validação. `node scripts/release-notes.js validate` roda
em `release.yml:235`, antes do `publish` — o CI barra a nota antes de ela chegar ao usuário.

Três restrições que o portão respeita:

1. **Só `## Para o usuário`.** O bloco `## Técnico` usa crase legitimamente e alimenta o
   `CHANGELOG.md`, que é renderizado pelo GitHub como Markdown completo. Não é tocado.
2. **`**negrito**` é liberado.** É o token que o #3876/#3898 acabaram de implementar nas
   quatro superfícies. O portão remove os trechos `\*\*(.+?)\*\*` **antes** de testar o
   resto, senão rejeitaria o recurso recém-entregue.
3. **Tokens gateados:** crase, link `[texto](url)`, cabeçalho `#` e tachado `~~`. Deixei
   `_ênfase_` **de fora** de propósito: é o único da lista com risco real de falso positivo
   em prosa PT-BR que cite `snake_case`, e tem **zero** ocorrências hoje. Gatear os outros
   quatro custa zero reescrita além da crase (medido: 0 ocorrências de link, `#` e `~~` em
   seções de usuário).

### D3 — Por que **não** estender o `MarkdownLite` para renderizar crase

Esta é a decisão que um revisor primado pelo #3898 vai questionar, então fica explícita.
O #3898 escolheu **implementar** `**` em vez de gateá-lo (D3 daquela spec). Aqui a escolha
é a inversa, e por dois motivos que não se aplicavam lá:

- **`**` é ênfase de usuário; `` ` `` é sintoma de vazamento.** Em 196 dos 208 itens da web,
  a crase marca um símbolo de código que a spec proíbe na UI. Renderizar
  `` `LiveEventsScreen` `` com fonte monoespaçada deixaria o texto bonito e continuaria
  violando a L134 — o usuário segue lendo o nome de uma classe interna.
- **Com o portão de D2, o suporte seria código morto no dia 1.** Nenhuma crase passa a
  validação; um parser que a entendesse nunca receberia uma.

Portanto: **nenhum `.kt` e nenhum arquivo de `web/src` é tocado neste PR.** A alternativa é
a que a própria issue registra como considerada e não recomendada.

### D4 — `functions` fica fora do portão

`functions` é a única plataforma em `PLATFORMS` que não está em `CLIENT_PLATFORMS`. Suas
seções de usuário não chegam a renderizador nenhum:

- `cmdBundle()` (L457) itera `CLIENT_PLATFORMS` — não gera bundle para `functions`;
- `cmdPublish()` (L475-477) rejeita explicitamente plataforma fora de `CLIENT_PLATFORMS`;
- `buildAutogen()` inclui `functions` no `CHANGELOG.md`, mas lendo **só** `SECTION_TECH`.

A justificativa do portão é "marcação não suportada **pelos renderizadores**". Onde não há
renderizador, não há defeito. Gatear `functions` custaria reescrever 12 itens de prosa que
não são exibidos em lugar nenhum, sem ganho. O portão usa `CLIENT_PLATFORMS`.

### D5 — Reescrita dos 37 itens residuais nos arquivos-fonte

Sem isso o portão de D2 deixa `validate` vermelho e a próxima release quebra. As reescritas
são de duas naturezas:

- **Tirar a crase** quando o valor citado é compreensível para o usuário:
  "usar `` `0` `` em jogos sem cobrança" → "usar 0 em jogos sem cobrança".
- **Reescrever o jargão** quando a crase escondia um símbolo interno:
  "`` `NotificationSettingsScreen` `` agora permite silenciar…" → "As configurações de
  notificação agora permitem silenciar…".

### D6 — Regeneração obrigatória dos bundles

`validateBundleTargets()` (L343-375) compara os JSONs commitados byte a byte com o
`buildBundlePayload()` recalculado. Mudar `toClientNote()` deixa os quatro arquivos de
bundle fora de sincronia e `validate` vermelho. `node scripts/release-notes.js bundle` faz
parte da correção, não é passo opcional — e **nenhum check de PR detecta isso**, porque
`validate` só roda em `release.yml`.

## 3. Mudanças

| Arquivo | Mudança |
|---|---|
| `scripts/release-notes.js` | `toClientNote()`: `fixed` deixa de concatenar `tech.Fixed` (D1); `validateNote()`: novo portão `validateUserMarkup()` (D2/D4) |
| `scripts/release-notes.test.js` | 2 testes existentes de `toClientNote` **atualizados** para o novo contrato + 5 testes novos do portão |
| `release-notes/web/*.md` (20 arquivos) | 33 itens de seções de usuário reescritos sem crase (D5) |
| `release-notes/android/*.md` (4 arquivos) | 4 itens reescritos sem crase (D5) |
| `web/public/release-notes.json` | Regerado (D6) |
| `app/src/main/assets/release-notes.json` | Regerado (D6) |
| `composeApp/src/commonMain/composeResources/files/release-notes.json` | Regerado (D6) |
| `iosApp/iosApp/release-notes.json` | Regerado (D6) |
| `release-notes/README.md` | Documenta a regra de marcação nas seções de usuário |

Nenhum arquivo `.kt`, nenhum arquivo em `web/src/`, nenhum arquivo em `functions/`.

## 4. Critérios de aceite

- [x] `toClientNote().fixed` contém apenas itens de `### Correções`
- [x] `node scripts/release-notes.js validate` verde — `OK — 260 arquivo(s)`
      (antes das reescritas: 41 erros = 37 marcação + 4 bundles fora de sincronia)
- [x] `node scripts/release-notes.js validate` rejeita uma nota de cliente com crase em
      seção de usuário, e **não** rejeita a mesma crase em `## Técnico`
- [x] `**negrito**` continua aceito nas seções de usuário
- [x] `npm run test:scripts` verde — 116/116 (114 antes + 8 novos − 6 substituídos)
- [x] `node scripts/release-notes.js changelog` produz **zero diff** — prova que o bloco
      `## Técnico` continua íntegro no `CHANGELOG.md`
- [x] Zero crases nos campos renderizados dos quatro bundles (208/19/0/0 → 0/0/0/0)
- [x] `node scripts/release-notes.js bundle` é idempotente após o commit

## 5. Não coberto

- **`functions`**: 12 itens com crase em seções de usuário permanecem (D4) — não são
  exibidos em nenhuma superfície.
- **`_ênfase_` não é gateada** (D2, item 3): zero ocorrências e risco de falso positivo em
  prosa que cite `snake_case`.
- **Renderização de crase**: deliberadamente não implementada (D3). Os quatro
  renderizadores seguem entendendo só `**negrito**`.
- **Documentos já publicados no Firestore** (`release_notes/{platform}_{version}`): este PR
  corrige o pipeline e os bundles embarcados. Os docs já gravados só são atualizados no
  próximo `publish` de cada versão. O caminho online continua servindo o `fixed` antigo até
  lá — os bundles offline, não.
- **Verificação visual** em `/whats-new` e no pop-up: a cobertura aqui é validação do
  pipeline + inspeção programática dos JSONs gerados, não navegação em navegador/aparelho.
- **Testes de `functions/`, Gradle e web**: nada nesses módulos foi tocado, então não há
  linhas novas para cobrir nem código para compilar.
