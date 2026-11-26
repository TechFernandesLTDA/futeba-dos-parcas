# FEAT: mensagens de validação localizadas (follow-up #4596)

> **Status:** `IN_PROGRESS`
> **Severidade:** `LOW`
> **Autor:** opencode
> **Data:** 2026-11-25
> **PR:** (a abrir)
> **Issue:** #4596 (item 4 ficava aberto: domain/validation em PT fixo)

---

## Diagnóstico (25/11/2026)

- `util.ValidationHelper` (auth) já migrado no #4654.
- `domain/validation.ValidationHelper` (55 mensagens em PT) alimenta `ValidationResult.Invalid` (246 construções). `message` continua exibido na UI via `LocationDetailViewModel.joinToString` — única UI que exibe esses erros ao usuário (os modelos validam entrados internos sem tela fora desse fluxo).
- Testes (`ValidationHelperTest`) assertam `message`/code — devem continuar passando.

## Solução

1. `ValidationResult.Invalid` ganha `messageKey: String` + `messageArgs: List<Any?>` (a `message` PT permanece para logs).
2. Cada Invalid do `ValidationHelper` domain recebe a sua chave.
3. Novo `ValidationMessages` (ui/validation) mapeia chave → `R.string.*` (values/en/es) com args; `LocationDetailViewModel` resolve ao mostrar (`Context.getString` com chave desconhecida = `message`).
4. Testes novos: `ValidationMessagesTest` (chave→string) + suíte ValidationHelperTest intacta.

## Fora

- ~180 `Invalid()` diretas nos modelos `data/model` (fora do helper): seguem com `message` em PT (fallback). Migração definitiva: PR seguinte (props passarem a carregar `messageKey` na origem).
