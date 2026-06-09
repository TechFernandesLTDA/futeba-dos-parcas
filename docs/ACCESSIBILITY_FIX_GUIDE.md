# Guia Completo de Correção de Acessibilidade

## Status Atual

### Problemas Identificados
- **611 ícones** sem `contentDescription`
- **85 imagens** sem `contentDescription`
- **169 clicáveis** sem `onClickLabel`
- **Total**: 865 issues de acessibilidade

### Progresso
✅ **Fase 1 Concluída**: `strings.xml` atualizado com 70+ content descriptions
✅ **Fase 2 Concluída**: 46 arquivos modificados pelo script inicial
✅ **Scripts Criados**: 4 scripts de automação disponíveis

---

## Opção 1: Correção Automática por Script

> **Atenção**: Os scripts funcionam bem para casos simples. Para código Compose complexo, prefira as opções 2 ou 3. Consulte `ACCESSIBILITY_LESSONS_LEARNED.md` para detalhes.

### Scripts Disponíveis

#### 1. JavaScript/Node.js (Mais Robusto)
```bash
node scripts/fix-accessibility.js
```

**Funcionalidades**:
- Detecta ícones sem `contentDescription`
- Mapeia 70+ ícones para strings adequadas
- Adiciona imports automaticamente
- Processa 496 arquivos Kotlin

#### 2. Python (Cross-platform)
```bash
python scripts/fix_accessibility.py
```

**Funcionalidades**:
- Pattern matching via regex
- Suporte a chamadas `Icon` multiline
- Correção para `AsyncImage` e `.clickable`

#### 3. Bash Script (Linux/Mac/WSL)
```bash
bash scripts/fix_all_icons.sh
```

**Funcionalidades**:
- Usa `sed` e `perl` para substituições
- Backup automático
- Contador de modificações

---

## Opção 2: Correção Manual por Arquivo

### Padrão 1: Ícone Simples
```kotlin
// ANTES:
Icon(Icons.Default.Settings)

// DEPOIS:
Icon(
    Icons.Default.Settings,
    contentDescription = stringResource(R.string.cd_settings)
)
```

### Padrão 2: Ícone com Parâmetros
```kotlin
// ANTES:
Icon(
    imageVector = Icons.Default.Add,
    tint = MaterialTheme.colorScheme.primary
)

// DEPOIS:
Icon(
    imageVector = Icons.Default.Add,
    contentDescription = stringResource(R.string.cd_add),
    tint = MaterialTheme.colorScheme.primary
)
```

### Padrão 3: Ícone Decorativo
```kotlin
// Para ícones puramente decorativos:
Icon(
    imageVector = Icons.Default.ChevronRight,
    contentDescription = null  // Explicitamente null para ícones decorativos
)
```

### Padrão 4: AsyncImage
```kotlin
// ANTES:
AsyncImage(
    model = user.photoUrl,
    modifier = Modifier.size(48.dp)
)

// DEPOIS:
AsyncImage(
    model = user.photoUrl,
    contentDescription = stringResource(R.string.cd_profile_photo),
    modifier = Modifier.size(48.dp)
)
```

### Padrão 5: Clickable Modifier
```kotlin
// ANTES:
.clickable { onClick() }

// DEPOIS:
.clickable(
    onClickLabel = stringResource(R.string.action_click)
) { onClick() }
```

---

## Opção 3: Abordagem via Lint (Mais Precisa)

### Passo 1: Gerar Relatório de Lint
```bash
./gradlew lint
```

### Passo 2: Abrir Relatório HTML
```bash
# Relatório gerado em:
app/build/reports/lint-results-debug.html
```

### Passo 3: Filtrar por ContentDescription
No relatório, buscar por:
- `ContentDescription`
- `Missing contentDescription attribute`
- `Missing clickable action label`

### Passo 4: Corrigir Issues por Prioridade
1. **Priority 10** (Crítico): Telas principais (Home, Games, Profile)
2. **Priority 8** (Alto): Componentes reutilizáveis
3. **Priority 6** (Médio): Telas secundárias
4. **Priority 4** (Baixo): Telas de admin/debug

---

## Strings de Content Description Já Disponíveis

Todas as strings abaixo já estão em `app/src/main/res/values/strings.xml`:

### Navigation
- `cd_back` - "Back"
- `cd_close` - "Close"
- `cd_menu` - "Menu"
- `cd_more_options` - "More options"

