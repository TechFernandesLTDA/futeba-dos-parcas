# BUGFIX: Consistência client do fluxo CPF (Android + Web) — partes client de #1310

> **Status:** `APPROVED`
> **Severidade:** `MEDIUM`
> **Autor:** Claude (agente client wave #1310)
> **Data:** 2026-05-17
> **PR:** (este PR)

---

## 1. Descrição do Bug

Auditoria CPF 2026-05-17 (umbrella #1310) levantou inconsistências e fragilidades
nas partes **client** do fluxo de verificação de CPF. Este spec cobre APENAS os
itens client (L2, L3, L4, L5, L7, L9). Os itens functions (L1, L6, L8) vão em PR
separado / hotfix #1314 — fora do escopo deste agente.

### 1.1 Comportamento Atual (Errado)

- **L2** `CpfValidator.kt` (shared KMP): `filter { it.isDigit() }` aceita dígitos
  Unicode (ex.: dígitos árabe-índicos `٠١٢`), que `digitToInt()` converteria — risco
  de aceitar CPF com glifos não-ASCII.
- **L3** `web/cpfValidator.ts`: `isValidCpf` só tem `if (!cpf)`; chamado com
  non-string (number/object via `as unknown`) crasha em `.replace`.
- **L4** `CpfVerificationViewModel.parseError`: classifica erro por
  `.contains("already-exists")` na message — frágil (depende de string interna do
  SDK / i18n).
- **L5** `FormattingHelper.formatCPF`: regex `[^0-9]` + lógica duplicada,
  divergente da fonte única `CpfValidator.format`.
- **L7** `CpfVerificationScreen`: sem estado visual de sucesso — navega
  imediatamente. Web mostra `CheckCircle` por ~1,4s antes de prosseguir
  (sem paridade).
- **L9** `web/cpfValidator.test.ts`: falta caso whitespace-only (paridade com
  `CpfValidatorTest.kt:40` que testa `"   "`).

### 1.2 Comportamento Esperado (Correto)

- L2: `filter { it in '0'..'9' }` (ASCII only) nos 2 sites (`isValid`, `strip`;
  `mask`/`format` herdam via `strip`).
- L3: guard `if (typeof cpf !== 'string') return false;` no início, mantendo
  `if (!cpf)`.
- L4: usar `FirebaseFunctionsException.code` (ex.: `Code.ALREADY_EXISTS`) com
  fallback string para exceptions não-Functions.
- L5: `formatCPF` delega a `CpfValidator.format` (fonte única).
- L7: estado visual de sucesso (ícone CheckCircle + mensagem) por ~1,4s antes de
  `onSuccess()`. Cor via `MaterialTheme.colorScheme.*`, string em `strings.xml`.
- L9: adicionar teste rejeitando string whitespace-only.

### 1.4 Contexto

| Item | Valor |
|------|-------|
| Versão do app | 1.22.0 |
| Frequência | Edge cases (Unicode digits / non-string input) — raro mas exploitável |
| Impacto | Consistência cross-plataforma + UX (feedback de sucesso) |

---

## 2. Análise de Causa Raiz

Algoritmo mod-11 está **correto e idêntico** nas 3 plataformas — NÃO alterado.
As divergências são em: (a) normalização de input (Unicode vs ASCII), (b) guards
de tipo, (c) classificação de erro frágil, (d) duplicação de formatação, (e)
ausência de feedback de sucesso no Android.

### 2.3 Arquivos Afetados

| Arquivo | Item | Motivo |
|---------|------|--------|
| `shared/.../domain/util/CpfValidator.kt` | L2 | Unicode digits |
| `web/src/utils/cpfValidator.ts` | L3 | type guard |
| `app/.../ui/onboarding/CpfVerificationViewModel.kt` | L4 | error code vs string |
| `app/.../util/FormattingHelper.kt` | L5 | dedup → fonte única |
| `app/.../ui/onboarding/CpfVerificationScreen.kt` | L7 | success state |
| `app/src/main/res/values/strings.xml` | L7 | string de sucesso |
| `web/src/utils/cpfValidator.test.ts` | L9 | caso whitespace |

---

## 3. Solução Proposta

Mudanças pontuais e cirúrgicas conforme 1.2. `parseError` mantém fallback de
string para `RuntimeException` genérica (preserva teste existente
`verifyCpf_callableFails_stateIsError`). Success state usa `delay(1400)` no
`LaunchedEffect` da Screen (não afeta VM tests que usam `advanceUntilIdle`).

### 3.3 Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Regressão no algoritmo | NÃO tocado; tests `*CpfValidator*` cobrem |
| VM test quebrar com L4 | Fallback string mantido; teste só assere `Error` |
| MagicNumber detekt (1400) | Constante nomeada `SUCCESS_DISPLAY_MS` |

---

## 4. Verificação

### 4.3 Checklist

- [x] `./gradlew :app:compileDebugKotlin`
- [x] `./gradlew :shared:testDebugUnitTest --tests "*CpfValidator*"`
- [x] `./gradlew :app:testDebugUnitTest --tests "*CpfVerificationViewModel*"`
- [x] `./gradlew detekt` sem novos issues
- [x] `cd web && npm run build`
- [x] `npx vitest run src/utils/cpfValidator.test.ts`
- [x] `npm run lint`

---

## Histórico

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-05-17 | Claude | Spec criada e aprovada (partes client #1310) |
| 2026-05-17 | Claude | Fix implementado |
