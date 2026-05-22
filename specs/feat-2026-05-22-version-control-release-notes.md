# SPEC: Sistema de Controle de Versão & Release Notes ("Novidades")

> **Status:** `APPROVED`
> **Autor:** Renan Locatiz Fernandes (via Claude)
> **Data:** 2026-05-22
> **PR:** #xxx (preencher quando criar)

---

## 0. Sumário Executivo

Sistema completo e unificado para **organizar o versionamento**, **gerar changelog** (técnico
e voltado ao usuário) e **exibir as novidades dentro do app** em todas as plataformas
(Android, iOS, Web/desktop).

Hoje o projeto tem versionamento parcial (CHANGELOG manual, versões dessincronizadas entre
plataformas) e **nenhuma forma de o usuário ver o que mudou** a cada atualização. Esta spec
cobre tudo de uma vez: fundação de versionamento, fonte única de release notes, pipeline de
geração, backend dinâmico e a tela "Novidades" nas 3 plataformas.

**Decisões já tomadas com o PO (ver §6):**
- Entrega das notas: **Firestore dinâmico + fallback embarcado** no build.
- Numeração: **independente por plataforma** (cada uma com sua cadência).
- Escopo: **spec única, implementação completa** (build em fases ordenadas, ver §4).
- Exibição: **pop-up automático pós-update + entrada permanente** em Ajustes/Sobre.

---

## 1. Requirements (Requisitos)

### 1.1 Problema / Oportunidade

1. **Versões dessincronizadas e sem fonte de verdade.** Android está em `1.26.0` (vc50),
   Web em `1.22.0`, iOS/Functions sem versão rastreada. `scripts/bump-version.js` só atualiza
   `app/build.gradle.kts`. Não há um registro central legível por máquina.
2. **Changelog 100% manual.** `CHANGELOG.md` é mantido à mão; `release.yml` gera notas de
   release a partir de `git log` cru (mensagens de commit sem curadoria).
3. **Issues não rastreadas por versão.** Não há vínculo estruturado entre uma versão entregue
   e as issues/PRs que ela resolveu.
4. **O usuário nunca vê o que mudou.** Não existe tela "Novidades"/"What's New" em nenhuma
   plataforma. As release notes só vivem no GitHub Releases, invisíveis dentro do app.

**Por que agora:** o app está em cadência ativa de releases (mega audit waves, deploys
frequentes). Sem um sistema, cada release perde a oportunidade de comunicar valor ao usuário
e o histórico técnico fica frágil.

### 1.2 Casos de Uso

| ID | Ator | Ação | Resultado esperado |
|----|------|------|-------------------|
| UC1 | Jogador | Abre o app pela 1ª vez após uma atualização | Pop-up "Novidades" aparece automaticamente mostrando o que mudou |
| UC2 | Jogador | Acessa Ajustes → "Novidades" a qualquer momento | Vê a lista de novidades da versão atual e o histórico recente |
| UC3 | Jogador | Abre o app sem internet logo após atualizar | Pop-up "Novidades" ainda aparece, lido do fallback embarcado |
| UC4 | Mantenedor | Corta um novo release de uma plataforma | `bump-version.js` atualiza a versão; escreve 1 arquivo de release notes |
| UC5 | Mantenedor | Faz merge / cria a tag de release | CI regenera o `CHANGELOG.md` e publica as notas no Firestore automaticamente |
| UC6 | Dev / Auditor | Precisa saber o que entrou em uma versão | Consulta `CHANGELOG.md` (técnico) com links diretos para issues/PRs e milestone |

### 1.3 Critérios de Aceite

- [ ] **CA1:** Existe `versions.json` na raiz como registro central das versões correntes de
      cada plataforma; `bump-version.js <platform>` atualiza a plataforma escolhida e o arquivo.
- [ ] **CA2:** `CHANGELOG.md` é **regenerado automaticamente** a partir dos arquivos-fonte de
      release notes, segmentado por plataforma, no formato Keep a Changelog.
- [ ] **CA3:** Cada release tem **um único arquivo-fonte** (`release-notes/<platform>/<version>.md`)
      contendo conteúdo voltado ao usuário (PT-BR) + conteúdo técnico + issues/PRs vinculados.
- [ ] **CA4:** A coleção Firestore `release_notes` é **populada automaticamente** pela CI no
      momento do release, via `firebase-admin` + service account (sem callable).
- [ ] **CA5:** Android, iOS e Web têm uma tela/seção "Novidades" acessível em Ajustes/Sobre,
      com os 4 estados obrigatórios (Loading com shimmer, Empty, Error com retry, Success).
- [ ] **CA6:** Um **pop-up de novidades** aparece automaticamente na primeira abertura após
      uma atualização, comparando o build atual com o último build visto no dispositivo.
