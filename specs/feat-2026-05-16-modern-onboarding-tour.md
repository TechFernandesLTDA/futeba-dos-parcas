# SPEC: Onboarding Moderno — Tour de Boas-Vindas + Primeiros Passos Gamificados

> **Status:** `APPROVED` (aprovada por Renan em 2026-05-16 — implementar Fase 1)
> **Autor:** Claude (Opus 4.7) — sessão com Renan
> **Data:** 2026-05-16
> **PR:** #xxx (preencher quando criar)

---

## ⭐ North Star

> **Toda decisão de onboarding se mede por uma única pergunta:**
> *"Isso aproxima o usuário de jogar a primeira pelada (ou entrar num grupo) mais rápido?"*
>
> KPI primário: **time-to-first-game** (TTFG) — tempo do 1º login até confirmar presença
> ou criar/entrar num jogo. Métrica secundária: **D1 / D7 retention**.
>
> "% de slides vistos" **não** é sucesso. Se um item não reduz TTFG, ele é Fase 2+ ou cortado.

---

## 1. Requirements (Requisitos)

### 1.1 Problema / Oportunidade

O onboarding atual (`ui/onboarding/OnboardingFlow.kt`) é funcional mas data: é uma
sequência linear `Welcome → Permissões → Perfil → AppGuide`, onde o `AppGuideScreen`
é uma **parede estática de 5 cards** (Home, Jogos, Jogadores, Liga, Grupos) com um
botão "Começar". Problemas concretos:

1. **Não cobre os recursos que diferenciam o app** — XP/níveis, badges, votação MVP,
   Liga/divisões, streak, locations/mapa, cashbox, prancheta tática, "Time do Coração".
   O usuário descobre tudo por tentativa e erro.
2. **Zero dicas contextuais** ("dicas de telas da primeira vez"). Ao chegar pela 1ª vez
   numa tela complexa (LiveGame, votação MVP, criar jogo) não há nenhum apoio.
3. **Não é gamificado** — o app inteiro é construído sobre XP/progressão, mas o
   onboarding não usa nada disso. Existe um empty state "Primeiros Passos"
   (`welcome_first_steps`) no Home que é texto morto, sem progresso nem recompensa.
4. **Web não tem paridade** — `web/src/pages/onboarding` só tem verificação CPF/telefone.
   Não há Welcome, guia, nem checklist no web.
5. **Não é rejogável** — quem pula não tem como rever depois (sem entrada em Ajuda).
6. **Sem analytics de funil** — não sabemos onde o novo usuário desiste.

Oportunidade: transformar o onboarding numa experiência moderna (carousel animado +
checklist gamificada + dicas one-shot estilo Linear/Notion) que **encurta o TTFG** e
ativa a retenção, com **paridade Android + Web** e *state model* compartilhado (KMP)
pronto para iOS.

### 1.2 Casos de Uso

| ID | Ator | Ação | Resultado esperado |
|----|------|------|--------------------|
| UC1 | Novo jogador | Cria conta e cai no onboarding | Vê carousel moderno (4 slides), entende o essencial em < 30s, chega no Home |
| UC2 | Novo jogador | Vê a checklist "Primeiros Passos" no Home | 4–5 itens claros; cada um conclui sozinho ao executar a ação real (não checkbox manual) |
| UC3 | Novo jogador | Completa a checklist | Ganha recompensa de boas-vindas (badge "Bem-vindo" — ver §3.2 decisão XP) + animação de celebração |
| UC4 | Novo jogador | Entra pela 1ª vez numa tela de alto valor (criar jogo, votar MVP, entrar em grupo) | Recebe **uma** dica contextual single-shot (tooltip/bottom-sheet), dispensável, nunca repetida |
| UC5 | Usuário existente | Quer rever o tour | Acessa "Como usar o app" em Ajuda/Configurações e replaya o carousel |
| UC6 | Usuário que pulou onboarding | Volta ao app | Checklist do Home continua disponível até ser concluída ou dispensada |
| UC7 | Product/Growth | Analisa funil | Dashboard com `onboarding_slide_viewed`, `checklist_step_completed`, `first_tip_dismissed`, TTFG |
| UC8 | Usuário offline | Abre app sem internet no 1º uso | Carousel e checklist funcionam (conteúdo local); ações que exigem rede mostram estado offline |

### 1.3 Critérios de Aceite