### Actions
- `cd_add` - "Add"
- `cd_delete` - "Delete"
- `cd_edit` - "Edit"
- `cd_save` - "Save"
- `cd_share` - "Share"
- `cd_search` - "Search"
- `cd_filter` - "Filter"
- `cd_refresh` - "Refresh"

### Content
- `cd_person` - "Person"
- `cd_group` - "Group"
- `cd_location` - "Location"
- `cd_calendar` - "Calendar"
- `cd_event` - "Event"

### Sports
- `cd_soccer` - "Soccer"
- `cd_trophy` - "Trophy"
- `cd_badge` - "Badge"

### Settings
- `cd_settings` - "Settings"
- `cd_notifications` - "Notifications"

### Images
- `cd_profile_photo` - "Profile photo"
- `cd_group_photo` - "Group photo"
- `cd_game_photo` - "Game photo"
- `cd_image` - "Image"

### Actions (Clickables)
- `action_click` - "Click"

---

## Verificação Pós-Correção

### 1. Compilação
```bash
./gradlew compileDebugKotlin
```

Deve compilar sem erros.

### 2. Lint Check
```bash
./gradlew lint
```

Verifique que os issues de `ContentDescription` foram reduzidos.

### 3. Teste com TalkBack (Manual)
1. Ativar TalkBack no dispositivo Android
2. Navegar pelo app
3. Verificar que todos os elementos interativos têm descrições audíveis

---

## Priorização de Arquivos

### P0 (Crítico) - ~100 arquivos
```
app/src/main/java/com/futebadosparcas/ui/home/
app/src/main/java/com/futebadosparcas/ui/games/
app/src/main/java/com/futebadosparcas/ui/profile/
app/src/main/java/com/futebadosparcas/ui/groups/
app/src/main/java/com/futebadosparcas/ui/statistics/
```

### P1 (Alto) - ~150 arquivos
```
app/src/main/java/com/futebadosparcas/ui/components/
app/src/main/java/com/futebadosparcas/ui/locations/
app/src/main/java/com/futebadosparcas/ui/players/
app/src/main/java/com/futebadosparcas/ui/badges/
```

### P2 (Médio) - ~246 arquivos
- Resto das telas e features secundárias

---

## Troubleshooting

### Problema: Script não modifica nenhum arquivo
**Causa**: Os arquivos já foram parcialmente editados.
**Solução**: Execute o lint para ver os issues remanescentes.

### Problema: Build falha após as correções
**Causa**: Import de `stringResource` ausente.
**Solução**: Adicione em cada arquivo modificado:
```kotlin
import androidx.compose.ui.res.stringResource
```

### Problema: "Unresolved reference: R"
**Causa**: Import da classe `R` ausente.
**Solução**: Adicione:
```kotlin
import com.futebadosparcas.R
```

---

## Checklist Final

- [ ] strings.xml contém todas as content descriptions
- [ ] Scripts de correção executados
- [ ] Build compila sem erros
- [ ] Lint report mostra redução de issues
- [ ] Testes manuais com Talkback (opcional)
- [ ] Commit das mudanças
- [ ] CI/CD passa (se configurado)

---

## Comandos Rápidos

```bash
# 1. Rodar correção automática
node scripts/fix-accessibility.js

# 2. Verificar build
./gradlew compileDebugKotlin

# 3. Verificar lint
./gradlew lint

# 4. Ver estatísticas
grep -r "contentDescription" app/src/main/java --include='*.kt' | wc -l
```

---

## Próximos Passos

Após corrigir os 865 issues:

1. **CI/CD**: Configurar lint check para falhar se novos issues forem introduzidos
2. **Pre-commit hook**: Bloquear commits com ícones sem `contentDescription`
3. **Template de PR**: Adicionar checklist de acessibilidade
4. **Documentação**: Atualizar `CLAUDE.md` com regras de acessibilidade

---

## Recursos Adicionais

- [Material 3 Accessibility](https://m3.material.io/foundations/accessible-design)
- [Android Accessibility Guidelines](https://developer.android.com/guide/topics/ui/accessibility)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Talkback Setup](https://support.google.com/accessibility/android/answer/6283677)

---

**Atualizado em**: 2026-02-03
**Scripts em**: `/scripts/fix-accessibility*.js`, `/scripts/fix_accessibility.py`
**Strings em**: `app/src/main/res/values/strings.xml`
