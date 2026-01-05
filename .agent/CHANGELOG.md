# Changelog de Implementações

**Última atualização**: 06/01/2026

Este arquivo consolida o histórico de todas as implementações significativas do projeto.

---

## 🔄 Correções Recentes

### 06/01/2026 (v1.3.0)

- **Perfil do jogador**: novos campos (nascimento, gênero, medidas, pé dominante, posições, estilo e experiência) com validação e avatar.
- **Autoavaliação inteligente**: notas calculadas a partir do desempenho real e combinadas com ratings manuais.
- **Notas consistentes**: cartões, listas, comparador e balanceamento agora usam a nota efetiva.
- **Tema e splash**: app inicia no modo claro e mostra a versão atual na splash/Sobre.
- **Build & warnings**: ajustes de dependências, R8/proguard e supressão de avisos irrelevantes.


### 07/01/2026 (v1.3.1)

- **Players atualizado**: o card “Você” agora aparece na aba jogadores com o melhor rating calculado e redireciona rapidamente para o perfil ativo.
- **Tema inteligente**: barras do sistema seguem o esquema gerado por `DynamicThemeEngine`, mantendo a navbar e o status bar alinhados com o modo escuro e as cores escolhidas no personalizador.
- **Personalização enriquecida**: a tela de aparência ganhou texto explicativo, botão “Redefinir para o padrão” e reforço de que as escolhas afetam todo o aplicativo.
- **Operação documentada**: este changelog traz o histórico das ações de manutenção e visualização para facilitar auditorias futuras.


---

## � Status Atual

✅ **Build**: SUCCESS  
📊 **Progresso**: ~91% completo  
🔧 **Próxima Prioridade**: Testes manuais do fluxo de jogo completo

---

## ✅ Implementações Concluídas (Por Data)

### Rodada 4: Sistema Completo de Jogo ao Vivo

**Arquivos Criados:**

- `LiveGameRepository.kt` - Repository para dados em tempo real
- `LiveGameViewModel.kt` - ViewModel principal
- `LiveStatsViewModel.kt` - Stats em tempo real
- `LiveEventsViewModel.kt` - Timeline de eventos
- `LiveGameFragment.kt` - Fragment com tabs

**Funcionalidades:**

- ✅ Jogo ao vivo com tabs (Estatísticas/Eventos)
- ✅ Placar atualizado em tempo real via Flow
- ✅ Sistema de eventos (gols, defesas, cartões)
- ✅ Timeline de eventos cronológica
- ✅ Botão finalizar jogo (apenas organizador)

---

### Rodada 3: Pagamentos PIX (MVP)

**Funcionalidades:**

- ✅ Geração de PIX simulado
- ✅ QR Code + Copia e Cola
- ✅ Integração com detalhes do jogo
- ✅ Atualização de status (Pendente → Pago)

---

### Rodada 2: Gamificação (Liga/Badges)

**Funcionalidades:**

- ✅ Sistema de streaks (sequências)
- ✅ Badges por conquistas
- ✅ Seasons/Temporadas
- ✅ Rankings por temporada

---

### Rodada 1: Melhorias Core

**Funcionalidades:**

- ✅ Contador de confirmações corrigido
- ✅ Status LIVE (Bola Rolando)
- ✅ Sistema de posições (Goleiro/Linha)
- ✅ Sorteio de times melhorado
- ✅ Ferramentas de desenvolvedor com mock data

---

## 📚 Documentação Relacionada

- **PROJECT_STATE.md** - Estado atual de cada feature
- **QUICK_REFERENCE.md** - Índice de navegação rápida
- **GEMINI_CONTEXT.md** - Instruções para o agente
