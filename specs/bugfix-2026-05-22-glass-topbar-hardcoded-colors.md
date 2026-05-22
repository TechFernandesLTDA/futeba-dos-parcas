# BUGFIX: GlassTopBar usa Color.Black/Color.White hardcoded

> **Status:** `APPROVED`
> **Severidade:** `MEDIUM`
> **Autor:** AI Assistant
> **Data:** 2026-05-22
> **Issue:** #1503

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

`GlassTopBar` usa `Color.White`/`Color.Black` hardcoded nos presets `LightGlassConfig`/`DarkGlassConfig`, e `isSystemInDarkTheme()` para detectar tema, ignorando `ThemeMode` do usuário.

### 1.2 Comportamento Esperado (Correto)

Usar `MaterialTheme.colorScheme.surface`/`onSurface` e respeitar o `ThemeMode` configurado pelo usuário via `ThemeViewModel`.

### 1.3 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `app/.../ui/components/GlassTopBar.kt` | Presets hardcoded + isSystemInDarkTheme() |

---

## 2. Solução

1. Remover `DarkGlassConfig`/`LightGlassConfig` como presets estáticos com cores hardcoded
2. `rememberGlassConfig()` deve usar `MaterialTheme.colorScheme` (que já respeita o tema final aplicado por `FutebaTheme`)
3. Gradiente overlay também deve usar cores do theme

---

## 3. Verificação

- [ ] Build Android passa
- [ ] GlassTopBar respeita ThemeMode.LIGHT/DARK/SYSTEM
- [ ] Sem regressão visual em telas que usam GlassTopBar