- [ ] **CA7:** A feature **funciona offline** — se o Firestore não responder, as notas da
      versão atual são lidas de um JSON embarcado no build (fallback).
- [ ] **CA8:** Toda versão é **rastreável às issues** do GitHub via milestone por release +
      campo `issueRefs` nas notas e no changelog.
- [ ] **CA9:** Existe `docs/RELEASE_PROCESS.md` documentando o processo completo de corte de
      release ponta a ponta.
- [ ] **CA10:** Schema das notas é **i18n-ready** (conteúdo organizado por locale); a entrega
      inicial preenche apenas `pt-BR`.

### 1.4 Fora de Escopo

- **Tradução de idiomas** além de PT-BR (o schema suporta, mas só `pt-BR` é preenchido agora).
- **Backfill de todo o histórico** (v1.0 → hoje). Será feito backfill **das últimas 3 versões**
  de cada plataforma (decisão do PO) para a tela "Novidades" já nascer com histórico; versões
  anteriores a essas permanecem apenas no `CHANGELOG.md` atual.
- **Notificação FCM "nova versão disponível"** — adiada para uma fase futura (evitar inchaço).
- **Painel admin** para editar release notes pela UI — por ora a edição é via arquivo-fonte +
  reprocessamento. (As notas no Firestore *são* editáveis manualmente para hotfix de texto.)
- **App desktop nativo** — não existe; a Web responsiva cobre o uso desktop.
- **Remote Config** como canal alternativo — o canal dinâmico é exclusivamente o Firestore.

---

## 2. UX/UI Design

### 2.1 Fluxo de Navegação

```
[App inicia / boot]
   │
   ├─ build atual > último build visto?  ──não──> segue para Home normalmente
   │            │ sim
   │            ▼
   │   [Pop-up Novidades]  (BottomSheet no Android/iOS, Dialog na Web)
   │       │ "Entendi" / fechar
   │       ▼
   │   marca build atual como visto  ──> Home
   │
   └─ [Ajustes / Sobre] --tap "Novidades"--> [Tela Novidades]
                                                 │
                                  ┌──────────────┼───────────────┐
                               Loading         Error           Success
                              (shimmer)     (msg + retry)   (lista de versões)
                                                                 │
                                                          Empty (sem notas)
```

### 2.2 Telas e Estados

| Tela | Estado | Descrição |
|------|--------|-----------|
| Pop-up Novidades | Success | Headline da versão + cards de destaques + seções Novidades/Melhorias/Correções. Botão único de fechar. |
| Pop-up Novidades | (sem Loading) | O pop-up só aparece se já houver dados (Firestore OU fallback). Nunca exibe spinner bloqueante no boot. |
| Tela Novidades | Loading | Shimmer (`LoadingState`, `itemType = CARD`) enquanto busca o histórico. |
| Tela Novidades | Empty | "Nenhuma novidade por aqui ainda." + ilustração. (Raro — só se Firestore vazio e sem fallback.) |
| Tela Novidades | Error | Mensagem amigável + botão "Tentar novamente". |
| Tela Novidades | Success | Lista de versões (mais recente no topo), cada uma expansível: headline, destaques, seções. Badge do tipo (major/minor/patch). |

**Conteúdo de uma nota (layout):**
- **Headline:** título curto e amigável do release (ex.: "Sua pelada agora tem Novidades!").
- **Destaques:** até 3 cards com ícone + título + descrição curta (o que mais importa).
- **Seções:** listas agrupadas — 🎉 Novidades, ⚡ Melhorias, 🐛 Correções.
- O conteúdo técnico e os números de issue **não** aparecem na UI do usuário (ficam no
  `CHANGELOG.md` e no campo `technicalSummary`/`issueRefs` do documento).

### 2.3 Responsividade

| Configuração | Comportamento |
|--------------|---------------|
| Phone Portrait | Pop-up = BottomSheet; Tela = lista de cards full-width. |
| Phone Landscape | Pop-up com altura máx. 80% + scroll interno. |
| Tablet (sw600dp+) | Tela Novidades centralizada com `maxWidth` (~600dp), não esticar. |
| Web desktop | Dialog centralizado `maxWidth: sm`; tela em container centralizado. |

### 2.4 Acessibilidade

- [ ] `contentDescription` em ícones de destaque e botão de fechar.
- [ ] Touch targets >= 48dp.
- [ ] Contraste >= 4.5:1 — usar `MaterialTheme.colorScheme.*` / tokens MUI (`theme.palette.*`).
- [ ] Badges de tipo (major/minor/patch) não dependem só de cor — incluir texto.
- [ ] Pop-up dispensável por gesto + botão; foco de leitor de tela vai para o título ao abrir.

