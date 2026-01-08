# Dialog Migration Guide - DialogFragments to Jetpack Compose

Este documento descreve a migração de 3 DialogFragments XML para Jetpack Compose, mantendo 100% da funcionalidade original.

## Resumo das Conversões

### 1. EditScheduleDialogFragment → EditScheduleDialog (Compose)

**Arquivo original:** `app/src/main/java/com/futebadosparcas/ui/schedules/EditScheduleDialogFragment.kt`

**Novo arquivo Compose:** `app/src/main/java/com/futebadosparcas/ui/schedules/ComposeScheduleDialogs.kt`

**Funcionalidade preservada:**
- Edição de agendamentos recorrentes
- Seleção de horário (19:00 padrão)
- Seleção de dia da semana (0-6)
- Seleção de frequência (Semanal, Quinzenal, Mensal)
- Validação de campos obrigatórios

**Diferenças na implementação:**
- O MaterialTimePicker requer FragmentManager, então a função Compose aceita um callback `onTimePickerClick` que deve ser implementado no Fragment/ViewModel
- DropdownMenu em vez de AutoCompleteTextView
- Validação inline com supportingText

**Como usar:**
```kotlin
EditScheduleDialog(
    schedule = schedule,
    onDismiss = { /* Handle dismiss */ },
    onSave = { updatedSchedule -> /* Handle save */ },
    onTimePickerClick = { currentTime ->
        // Implement MaterialTimePicker logic here using FragmentManager
        val picker = MaterialTimePicker.Builder()
            .setTimeFormat(TimeFormat.CLOCK_24H)
            .setHour(hour)
            .setMinute(minute)
            .setTitleText("Selecione o Horário")
            .build()
        picker.addOnPositiveButtonClickListener { /* update time */ }
        picker.show(parentFragmentManager, "TIME_PICKER")
    }
)
```

---

### 2. AddCashboxEntryDialogFragment → AddCashboxEntryDialog (Compose)

**Arquivo original:** `app/src/main/java/com/futebadosparcas/ui/groups/dialogs/AddCashboxEntryDialogFragment.kt`

**Novo arquivo Compose:** `app/src/main/java/com/futebadosparcas/ui/groups/dialogs/ComposeGroupDialogs.kt`

**Status:** ✅ Já foi convertido e está funcional

**Funcionalidade preservada:**
- Seleção de tipo de entrada (Income/Expense)
- Seleção dinâmica de categorias baseada no tipo
- Campo de descrição
- Campo de valor monetário (aceita "." e ",")
- Upload de recebimento (foto via câmera ou galeria)
- Validação: valor > 0
- Validação: descrição obrigatória se categoria == OTHER
- Preview de foto do recebimento

**Melhorias implementadas:**
- Validação melhorada do botão de salvar
- Suporte completo para câmera e galeria
- Erro handling com Toast
- Logging com AppLogger

**Como usar:**
```kotlin
AddCashboxEntryDialog(
    type = CashboxEntryType.INCOME,
    onDismiss = { /* Handle dismiss */ },
    onSave = { description, amount, category, receiptUri ->
        // Save the entry
    }
)
```

---

### 3. FieldEditDialog → FieldEditDialog (Compose)

**Arquivo original:** `app/src/main/java/com/futebadosparcas/ui/locations/FieldEditDialog.kt`

**Novo arquivo Compose:** `app/src/main/java/com/futebadosparcas/ui/locations/ComposeLocationDialogs.kt`

**Funcionalidade preservada:**
- Criar nova quadra ou editar existente
- Upload de foto (câmera ou galeria)
- Edição de nome, tipo, preço
- Campos opcionais: superfície, dimensões
- Toggles para: coberta, ativa
- Validação: nome obrigatório
- Preview de foto da quadra
- Suporte para múltiplos tipos de quadra (SOCIETY, FUTSAL, CAMPO, AREIA, OUTROS)

**Melhorias implementadas:**
- LazyColumn para scrolling em caso de conteúdo extenso
- Validação inline com supportingText
- Melhor UX com foto preview
- Logout com AppLogger

**Como usar:**
```kotlin
FieldEditDialog(
    field = existingField, // null para criar novo
    defaultType = FieldType.SOCIETY,
    onDismiss = { /* Handle dismiss */ },
    onSave = { name, type, price, isActive, photoUri, surface, isCovered, dimensions ->
        // Save the field
    }
)
```

---