**Fase 1 (MVP embarcável):**
- [ ] CA1: Novo usuário vê um carousel de boas-vindas moderno (4 slides, swipe + dots animados, skip sempre visível) que substitui o `AppGuideScreen` estático.
- [ ] CA2: Home exibe uma checklist "Primeiros Passos" com 4–5 itens; cada item marca-se sozinho ao o usuário **realizar a ação real** (criar/entrar em grupo, confirmar presença, completar perfil, votar MVP/jogar 1 jogo).
- [ ] CA3: Concluir a checklist dispara recompensa + animação de celebração.
- [ ] CA4: Estado de onboarding persiste por usuário e sobrevive a reinstalação (Firestore, não só local) — ver §3.2.
- [ ] CA5: Paridade visual e funcional **Android + Web** (mesmos slides, mesma checklist, mesmos eventos).
- [ ] CA6: Analytics dispara em cada slide visto, cada step concluído e na conclusão total.
- [ ] CA7: Acessibilidade — todos os controles com `contentDescription`/`aria-label`, touch target ≥ 48dp, contraste ≥ 4.5:1, navegável por TalkBack/teclado.
- [ ] CA8: Carousel/checklist funcionam offline (conteúdo é local; sem crash sem rede).

**Fase 2:**
- [ ] CA9: Dicas contextuais one-shot em 3–4 telas de alto valor, dispensáveis, nunca repetidas (flag por tela).

**Fase 3:**
- [ ] CA10: Tour rejogável a partir de Ajuda/Configurações.
- [ ] CA11: Conteúdo do carousel parametrizável via Remote Config (habilita A/B test).

### 1.4 Fora de Escopo

- **Verificação CPF/telefone** — fluxo separado, não é tocado por esta spec.
- **UI de onboarding iOS** — apenas o *state model* KMP é especificado; a UI iOS é follow-up (iOS ainda está scaffold/bloqueado em TestFlight).
- Tour multi-passo intrusivo tipo "wizard" sobre a UI real (anti-padrão; usamos one-shot tips).
- Onboarding diferenciado por role (ADMIN/FIELD_OWNER) — v2.
- Vídeos/Lottie pesados — usamos animações Compose/CSS nativas e ilustrações vetoriais leves.
- Tradução i18n além de PT-BR (app é PT-BR-only hoje).

---

## 2. UX/UI Design

### 2.1 Fluxo de Navegação

```
[Signup/Login OK]
   → [OnboardingFlow] (REUSO — só troca o passo 4)
        passo 0: WelcomeScreen        (existe, mantém)
        passo 1: PermissionOnboarding (existe, mantém)
        passo 2: ProfileSetup         (existe, mantém)
        passo 3: WelcomeCarousel  ◀── NOVO (substitui AppGuideScreen)
                    ├─ swipe/next entre 4 slides
                    ├─ "Pular" sempre visível (top-right)
                    │     → Home · carouselSkipped=true · carouselCompletedAt=null
                    │       (checklist continua disponível normalmente)
                    └─ último slide: CTA "Bora jogar!"
                          → Home · carouselCompletedAt=now · carouselSkipped=false
   → [Home]
        ├─ FirstStepsChecklist (NOVO — card fixo no topo até concluir/dispensar)
        │     ├─ tap item → navega pra ação real (deep link)
        │     ├─ item conclui sozinho via evento de domínio (não checkbox manual)
        │     └─ ícone "X" (dispensar) → diálogo "Dispensar — você pode rever
        │           em Ajuda" → checklistDismissed=true (card some; replay na Fase 3)
        └─ ao concluir todos → CelebrationSheet (confete + recompensa)

[1ª vez em tela de alto valor]  (Fase 2)
   → FirstTimeTip (bottom-sheet/tooltip single-shot)
        └─ "Entendi" → seta firstTimeTipShown_<screenId>=true (nunca mais aparece)

[Settings/Ajuda]  (Fase 3)
   → "Como usar o app" → replay WelcomeCarousel (modo review, sem checklist)
```

### 2.2 Telas e Estados

| Tela | Estado | Descrição |
|------|--------|-----------|
| `WelcomeCarousel` | Success | 4 slides, pager animado, dots, skip, CTA final |
| `WelcomeCarousel` | Offline | Funciona normal (conteúdo local); CTA final navega ao Home mesmo offline |
| `FirstStepsChecklist` | Loading | Shimmer (3 linhas) enquanto lê estado do onboarding |
| `FirstStepsChecklist` | InProgress | Lista de steps; concluídos com check animado + XP/selo; barra de progresso |
| `FirstStepsChecklist` | Empty/Dismissed | Card some (usuário concluiu ou tocou "dispensar") |
| `FirstStepsChecklist` | Error | Card colapsa silenciosamente (não bloqueia Home) + log; retry em background |
| `CelebrationSheet` | Success | Animação de confete + "Você completou seus primeiros passos!" + recompensa |
| `FirstTimeTip` (F2) | Success | Tooltip/bottom-sheet com 1 dica + botão "Entendi" |