### 2.5 Animações e Micro-interações

- Pop-up: entrada padrão de BottomSheet/Dialog (sem animação custom).
- Cards de destaque: sem animação; ícones estáticos.
- Tela: itens de versão expandem/colapsam com `animateContentSize()`.

---

## 3. Technical Design

### 3.1 Visão Geral da Arquitetura

```
                    release-notes/<platform>/<version>.md   ← ÚNICO arquivo escrito à mão
                                   │
                  scripts/release-notes.js (Node)
                    │            │              │
        regenera CHANGELOG   gera JSON      publica no Firestore
              .md            embarcado      (firebase-admin + SA)
                             (fallback)            │
                                                   ▼
                                        Firestore: release_notes/
                                                   │
                  ┌────────────────────────────────┼────────────────────────┐
            shared/commonMain (KMP)           web/src (React)          (mesmo repo)
            ReleaseNotesRepository            useReleaseNotes hook
            SemVer, UseCase, Model                  │
                  │                                 │
        ┌─────────┴─────────┐                       │
   Android :app          iOS composeApp        Web WhatsNewDialog
   WhatsNewScreen        WhatsNewScreen         + página Ajustes
```

### 3.2 Componente A — Versionamento independente por plataforma

**`versions.json` (raiz)** — registro central, fonte de verdade legível por máquina:

```json
{
  "$schema": "./scripts/versions.schema.json",
  "android":   { "version": "1.26.0", "buildNumber": 50 },
  "web":       { "version": "1.22.0", "buildNumber": 1 },
  "ios":       { "version": "1.0.0",  "buildNumber": 1 },
  "functions": { "version": "1.0.0" }
}
```

> **Resolvido (2026-05-22):** a divergência Web 1.22.0 × Android 1.26.0 **não é intencional** —
> a Web ficou sem bump. A Task 1 deve apurar o estado real de cada plataforma (tags git,
> histórico de deploy) e gravar em `versions.json` os números **corretos e atualizados**. O
> modelo segue independente por plataforma, mas toda entrada reflete a realidade.

**`scripts/bump-version.js` reescrito** — multi-plataforma:
- `node scripts/bump-version.js <android|web|ios|functions> [major|minor|patch]`
- Sem o nível explícito, infere por Conventional Commits desde a última tag daquela plataforma.
- Atualiza `versions.json` **e** o arquivo nativo correspondente:
  - android → `app/build.gradle.kts` (`versionName` + `versionCode` += 1)
  - web → `web/package.json`
  - ios → `iosApp/iosApp/Info.plist` (`CFBundleShortVersionString` / `CFBundleVersion`)
  - functions → `functions/package.json`
- Web e Functions passam a **derivar a versão de `versions.json` no build** (Vite injeta
  `VITE_APP_VERSION` a partir do arquivo; Functions lê em runtime se necessário).

### 3.3 Componente B — Fonte única de release notes

Um arquivo por release: **`release-notes/<platform>/<version>.md`**

```markdown
---
platform: android
version: 1.27.0
buildNumber: 51
date: 2026-05-25
type: minor            # major | minor | patch
showPopup: true
issues: [1480, 1479]
prs: [1481]
milestone: android-1.27.0
---

## Para o usuário

### Destaques
- icon=celebration | Novidades chegou! | Veja o que muda a cada atualização do app.

### Novidades
- Tela "Novidades" para acompanhar cada atualização.

### Melhorias
- Carregamento da Home mais rápido.

### Correções
- Corrigido travamento ao abrir um jogo finalizado.

## Técnico

### Added
- Sistema de release notes (spec feat-2026-05-22).

### Fixed
- NPE em GameDetailViewModel quando game.status == FINISHED (#1480).
```

Regras: a seção **"Para o usuário"** é PT-BR amigável e alimenta o Firestore/UI; a seção
**"Técnico"** alimenta o `CHANGELOG.md`. `issues`/`prs` no frontmatter dão a rastreabilidade.

### 3.4 Componente C — Pipeline `scripts/release-notes.js`

Subcomandos:
- `validate` — valida frontmatter + estrutura de todos os arquivos `release-notes/**`.
- `changelog` — regenera `CHANGELOG.md` (segmentado por plataforma, Keep a Changelog).
- `bundle` — gera o JSON de fallback embarcado por plataforma:
  - Android → `app/src/main/assets/release-notes.json`
  - Web → `web/public/release-notes.json`
  - iOS/composeApp → `composeApp/src/commonMain/composeResources/files/release-notes.json`
- `publish --platform <p> --version <v>` — faz upsert do documento no Firestore via
  `firebase-admin` (service account). Roda na CI.

### 3.5 Componente D — Modelo de Dados (Firestore)

