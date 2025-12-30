# Plano de Implementação: Correções Críticas Firebase & Bugfix

Este plano foca na estabilização do app, resolvendo o bug de carregamento da tela de jogos e implementando as correções críticas de arquitetura auditadas (Segurança, Performance, Observabilidade).

## User Review Required
>
> [!IMPORTANT]
> **Alteração de Esquema**: O modelo `Game` será alterado para incluir contadores atômicos (`goalkeepers_count`, `players_count`). Isso requer que jogos existentes sejam atualizados ou recriados para funcionarem 100% com a nova lógica (embora incluiremos fallback para manter compatibilidade).
> **Índices**: Novas queries exigirão criação de índices no Console do Firebase. O app lançará exceções no Logcat com o link para criação até que isso seja feito.

## Proposed Changes

### Build & Observabilidade

Configuração de plugins essenciais para monitoramento em produção.

#### [MODIFY] [build.gradle.kts (Project)](file:///c:/Projetos/Futeba%20dos%20Par%C3%A7as/build.gradle.kts)

- Adicionar plugins `google-services`, `crashlytics`, `perf`.

#### [MODIFY] [build.gradle.kts (App)](file:///c:/Projetos/Futeba%20dos%20Par%C3%A7as/app/build.gradle.kts)

- Aplicar plugins e adicionar dependências do SDK.

### Camada de Dados (Repository & Models)

#### [MODIFY] [Game.kt](file:///c:/Projetos/Futeba%20dos%20Par%C3%A7as/app/src/main/java/com/futebadosparcas/data/model/Game.kt)

- Adicionar campos `goalkeepersCount` e `playersCount` para controle atômico.

#### [MODIFY] [GameRepositoryImpl.kt](file:///c:/Projetos/Futeba%20dos%20Par%C3%A7as/app/src/main/java/com/futebadosparcas/data/repository/GameRepositoryImpl.kt)

- **Fix Loading**: Garantir tratamento de erro robusto no `getAllGames` e `getUpcomingGames` para não travar a UI em caso de falta de índice.
- **Atomicidade**: Reescrever `confirmPresence` para usar `firestore.runTransaction` com incremento real de contadores no documento pai.

#### [MODIFY] [UserRepository.kt](file:///c:/Projetos/Futeba%20dos%20Par%C3%A7as/app/src/main/java/com/futebadosparcas/data/repository/UserRepository.kt)

- **Performance**: Otimizar `searchUsers` para usar query de prefixo (`startAt`, `endAt`) em vez de filtrar na memória.

### Correção de UI

Se o bug de "loading eterno" persistir após ajuste no repositório, verificar o ViewModel.

## Verification Plan

### Automated / Manual Verification

1. **Observabilidade**: Verificar se Crashlytics inicializa no Logcat.
2. **Busca de Usuários**: Testar busca na tela de convite/perfil e verificar no Logcat se a query foi enviada com filtros (e não baixou a coleção toda).
3. **Confirmação Atômica**:
    - Confirmar presença em um jogo.
    - Verificar no Firestore Console se `players_count` incrementou.
    - Tentar confirmar além do limite (se possível simular concorrência, ou apenas verificar a lógica de bloqueio).
4. **Loading Tela de Jogos**: Abrir o app e garantir que a lista carrega (mesmo que vazia) e o loading some.
