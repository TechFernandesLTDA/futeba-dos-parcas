# SCREEN: [Nome da Tela]

> **Status:** `DRAFT` | `DESIGN_REVIEW` | `APPROVED` | `IMPLEMENTED`
> **Autor:** [seu nome]
> **Data:** YYYY-MM-DD
> **Relacionado:** feat-YYYY-MM-DD-xxx.md (se fizer parte de uma feature)

---

## 1. Visão Geral

### 1.1 Propósito
<!-- Para que serve esta tela? -->

### 1.2 Contexto de Navegação

```
[De onde vem] --> [ESTA TELA] --> [Para onde vai]
                       |
                       v
                  [Ações possíveis]
```

### 1.3 Tipo de Tela

- [ ] Listagem
- [ ] Detalhe
- [ ] Formulário
- [ ] Dashboard
- [ ] Dialog/BottomSheet
- [ ] Outro: ...

---

## 2. Layout e Componentes

### 2.1 Estrutura Geral

```
┌─────────────────────────────────┐
│ TopAppBar                       │
│ [← Back] [Título]    [Actions]  │
├─────────────────────────────────┤
│                                 │
│ [Conteúdo Principal]            │
│                                 │
│                                 │
│                                 │
├─────────────────────────────────┤
│ [BottomBar / FAB]               │
└─────────────────────────────────┘
```

### 2.2 Componentes

| Componente | Tipo | Descrição | Interação |
|------------|------|-----------|-----------|
| TopAppBar | Material3 | Título + navegação | Back, menu |
| Lista | LazyColumn | Items de X | Tap → detalhe |
| FAB | FloatingActionButton | Criar novo | Tap → formulário |
| ... | ... | ... | ... |

### 2.3 Wireframes / Mockups

<!-- Links para Figma, imagens, ou ASCII art -->

**Phone Portrait:**
```
[wireframe ou link]
```

**Phone Landscape:**
```
[wireframe ou link]
```

**Tablet:**
```
[wireframe ou link]
```

---

## 3. Estados da Tela

### 3.1 Loading

| Elemento | Comportamento |
|----------|---------------|
| Lista | Shimmer/Skeleton (3-5 items) |
| Botões | Desabilitados |
| Pull-to-refresh | Não disponível |

### 3.2 Empty

| Cenário | Mensagem | Ilustração | Ação |
|---------|----------|------------|------|
| Nenhum item | "Nenhum X encontrado" | [ícone] | Botão "Criar primeiro" |
| Filtro sem resultado | "Nenhum resultado para..." | [ícone] | Botão "Limpar filtros" |

### 3.3 Error

| Tipo de erro | Mensagem | Ação |
|--------------|----------|------|
| Sem conexão | "Sem conexão com a internet" | Botão "Tentar novamente" |
| Servidor indisponível | "Erro ao carregar dados" | Botão "Tentar novamente" |
| Permissão negada | "Você não tem acesso a..." | Botão "Voltar" |

### 3.4 Success

<!-- Descrição do estado normal com dados -->

---

## 4. Responsividade

### 4.1 Breakpoints

| Configuração | Largura | Adaptações |
|--------------|---------|------------|
| Phone Portrait | < 600dp | Layout padrão |
| Phone Landscape | < 600dp rotated | Scroll horizontal se necessário |
| Tablet Portrait | 600-840dp | Expandir conteúdo |
| Tablet Landscape | > 840dp | Two-pane layout (se aplicável) |

### 4.2 Adaptações Específicas

| Elemento | Phone | Tablet |
|----------|-------|--------|
| Navegação | BottomBar | NavigationRail |
| Lista | Single column | Grid 2-3 columns |
| Detalhes | Nova tela | Side panel |

---

## 5. Acessibilidade

### 5.1 Content Descriptions

| Elemento | contentDescription |
|----------|-------------------|
| Botão X | "Criar novo jogo" |
| Ícone status | "Status: confirmado" |
| Avatar | "Foto de perfil de [nome]" |

### 5.2 Navegação

- [ ] Foco inicial correto ao abrir
- [ ] Ordem de foco lógica (top-down, left-right)
- [ ] Elementos decorativos ignorados pelo leitor
- [ ] Grupos semânticos definidos

### 5.3 Contraste e Legibilidade

- [ ] Texto principal: contraste >= 4.5:1
- [ ] Texto secundário: contraste >= 3:1
- [ ] Ícones interativos: contraste >= 3:1
- [ ] Tamanho mínimo de fonte: 12sp

### 5.4 Touch Targets

- [ ] Todos os botões >= 48dp x 48dp
- [ ] Espaçamento entre targets >= 8dp
- [ ] Áreas de toque claras

---

## 6. Interações e Animações

### 6.1 Transições de Navegação

| De → Para | Animação |
|-----------|----------|
| Lista → Detalhe | Shared element / Slide |
| Tela → Dialog | Fade + Scale |

### 6.2 Micro-interações

| Ação | Feedback |
|------|----------|
| Pull-to-refresh | Indicador de carregamento |
| Tap em item | Ripple effect |
| Swipe-to-dismiss | Animação de saída |
| Sucesso ao salvar | Snackbar com confirmação |

### 6.3 Estados de Loading

- [ ] Shimmer para conteúdo inicial
- [ ] Spinner para ações pontuais
- [ ] Progress bar para uploads/downloads

---

## 7. Dados e Integração

### 7.1 Dados Exibidos

| Campo | Fonte | Formatação |
|-------|-------|------------|
| Título | `model.title` | Capitalizado |
| Data | `model.date` | "dd/MM/yyyy" |
| Preço | `model.price` | "R$ 0,00" |

### 7.2 Ações do Usuário

| Ação | Endpoint/Método | Feedback |
|------|-----------------|----------|
| Criar | `repository.create()` | Toast sucesso / Dialog erro |
| Editar | `repository.update()` | Snackbar confirmação |
| Deletar | `repository.delete()` | Dialog confirmação antes |

---

## 8. Testes de UI

### 8.1 Cenários a Testar

| Cenário | Verificação |
|---------|-------------|
| Tela carrega com dados | Lista exibe items corretamente |
| Estado empty | Mensagem e ação aparecem |
| Estado error | Botão retry funciona |
| Tap em item | Navega para detalhe |

### 8.2 Compose Test Tags

```kotlin
// Tags para testes
Modifier.testTag("screen_list")
Modifier.testTag("item_card_$id")
Modifier.testTag("empty_state")
Modifier.testTag("error_retry_button")
```

---

## 9. Notas de Implementação

### 9.1 Composables a Criar

- [ ] `NomeDaTelaScreen.kt` - Tela principal
- [ ] `NomeDaTelaContent.kt` - Conteúdo stateless (para preview/teste)
- [ ] `NomeDaTelaItem.kt` - Item da lista (se aplicável)

### 9.2 Dependências

- ViewModel existente: `XViewModel`
- UiState: `XUiState` (sealed class)
- Navegação: `NavController` ou callback

---

## Histórico

| Data | Autor | Alteração |
|------|-------|-----------|
| YYYY-MM-DD | Nome | Criação do spec |
