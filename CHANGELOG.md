# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [1.7.2] - 2026-02-01

### Removido
- Permissão ACCESS_BACKGROUND_LOCATION (não utilizada)
- Documentado roadmap para check-in automático via geofence (v1.8.0+)

### Documentação
- Adicionado ROADMAP_BACKGROUND_LOCATION.md

## [1.7.0] - 2026-01-31

### Adicionado
- Infraestrutura completa para iOS com Kotlin Multiplatform
- Compose Multiplatform para UI compartilhada (Android + iOS)
- Firebase bridges para iOS (Auth, Firestore, Storage)
- Serviços nativos iOS (Location, Apple Sign-In, Push)
- GitHub Actions CI/CD para builds iOS
- Spec completa de desenvolvimento iOS

### Mudado
- Estrutura do projeto para suportar KMP
- Compose Multiplatform plugin adicionado

### Documentação
- SPEC_IOS_KMP_DEVELOPMENT.md criada
- NEXT_STEPS_iOS.md para guia de setup Mac
- iosApp/SETUP.md para configuração Xcode

## [1.6.0] - 2026-01-20

### Adicionado
- Sistema de busca global com filtros avançados
- Melhorias visuais em múltiplas telas
- Responsividade para tablets
- Suporte multi-plataforma (portrait/landscape)

### Melhorado
- Performance de listas com paginação
- UI/UX geral do aplicativo

## [1.3.0] - 2026-01-06

### Novidades

- **Perfil do Jogador**: novos campos de perfil (data de nascimento, genero, altura/peso, pe dominante, posicoes, estilo de jogo e experiencia).
- **Autoavaliacao Inteligente**: notas automaticas calculadas pelo desempenho e combinadas com notas manuais para refletir a forma real do jogador.

### Melhorias

- **Consistencia de Ratings**: notas efetivas aplicadas no mercado de jogadores, comparador, cards e balanceamento de times.
- **Tela Inicial**: ajuste no carregamento de "Meus Proximos Jogos" para evitar cards cortados.

### Ajustes Tecnicos

- **Tema Padrao**: o app agora inicia no tema claro.

## [1.2.0] - 2026-01-05

### Correções (Fixes)

- **Criação de Jogos**: Corrigido bug crítico onde jogos "Apenas Grupo" eram criados sem o campo `dateTime` no banco de dados, tornando-os invisíveis nas listagens.
  - Implementada conversão robusta de Data/Hora usando `java.util.Date` e `java.time.ZoneId` para suportar adequadamente todas as instâncias do Firestore.
  - Adicionado "fallback" de segurança na camada de repositório (`GameRepositoryImpl`) para auto-corrigir jogos criados sem `dateTime` caso o problema ocorra novamente.
- **Compilação**: Resolvido erro de compatibilidade de API (Argument type mismatch) no `CreateGameViewModel` ao converter Timestamp.
- **Performance**: Melhoria na query de buscas de jogos de grupo, otimizando a recuperação de IDs de grupos do usuário.
- **Estabilidade**: Adicionado log de erros detalhado (AppLogger.e) nas Streams do Firestore para facilitar diagnóstico de falhas em tempo real (como índices faltando).
- **Limpeza**: Removidos logs de debug intrusivos que estavam poluindo o Logcat em produção.

### Mudanças Anteriores (Destaques Recentes)

- **Interface**: Melhorias na consistência visual do cabeçalho da "Liga" em relação às outras telas principais.
- **Gamification**: Ajustes nas regras de segurança do Firestore para permitir que donos de jogos validem partidas e atualizem XP.

## [Unreleased]

### Adicionado
- Rate limiting aplicado às Cloud Functions críticas (`setUserRole`, `migrateAllUsersToCustomClaims`)
- Cleanup automático de rate limits expirados (scheduled function a cada hora)
- Componentes modernos UI/UX (Material 3):
  - `ShimmerLoading.kt` - Skeleton loading states com animação shimmer
  - `ErrorState.kt` - Estados de erro com retry e ícones ilustrativos (5 tipos)
  - `EmptyState.kt` - Estados vazios com CTAs (7 variantes pré-configuradas)
  - `LoadingButton.kt` - Botões com loading interno (6 variantes)
  - `AdaptiveNavigation.kt` - Navegação responsiva (bottom bar/rail/drawer)
  - `PullToRefreshContainer.kt` - Pull-to-refresh moderno Material 3
- Spec completa com 30 melhorias de UI/UX (`specs/UI_UX_IMPROVEMENTS_30.md`)
- Documentação consolidada para LLMs (`.claude/PROJECT_CONTEXT.md`)
- `.gitattributes` para padronização de line endings cross-platform

### Melhorado
- README.md atualizado para versão 1.8.0
- Documentação otimizada para Claude Code e outros LLMs

### Removido
- Arquivos temporários obsoletos (`build_errors*.txt`, `nul`)

### Planejado
- [ ] Aplicar componentes modernos em telas existentes (Fase 2)
- [ ] Animações de transição e micro-interações (Fase 3)
- [ ] Gráficos modernos com Vico Charts (Fase 3)
- [ ] Onboarding interativo (Fase 4)
- [ ] Check-in automático via geofence (v1.8.0)
- [ ] App iOS completo (v2.0.0)
- [ ] Widgets iOS (v2.1.0)
- [ ] Modo offline completo
- [ ] Sincronização multi-device

---

## Tipos de Mudanças

- **Adicionado** - Novas funcionalidades
- **Mudado** - Mudanças em funcionalidades existentes
- **Depreciado** - Funcionalidades que serão removidas
- **Removido** - Funcionalidades removidas
- **Corrigido** - Correção de bugs
- **Segurança** - Vulnerabilidades corrigidas

---

[1.7.2]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/compare/v1.7.0...v1.7.2
[1.7.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/releases/tag/v1.6.0