**Conteúdo dos 4 slides (Fase 1) — filtrado pelos buckets do North Star:**

| # | Slide | Bucket | Mensagem (amigável, PT-BR) |
|---|-------|--------|----------------------------|
| 1 | "Sua pelada, organizada" | Core | Crie ou entre num grupo, agende jogos e confirme presença num toque. |
| 2 | "Jogou, pontuou" | Gamificação (consolidado) | Cada jogo dá XP. Suba de nível, dispute a Liga e desbloqueie badges. |
| 3 | "Chame os parças" | Core / Ação | Time vazio não joga. Compartilhe o convite do grupo e monte a pelada. CTA secundário → fluxo de convite (invite system já existe). |
| 4 | "Bora começar!" | Ação | Resumo + CTA grande "Bora jogar!" → leva direto ao Home com a checklist. |

> **Por que slide 3 é "Chame os parças" e não votação MVP:** votação MVP é fluxo
> *pós-jogo* — explicar antes do usuário ter jogado **não encurta TTFG** (falha o
> North Star). MVP vira **tip contextual Fase 2** no 1º jogo FINISHED. O convite de
> grupo, ao contrário, é pré-requisito direto pra jogar → puxa TTFG.
>
> Locations/Mapa, Cashbox, Tática, LiveGame, votação MVP **não** ganham slide —
> descoberta via empty states modernos (já existem) e dicas contextuais Fase 2.
> Decisão registrada em DECISIONS.md.

**Checklist "Primeiros Passos" (Fase 1) — reaproveita strings `welcome_step_*`:**

| Step | Conclui quando… | Deep link do tap |
|------|-----------------|------------------|
| `complete_profile` | usuário salva nome + posição/foto | Tela de editar perfil |
| `join_or_create_group` | entra em ou cria 1 grupo | Aba Grupos |
| `confirm_presence` | confirma presença em ≥1 jogo | Aba Jogos |
| `play_first_game` | participa de 1 jogo finalizado (ou vota MVP) | Aba Jogos |

> Steps detectados por **evento de domínio real** (já existem repos/triggers), nunca
> checkbox manual — evita "fake completion" e mantém honestidade do TTFG.

### 2.3 Responsividade

| Configuração | Comportamento |
|--------------|---------------|
| Phone Portrait | Carousel full-screen; checklist como card no topo do Home |
| Phone Landscape | Carousel: ilustração à esquerda, texto/CTA à direita |
| Tablet (sw600dp+) / Web ≥ md | Carousel centralizado max-width ~480dp; checklist em coluna lateral ou card destacado |
| Web mobile | Idêntico ao phone portrait |

### 2.4 Acessibilidade

- [ ] `contentDescription`/`aria-label` em dots, skip, next, CTAs, cada item da checklist
- [ ] Touch targets ≥ 48dp
- [ ] Contraste ≥ 4.5:1 (`ContrastHelper` no Android; tokens MUI no Web)
- [ ] TalkBack/leitor de tela anuncia "slide X de 4" e progresso da checklist
- [ ] Navegação por teclado/D-pad (web: Tab/Enter; Android: D-pad)
- [ ] `prefers-reduced-motion` (web) / config de animações reduzidas: desliga confete/parallax
- [ ] Carousel não depende só de swipe — botões next/prev visíveis

### 2.5 Animações e Micro-interações

- Carousel: slide horizontal + fade (reusar `AnimatedContent` do `OnboardingFlow`); dots com escala/cor animada no slide ativo.
- Checklist: check com `scaleIn` + risco no texto; barra de progresso anima incremental. Dispensar = ícone "X" no canto do card → diálogo de confirmação "Dispensar — você pode rever em Ajuda" → card colapsa com `shrinkOut`.
- Conclusão: `CelebrationSheet` com confete (partícula leve nativa — sem Lottie pesado) + haptic no Android.
- Tudo respeita "reduzir animações" (acessibilidade).

---

## 3. Technical Design

### 3.1 Arquitetura

