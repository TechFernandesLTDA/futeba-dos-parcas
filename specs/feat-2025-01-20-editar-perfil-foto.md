# SPEC: Editar Perfil com Foto e Validação

> **Status:** `APPROVED`
> **Autor:** Claude
> **Data:** 2025-01-20
> **PR:** #xxx (a preencher)

---

## 1. Requirements (Requisitos)

### 1.1 Problema / Oportunidade

Atualmente o usuário não consegue editar seu perfil diretamente no app. Precisa de uma tela para:
- Alterar nome de exibição
- Alterar foto de perfil
- Configurar preferências de posição

### 1.2 Casos de Uso

| ID | Ator | Ação | Resultado esperado |
|----|------|------|-------------------|
| UC1 | Jogador | Edita nome | Nome atualizado em todo o app |
| UC2 | Jogador | Seleciona foto da galeria | Foto é cortada, comprimida e salva |
| UC3 | Jogador | Tira foto com câmera | Foto é cortada, comprimida e salva |
| UC4 | Jogador | Remove foto | Volta para avatar padrão |

### 1.3 Critérios de Aceite

- [ ] CA1: Nome deve ter entre 2-50 caracteres, sem caracteres especiais
- [ ] CA2: Foto deve ser cortada em 1:1 (quadrada) antes de upload
- [ ] CA3: Foto deve ser comprimida para max 500KB antes de upload
- [ ] CA4: Feedback visual durante upload (progress indicator)
- [ ] CA5: Validação em tempo real com mensagens de erro claras
- [ ] CA6: Botão salvar só habilitado quando há alterações válidas

### 1.4 Fora de Escopo

- Edição de email (requer re-autenticação)
- Edição de telefone
- Conexão com redes sociais

---

## 2. UX/UI Design

### 2.1 Fluxo de Navegação

```
[ProfileScreen] --tap "Editar"--> [EditProfileScreen] --salvar--> [ProfileScreen]
                                         |
                                         +--tap foto--> [BottomSheet: Câmera/Galeria/Remover]
                                         |                    |
                                         |                    +--Câmera--> [CameraX]
                                         |                    +--Galeria--> [PhotoPicker]
                                         |
                                         +--erro--> [Snackbar erro]
```

### 2.2 Telas e Estados

| Tela | Estado | Descrição |
|------|--------|-----------|
| EditProfileScreen | Loading | Shimmer nos campos enquanto carrega dados |
| EditProfileScreen | Idle | Formulário preenchido com dados atuais |
| EditProfileScreen | Saving | Progress indicator, campos desabilitados |
| EditProfileScreen | Error | Snackbar com mensagem de erro |
| EditProfileScreen | Success | Navega de volta com Toast de confirmação |

### 2.3 Responsividade

| Configuração | Comportamento |
|--------------|---------------|
| Phone Portrait | Layout vertical padrão |
| Phone Landscape | Scroll se necessário, campos mantêm tamanho |
| Tablet (sw600dp+) | Conteúdo centralizado com max-width de 600dp |

### 2.4 Acessibilidade

- [x] Foto de perfil: `contentDescription = "Foto de perfil. Toque para alterar"`
- [x] Campos de texto: labels descritivos
- [x] Botão salvar: `contentDescription = "Salvar alterações"`
- [x] Touch targets >= 48dp
- [x] Contraste >= 4.5:1 verificado

### 2.5 Animações e Micro-interações

- Transição de entrada: Slide from right
- Upload de foto: Circular progress sobre a foto
- Validação: Shake animation em campo inválido
- Sucesso: Fade out + navegação

---

## 3. Technical Design

### 3.1 Arquitetura

```
[EditProfileScreen.kt]
    ↓ eventos (onNameChange, onPhotoSelect, onSave)
[EditProfileViewModel]
    ↓ StateFlow<EditProfileUiState>
[UpdateProfileUseCase]
    ↓
[UserRepository]
    ↓
[Firebase Auth + Firestore + Storage]
```

### 3.2 Modelos de Dados