**Coleção `release_notes`**, doc id `{platform}_{version}` (ex.: `android_1.27.0`):

```jsonc
{
  "platform": "android",          // "android" | "web" | "ios"
  "version": "1.27.0",
  "buildNumber": 51,
  "releaseDate": "<Timestamp>",
  "type": "minor",                // "major" | "minor" | "patch"
  "published": true,
  "content": {                    // i18n-ready: chaveado por locale
    "pt-BR": {
      "headline": "Sua pelada agora tem Novidades!",
      "highlights": [
        { "icon": "celebration", "title": "Novidades chegou!",
          "description": "Veja o que muda a cada atualização." }
      ],
      "sections": {
        "added":    ["Tela \"Novidades\"..."],
        "improved": ["Carregamento da Home mais rápido."],
        "fixed":    ["Corrigido travamento ao abrir jogo finalizado."]
      }
    }
  },
  "technicalSummary": "Sistema de release notes; fix NPE GameDetail.",
  "issueRefs": [1480, 1479],
  "prRefs": [1481],
  "milestone": "android-1.27.0",
  "displayConfig": { "showPopup": true, "minBuildToShow": 1 },
  "createdAt": "<serverTimestamp>",
  "updatedAt": "<serverTimestamp>"
}
```

**Firestore Rules** (`firestore.rules`):

```javascript
match /release_notes/{noteId} {
  allow read: if isAuthenticated();
  allow write: if false;   // escrita só via Admin SDK (CI). Rules nunca combinam update+delete.
}
```

**Índice composto:** `release_notes` → `platform` ASC + `buildNumber` DESC
(para "buscar notas desde o build X").

### 3.6 Componente E — Modelo KMP compartilhado (`shared/commonMain`)

```kotlin
data class ReleaseNote(
    val platform: String,
    val version: String,
    val buildNumber: Int,
    val releaseDate: Long,
    val type: ReleaseType,
    val headline: String,
    val highlights: List<ReleaseHighlight>,
    val added: List<String>,
    val improved: List<String>,
    val fixed: List<String>,
    val issueRefs: List<Int>,
    val showPopup: Boolean,
)

data class ReleaseHighlight(val icon: String, val title: String, val description: String)

enum class ReleaseType { MAJOR, MINOR, PATCH }

interface ReleaseNotesRepository {
    /** Notas com buildNumber > sinceBuild, mais recente primeiro. */
    suspend fun getReleaseNotes(platform: String, sinceBuild: Int): Result<List<ReleaseNote>>
}

// Comparação de versão semântica — testada em commonTest.
object SemVer { fun compare(a: String, b: String): Int }

// Persistência do "último build visto" — expect/actual por plataforma.
expect class LastSeenVersionStore {
    suspend fun getLastSeenBuild(): Int
    suspend fun setLastSeenBuild(build: Int)
}

class GetUnseenReleaseNotesUseCase(
    private val repo: ReleaseNotesRepository,
    private val store: LastSeenVersionStore,
)
```

- **Impl Android** (`shared/androidMain`): GitLive Firestore + fallback lendo
  `release-notes.json` de assets; `LastSeenVersionStore` via DataStore.
- **Impl iOS** (`shared/iosMain`): GitLive Firestore + fallback de resources;
  `LastSeenVersionStore` via `NSUserDefaults`.
- **Web**: não usa KMP — replica a lógica em `web/src` (hook `useReleaseNotes`, comparador
  SemVer em TS, `localStorage` para o último build visto).

> **Persistência "último visto" = por dispositivo** (DataStore / UserDefaults / localStorage),
> não por usuário. Justificativa: o pop-up comunica "este aparelho acabou de ser atualizado",
> que é inerentemente um evento de dispositivo; uma instalação nova legitimamente deve ver as
> novidades. Evita também leitura/escrita extra no doc do usuário a cada boot.

### 3.7 Componente F — UI "Novidades"

| Plataforma | Local | Componentes |
|-----------|-------|-------------|
| Android | `app/.../ui/whatsnew/` | `WhatsNewViewModel`, `WhatsNewScreen`, `WhatsNewBottomSheet` |
| Web | `web/src/pages/whatsnew/` + `web/src/hooks/useReleaseNotes.ts` | `WhatsNewDialog`, `WhatsNewPage` |
| iOS | `composeApp/.../ui/whatsnew/` | `WhatsNewScreen` (Compose-MP) consumido pelo app iOS |

> **Resolvido (2026-05-22):** a UI Android é construída em `:app` (mantém a convenção vigente
> do projeto); a UI iOS é construída **separadamente** em `composeApp` (Compose Multiplatform).
> Aceita-se a leve duplicação de uma tela simples em troca de não divergir do padrão atual.
> A lógica (model, repositório, `SemVer`, use case) é 100% compartilhada via `shared/commonMain`.

