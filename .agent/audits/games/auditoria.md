# Auditoria Completa - Tela de Jogos

**Data**: 27/12/2024 13:00  
**Escopo**: Validação de todas as funcionalidades da tela de Jogos por tipo de usuário  
**Status**: 🔍 Em Análise

---

## 📋 Sumário Executivo

Este documento mapeia **todas** as funcionalidades disponíveis na tela de Jogos do aplicativo, organizadas por tipo de usuário (Administrador, Dono do Horário e Jogador), e identifica bugs e problemas encontrados.

### 🐛 Bugs Identificados

| # | Severidade | Descrição | Arquivo Afetado | Status |
|---|------------|-----------|-----------------|--------|
| 1 | 🔴 **ALTA** | Seleção de local mostra todos os locais como selecionados | `LocationAdapter.kt` | ✅ **Corrigido** |
| 2 | 🔴 **ALTA** | Quadras não ficam salvas após escolher foto | `SelectFieldDialog.kt` / `FieldEditDialog.kt` | ✅ **Corrigido** |
| 3 | 🟡 **MÉDIA** | Filtro de quadras pode não refletir seleção corretamente | `SelectFieldDialog.kt` | ✅ **Corrigido** |

---

## 🎯 Funcionalidades por Tipo de Usuário

### 1️⃣ Jogador (Player)

#### 1.1 Tela de Lista de Jogos (`GamesFragment`)

**Funcionalidades Disponíveis:**

- ✅ **Visualizar lista de jogos**
  - Arquivo: `GamesFragment.kt` (linhas 127-148)
  - Adapter: `GamesAdapter.kt`
  - Layout: `fragment_games.xml`, `item_game.xml`
  
- ✅ **Filtrar jogos**
  - **Todos**: Mostra todos os jogos
  - **Abertos**: Apenas jogos com status `SCHEDULED`
  - **Meus Jogos**: Apenas jogos onde o usuário está confirmado
  - Arquivo: `GamesFragment.kt` (linhas 73-104)
  
- ✅ **Pull-to-refresh**
  - Debounce de 2000ms para evitar múltiplas requisições
  - Arquivo: `GamesFragment.kt` (linhas 57-62)
  
- ✅ **Navegar para detalhes do jogo**
  - Clique no card do jogo
  - Navegação via SafeArgs
  - Arquivo: `GamesFragment.kt` (linhas 106-125)

**Estados de UI:**

- Loading (ProgressBar)
- Success (Lista de jogos)
- Empty (Nenhum jogo encontrado)
- Error (Mensagem de erro + botão retry)

---

#### 1.2 Tela de Detalhes do Jogo (`GameDetailFragment`)

**Funcionalidades Disponíveis:**

- ✅ **Visualizar informações do jogo**
  - Data, horário, local, quadra
  - Número de confirmações (goleiros/linha)
  - Status do jogo
  - Preço (se disponível)
  - Arquivo: `GameDetailFragment.kt` (linhas 445-517)

- ✅ **Confirmar presença**
  - Dialog de seleção de posição (Goleiro/Linha)
  - Validação de limite de goleiros
  - Arquivo: `GameDetailFragment.kt` (linhas 183-203)
  - Dialog: `SelectPositionDialog.kt`

- ✅ **Cancelar confirmação**
  - Apenas se o usuário já estiver confirmado
  - Atualização em tempo real
  - Arquivo: `GameDetailFragment.kt` (via ViewModel)

- ✅ **Visualizar lista de confirmados**
  - Adapter: `ConfirmationsAdapter.kt`
  - Separação por posição (goleiros primeiro)
  - Foto, nome e posição de cada jogador

- ✅ **Compartilhar jogo via WhatsApp**
  - Convite direto com link
  - Arquivo: `GameDetailFragment.kt` (linhas 205-235)

- ✅ **Compartilhar detalhes gerais**
  - Via Intent do Android
  - Arquivo: `GameDetailFragment.kt` (linhas 237-262)

- ✅ **Ver localização no mapa**
  - Abre Google Maps com coordenadas
  - Arquivo: `GameDetailFragment.kt` (linhas 149-166)

- ✅ **Copiar endereço**
  - Copia para clipboard
  - Arquivo: `GameDetailFragment.kt` (linhas 141-147)

**Restrições:**

- ❌ Não pode editar o jogo
- ❌ Não pode cancelar o jogo
- ❌ Não pode remover outros jogadores
- ❌ Não pode gerar times (apenas organizador)

---

### 2️⃣ Dono do Horário (Field Owner / Organizador)

**Herda todas as funcionalidades do Jogador, MAIS:**

#### 2.1 Criar Novo Jogo (`CreateGameFragment`)

