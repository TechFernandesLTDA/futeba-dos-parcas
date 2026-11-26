# CHORE: Android — textos de validação para strings.xml (fatia #4596 item 4)

> **Status:** `IN_PROGRESS`
> **Severidade:** `LOW`
> **Autor:** opencode
> **Data:** 2026-11-25
> **PR:** (a abrir)
> **Issue:** #4596 (item 4)

---

## 1. Verificação (25/11/2026)

### Use cases mortos (zero chamadores em produção)
| Código | Verificação |
|--------|-------------|
| `CreateGameUseCase` (domain/usecase/game) | Sem constructores/injetores em `app/src/main` (só `CreateGameUseCaseTest`) |
| `RecordPaymentUseCase` + `RecordExpenseUseCase` (domain/usecase/cashbox) | Sem Koin/injetores; `CashboxViewModel` usa `CashboxRepository` direto. Têm `private val validationHelper` injetado mas **nunca usado** (dead param) |
| Testes `RecordPaymentUseCaseTest`, `CashboxPermissionsTest`, `CreateGameUseCaseTest` | Só exercitam os use cases mortos |

### `util.ValidationHelper` — funções vivas (remaining)
| Função | Chamador vivo |
|--------|---------------|
| `validateEmail` | LoginScreen:308,324 |
| `validatePassword` | LoginScreen:309, RegisterScreen:228 |
| `validateName` | RegisterScreen:226 |
| `isValidEmail`, `validatePasswordMatch`, `validatePhone`, `validatePositiveInt`, `validateRange`, `validatePlayerCount`, `validatePrice`, `validateNonEmpty`, `validateLength`, `sanitize*` | Zero chamadores em main (só o teste do DOMAIN helper) |

### domain/validation (modelos)
`Group/Ranking/Location/... .validate()` alimenta `ValidationResult.Invalid` com mensagem PT; `LocationDetailViewModel:153,288` exibe para o usuário → **fora deste PR** (exige propagar Context nos modelos; follow-up). Este PR resolve as telas de auth.

---

## 2. Solução deste PR

1. Apagar os 3 use cases mortos + seus testes.
2. `util.ValidationHelper`: só as 3 funções vivas permanecem; mensagens via `Context` + `R.string` (`values`, `values-en`, `values-es`). Booleanas/puras sem texto permanecem (isValidEmail? — morto → apagar).
3. LoginScreen/RegisterScreen passam `context`.

## 3. Verificação

- [x] `:app:compileDebugKotlin` (ver PR)
- [ ] Lint Android sem novos warnings (CI)
- [ ] Smoke: login/register com email/senha inválidos mostra pt/en/es