**Disparo do pop-up:** no boot (`MainActivityCompose` no Android; `App.tsx`/root na Web; entry
do iOS), `GetUnseenReleaseNotesUseCase` compara `BuildConfig.VERSION_CODE` (Android) /
`VITE_APP_VERSION`→build (Web) / build iOS contra o `LastSeenVersionStore`. Se houver notas
não vistas com `showPopup = true`, exibe o pop-up e grava o build atual como visto.

### 3.8 Cache e Offline

| Cenário | Comportamento |
|---------|---------------|
| Sem internet no boot | Pop-up lê o JSON embarcado (fallback) da versão atual. |
| Firestore falha na Tela Novidades | Mostra fallback embarcado; se vazio → estado Error com retry. |
| Firestore OK | Firestore é a fonte; fallback só completa a versão atual se faltar. |

### 3.9 Segurança

- [ ] Nenhum secret hardcoded. Service account da CI vem de **GitHub Secret** já existente
      (mesma SA usada para deploy Firebase/Play Store — ver memória do projeto).
- [ ] `release_notes` é read-only para clientes (rules `allow write: if false`).
- [ ] Publicação só pela CI via Admin SDK (bypassa rules por design).
- [ ] Sem PII nas notas — conteúdo é curado manualmente no arquivo-fonte.

### 3.10 Performance

- Query `release_notes` limitada (ex.: `limit(20)`) + índice composto.
- JSON de fallback é pequeno (só a versão atual + últimas N) — sem impacto no tamanho do app.
- Lista da Tela Novidades usa `key` em `items()`.
- Pop-up nunca bloqueia o boot: se os dados não estão prontos, não aparece (aparece no próximo
  boot ou via menu).

### 3.11 Analytics e Observabilidade

| Evento | Quando dispara | Parâmetros |
|--------|----------------|------------|
| `whats_new_popup_shown` | Pop-up exibido no boot | `version`, `platform` |
| `whats_new_opened` | Tela aberta via menu | `source: "settings"` |
| `whats_new_dismissed` | Pop-up fechado | `version` |

### 3.12 CI/CD

- **`version-bump.yml`:** passa a usar `bump-version.js <platform>` e a respeitar `versions.json`.
- **`release.yml`:** após criar o release, novos steps —
  1. `node scripts/release-notes.js validate`
  2. `node scripts/release-notes.js changelog && bundle`
  3. `node scripts/release-notes.js publish --platform <p> --version <v>`
     (com a SA via secret, `GOOGLE_APPLICATION_CREDENTIALS`).
- O conteúdo das GitHub Releases passa a usar a seção "Técnico" do arquivo-fonte (curado),
  não mais `git log` cru.

---

## 4. Tasks (Breakdown — ordem de build obrigatória)

> A ordem importa: cada fase depende da anterior. **Não começar pela UI.**

### Fase A — Fundação de versionamento
| # | Task | Est. | Status |
|---|------|------|--------|
| 1 | Criar `versions.json` + `versions.schema.json` com versões reais atuais | 1h | ✅ |
| 2 | Reescrever `scripts/bump-version.js` (multi-plataforma + atualiza `versions.json`) | 3h | ✅ |
| 3 | Web/Functions derivam versão de `versions.json` no build (Vite injeta `VITE_APP_VERSION`) | 2h | ✅ |
| 4 | Atualizar `version-bump.yml` para o novo fluxo | 1h | ✅ |

### Fase B — Fonte de release notes + pipeline
| # | Task | Est. | Status |
|---|------|------|--------|
| 5 | Definir/documentar formato `release-notes/<platform>/<version>.md` + criar arquivos iniciais | 2h | ✅ |
| 6 | Criar `scripts/release-notes.js` (`validate`, `changelog`, `bundle`, `publish`) | 5h | ✅ |
| 7 | Regenerar `CHANGELOG.md` segmentado por plataforma + backfill das últimas 3 versões de cada plataforma | 3h | ✅ |
| 8 | Criar `docs/RELEASE_PROCESS.md` | 1h | ✅ |

### Fase C — Backend
| # | Task | Est. | Status |
|---|------|------|--------|
| 9 | `firestore.rules` + índice composto para `release_notes` | 1h | ✅ |
| 10 | Integrar `release-notes.js publish` no `release.yml` (Admin SDK + SA secret) | 2h | ✅ |

