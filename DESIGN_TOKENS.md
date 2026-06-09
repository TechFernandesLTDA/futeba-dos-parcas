# Design Tokens — Futeba dos Parças

> **Fonte única do design system cross-platform.** Documenta os tokens
> canônicos compartilhados entre Web (React + MUI 5) e Android (Compose +
> Material 3). Toda nova feature deve consumir estes tokens — nunca valores
> hardcoded.
>
> Issues de origem: #2239 (este doc), #2236 (badges/gamificação), #2195
> (animação), #2180/#2183 (cores e tokens).

---

## Onde cada token vive

| Categoria | Web | Android |
|-----------|-----|---------|
| Cores | `web/src/theme/index.ts` | `app/.../ui/theme/Color.kt` |
| Tipografia | MUI `typography` em `theme/index.ts` | `app/.../ui/theme/Typography.kt` (`FutebaTypography`) |
| Espaçamento | `web/src/theme/pageTokens.ts` | `app/.../ui/theme/Spacing.kt` |
| Ícones (tamanho) | `web/src/theme/iconSizes.ts` | `MaterialTheme` sizes / `Modifier.size` |
| Formas/raio | MUI `shape.borderRadius` | `app/.../ui/theme/Shape.kt` (`FutebaShapes`) |
| Gamificação | `gamificationColors[Dark]` em `theme/index.ts` | `GamificationColors` em `Color.kt` |
| Gradientes | (não usado — flat) | `app/.../ui/theme/Gradients.kt` |
| **Animação** | **`web/src/theme/motion.ts`** | **`app/.../ui/theme/AppMotion.kt`** |

---

## 1. Cores de marca

| Token | Web | Android | Uso |
|-------|-----|---------|-----|
| Primary | `#00852A` (light, WCAG AA 4.76:1) | tema M3 `primary` | CTAs, brand |
| Brand original | `#00C853` (gamificationColors.brand) | `XpGreen #00C853` | barras de XP, acento |
| Secondary | `#2979FF` | tema M3 `secondary` | ações secundárias |

> **Nota WCAG:** o verde de marca puro (`#00C853`, 2.24:1 sobre branco) reprova
> em texto. A web usa `#00852A` para texto/CTA e reserva `#00C853` para
> elementos não-textuais (barras de XP). Android usa roles do M3.

### Dark mode background — DIVERGÊNCIA CONHECIDA (decisão de produto pendente)

| Token | Web | Android |
|-------|-----|---------|
| Background Dark | `#0F172A` (slate) | `#0F1114` (neutro/true-black) |
| Surface Dark | `#1E293B` (slate) | `#15191C` (neutro) |