```
[UI: WelcomeCarousel / FirstStepsChecklist / FirstTimeTip]   (Android Compose · Web React+MUI)
        ↓ eventos
[ViewModel: OnboardingViewModel : StateFlow<OnboardingUiState>]  (Android)
[Hook: useOnboarding()]                                          (Web)
        ↓
[Domain: OnboardingState (KMP shared/commonMain)]  ◀── fonte da verdade do modelo
        ↓
[Repository: OnboardingRepository]
        ↓
[DataSource: Firestore users/{uid}.onboarding + PreferencesManager (cache local de flags one-shot)]
```

- **State model em `shared/commonMain`** (KMP) → Android, Web (via tipos espelhados em `web/src/types`) e iOS futuro consomem o mesmo contrato. iOS UI = follow-up.
- Reuso máximo: `OnboardingFlow.kt` mantido; só o passo 3 (`AppGuideScreen`) é trocado por `WelcomeCarousel`. `WelcomeScreen`, `PermissionOnboardingScreen`, `ProfileSetupScreen` intocados.
- Gating segue o padrão existente `PreferencesManager.setPermissionOnboardingCompleted(...)`.

### 3.2 Modelos de Dados

```kotlin
// shared/src/commonMain/kotlin/.../onboarding/OnboardingState.kt
@Serializable
data class OnboardingState(
    val carouselCompletedAt: Long? = null,     // null = ainda não viu/concluiu
    val carouselSkipped: Boolean = false,
    val checklistSteps: Map<String, Boolean> = emptyMap(), // stepId -> done
    val checklistCompletedAt: Long? = null,
    val checklistDismissed: Boolean = false,
    val firstTimeTips: Map<String, Boolean> = emptyMap(),  // screenId -> shown (Fase 2)
    val rewardGranted: Boolean = false,
    val version: Int = 1                       // bump força re-tour em mudança de conteúdo
)

enum class OnboardingStep(val id: String) {
    COMPLETE_PROFILE("complete_profile"),
    JOIN_OR_CREATE_GROUP("join_or_create_group"),
    CONFIRM_PRESENCE("confirm_presence"),
    PLAY_FIRST_GAME("play_first_game")
}
```

**Re-tour por versão:** no boot, se `state.version < CURRENT_ONBOARDING_VERSION`,
abrir o carousel em **modo review** (sem repetir a checklist nem reconceder recompensa);
ao concluir, gravar `version = CURRENT_ONBOARDING_VERSION`. Usado quando o conteúdo
dos slides muda materialmente.

> **Decisão aberta — recompensa (validar com `xp-engine-guardian`):**
> Conceder **XP** de boas-vindas mexe no sistema de XP (anti-cheat caps, `xp_logs`,
> season). Para **de-riscar a Fase 1**, a recompensa default é uma **badge
> "Bem-vindo"** (sistema de badges já isolado, sem efeito em ranking/season).
> XP de boas-vindas fica como opção a validar com o `xp-engine-guardian` antes de
> qualquer implementação que toque `xp_logs`. **Não implementar XP sem essa validação.**

### 3.3 API / Firestore

| Operação | Collection/Doc | Método | Payload |
|----------|----------------|--------|---------|
| Ler estado | `users/{uid}` campo `onboarding` | GET | - |
| Atualizar step/skip/dismiss | `users/{uid}` | UPDATE (merge) | `{ onboarding: {...} }` |
| Conceder badge "Bem-vindo" | `user_badges/{uid}` (fluxo de badge já existente) | via `badges/badge-helper.ts` | `{ badgeId: "welcome" }` |
| Detecção de steps | listeners/triggers **já existentes** (grupo criado, presença confirmada, jogo finalizado, perfil salvo) | — | reaproveitar; sem nova Cloud Function se possível |

- Sem nova collection. `onboarding` é um mapa dentro de `users/{uid}` (1 doc já lido no boot).
- **Firestore rules:** usuário só lê/escreve `onboarding` do próprio doc; campos de step **não podem** ser setados manualmente pelo client de forma que burle XP — como a recompensa Fase 1 é badge (não XP) o risco é baixo; se virar XP, a concessão **tem que** ser server-side (Cloud Function), nunca client.

### 3.4 Cache e Offline