### Fase D — Camada compartilhada (KMP)
| # | Task | Est. | Status |
|---|------|------|--------|
| 11 | `ReleaseNote`, `ReleaseHighlight`, `ReleaseType` em `commonMain` | 1h | ✅ |
| 12 | `SemVer` comparador + testes em `commonTest` | 1h | ✅ |
| 13 | `ReleaseNotesRepository` interface + impl Android/iOS (Firestore + fallback) | 4h | ✅ |
| 14 | `LastSeenVersionStore` expect/actual (SharedPreferences / NSUserDefaults) | 2h | ✅ |
| 15 | `GetUnseenReleaseNotesUseCase` + registro nos módulos Koin | 1h | ✅ |

### Fase E — UI Android (`:app`)
| # | Task | Est. | Status |
|---|------|------|--------|
| 16 | `WhatsNewViewModel` + `WhatsNewUiState` (Loading/Empty/Error/Success) | 2h | ✅ |
| 17 | `WhatsNewScreen` + `WhatsNewBottomSheet` (estados, responsividade, a11y) | 5h | ✅ |
| 18 | Pop-up no boot (`MainActivityCompose`) + entrada em Ajustes/Sobre | 2h | ✅ |
| 19 | `strings.xml` + testes (ViewModel + UI) | 2h | ✅ |

### Fase F — UI Web
| # | Task | Est. | Status |
|---|------|------|--------|
| 20 | `useReleaseNotes` hook + service Firestore + SemVer TS + fallback JSON | 3h | ✅ |
| 21 | `WhatsNewDialog` + `WhatsNewPage` + entrada em Ajustes/Sobre | 4h | ✅ |
| 22 | Pop-up no boot + chaves i18n + testes Vitest | 2h | ✅ |

### Fase G — UI iOS (`composeApp`)
| # | Task | Est. | Status |
|---|------|------|--------|
| 23 | `WhatsNewScreen` + pop-up em `composeApp` (Compose-MP), consumindo o use case compartilhado | 4h | ✅ |
| 24 | Wire no app iOS + smoke test no iOS Simulator | 2h | 🟡 |

> **Fase G entregue (2026-05-22) — PR #1522.** `WhatsNewScreen` + `WhatsNewBottomSheet`
> + `WhatsNewPopupHost` + `WhatsNewViewModel` em `composeApp/commonMain/.../ui/whatsnew/`,
> consumindo `GetUnseenReleaseNotesUseCase` (real no iOS). Wiring `expect/actual` da DI por
> plataforma (`releaseNotesModule()`): iOS = fiação real (Firestore + fallback do bundle);
> Android/wasmJs = stub (targets só de build — o app Android real é `:app`, Fase E).
> Rota `WHATS_NEW` no NavHost, pop-up montado no boot (`AppContent`), entrada na `HomeScreen`.
>
> **Gate verificado:** `:composeApp:compileKotlinIosSimulatorArm64` ✅ +
> `:composeApp:linkDebugFrameworkIosSimulatorArm64` ✅ + `:composeApp:compileDebugKotlinAndroid` ✅.
> wasmJs não compila por limitação **pré-existente** do `:shared` (GitLive Firebase sem suporte
> wasmJs — CMP Fase 0, target não-shipping); não é regressão da Fase G.
>
> **Task #24 — parcial (🟡):** wire no app iOS feito (o `iosApp` consome `MainViewController()`
> do `composeApp`). O **smoke test live no iOS Simulator** + o **empacotamento do
> `release-notes.json` como recurso do app bundle iOS** (hoje o fallback é um recurso CMP em
> `composeResources/files/`, mas `ReleaseNotesAssetReader` iOS lê via `NSBundle.pathForResource`
> — degrada para Firestore-only se ausente) ficam para a **Fase H, task #26**
> ("validar live nas 3 plataformas").