## Arquivos Criados/Modificados

### Novos Arquivos Compose
1. **ComposeScheduleDialogs.kt** (238 linhas)
   - `EditScheduleDialog()` - Dialog para editar agendamentos

2. **ComposeLocationDialogs.kt** (403 linhas)
   - `FieldEditDialog()` - Dialog para criar/editar quadras

### Arquivos Modificados
1. **ComposeGroupDialogs.kt**
   - Melhorada a função `AddCashboxEntryDialog()` com validações mais robustas

---

## Padrões Aplicados

Todos os novos Compose dialogs seguem os padrões estabelecidos no projeto:

### 1. **State Management**
```kotlin
var fieldName by remember { mutableStateOf("") }
var showError by remember { mutableStateOf(false) }
```

### 2. **Validação Inline**
```kotlin
OutlinedTextField(
    value = name,
    isError = showNameError,
    supportingText = if (showNameError) {
        { Text("Campo obrigatório", color = MaterialTheme.colorScheme.error) }
    } else null
)
```

### 3. **Material Design 3**
- RoundedCornerShape(24.dp) para dialogs
- ColorScheme do MaterialTheme
- Ícones do material.icons.filled

### 4. **Photo Pickers**
```kotlin
val pickImageLauncher = rememberLauncherForActivityResult(
    ActivityResultContracts.GetContent()
) { uri: Uri? -> selectedPhotoUri = uri }
```

### 5. **Dropdowns**
```kotlin
var expandedDay by remember { mutableStateOf(false) }
Box {
    OutlinedTextField(/* ... */)
    DropdownMenu(
        expanded = expandedDay,
        onDismissRequest = { expandedDay = false }
    ) {
        /* items */
    }
}
```

---

## Migração de Fragmentos (Próximos Passos)

Para usar estes novos dialogs em uma Screen Compose, substitua as chamadas de Fragment:

### Antes (Fragment):
```kotlin
val dialog = EditScheduleDialogFragment.newInstance(schedule) { updatedSchedule ->
    // Handle save
}
dialog.show(parentFragmentManager, EditScheduleDialogFragment.TAG)
```

### Depois (Compose):
```kotlin
if (showScheduleDialog) {
    EditScheduleDialog(
        schedule = schedule,
        onDismiss = { showScheduleDialog = false },
        onSave = { updatedSchedule ->
            // Handle save
            showScheduleDialog = false
        }
    )
}
```

---

## Validações Implementadas

### EditScheduleDialog
- ✅ Nome: Campo obrigatório
- ✅ Horário: Campo obrigatório (formato HH:mm)
- ✅ Dia da semana: Seleção obrigatória
- ✅ Frequência: Seleção obrigatória

### AddCashboxEntryDialog
- ✅ Valor: Obrigatório e > 0
- ✅ Categoria: Seleção obrigatória
- ✅ Descrição: Obrigatória se categoria == OTHER
- ✅ Aceita separadores: "." e ","

### FieldEditDialog
- ✅ Nome: Campo obrigatório
- ✅ Tipo: Seleção obrigatória
- ✅ Preço: Opcional, mas > 0 se preenchido
- ✅ Foto: Opcional

---

## Recursos Utilizados

- **Jetpack Compose**: Material3, Foundation, Animation
- **Coil**: Para carregamento de imagens (AsyncImage)
- **Activity Result Contracts**: Para seleção de imagens
- **Material Components**: MaterialTimePicker (chamado do Fragment)

---

## Compatibilidade

- **Min SDK**: 24 (Android 7.0)
- **Target SDK**: 34 (Android 14)
- **Kotlin**: 2.0+

---

## Próximas Migrações

Os seguintes arquivos XML/Fragment ainda podem ser migrados:
- Outros dialogs em `ui/games/`
- Dialogs em `ui/players/`
- Dialogs em `ui/league/`

---

## Notas Importantes

1. **MaterialTimePicker**: Continua usando a implementação nativa (FragmentManager) pois Compose ainda não tem equivalente direto
2. **AsyncImage**: Usa Coil para carregamento lazy de imagens
3. **Photo Pickers**: Suportam câmera (via FileProvider) e galeria
4. **Validação**: Toda validação é feita inline com feedback visual imediato

---

## Build & Compilation

```bash
# Verificar compilação
./gradlew compileDebugKotlin

# Build completo
./gradlew assembleDebug
```

Todos os arquivos foram testados e compilam sem erros.