| Cenário | Comportamento |
|---------|---------------|
| 1º uso sem internet | Carousel/checklist renderizam (conteúdo 100% local). Estado fica em `PreferencesManager`, sincroniza pro Firestore quando voltar a rede |
| Perda de conexão durante onboarding | Progresso local não se perde; merge no Firestore com `serverTimestamp()` ao reconectar |
| Reinstalação do app | Estado vem do Firestore (`users/{uid}.onboarding`) — não repete tour já concluído |
| Conflito local vs servidor | Servidor vence para `*CompletedAt`; OR lógico para flags booleanas (step concluído nunca "desconclui") |

### 3.5 Segurança

- [ ] Sem token/secret hardcoded
- [ ] `onboarding` é dado não-sensível; ainda assim escrita restrita ao próprio `uid` nas rules
- [ ] Recompensa que afete ranking/XP **só** server-side (ver §3.2) — client nunca credita XP
- [ ] Validação de `stepId` contra enum (client e, se houver função, server) — ignora ids desconhecidos
- [ ] Firestore rules atualizadas + teste de rules (usuário A não escreve onboarding de B)

### 3.6 Performance

- [ ] Ilustrações vetoriais leves (Compose `ImageVector`/SVG no web) — sem Lottie/MP4
- [ ] Carousel usa pager nativo (HorizontalPager Android / MUI/CSS scroll-snap web), sem lib externa
- [ ] Estado de onboarding lido do `users/{uid}` que **já é carregado** no boot — zero read extra
- [ ] Checklist deriva de dados já em cache (grupos/jogos do usuário) — sem query nova quando possível
- [ ] `derivedStateOf`/`remember` no Android; memo no web — sem recomposição por slide

### 3.7 Analytics e Observabilidade

| Evento | Quando dispara | Parâmetros |
|--------|----------------|------------|
| `onboarding_started` | Entra no carousel | `source` (signup/replay) |
| `onboarding_slide_viewed` | Cada slide exibido | `slide_index`, `slide_id` |
| `onboarding_skipped` | Toca "Pular" | `at_slide_index` |
| `onboarding_carousel_completed` | CTA final | `duration_ms` |
| `checklist_step_completed` | Step conclui (evento de domínio) | `step_id`, `time_since_start_ms` |
| `checklist_completed` | Todos os steps | `total_duration_ms` (≈ TTFG proxy) |
| `checklist_dismissed` | Usuário dispensa | `steps_done`, `steps_total` |
| `onboarding_reward_granted` | Recompensa concedida | `reward_type` (`badge`/`xp`) |
| `first_tip_shown` / `first_tip_dismissed` (F2) | Dica one-shot | `screen_id` |

**Logs:** nível `DEBUG`, sem PII (só `uid` hash já padrão do projeto). Analytics é **obrigatório na Fase 1** — sem ele a Fase 3 (A/B) não existe.

---

## 4. Tasks (Breakdown)

### Fase 1 — MVP embarcável (Android + Web + KMP state)

| # | Task | Est. | Status |
|---|------|------|--------|
| 1 | `OnboardingState` + `OnboardingStep` em `shared/commonMain` | 2h | ⬜ |
| 2 | `OnboardingRepository` (Firestore `users/{uid}.onboarding` + merge offline) | 3h | ⬜ |
| 3 | Firestore rules: escrita de `onboarding` restrita ao próprio uid + teste de rules | 2h | ⬜ |
| 4 | Android: `WelcomeCarousel` (HorizontalPager, dots, skip, 4 slides) substituindo passo 3 do `OnboardingFlow` | 5h | ⬜ |
| 5 | Android: `OnboardingViewModel` + `FirstStepsChecklist` no Home (deriva steps de eventos de domínio) | 5h | ⬜ |
| 6 | Android: `CelebrationSheet` + recompensa badge "Bem-vindo" (via badge-helper) | 3h | ⬜ |
| 7 | Web: paridade — `WelcomeCarousel` (MUI, scroll-snap), `useOnboarding()` hook, integração TanStack Query, i18n, checklist no Home | 14h | ⬜ |
| 8 | Strings: reaproveitar `welcome_step_*`, novos textos dos slides em `strings.xml` + web i18n | 2h | ⬜ |
| 9 | Analytics: todos os eventos §3.7 (Android + Web) | 3h | ⬜ |
| 10 | Validar recompensa com `xp-engine-guardian` (badge vs XP) — decisão registrada | 1h | ⬜ |
| 11 | Testes: ViewModel/repo (state machine, offline merge), rules test, UI smoke (carousel skip/complete) | 4h | ⬜ |
| 12 | DECISIONS.md: phasing + critério time-to-first-game + "sem slide para Locations/Cashbox/Tática" | 0.5h | ✅ (nesta spec) |

