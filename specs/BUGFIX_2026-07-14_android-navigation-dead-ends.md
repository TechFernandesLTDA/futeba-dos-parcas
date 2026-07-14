# BUGFIX: Dead ends de navegação no Android

> **Status:** `APPROVED`
> **Severidade:** `HIGH`
> **Autor:** Codex
> **Data:** 2026-07-14
> **Issues:** #3633, #3638, #3641

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

- “Ver todos” em jogos públicos é anunciado como clicável, mas executa um lambda vazio.
- O dashboard de dono de quadra está registrado no `NavHost`, porém não possui entrada na UI.
- O corpo de uma notificação de convite usa `referenceType="invite"`, que cai no `else` vazio do grafo.

### 1.2 Comportamento Esperado (Correto)

Todo controle anunciado como interativo deve concluir uma ação observável. “Ver todos” abre a
lista de jogos públicos, FIELD_OWNER/ADMIN veem o dashboard no Perfil e tocar no corpo de um
convite orienta explicitamente o uso das ações Aceitar/Recusar.

### 1.3 Impacto

Os três pontos quebram descoberta de funcionalidades e semântica de acessibilidade. No convite,
usar `referenceId` diretamente como grupo também seria incorreto porque esse campo contém o ID do
convite.

---

## 2. Análise de Causa Raiz

- `PublicGamesSuggestions` não expõe callback para a ação do cabeçalho.
- `ProfileScreen` não recebe callback para `Screen.FieldOwnerDashboard`.
- `AppNotification.createGroupInviteNotification` grava `referenceId=inviteId`; o NavGraph só
  conhece referências `game` e `group` e não pode derivar `groupId` localmente.

### Invariantes

1. ADMIN e FIELD_OWNER podem descobrir o dashboard; PLAYER não recebe a entrada.
2. `inviteId` nunca pode ser tratado como `groupId`.
3. Um convidado ainda não é membro; grupos privados não são legíveis por ele nas regras atuais.
   Portanto, o corpo do card não deve navegar para `GroupDetail` antes do aceite.
4. Identificador ausente ou destino inválido gera feedback; nenhum toque cai em no-op silencioso.

---

## 3. Solução Aprovada

1. Expor `onSeeAllClick` em `PublicGamesSuggestions`, propagá-lo pela Home e navegar para
   `Screen.PublicGames`.
2. Expor `onFieldOwnerDashboardClick` em `ProfileScreen`, mostrar item no bloco administrativo para
   `isFieldOwner` (helper que também autoriza ADMIN) e navegar para a rota já registrada.
3. Centralizar abertura de notificações no `NotificationsViewModel`:
   - `game` e `group`: validar o ID e emitir destino;
   - `invite`: exibir orientação localizada para usar Aceitar/Recusar, únicas ações que processam
     o convite com o repositório e regras autoritativas;
   - demais casos/falhas: emitir erro para snackbar.
4. Fazer `NotificationsScreen` consumir os destinos e manter Aceitar/Recusar como ações separadas.

### Arquivos previstos

| Arquivo | Alteração |
|---|---|
| `PublicGamesSuggestions.kt`, `HomeScreen.kt` | Callback funcional “Ver todos” |
| `ProfileScreen.kt`, `AppNavGraph.kt` | Entrada de dashboard e rotas |
| `NotificationsViewModel.kt`, `NotificationsScreen.kt` | Resolução autoritativa e feedback |
| `values*/strings.xml` | Rótulo e mensagens localizadas |
| `NotificationsViewModelTest.kt` | Destinos, orientação de convite e identificador ausente |

---

## 4. Verificação

- [x] Testes focados de notificações
- [x] `:app:compileDebugKotlin`
- [x] `:app:detekt`
- [x] `git diff --check`
- [x] Revisão de semântica/callbacks

---

## 5. Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Navegar para grupo usando `inviteId` | Convite não navega antes do aceite; mostra orientação |
| Grupo privado negar leitura ao convidado | Manter Aceitar/Recusar como ações autoritativas |
| Expor dashboard a jogador comum | Item condicionado a `User.isFieldOwner()` |
| Destino inválido voltar a ser silencioso | Estado de erro consumido pelo snackbar |

---

## Histórico

| Data | Autor | Alteração |
|---|---|---|
| 2026-07-14 | Codex | Investigação, desenho e aprovação |
| 2026-07-14 | Codex | Implementação concluída e gates focados validados |