```kotlin
// UiState
sealed class EditProfileUiState {
    object Loading : EditProfileUiState()
    data class Idle(
        val currentName: String,
        val currentPhotoUrl: String?,
        val newName: String = currentName,
        val newPhotoUri: Uri? = null,
        val nameError: String? = null,
        val hasChanges: Boolean = false,
        val isSaving: Boolean = false
    ) : EditProfileUiState()
    data class Error(val message: String) : EditProfileUiState()
}

// Validação
object ProfileValidator {
    fun validateName(name: String): ValidationResult
}
```

### 3.3 API / Firebase

| Operação | Collection/Endpoint | Método | Payload |
|----------|---------------------|--------|---------|
| Carregar perfil | `users/{uid}` | GET | - |
| Atualizar nome | `users/{uid}` | UPDATE | `{name: "..."}` |
| Upload foto | `Storage/profile_photos/{uid}` | PUT | File |
| Atualizar URL foto | `users/{uid}` | UPDATE | `{photoUrl: "..."}` |

### 3.4 Cache e Offline

| Cenário | Comportamento |
|---------|---------------|
| Sem internet ao abrir | Carrega dados do cache local (Room) |
| Sem internet ao salvar | Snackbar "Sem conexão", não permite salvar |
| Perda durante upload | Cancela upload, mantém foto anterior |

### 3.5 Segurança

- [x] Upload só para usuário autenticado
- [x] Storage rules: só o próprio usuário pode escrever em `profile_photos/{uid}`
- [x] Firestore rules: só o próprio usuário pode editar `users/{uid}`
- [x] Validação de input no client E backend

### 3.6 Performance

- [x] Compressão de imagem para max 500KB (usar Coil ou similar)
- [x] Resize para max 512x512 pixels
- [x] Debounce de 300ms na validação de nome
- [x] Evitar recomposição: usar `remember` e `derivedStateOf`

### 3.7 Analytics e Observabilidade

| Evento | Quando dispara | Parâmetros |
|--------|----------------|------------|
| `profile_edit_opened` | Ao abrir tela | - |
| `profile_photo_changed` | Após upload bem-sucedido | `source: "camera" \| "gallery"` |
| `profile_name_changed` | Após salvar nome | - |
| `profile_edit_error` | Ao falhar | `error_type: String` |

---

## 4. Tasks (Breakdown)

| # | Task | Estimativa | Status |
|---|------|------------|--------|
| 1 | Criar `EditProfileUiState` e `ProfileValidator` | 1h | ⬜ |
| 2 | Criar `EditProfileViewModel` | 2h | ⬜ |
| 3 | Criar `UpdateProfileUseCase` | 1h | ⬜ |
| 4 | Atualizar `UserRepository` com métodos de update | 1h | ⬜ |
| 5 | Criar `EditProfileScreen.kt` (Compose) | 3h | ⬜ |
| 6 | Implementar seleção de foto (BottomSheet + Picker) | 2h | ⬜ |
| 7 | Implementar compressão/resize de imagem | 1h | ⬜ |
| 8 | Adicionar navegação no NavGraph | 0.5h | ⬜ |
| 9 | Testes unitários (ViewModel, Validator) | 2h | ⬜ |
| 10 | Teste de UI (fluxo principal) | 1h | ⬜ |
| 11 | Code review + ajustes | 1h | ⬜ |

**Total estimado:** 15.5h

---

## 5. Verification (Verificação)

### 5.1 Testes

| Tipo | Cobertura | Status |
|------|-----------|--------|
| Unit: ProfileValidator | Todos os cenários de validação | ⬜ |
| Unit: EditProfileViewModel | Estados e transições | ⬜ |
| UI: Compose | Fluxo de edição completo | ⬜ |

### 5.2 Checklist de Revisão

- [ ] Build passa sem erros
- [ ] Lint passa
- [ ] Testes passam
- [ ] Testado em light/dark theme
- [ ] Testado em phone portrait/landscape
- [ ] Strings em `strings.xml`
- [ ] Analytics implementado

### 5.3 Demo

- [ ] Demo para PM/stakeholders

---

## 6. Notas e Referências

- Componente de crop: considerar usar `UCrop` ou similar
- Referência M3: [Profile editing patterns](https://m3.material.io/patterns)

---

## Histórico de Alterações

| Data | Autor | Alteração |
|------|-------|-----------|
| 2025-01-20 | Claude | Criação inicial |
| 2025-01-20 | Claude | Status: APPROVED |
