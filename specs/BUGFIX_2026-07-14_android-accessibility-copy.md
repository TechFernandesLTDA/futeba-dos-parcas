# BUGFIX: Acessibilidade e copy canônica em componentes Android

> **Status:** `FIXED`
> **Severidade:** `MEDIUM`
> **Autor:** Codex
> **Data:** 2026-07-14
> **Issues:** #3630, #3631, #3634, #3636, #3637

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

- `RankingList` e `SimpleRankingList` duplicam em PT-BR a mensagem padrão do
  estado vazio.
- ações de comentário e remoção de mídia restringem o `IconButton` a 36 dp.
- os passos do wizard de criação recebem callback, mas não são clicáveis nem
  expõem nome e estado ao TalkBack.
- a foto/brasão clicável da Home herda descrições dos descendentes em vez de
  anunciar a ação de abrir o perfil.
- o título Android usa "Caixinha do Grupo", enquanto as demais superfícies
  canônicas usam "Caixa do Grupo".

### 1.2 Comportamento Esperado (Correto)

Textos visíveis e rótulos acessíveis vêm de recursos PT-BR/en/es; controles
interativos têm alvo mínimo de 48 dp; o stepper responde ao toque e anuncia
passo/estado; a ação de perfil tem um único nome claro; o título financeiro é
"Caixa do Grupo" em PT-BR.

### 1.3 Passos para Reproduzir

1. Ativar TalkBack e abrir a Home ou o wizard de criação de jogo.
2. Focar a foto do perfil ou os círculos de passo.
3. Observar anúncio ambíguo/ausente e que tocar no passo não chama o callback.
4. Abrir comentários ou anexar mídia ao mural e inspecionar os alvos de 36 dp.
5. Abrir a Caixa do grupo no Android e comparar o título com o Web.

### 1.4 Contexto

| Item | Valor |
|------|-------|
| Plataforma | Android / Jetpack Compose |
| Frequência | Sempre |
| Impacto | TalkBack, precisão de toque e consistência multiplataforma |

---

## 2. Análise de Causa Raiz

### 2.1 Investigação

Os componentes usam literais, constraints externas de 36 dp e callbacks sem
`clickable`. O container do avatar não sobrescreve a semântica herdada. O título
financeiro divergiu apesar de já existir "Caixa do Grupo" em outras strings.

### 2.2 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `ui/components/lists/RankingList.kt` | default duplicado e não localizado |
| `ui/games/components/GameCommentsSection.kt` | alvos e rótulos das ações |
| `ui/groups/WallPostComposer.kt` | alvo de remoção de mídia |
| `ui/games/components/CreateGameWizard.kt` | clique e semântica dos passos |
| `ui/games/CreateGameViewModel.kt` | IDs localizados dos títulos dos passos |
| `ui/home/components/ExpressiveHubHeader.kt` | ação semântica do avatar |
| `res/values*/strings.xml` | copy e rótulos PT-BR/en/es |

---

## 3. Solução Aprovada

1. Centralizar a mensagem de ranking e novos rótulos acessíveis em recursos
   traduzidos.
2. Preservar ícones compactos, mas deixar o `IconButton` fornecer 48 dp.
3. Manter o círculo visual do stepper em 36 dp dentro de uma superfície
   clicável de 48 dp, com nome, estado e papel de botão.
4. Definir descrição explícita localizada no container clicável do avatar para
   substituir descrições internas.
5. Adotar "Caixa do Grupo" como termo canônico PT-BR; en/es usam equivalentes
   naturais sem alterar nomes de domínio, coleções ou payloads.

### 3.1 Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Ações ocuparem mais espaço | reduzir apenas o ícone visual; manter alvo de 48 dp |
| TalkBack anunciar conteúdo duplicado | descrição explícita no nó clicável e ícones decorativos |
| Tradução ausente | adicionar as mesmas chaves em PT-BR, inglês e espanhol |
| Stepper alterar estado indevidamente | callback existente continua sendo a única fonte da navegação |

---

## 4. Verificação

- [x] Teste Compose focado no clique e semântica do stepper.
- [x] Teste Compose do estado vazio localizado do ranking.
- [x] `:app:compileDebugKotlin`.
- [ ] compilação global de testes instrumentados — bloqueada por erros
  preexistentes em suítes antigas; nenhum erro aponta para os testes adicionados.
- [x] `detekt` e Android Lint proporcionais.
- [x] validação XML e diff-check.
- [x] revisão estática de touch targets, tema e recursos PT-BR/en/es.

---

## 5. Prevenção Futura

- Usar recursos desde a criação do componente e limitar tamanhos no ícone, não
  no `IconButton`.
- Cobrir controles customizados com testes de semântica e interação.

## Histórico

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-07-14 | Codex | Requisitos, UX, design técnico e tarefas aprovados antes da implementação |
| 2026-07-14 | Codex | Fix implementado; produção, lint, detekt, XML e testes unitários validados |