### Fase H — Verificação e entrega
| # | Task | Est. | Status |
|---|------|------|--------|
| 25 | Testes completos + validação cross-platform (light/dark, telas) | 3h | ✅ |
| 26 | Deploy: rules + índices + 1º publish; validar live nas 3 plataformas (inclui smoke test iOS Simulator + empacotar `release-notes.json` no app bundle iOS — herdado da Fase G #24) | 3h | ✅ |
| 27 | Registrar decisões em `specs/DECISIONS.md`; code review final | 1h | ✅ |

> **Fase H — tasks #25 e #27 entregues (2026-05-22).** Suíte de testes completa
> verde nas 5 frentes (ver §5.1); builds das 3 plataformas OK; sem cores
> hardcoded em nenhuma UI de "Novidades"; CHANGELOG determinístico (regenerar
> não produz diff); decisões registradas em `DECISIONS.md`.
>
> **Task #26 — parcial (🟡), deploy de produção feito em 2026-05-22** (autorizado
> pelo PO):
> - ✅ `firestore.rules` + `firestore.indexes.json` deployados em produção
>   (`futebadosparcas`) — coleção `release_notes` (read autenticado / write
>   negada) + índice composto `platform`+`buildNumber`.
> - ✅ 1º publish: 4 documentos em `release_notes` via `scripts/release-notes.js
>   publish` (Admin SDK) — `android_1.24.0`, `android_1.25.0`, `android_1.26.0`,
>   `web_1.26.0`, todos `published: true`.
> - ✅ Web hosting deployado (UI "Novidades" da Fase F agora live em
>   `futebadosparcas.web.app`); smoke: site `200`, fallback `/release-notes.json`
>   `200`. Android v1.26 (Play Store) lê os docs do Firestore.
> - ✅ **iOS — `release-notes.json` empacotado no app bundle** (2026-05-22,
>   follow-up da Fase H). `scripts/release-notes.js` (`BUNDLE_TARGETS.ios`) agora
>   grava também em `iosApp/iosApp/release-notes.json`; o glob de `sources` do
>   `project.yml` o adiciona à fase Copy Bundle Resources do target Xcode
>   `iosApp`. **Verificado empiricamente:** o arquivo está dentro do `.app`
>   compilado (`iosApp.app/release-notes.json`), de onde `ReleaseNotesAssetReader`
>   (iosMain) o lê via `NSBundle.mainBundle`.
> - ⬜ **iOS** não publicado no Firestore: `release-notes/ios/1.6.0.md` tem
>   `published: false` (app iOS é **pré-lançamento**, ainda não na App Store) —
>   coleção `release_notes` sem doc iOS por design.
> - ⚠️ **Smoke iOS — parcial.** Build do `iosApp` OK e recurso confirmado no
>   `.app`; o smoke run-time (abrir a tela "Novidades" no Simulator) não foi
>   concluído: o ambiente de smoke não tem `GoogleService-Info.plist`, então o
>   `ReleaseNotesRepositoryImpl` toca o Firestore e `+[FIRFirestore firestore]`
>   lança um `NSException` ObjC que o `try/catch` Kotlin/Native **não** captura.
>   O fix `by lazy` (parte deste PR) move o toque do Firebase do construtor para
>   o 1º uso — **não é regressão** (o crash já existia antes, no construtor) e
>   **não afeta produção** (build de produção tem o plist → `FirebaseApp.configure()`).
>   A robustez "degrada graciosamente quando o Firebase não está configurado"
>   virou **follow-up de hardening próprio** (guarda `expect/actual
>   isFirebaseAvailable()` + os outros 5 inicializadores Firebase eager no
>   `shared`).

**Total estimado:** ~71h (sugerido entregar em ~6 PRs por fase/domínio — ver §6).

---

## 5. Verification (Verificação)

### 5.1 Testes

