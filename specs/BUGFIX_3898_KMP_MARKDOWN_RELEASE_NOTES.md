# BUGFIX #3898 — Notas de versão exibem Markdown literal no Android e no iOS

| Campo | Valor |
|---|---|
| **Issue** | #3898 |
| **Status** | APPROVED |
| **Tipo** | Bugfix |
| **Camadas** | `:shared` (parser) + `:app` (UI Android) + `:composeApp` (UI iOS/CMP) |
| **Origem** | Fix incompleto do #3876 (PR #3888, commit `f3785afb`) |

## 1. Problema

O #3876 documentou que **os três** renderizadores de notas de versão jogavam a
string crua na tela, mostrando os asteriscos de `**negrito**` ao usuário. O PR
#3888 corrigiu **só a web**, criando `web/src/utils/markdownLite.ts` e aplicando
o componente `FormattedText`. Os dois renderizadores Kotlin ficaram como estavam.

`grep -rn 'buildAnnotatedString|SpanStyle|FontWeight.Bold'` nos dois pacotes
`ui/whatsnew` retorna **zero** ocorrências. São **10** pontos de render — a
issue diz 8 porque duas linhas da tabela dela agrupam dois pontos cada
(`highlight.title` / `highlight.description`):

| Módulo | Arquivo | Linha | Render |
|---|---|---|---|
| `:app` | `ui/whatsnew/WhatsNewContent.kt` | 152 | `text = highlight.title` |
| `:app` | `ui/whatsnew/WhatsNewContent.kt` | 158 | `text = highlight.description` |
| `:app` | `ui/whatsnew/WhatsNewContent.kt` | 202 | `text = item` (itens de seção) |
| `:app` | `ui/whatsnew/WhatsNewContent.kt` | 230 | `text = note.headline` |
| `:app` | `ui/whatsnew/WhatsNewBottomSheet.kt` | 84 | `text = note.headline.ifBlank { … }` |
| `:composeApp` | `ui/whatsnew/WhatsNewContent.kt` | 174 | `text = highlight.title` |
| `:composeApp` | `ui/whatsnew/WhatsNewContent.kt` | 180 | `text = highlight.description` |
| `:composeApp` | `ui/whatsnew/WhatsNewContent.kt` | 224 | `text = item` |
| `:composeApp` | `ui/whatsnew/WhatsNewContent.kt` | 252 | `text = note.headline` |
| `:composeApp` | `ui/whatsnew/WhatsNewPopup.kt` | 92 | `text = note.headline.ifBlank { … }` |

### Alcance real (não inflar)

- **Android — visível, tráfego baixo**: `app/src/main/assets/release-notes.json`
  tem 22 notas e **uma** com marcação, a v1.34.0
  (`**Rede social da pelada**: chat por jogo e mural …`). A versão corrente do
  Android é a 1.39.1, então **a exposição no pop-up já passou**; o defeito
  sobrevive apenas na tela de histórico "Novidades", que continua listando a
  1.34.0 com os asteriscos literais. **Não** é quebra em produção no pop-up.
- **iOS — latente**: `iosApp/iosApp/release-notes.json` tem 5 notas, **nenhuma**
  com marcação. O renderizador está igualmente desprotegido e quebra na primeira
  nota que usar `**`.
- **Risco pra frente (a razão do `priority:medium`)**: as notas da web usam `**`
  com frequência (13 de 168 entradas). Escrever uma nota Android/iOS no mesmo
  estilo é o caminho natural — e ela vai direto pro pop-up de todo mundo que
  atualizar, com asterisco literal.

### O que muda visualmente

A mudança perceptível é **os asteriscos sumirem**. O ganho de peso é secundário e
varia por estilo — o projeto tem duas definições de tipografia e os estilos usados
nesses pontos já partem de pesos altos:

| Estilo | `Typography.kt` | `ResponsiveTypography.kt` |
|---|---|---|
| `headlineSmall` (headline do pop-up) | SemiBold | SemiBold |
| `titleMedium` (headline do corpo) | Medium | SemiBold |
| `titleSmall` (título de destaque) | Medium | **Bold** |
| `bodyMedium` / `bodySmall` (itens, descrição) | Normal | Normal |

