# Futeba dos Parças — Dynamic Design System 2.0

## Visão Geral

O sistema de temas dinâmico implementado permite que o aplicativo se adapte à identidade visual preferida do usuário, mantendo a consistência e legibilidade do Material Design 3.

### Arquitetura

O sistema é composto por:

1.  **Primitives (Seeds)**: Cores base escolhidas pelo usuário (Primary, Secondary).
2.  **Engine (HCT)**: Algoritmo que gera paletas tonais completas a partir das seeds.
3.  **Tokens (Semânticos)**: Variáveis consumidas pela UI (`MaterialTheme.colorScheme.primary`, etc.).

## Uso no Código

### 1. Consumir Cores
Nunca use cores hardcoded (`Color(0xFF...)`). Use sempre tokens do tema:

```kotlin
// ✅ CORRETO
Text(
    color = MaterialTheme.colorScheme.onSurface,
    style = MaterialTheme.typography.bodyMedium
)

// ❌ ERRADO
Text(color = Color.Black)
```

### 2. Tela de Configuração
A tela `ThemeSettingsScreen` já está implementada e pronta para uso.
Para acessá-la, adicione a navegação no seu grafo:

```kotlin
composable("theme_settings") {
    ThemeSettingsScreen()
}
```

### 3. Persistência
As configurações são salvas via DataStore (`theme_settings.preferences_pb`) e aplicadas reativamente em todo o app via `ThemeRepository`.

## Paleta Tonal e Acessibilidade

O sistema garante acessibilidade (WCAG AA) automaticamente:

*   **PrimaryContainer**: Usado para fundos de elementos ativos, garante contraste com `onPrimaryContainer`.
*   **Texto**: Sempre usa `onSurface` (escuro no light, claro no dark) para legibilidade máxima.
*   **Status**: Cores de Sucesso/Erro são fixas semanticamente e não mudam com o tema do usuário (segurança).

## Migração

Para migrar telas antigas (XML):
1.  O `MainActivity` já aplica a cor de StatusBar.
2.  Para componentes XML individuais, considere migrar para Compose (`ComposeView`) ou usar `Theme.FutebaDosParcas` no manifesto que referencia cores estáticas compatíveis.

## Manutenção

Para adicionar novas seeds ou variantes:
1.  Edite `com.futebadosparcas.data.model.ThemeConfig`.
2.  Atualize `DynamicThemeEngine.kt` para gerar os novos tokens.
3.  Atualize `ThemeRepositoryImpl.kt` para persistir.