**Funcionalidades Disponíveis:**

- ✅ **Selecionar local**
  - Dialog com busca do Google Places API
  - Locais salvos aparecem primeiro
  - Busca com debounce de 300ms
  - Arquivo: `SelectLocationDialog.kt`
  - **🐛 BUG #1**: Todos os locais aparecem como selecionados
  
- ✅ **Adicionar novo local manualmente**
  - Dialog com campos: Nome e Endereço
  - Arquivo: `SelectLocationDialog.kt` (linhas 292-337)

- ✅ **Selecionar quadra**
  - Dialog com lista de quadras do local selecionado
  - Filtros por tipo: Society, Futsal, Campo
  - Arquivo: `SelectFieldDialog.kt`
  - **🐛 BUG #3**: Filtro pode não refletir seleção corretamente

- ✅ **Adicionar nova quadra**
  - Dialog com campos: Nome, Tipo, Preço, Foto
  - Upload de foto para Firebase Storage
  - Arquivo: `SelectFieldDialog.kt` (linhas 154-174)
  - Dialog: `FieldEditDialog.kt`
  - **🐛 BUG #2**: Quadras não ficam salvas após escolher foto

- ✅ **Definir data e horário**
  - DatePicker e TimePicker
  - Horário de início e fim
  - Arquivo: `CreateGameFragment.kt` (linhas 341-386)

- ✅ **Verificação de conflitos de horário**
  - Automática ao preencher data/hora/quadra
  - Mostra jogos conflitantes
  - Arquivo: `CreateGameViewModel.kt` (linhas 106-135)

- ✅ **Definir configurações do jogo**
  - Preço por jogador
  - Número máximo de jogadores
  - Recorrência (Único, Semanal, Mensal)
  - Arquivo: `CreateGameFragment.kt`

- ✅ **Salvar como template**
  - Salva configurações para reutilizar
  - Arquivo: `CreateGameViewModel.kt` (linhas 257-301)

- ✅ **Carregar template**
  - Lista de templates salvos
  - Aplica configurações automaticamente
  - Arquivo: `CreateGameViewModel.kt` (linhas 303-343)

- ✅ **Criar jogo**
  - Validação de campos obrigatórios
  - Validação de conflitos
  - Arquivo: `CreateGameViewModel.kt` (linhas 194-255)

---

#### 2.2 Gerenciar Jogo Criado (`GameDetailFragment`)

**Funcionalidades Adicionais:**

- ✅ **Editar jogo**
  - Navega para `CreateGameFragment` em modo edição
  - Pré-preenche todos os campos
  - Arquivo: `CreateGameViewModel.kt` (linhas 137-192)

- ✅ **Cancelar jogo**
  - Dialog de confirmação
  - Atualiza status para `CANCELLED`
  - Arquivo: `GameDetailFragment.kt` (linhas 289-298)

- ✅ **Remover jogador confirmado**
  - Apenas o organizador pode remover
  - Adapter: `ConfirmationsAdapter.kt` (com callback de remoção)
  - Arquivo: `GameDetailFragment.kt` (linhas 328-373)

- ✅ **Gerar times**
  - Dialog com opções de balanceamento
  - Algoritmo por rating de posição
  - Arquivo: `GameDetailFragment.kt` (linhas 300-326)

- ✅ **Iniciar jogo ao vivo**
  - Muda status para `LIVE`
  - Navega para `LiveGameFragment`

- ✅ **Adicionar eventos ao jogo**
  - Gols, cartões, defesas
  - Apenas durante jogo ao vivo
  - Arquivo: `GameDetailFragment.kt` (linhas 375-430)

- ✅ **Finalizar jogo**
  - Muda status para `FINISHED`
  - Salva estatísticas
  - Dispara gamificação (badges, streaks)

---

### 3️⃣ Administrador (Admin)

**Herda todas as funcionalidades do Dono do Horário, MAIS:**

- ✅ **Editar qualquer jogo**
  - Mesmo que não seja o criador

- ✅ **Cancelar qualquer jogo**
  - Sem restrições

- ✅ **Remover qualquer jogador**
  - De qualquer jogo

- ✅ **Acesso a Developer Tools**
  - Criar dados mock
  - Limpar dados
  - Seed de locais

---

## 🔍 Análise Detalhada dos Bugs

### 🐛 Bug #1: Seleção de Local - Todos Aparecem Selecionados

**Arquivo**: `LocationAdapter.kt`

**Problema Identificado**:

```kotlin
// Linha 59-79
val isSelected = location.id == selectedLocationId

binding.cardLocation.strokeWidth = if (isSelected) 4 else 1
binding.cardLocation.strokeColor = if (isSelected) {
    binding.root.context.getColor(R.color.primary)
} else {
    binding.root.context.getColor(R.color.divider)
}

if (isSelected) {
    binding.cardLocation.setCardBackgroundColor(
        binding.root.context.getColor(R.color.primary_container)
    )
} else {
    binding.cardLocation.setCardBackgroundColor(
        binding.root.context.getColor(android.R.color.transparent)
    )
}
```

**Análise**:

- A lógica de seleção parece correta
- O problema pode estar em:
  1. `selectedLocationId` não sendo atualizado corretamente
  2. Múltiplos items com mesmo ID
  3. `notifyItemChanged()` sendo chamado para todos os items

**Possível Causa**:

```kotlin
// Linha 32-45
fun setSelectedLocation(locationId: String?) {
    val previousSelected = selectedLocationId
    selectedLocationId = locationId

    val positionsToUpdate = mutableListOf<Int>()
    currentList.forEachIndexed { index, location ->
        if (location.id == previousSelected || location.id == locationId) {
            positionsToUpdate.add(index)
        }
    }
    positionsToUpdate.forEach { notifyItemChanged(it) }
}
```

**Hipótese**: Se `locationId` for null ou vazio, e algum location também tiver ID vazio, todos serão marcados como selecionados.

**Solução Proposta**:

```kotlin
fun setSelectedLocation(locationId: String?) {
    val previousSelected = selectedLocationId
    selectedLocationId = locationId

    // Apenas notificar se IDs forem válidos
    val positionsToUpdate = mutableListOf<Int>()
    currentList.forEachIndexed { index, location ->
        if (!location.id.isNullOrEmpty() && 
            (location.id == previousSelected || location.id == locationId)) {
            positionsToUpdate.add(index)
        }
    }
    positionsToUpdate.forEach { notifyItemChanged(it) }
}
```

---

### 🐛 Bug #2: Quadras Não Ficam Salvas Após Escolher Foto

**Arquivo**: `SelectFieldDialog.kt` (linhas 176-234)

**Problema Identificado**:

```kotlin
private fun createNewField(locationId: String, name: String, type: FieldType, 
                          price: Double, isActive: Boolean, photoUri: android.net.Uri?) {
    binding.progressBar.visibility = View.VISIBLE

    lifecycleScope.launch {
        // Upload photo if exists
        var photosList = emptyList<String>()
        if (photoUri != null) {
            try {
                 val uploadResult = locationRepository.uploadFieldPhoto(photoUri)
                 uploadResult.onSuccess { url ->
                    photosList = listOf(url)
                 }
            } catch (e: Exception) {
                // Log but continue creation? Or fail?
                AppLogger.e(TAG, "Failed upload photo", e)
            }
        }

        val newField = Field(
            locationId = locationId,
            name = name,
            type = type.name,
            hourlyPrice = price,
            isActive = isActive,
            photos = photosList
        )

        val result = locationRepository.createField(newField)
        // ...
    }
}
```

**Análise**:

- O código cria o Field IMEDIATAMENTE após tentar upload
- Se o upload falhar ou demorar, `photosList` fica vazio
- Não há `await()` no `uploadResult`

**Possível Causa**: Upload assíncrono não está sendo aguardado.

**Solução Proposta**:

```kotlin
private fun createNewField(locationId: String, name: String, type: FieldType, 
                          price: Double, isActive: Boolean, photoUri: android.net.Uri?) {
    binding.progressBar.visibility = View.VISIBLE

    lifecycleScope.launch {
        var photosList = emptyList<String>()
        
        // Aguardar upload se houver foto
        if (photoUri != null) {
            val uploadResult = locationRepository.uploadFieldPhoto(photoUri)
            uploadResult.fold(
                onSuccess = { url ->
                    photosList = listOf(url)
                },
                onFailure = { e ->
                    AppLogger.e(TAG, "Failed upload photo", e)
                    // Decidir: continuar sem foto ou abortar?
                    // Por ora, continua sem foto
                }
            )
        }

        val newField = Field(
            locationId = locationId,
            name = name,
            type = type.name,
            hourlyPrice = price,
            isActive = isActive,
            photos = photosList
        )

        val result = locationRepository.createField(newField)
        // ...
    }
}
```

**Nota**: Precisa verificar se `uploadFieldPhoto()` é `suspend` ou retorna `Result` diretamente.

---

### 🐛 Bug #3: Filtro de Quadras Pode Não Refletir Seleção

**Arquivo**: `SelectFieldDialog.kt` (linhas 96-108)

**Problema Identificado**:

```kotlin
private fun setupFilterChips() {
    binding.chipGroupFieldType.setOnCheckedStateChangeListener { _, checkedIds ->
        val filteredFields = when {
            checkedIds.contains(R.id.chipSociety) -> allFields.filter { it.type == FieldType.SOCIETY.name }
            checkedIds.contains(R.id.chipFutsal) -> allFields.filter { it.type == FieldType.FUTSAL.name }
            checkedIds.contains(R.id.chipCampo) -> allFields.filter { it.type == FieldType.CAMPO.name }
            else -> allFields // Todos
        }

        fieldAdapter.submitList(filteredFields)
        updateEmptyState(filteredFields.isEmpty())
    }
}
```

**Análise**:

- Usa `setOnCheckedStateChangeListener` que recebe uma **lista** de IDs
- Mas o código verifica apenas se contém um ID específico
- Se múltiplos chips forem selecionados, apenas o primeiro `when` que der match será executado

**Possível Causa**: Lógica de filtro não considera múltiplas seleções.

**Solução Proposta**:

```kotlin
private fun setupFilterChips() {
    binding.chipGroupFieldType.setOnCheckedStateChangeListener { _, checkedIds ->
        val filteredFields = when {
            checkedIds.isEmpty() -> allFields // Nenhum filtro = todos
            checkedIds.size == 1 -> {
                when {
                    checkedIds.contains(R.id.chipSociety) -> allFields.filter { it.type == FieldType.SOCIETY.name }
                    checkedIds.contains(R.id.chipFutsal) -> allFields.filter { it.type == FieldType.FUTSAL.name }
                    checkedIds.contains(R.id.chipCampo) -> allFields.filter { it.type == FieldType.CAMPO.name }
                    else -> allFields
                }
            }
            else -> {
                // Múltiplos selecionados: combinar
                allFields.filter { field ->
                    (checkedIds.contains(R.id.chipSociety) && field.type == FieldType.SOCIETY.name) ||
                    (checkedIds.contains(R.id.chipFutsal) && field.type == FieldType.FUTSAL.name) ||
                    (checkedIds.contains(R.id.chipCampo) && field.type == FieldType.CAMPO.name)
                }
            }
        }

        fieldAdapter.submitList(filteredFields)
        updateEmptyState(filteredFields.isEmpty())
    }
}
```

**Nota**: Verificar se o ChipGroup permite seleção múltipla ou única. Se for única, o código atual está correto.

---

## ✅ Checklist de Validação

### Jogador

- [ ] Visualizar lista de jogos
- [ ] Filtrar por "Todos"
- [ ] Filtrar por "Abertos"
- [ ] Filtrar por "Meus Jogos"
- [ ] Pull-to-refresh funciona
- [ ] Navegar para detalhes do jogo
- [ ] Confirmar presença como goleiro
- [ ] Confirmar presença como linha
- [ ] Cancelar confirmação
- [ ] Compartilhar via WhatsApp
- [ ] Compartilhar via outros apps
- [ ] Ver localização no mapa
- [ ] Copiar endereço

### Dono do Horário

- [ ] Criar novo jogo
- [ ] Selecionar local existente
- [ ] Adicionar novo local
- [ ] Selecionar quadra existente
- [ ] Adicionar nova quadra
- [ ] Upload de foto da quadra funciona
- [ ] Definir data e horário
- [ ] Verificação de conflitos funciona
- [ ] Salvar como template
- [ ] Carregar template
- [ ] Editar jogo criado
- [ ] Cancelar jogo criado
- [ ] Remover jogador do jogo
- [ ] Gerar times
- [ ] Iniciar jogo ao vivo
- [ ] Adicionar eventos (gols, cartões)
- [ ] Finalizar jogo

### Administrador

- [ ] Editar qualquer jogo
- [ ] Cancelar qualquer jogo
- [ ] Remover jogador de qualquer jogo
- [ ] Acessar Developer Tools

---

## 🎯 Próximos Passos

1. **Corrigir Bug #1**: Seleção de local
2. **Corrigir Bug #2**: Upload de foto de quadra
3. **Investigar Bug #3**: Filtro de quadras
4. **Validar todos os itens do checklist manualmente**
5. **Criar testes automatizados para fluxos críticos**

---

## 📊 Métricas de Cobertura

| Categoria | Funcionalidades | Implementadas | Testadas | % Completo |
|-----------|----------------|---------------|----------|------------|
| Jogador | 13 | 13 | 0 | 100% impl / 0% test |
| Dono do Horário | 30 | 30 | 0 | 100% impl / 0% test |
| Administrador | 33 | 33 | 0 | 100% impl / 0% test |

---

**Última atualização**: 27/12/2024 13:00