### Fase 2 — Dicas contextuais

| # | Task | Est. | Status |
|---|------|------|--------|
| 13 | `FirstTimeTip` component (Android bottom-sheet · Web Popover/Tooltip MUI), single-shot por `screenId` | 4h | ⬜ |
| 14 | Instrumentar 3–4 telas de alto valor (criar jogo, votar MVP, entrar em grupo, 1ª LiveGame) | 4h | ⬜ |
| 15 | Analytics `first_tip_*` + testes | 2h | ⬜ |

### Fase 3 — Replay + A/B

| # | Task | Est. | Status |
|---|------|------|--------|
| 16 | Entrada "Como usar o app" em Ajuda/Configurações → replay do carousel (modo review) | 3h | ⬜ |
| 17 | Conteúdo do carousel via Remote Config (slides parametrizáveis) | 3h | ⬜ |
| 18 | Setup A/B (variantes de conteúdo) + dashboard de funil/TTFG | 4h | ⬜ |

**Total estimado:** Fase 1 ≈ 44h · Fase 2 ≈ 10h · Fase 3 ≈ 10h

---

## 5. Verification (Verificação)

### 5.1 Testes

| Tipo | Cobertura | Status |
|------|-----------|--------|
| Unit (OnboardingState machine / repo) | steps idempotentes, merge offline, version bump | ⬜ |
| Unit (ViewModel / hook) | transições de UiState, skip, dismiss | ⬜ |
| Firestore rules test | usuário A não escreve `onboarding` de B; usuário só altera o próprio doc (recompensa Fase 1 = badge, não toca XP — placeholder de teste server-side caso XP venha na §3.2) | ⬜ |
| UI (Compose) | carousel: skip no slide 2, completar, checklist conclui via evento | ⬜ |
| Web (Vitest/Playwright) | paridade carousel + checklist | ⬜ |

### 5.2 Checklist de Revisão

- [ ] Build Android + Web passam sem erro/warning novo
- [ ] Detekt / ESLint limpos
- [ ] Testes passam (incl. rules test)
- [ ] Light/dark theme OK (Android + Web)
- [ ] Phone/landscape/tablet/web responsivos
- [ ] Sem regressão no `OnboardingFlow` existente (CPF/telefone intactos)
- [ ] Strings em `strings.xml` / i18n web (sem hardcode)
- [ ] Analytics disparando (validado no DebugView)
- [ ] Acessibilidade (TalkBack + teclado web) verificada
- [ ] Offline: 1º uso sem rede não quebra
- [ ] Recompensa validada com `xp-engine-guardian` antes de mexer em XP
- [ ] DECISIONS.md atualizado

### 5.3 Demo

- [ ] Vídeo: novo usuário do signup → carousel → Home → completa checklist → celebração (Android e Web)
- [ ] Métrica baseline de TTFG capturada antes do rollout (grupo controle)

---

## 6. Notas e Referências

- Reuso: `app/.../ui/onboarding/OnboardingFlow.kt`, `AppGuideScreen.kt` (será substituído), `util/PreferencesManager.kt`
- Strings já existentes a reaproveitar: `welcome_first_steps`, `welcome_step_create_game`, `welcome_step_invite_friends`, `welcome_step_earn_xp`, `welcome_xp_tip`, `welcome_action_create_game`, `welcome_action_join_group`
- Web: `web/src/pages/onboarding` (hoje só CPF/telefone — adicionar carousel/checklist)
- Paridade 3 plataformas: state em `shared/commonMain`; UI iOS = follow-up
- Recompensa: coordenar com `functions/src/badges/badge-helper.ts`
- Decisões: `/specs/DECISIONS.md` (entrada "Onboarding Moderno — Phasing & North Star")
- Precedentes de spec: `feat-2026-05-09-favorite-team.md`, `feat-2026-05-08-web-desktop-nav-phase-1.md`

---

## Histórico de Alterações

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-05-16 | Claude (Opus 4.7) | Criação inicial (DRAFT) — escopo travado por north star TTFG + advisor phasing |
| 2026-05-16 | Claude (Opus 4.7) | Revisão pós-advisor: slide 3 MVP→"Chame os parças" (passa no TTFG); dispensar checklist no fluxo; "Pular" definido (skipped vs completed); re-tour por versão; rules test reescrito (badge ≠ XP); estimativa web 8h→14h |
| 2026-05-16 | Renan | **APPROVED** — implementar Fase 1 |