Ou seja: sob `ResponsiveTypography` o título de destaque já é Bold e **não muda de
peso**; o contraste só fica realmente evidente em `bodyMedium`/`bodySmall`. O
defeito é "asterisco literal na tela", como o #3876 enquadrou, não "negrito não
aparecia".

## 2. Decisões de design

### D1 — Parser puro em `:shared`, conversor duplicado nos dois módulos de UI

Esta é a decisão que o grafo de módulos impõe, não uma preferência:

- `shared/build.gradle.kts` não tem **nenhuma** dependência de Compose (zero hits
  de `compose` no arquivo). `buildAnnotatedString`, `SpanStyle` e `FontWeight` são
  de `androidx.compose.ui.text`, logo **não podem** morar em `:shared`.
- `:app` depende de `:shared`; `:composeApp` depende de `:shared`; **`:app` não
  depende de `:composeApp`** e nenhum módulo depende de `:composeApp`
  (`settings.gradle.kts:45` só o inclui; nenhum `build.gradle.kts` do repo
  declara `project(":composeApp")` ou `project(":app")`).

Portanto o único ponto de compartilhamento possível é o `:shared`. O split fica:

- **`:shared/commonMain`** — `MarkdownLite.parseMarkdownLite(text)`, que devolve
  `List<MarkdownSpan>` (estrutura neutra: `text` + `bold`). É onde mora a lógica
  de verdade, e é o que os testes cobrem.
- **`:app` e `:composeApp`** — um conversor `List<MarkdownSpan> → AnnotatedString`
  em cada um, ~20 linhas, sem lógica de parsing. Duas cópias de um mapeamento
  trivial é o **mínimo irredutível** dado o grafo, e ambas consomem o mesmo parser.

A duplicação é segura porque nenhum classpath junta os dois módulos: as duas
funções homônimas em `com.futebadosparcas.ui.whatsnew` nunca coexistem.

### D2 — Porte direto de `web/src/utils/markdownLite.ts`, sem lib de Markdown

O conteúdo é curto, vem de fonte controlada (`scripts/release-notes.js`) e só
precisa de ênfase em negrito. Uma lib de Markdown seria dependência nova nos três
targets do KMP (Android, iOS, wasmJs) para um recurso de 40 linhas. O parser
Kotlin replica o regex `\*\*(.+?)\*\*` e a mesma varredura sequencial da web.

Diferença de implementação em relação ao TS: o Kotlin usa `Regex.findAll`, sem o
`lastIndex = 0` que a versão JS precisa por causa do estado mutável do regex
global compartilhado no módulo. Comportamento igual, sem a armadilha.

### D3 — Prevenção: `**` é marcação suportada em todas as plataformas, com teste de contrato

A issue pede **uma** das duas opções, não as duas. Escolhida a segunda.

Validar `**` em `scripts/release-notes.js` e emitir erro (opção 1) contradiz o
fix: depois deste PR os três renderizadores entendem `**`, então avisar o autor
para não usá-lo seria proibir o recurso que acabamos de entregar. O que precisa
de guarda é a **divergência entre implementações**, e essa guarda é um teste.

O contrato é `MarkdownLiteTest.kt` (`:shared/commonTest`) espelhando caso a caso
`web/src/utils/markdownLite.test.ts`, com os seis casos portados
literalmente e um sétimo usando o headline real da v1.34.0. O KDoc do teste
Kotlin nomeia o arquivo da web, para que quem mexer num lado ache o outro.

`scripts/release-notes.js` **não** é tocado.

### D4 — `remember(text)` em cada ponto de chamada

O parse roda a cada recomposição se for chamado direto no corpo do `@Composable`.
`remember(text) { … }` prende o resultado à string. É barato, mas é o padrão do
projeto para cálculo derivado em composição.

## 3. Mudanças