A web é afinada em torno do slate `#0F172A` (sombras inclusive). Android usa
neutro/OLED. **Unificar é decisão de produto** — registrada em
`specs/DECISIONS.md`. Não alinhar sem spec aprovada (Regra #1 SDD).

---

## 2. Gamificação (medalhas, MVP, divisões)

**Canônico = Android** (`GamificationColors` em `Color.kt`); documentado também
em `.claude/rules/material3-compose-reference.md`.

| Token   | HEX base canônico | Web light                   | Web dark                        | Android (`GamificationColors`)    |
|---------|-------------------|-----------------------------|---------------------------------|-----------------------------------|
| Gold    | `#FFD700`         | `#FFD700` ✅ (#2236)         | `#FFD700` ✅                    | `Gold = Color(0xFFFFD700)` ✅     |
| Silver  | `#E0E0E0`         | `#E0E0E0` ✅ (#2236)         | `#E0E0E0` ✅                    | `Silver = Color(0xFFE0E0E0)` ✅   |
| Bronze  | `#CD7F32`         | `#CD7F32` ✅                 | `#E8924A` (clareado p/ dark)    | `Bronze = Color(0xFFCD7F32)` ✅   |
| Diamond | `#B9F2FF`         | `#B9F2FF` ✅ (#2236)         | `#B9F2FF` ✅                    | `Diamond = Color(0xFFB9F2FF)` ✅  |

> **Nota:** Gold (`#FFD700`) e Silver (`#E0E0E0`) são cores de fundo — usar
> texto escuro sobre eles (ex.: `#1A1C1E`) ou calcular via `getContrastText()`.
> Bronze no dark mode é clareado (`#E8924A`) pois `#CD7F32` perde contraste em
> fundos escuros (#0F172A / #1E293B).
>
> Seleção automática por modo: `getGamificationColors(theme)` /
> `useGamificationColors()`. Android usa `GamificationColors` + `ContrastHelper`
> para o texto. **Paridade total** (todos os tiers alinhados) após #2236.

### Formato de badge/medalha (#2236)

- **Forma:** circular.
- **Texto/ícone interno:** cor de contraste calculada (`ContrastHelper` no
  Android; `theme.palette.getContrastText` na web).
- **Gradiente:** opcional, apenas Android (`Gradients.kt`) para tiers de divisão.
  A web usa cor sólida. Não é divergência bloqueante — ambos comunicam o tier
  pela mesma cor base.

### Raridade de badge

| Raridade | Light | Dark |
|----------|-------|------|
| COMUM | `#9E9E9E` | `#BDBDBD` |
| INCOMUM | `#388E3C` | `#66BB6A` |
| RARO | `#2196F3` | `#42A5F5` |
| ÉPICO | `#9C27B0` | `#CE93D8` |
| LENDÁRIO | `#FF9800` | `#FFB74D` |

---

## 3. Tipografia

Escala Material 3 (display / headline / title / body / label). Detalhes em
`.claude/rules/material3-compose-reference.md` (seção 4). Web mapeia para os
`variant` do MUI (`h4`–`h6`, `subtitle`, `body1/2`, `caption`, `overline`).

**Regra:** usar `variant`/`style` da escala — nunca `fontSize`/`fontWeight`
hardcoded.

---

## 4. Espaçamento (grid 8px)

| Token | Valor | Web | Android |
|-------|-------|-----|---------|
| xs | 4px | `pagePadding.xs`≈ | `Spacing.xs = 4.dp` |
| sm | 8px | — | `Spacing.sm = 8.dp` |
| md | 16px | `pagePadding.md`≈ | `Spacing.md = 16.dp` |
| lg | 24px | — | `Spacing.lg = 24.dp` |
| xl | 32px | — | `Spacing.xl = 32.dp` |

Web também: `headerHeight = 56`, `bottomBarHeight = 64`, `contentMaxWidth = 720`.

---

## 5. Ícones (tamanho)

| Token | px | Uso |
|-------|----|----|
| xs | 14 | inline pequeno |
| sm | 16 | chips/listas |
| md | 20 | botões |
| lg | 24 | padrão MUI/M3 |
| xl | 36 | headers/destaques |
| xxl | 48 | empty states |
| hero | 64 | onboarding/splash |

Web: `iconSizes` em `theme/iconSizes.ts`. Android: `Modifier.size(N.dp)` com os
mesmos valores.

---

## 6. Formas / raio

| Token | Raio | Uso |
|-------|------|-----|
| extraSmall | 4dp | chips, badges |
| small | 8dp | botões, campos |
| medium | 16dp | cards, dialogs |
| large | 24dp | bottom sheets, drawers |
| extraLarge | 32dp | elementos full-width |

Web: MUI `shape.borderRadius` (12 default, Card override 16). Android:
`FutebaShapes` (`MaterialTheme.shapes.*`).

> **#2183:** `HighContrastTheme`/`OledTheme` no Android devem passar
> `FutebaTypography`/`FutebaShapes` (não `MaterialTheme.*` lido dentro do
> builder, que retorna defaults do M3). Corrigido.

---

## 7. Animação (#2195)

Tokens de duração/easing centralizados, alinhados ao Material Design 3 Motion.

**Localização dos tokens:**

| Plataforma | Arquivo | Objeto/Classe |
|------------|---------|---------------|
| Web        | `web/src/theme/motion.ts` | `motionDuration`, `motionEasing`, `motion()` |
| Web (re-export) | `web/src/theme/index.ts` | (mesmos, para importadores do tema) |
| Android    | `app/src/main/java/com/futebadosparcas/ui/theme/AppMotion.kt` | `MotionDuration`, `MotionEasing` |

### Durações

| Token    | Valor  | Web (`motionDuration`)   | Android (`MotionDuration`) | Uso típico                              |
|----------|--------|--------------------------|----------------------------|-----------------------------------------|
| `short`  | 150 ms | `motionDuration.short`   | `MotionDuration.Short`     | Tooltips, micro-feedback, ripple        |
| `medium` | 300 ms | `motionDuration.medium`  | `MotionDuration.Medium`    | Navegação, modais, transições padrão    |
| `long`   | 500 ms | `motionDuration.long`    | `MotionDuration.Long`      | Onboarding, celebração de XP, hero anim |

### Easings (Material 3)

| Token        | Curva CSS                    | Android (`MotionEasing`)         | Uso típico                              |
|--------------|------------------------------|----------------------------------|-----------------------------------------|
| `standard`   | `cubic-bezier(0.2, 0, 0, 1)` | `MotionEasing.Standard`          | Uso geral                               |
| `emphasized` | `cubic-bezier(0.2, 0, 0, 1)` | `MotionEasing.Emphasized`        | FAB, hero, destaque high-emphasis       |
| `decelerate` | `cubic-bezier(0, 0, 0, 1)`   | `MotionEasing.Decelerate`        | Elementos que entram em tela            |
| `accelerate` | `cubic-bezier(0.3, 0, 1, 1)` | `MotionEasing.Accelerate`        | Elementos que saem de tela              |

**Uso web:**
```ts
import { motion, motionDuration, motionEasing } from '@/theme';
// em sx prop:
sx={{ transition: motion('opacity', 'medium', 'standard') }}
// valor direto:
`${motionDuration.medium}ms ${motionEasing.decelerate}`
```

**Uso Android:**
```kotlin
import com.futebadosparcas.ui.theme.MotionDuration
import com.futebadosparcas.ui.theme.MotionEasing
// em animationSpec:
tween(durationMillis = MotionDuration.Medium, easing = MotionEasing.Standard)
```

**Acessibilidade:** respeitar `prefers-reduced-motion` (web — já coberto pelo
`MuiCssBaseline` override no tema) e `Settings.Global.ANIMATOR_DURATION_SCALE`
(Android — gerenciado automaticamente pelo sistema).

---

## 8. Estados obrigatórios (toda tela)

`loading` (shimmer/skeleton) · `empty` (mensagem + ação) · `error` (mensagem +
retry) · `success`.

- Web: `web/src/components/states/` + `EmptyState` (variantes em
  `components/common/EmptyState.tsx`).
- Android: `ui/components/states/LoadingState.kt`, `modern/EmptyState.kt`,
  `modern/ErrorState.kt`.

### Catálogo de EmptyState (paridade #2197)

Variantes alinhadas entre plataformas (mesmos ícones Material por categoria):
Games, Groups, Players, Notifications, Search, Ranking, Badges, League,
Schedules, Locations, Challenges, **Cashbox, Members, Activities, XpLogs,
Statistics, Confirmations**.

---

## 9. Feedback tátil / micro-interações (#2218)

- Android: `SoundboardReactions`, `MicroInteractionModifiers`,
  `ConfettiAnimation`.
- Web: `useHapticFeedback` (`navigator.vibrate`, fallback silencioso, respeita
  `prefers-reduced-motion`). Padrões: `light` (10ms), `medium` (25ms), `heavy`
  (50ms), `success` (`[40,30,40]`), `error` (`[60,40,60,40,60]`). Aplicado em
  `InteractiveCard` e `ConfirmDialog`.

---

## Manutenção

Atualize este arquivo como parte de qualquer feature que introduza ou altere um
token. Decisões de divergência (ex.: dark background, bottom nav) devem ser
registradas em `specs/DECISIONS.md`.
