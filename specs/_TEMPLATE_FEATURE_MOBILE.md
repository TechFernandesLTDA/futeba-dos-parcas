# SPEC: [Nome da Feature]

> **Status:** `DRAFT` | `IN_REVIEW` | `APPROVED` | `IN_PROGRESS` | `DONE`
> **Autor:** [seu nome]
> **Data:** YYYY-MM-DD
> **PR:** #xxx (preencher quando criar)

---

## 1. Requirements (Requisitos)

### 1.1 Problema / Oportunidade
<!-- O que estamos resolvendo? Por que agora? -->

### 1.2 Casos de Uso
<!-- Quem usa? Como usa? Cenários principais. -->

| ID | Ator | Ação | Resultado esperado |
|----|------|------|-------------------|
| UC1 | Jogador | ... | ... |
| UC2 | Admin | ... | ... |

### 1.3 Critérios de Aceite
<!-- Quando a feature está "pronta"? -->

- [ ] CA1: ...
- [ ] CA2: ...
- [ ] CA3: ...

### 1.4 Fora de Escopo
<!-- O que NÃO será feito nesta versão? -->

- ...

---

## 2. UX/UI Design

### 2.1 Fluxo de Navegação
<!-- Diagrama de fluxo ou descrição textual -->

```
[Tela A] --tap botão--> [Tela B] --sucesso--> [Tela C]
                                 --erro--> [Dialog Erro]
```

### 2.2 Telas e Estados

| Tela | Estado | Descrição | Wireframe |
|------|--------|-----------|-----------|
| TelaX | Loading | Skeleton/shimmer enquanto carrega | [link] |
| TelaX | Empty | Nenhum dado encontrado | [link] |
| TelaX | Error | Falha na requisição, botão retry | [link] |
| TelaX | Success | Dados exibidos normalmente | [link] |

### 2.3 Responsividade

| Configuração | Comportamento |
|--------------|---------------|
| Phone Portrait | Layout padrão |
| Phone Landscape | Adaptar/esconder elementos se necessário |
| Tablet (sw600dp+) | Usar NavigationRail, expandir conteúdo |

### 2.4 Acessibilidade

- [ ] Todos os elementos interativos têm `contentDescription`
- [ ] Touch targets >= 48dp
- [ ] Contraste >= 4.5:1 (usar `ContrastHelper`)
- [ ] Suporte a TalkBack/leitor de tela
- [ ] Navegação por teclado/D-pad funciona

### 2.5 Animações e Micro-interações
<!-- Descreva transições, feedbacks visuais -->

---

## 3. Technical Design

### 3.1 Arquitetura

```
[UI: Composable]
    ↓ eventos
[ViewModel: StateFlow<UiState>]
    ↓
[UseCase / Repository]
    ↓
[DataSource: Firebase / Room]
```

### 3.2 Modelos de Dados

```kotlin
// Novo modelo ou alteração
data class NomeDoModelo(
    val id: String,
    val campo1: String,
    // ...
)
```

### 3.3 API / Firestore

| Operação | Collection/Endpoint | Método | Payload |
|----------|---------------------|--------|---------|
| Buscar X | `collection/doc` | GET | - |
| Salvar Y | `collection` | POST | `{...}` |

### 3.4 Cache e Offline

| Cenário | Comportamento |
|---------|---------------|
| Sem internet ao abrir | Exibir dados do cache + banner "offline" |
| Perda de conexão durante uso | Fila de operações, retry automático |
| Dados expirados | Mostrar stale + fetch em background |

### 3.5 Segurança

- [ ] Nenhum token/secret hardcoded
- [ ] Dados sensíveis em EncryptedSharedPreferences
- [ ] Validação de input no client E no backend
- [ ] Firestore rules atualizadas (se aplicável)

### 3.6 Performance

- [ ] Imagens otimizadas (WebP, tamanho adequado)
- [ ] Listas usam `key` em `items()` do LazyColumn
- [ ] Evitar recomposições desnecessárias (`remember`, `derivedStateOf`)
- [ ] Pagination para listas grandes (50 items/page)

### 3.7 Analytics e Observabilidade

| Evento | Quando dispara | Parâmetros |
|--------|----------------|------------|
| `feature_x_opened` | Ao abrir a tela | `source: String` |
| `feature_x_action` | Ao concluir ação | `success: Boolean` |

**Logs:** Nível `DEBUG` para desenvolvimento, sem PII.

---

## 4. Tasks (Breakdown)

| # | Task | Estimativa | Responsável | Status |
|---|------|------------|-------------|--------|
| 1 | Criar modelo de dados | 1h | | ⬜ |
| 2 | Implementar Repository | 2h | | ⬜ |
| 3 | Criar ViewModel + UiState | 2h | | ⬜ |
| 4 | Implementar tela (Compose) | 4h | | ⬜ |
| 5 | Adicionar testes unitários | 2h | | ⬜ |
| 6 | Adicionar teste de UI | 2h | | ⬜ |
| 7 | Code review + ajustes | 1h | | ⬜ |

**Total estimado:** Xh

---

## 5. Verification (Verificação)

### 5.1 Testes

| Tipo | Cobertura | Status |
|------|-----------|--------|
| Unit (ViewModel/UseCase) | Casos principais | ⬜ |
| UI (Compose) | Fluxo crítico | ⬜ |
| Instrumented (Room) | Se aplicável | ⬜ |

### 5.2 Checklist de Revisão

- [ ] Build passa sem erros/warnings
- [ ] Lint passa (ou justificativa para ignorar)
- [ ] Testes passam
- [ ] Testado em light/dark theme
- [ ] Testado em diferentes tamanhos de tela
- [ ] Sem regressões em funcionalidades existentes
- [ ] Strings em `strings.xml` (sem hardcode)
- [ ] Analytics implementado
- [ ] Documentação atualizada (se necessário)

### 5.3 Demo

- [ ] Demo gravada ou realizada para stakeholders
- [ ] Feedback incorporado

---

## 6. Notas e Referências

- Link para issue: #xxx
- Link para design no Figma: [...]
- Decisões relacionadas: `/specs/DECISIONS.md#[...]`

---

## Histórico de Alterações

| Data | Autor | Alteração |
|------|-------|-----------|
| YYYY-MM-DD | Nome | Criação inicial |