| Arquivo | Mudança |
|---|---|
| `shared/src/commonMain/kotlin/com/futebadosparcas/domain/markdown/MarkdownLite.kt` | Novo: `MarkdownSpan` + `parseMarkdownLite` (porte de `markdownLite.ts`) |
| `shared/src/commonTest/kotlin/com/futebadosparcas/domain/markdown/MarkdownLiteTest.kt` | Novo: teste de contrato, 6 casos espelhados da web + headline real da v1.34.0 |
| `app/src/main/java/com/futebadosparcas/ui/whatsnew/MarkdownLiteText.kt` | Novo: `rememberMarkdownLite(text): AnnotatedString` (Compose Android) |
| `app/src/main/java/com/futebadosparcas/ui/whatsnew/WhatsNewContent.kt` | 4 pontos passam a `AnnotatedString` (152, 158, 202, 230) |
| `app/src/main/java/com/futebadosparcas/ui/whatsnew/WhatsNewBottomSheet.kt` | Headline do pop-up passa a `AnnotatedString` (84) |
| `composeApp/src/commonMain/kotlin/com/futebadosparcas/ui/whatsnew/MarkdownLiteText.kt` | Novo: mesmo conversor para CMP |
| `composeApp/src/commonMain/kotlin/com/futebadosparcas/ui/whatsnew/WhatsNewContent.kt` | 4 pontos passam a `AnnotatedString` (174, 180, 224, 252) |
| `composeApp/src/commonMain/kotlin/com/futebadosparcas/ui/whatsnew/WhatsNewPopup.kt` | Headline do pop-up passa a `AnnotatedString` (92) |

Nenhuma string nova em `strings.xml`: os fallbacks `ifBlank { … }` já usam
recursos existentes. Nenhuma cor nova: os `color =` dos `Text` seguem intactos,
todos vindos de `MaterialTheme.colorScheme.*`.

## 4. Critérios de aceite

- [ ] `parseMarkdownLite` devolve os mesmos segmentos que `parseMarkdownLite` da
      web nos seis casos portados, incluindo negrito não fechado tratado como
      texto puro e string vazia devolvendo lista vazia
- [ ] Os 10 pontos de render (5 no `:app`, 5 no `:composeApp`) usam `AnnotatedString`
- [ ] O headline da v1.34.0 aparece sem asteriscos literais na tela "Novidades"
- [ ] `./gradlew :shared:compileDebugKotlinAndroid` verde
      (`:shared:compileKotlinMetadata` sai `SKIPPED` neste build — não serve de gate)
- [ ] `./gradlew :app:compileDebugKotlin` verde
- [ ] `./gradlew :composeApp:compileDebugKotlinAndroid` verde
- [ ] `./gradlew :composeApp:compileCommonMainKotlinMetadata` verde
      (type-check do sourceset onde vivem os 5 pontos do CMP)
- [ ] `./gradlew :shared:compileKotlinIosSimulatorArm64 :composeApp:compileKotlinIosSimulatorArm64`
      verde (target nativo, metade iOS)
- [ ] `./gradlew :shared:testDebugUnitTest` verde (é a task que roda `commonTest`)
- [ ] `./gradlew :app:testDebugUnitTest` verde (nada existente quebrou)
- [ ] `./gradlew detekt` verde

## 5. Não coberto

- **Outras marcações Markdown** (`_itálico_`, `` `código` ``, links). O parser
  cobre só `**negrito**`, igual à web. Ampliar é mudança de contrato nos quatro
  renderizadores e merece issue própria.
- **`scripts/release-notes.js`** fica intocado — é a opção de prevenção
  deliberadamente **não** escolhida (D3).
- **Verificação visual em simulador/aparelho**. A cobertura aqui é compilação
  (incluindo target nativo iOS) + teste de unidade do parser; não há teste de UI
  Compose asserindo o `AnnotatedString` renderizado.
- **Backfill das notas existentes**. A v1.34.0 continua com `**` no JSON — o
  renderizador é que passou a entender. É o comportamento desejado.
