# BUGFIX: Nome sob o ícone do iOS sai como "FutebadosParças"

> **Status:** `APPROVED`
> **Severidade:** `LOW`
> **Autor:** Claude (autonomia ampla autorizada pelo dono; iOS: só bugs e CI)
> **Data:** 2026-11-02
> **PR:** a definir (issue #4429, épico #4401)

## 1. Bug
`CFBundleDisplayName` = "Futeba dos Parças" (`iosApp/iosApp/Info.plist`) não cabe sob o ícone; o SpringBoard encurta para "FutebadosParças".

## 2. Solução
`CFBundleDisplayName` = "Futeba", o nome curto sugerido na própria issue. Só muda o rótulo da tela inicial: o nome na App Store vem do App Store Connect e não muda. Se o dono preferir outro nome curto, basta trocar essa string.

| Arquivo | Motivo |
|---|---|
| `iosApp/iosApp/Info.plist` | Nome curto |

## 3. Verificação
- `plutil -lint` OK.
- Visual na tela inicial fica para o QA do iOS (#4432), junto da conta Apple (#4395).