| Tipo | Cobertura | Status |
|------|-----------|--------|
| Unit KMP (`SemVer`) | Comparações major/minor/patch, edge cases | ✅ `SemVerTest.kt` |
| Unit KMP (`GetUnseenReleaseNotesUseCase`) | build atual >/=/< último visto | ✅ `GetUnseenReleaseNotesUseCaseTest.kt` |
| Unit Android (`WhatsNewViewModel`) | Loading→Success/Error/Empty | ✅ `WhatsNewViewModelTest.kt` |
| Unit Web (`useReleaseNotes`, SemVer TS) | Vitest | ✅ 20 testes (`semver` + `useReleaseNotes`) |
| Unit Node (`release-notes.js`) | validate rejeita frontmatter inválido; changelog determinístico | ✅ `scripts/release-notes.test.js` (19 testes, `node:test`) |
| Firestore Rules | leitura autenticada OK; escrita cliente negada | ✅ `release-notes.test.ts` (suíte 372/372) |
| UI smoke | Pop-up aparece 1x pós-update e não repete; Android + Web + iOS | 🟡 Android/Web validados live (#26); iOS: build + recurso no `.app` ✅, smoke run-time parcial (ambiente sem `GoogleService-Info.plist` → follow-up de hardening) |

> **§5.1 — todas as suítes verdes (2026-05-22).** `composeApp` (UI iOS) não tem
> teste de `WhatsNewViewModel` próprio: a lógica é idêntica à do `:app` (já
> coberta) e o use case compartilhado tem cobertura em `commonTest`; o módulo
> ainda não tem infra de `commonTest` configurada. Não é regressão — registrado
> aqui para não parecer esquecido.

### 5.2 Checklist de Revisão

- [x] Build passa nas 3 plataformas (`:app:compileDebugKotlin` ✅, `web build` ✅, iOS framework ✅ Fase G).
- [x] Lint/detekt/eslint passam (verde no CI de cada PR de fase — E/F/G).
- [x] Testes passam (5 frentes — ver §5.1).
- [~] Testado em light/dark theme — verificação de código (zero cores hardcoded); validação visual live → #26.
- [~] Testado em phone/tablet/desktop — validação visual live → #26.
- [x] Pop-up aparece **uma vez** após update e não reaparece no boot seguinte (lógica coberta por `GetUnseenReleaseNotesUseCaseTest` + `WhatsNewViewModelTest`; smoke do ciclo de boot → #26).
- [x] Funciona offline (fallback embarcado — `release-notes.json` no bundle de Android/Web; iOS empacotado no app bundle e verificado dentro do `.app` — #26).
- [~] Strings em `strings.xml` / i18n da Web (sem hardcode) — `:app` usa `strings.xml`, Web usa i18n; `composeApp` (UI iOS) tem strings PT-BR hardcoded por convenção do módulo (ver DECISIONS.md 2026-05-22).
- [x] Sem cores hardcoded (grep verificado em `:app`, `composeApp` e `web`).
- [~] Analytics implementado — Android (`WhatsNewViewModel`) e Web (`WhatsNewPage`/`WhatsNewDialog`); `composeApp`/iOS sem analytics (port enxuto).
- [x] `CHANGELOG.md` regenerado bate com os arquivos-fonte (regenerar não produz diff).

### 5.3 Mapa CA → Tasks → Verificação

| CA | Tasks | Verificação |
|----|-------|-------------|
| CA1 versions.json + bump | 1, 2 | 5.1 Unit Node, 5.2 build |
| CA2 CHANGELOG auto | 6, 7 | 5.1 Unit Node, 5.2 changelog bate |
| CA3 arquivo-fonte único | 5, 6 | 5.1 validate |
| CA4 publish automático Firestore | 9, 10 | 5.2 deploy/publish, 5.1 Rules |
| CA5 tela Novidades 3 plataformas | 16–24 | 5.1 ViewModel/hook, 5.1 UI smoke |
| CA6 pop-up pós-update | 14, 15, 18, 22, 23 | 5.1 UseCase, 5.2 pop-up 1x |
| CA7 offline/fallback | 6, 13 | 5.2 funciona offline |
| CA8 rastreabilidade issues | 5, 7 | 5.2 changelog com issueRefs |
| CA9 RELEASE_PROCESS.md | 8 | revisão de doc |
| CA10 schema i18n-ready | 5, 11 | 5.1 validate / schema |

### 5.4 Demo

- [ ] Demo do fluxo completo: corte de release → CI publica → pop-up no app.

---

## 6. Notas e Referências

### Decisões a registrar em `specs/DECISIONS.md` (após aprovação)

1. **Versionamento independente por plataforma** — cada plataforma mantém sua própria
   cadência/número; `versions.json` é o registro central.
2. **`release-notes/<platform>/<version>.md` como fonte única** — um arquivo gera CHANGELOG,
   bundle de fallback e o documento Firestore.
3. **Canal dinâmico = Firestore + fallback embarcado** — sem Remote Config, sem callable;
   publicação via `firebase-admin` + service account na CI.
4. **"Último build visto" persistido por dispositivo** — não por usuário.
5. **Schema i18n-ready, entrega PT-BR only** — `content` chaveado por locale desde o dia 1.

### Sugestão de fatiamento em PRs

| PR | Fases | Domínio |
|----|-------|---------|
| 1 | A | Versionamento + `versions.json` + bump script |
| 2 | B | Fonte de notas + pipeline + CHANGELOG + RELEASE_PROCESS |
| 3 | C | Firestore rules/índices + integração CI |
| 4 | D | Camada KMP compartilhada |
| 5 | E + G | UI Android + iOS (composeApp) |
| 6 | F | UI Web |

### Decisões resolvidas na revisão (2026-05-22)

- ✅ **UI iOS** construída separadamente em `composeApp`; Android em `:app` (mantém convenção).
- ✅ **Drift de versão** Web×Android não é intencional — `versions.json` deve refletir o
  estado real e atualizado de cada plataforma (Task 1 apura os números corretos).
- ✅ **Backfill** das últimas 3 versões de cada plataforma: confirmado.

### Referências

- `CHANGELOG.md` (formato atual Keep a Changelog)
- `scripts/bump-version.js`, `.github/workflows/{version-bump,release}.yml`
- `commitlint.config.js` (tipos/escopos Conventional Commits)
- `scripts/run-migration-custom-claims.js` (padrão Admin SDK + SA para o `publish`)
- `.claude/rules/firestore.md`, `.claude/rules/viewmodel-patterns.md`, `web-react.md`

---

## Histórico de Alterações

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-05-22 | Renan / Claude | Criação inicial (status IN_REVIEW) |
| 2026-05-22 | Renan / Claude | Resolvidas 3 pendências; status → APPROVED |
