# Changelog

## [1.5.0] - 2026-01-28

### Added

- **Clean Architecture**: Base classes para camadas de dominio, data e presentation.
- **Utilitarios Completos**: Novos utilitarios para animacao, tema, permissoes, rede, compartilhamento, vibracao, clipboard, bateria, teclado, formatacao, arquivos, dispositivo, WorkManager, acessibilidade e conversao de dados.
- **Componentes Compose Reutilizaveis**: Biblioteca de componentes UI padronizados.
- **Seguranca**: Utilitarios para biometria, criptografia e deep links.
- **Monitoramento**: Infraestrutura de analytics, rastreamento de erros e monitoramento de performance.
- **Testes**: Utilitarios abrangentes para testes unitarios e de UI.
- **Paging 3**: Carregamento eficiente de listas grandes com paginacao.
- **Validacao Firebase**: 47 melhorias de validacao de dados no Firebase/Firestore.
- **Melhorias de Localizacao**: 30 melhorias na feature de locais/campos.
- **Compressao de Imagens**: Validacao e compressao automatica para grupos e campos.
- **Detekt**: Plugin de analise estatica de codigo configurado.
- **Onboarding**: Fluxo completo de permissoes e primeiros passos.
- **Feedback**: Sistema de reporte de problemas pelo usuario.
- **Baseline Profiles**: Otimizacao de startup com perfis de referencia.
- **CI/CD**: GitHub Actions para build, testes e deploy automatizado.
- **Lembretes de Jogo**: Cloud Function para envio automatico de lembretes.

### Changed

- **Performance Otimizada**: Suite completa de otimizacoes (150-300ms mais rapido).
- **Cache Inteligente**: CachedAsyncImage com Coil, cache local com TTL.
- **Carregamento Progressivo**: HomeViewModel com 3 fases de carregamento.
- **Material 3**: Surface Containers para hierarquia visual correta.
- **Compose Migration**: Migracao completa de telas para Jetpack Compose.
- **KMP Shared Module**: Modulo compartilhado Kotlin Multiplatform preparado para iOS.
- **Internationalizacao**: Todas strings extraidas para strings.xml (i18n ready).
- **Modo Retrato**: Bloqueio de orientacao e correcao de espacamentos.

### Fixed

- **45 Bugs Corrigidos**: Rodada completa de correcao de bugs incluindo:
  - 16 operadores `!!` inseguros substituidos por tratamento null-safe
  - 8 catch blocks silenciosos agora logam erros corretamente
  - 12 LazyColumn/LazyRow sem keys corrigidos para performance
  - Bug critico de reset de streak na finalizacao de partidas
  - Bug de comparacao null no fechamento de temporadas
  - Crash de scroll em tablet/landscape
  - Crash de navegacao e visibilidade de jogos admin
  - Crash de key duplicada na secao de badges do perfil
- **Null Safety**: Validacao de input e seguranca melhoradas.
- **Logs sem PII**: Remocao de dados pessoais (email, nome) dos logs.
- **EditProfile**: Salvamento de perfil corrigido.
- **Hilt**: Atualizado para 2.56.2 (compatibilidade Kotlin 2.2.x).
- **AGP 9.0**: Compatibilidade com Android Gradle Plugin 9.0.
- **Cloud Functions**: Inicializacao lazy dos servicos Firebase.

### Security

- **3 Vulnerabilidades Criticas Corrigidas**: Fase 1 de seguranca completa.
- **Firestore Rules**: Regras de seguranca atualizadas e indices compostos.

### Performance

- **98% menos recomposicoes**: Timer isolado no LiveGameScreen.
- **ListenerLifecycleManager**: Limpeza automatica de listeners Firestore.
- **CacheCleanupWorker**: Gerenciamento abrangente de cache.
- **PerformanceTracker**: Monitoramento de metricas em tempo real.
- **Scroll otimizado**: LeagueScreen e ProfileScreen sem jank.

---

## [1.4.2] - 2026-01-15

### Added

- **Native Debug Symbols**: Simbolos de debug nativos para analise de crashes no Play Console.

---

## [1.4.1] - 2026-01-12

### Added

- **KMP Shared Module**: Modulo compartilhado inicial com camada de dominio completa.
- **Claude CI/CD**: Workflows de Code Review e PR Assistant com IA.

### Fixed

- **Notificacoes**: Correcao de datas em notificacoes.
- **Badges**: Correcao no compartilhamento de badges.
- **Proximos Jogos**: Correcao na exibicao de jogos futuros.

### Documentation

- **KMP Plan**: Plano atualizado com status atual e requisitos iOS.

---

## [1.4.0] - 2026-01-10

### Added

- **Cashbox Receipts**: Upload de comprovantes no caixa do grupo.
- **Cashbox Monthly Grouping**: Agrupamento mensal de transacoes.
- **Location Management**: Gerenciamento completo de locais com migracao e deduplicacao.
- **Firebase Hardening**: Seguranca reforçada do Firebase.
- **Google Sign-In Fix**: Correcao do login com Google e App Check debug.

### Changed

- **Performance Optimizations**: Otimizacoes de performance v1.4.0.
- **Security Improvements**: Melhorias de seguranca.
- **KMP Preparation**: Preparacao para Kotlin Multiplatform.
- **Color Palette**: Nova paleta de cores premium moderna.

### Fixed

- **Games Section Crash**: Crash na secao de jogos resolvido.
- **Firestore Resilience**: Anotacao @Exclude em metodos auxiliares.
- **Location Syntax Errors**: Erros de sintaxe no LocationDetailScreen.
- **Empty State Alignment**: Alinhamento do estado vazio na Home.

### Documentation

- **Comprehensive Docs**: Documentacao expandida de regras de negocio e stack.
- **Scripts Documentation**: Documentacao completa dos scripts.

---

## [1.3.0] - 2026-01-06

### Added

- **Perfil do Jogador**: novos campos de perfil (data de nascimento, genero, altura/peso, pe dominante, posicoes, estilo de jogo e experiencia).
- **Autoavaliacao Inteligente**: notas automaticas calculadas com base no desempenho e exibicao dedicada no perfil.

### Changed

- **Consistencia de Ratings**: notas efetivas aplicadas em cards, comparador, lista de jogadores e balanceamento de times.
- **Tema Padrao**: o app agora inicia no tema claro.

### Fixed

- **Tela Inicial**: ajuste no carregamento de "Meus Proximos Jogos" para evitar cards cortados.

---

## [1.1.5] - 2026-01-02

### Changed

- **Home Screen Redesign**:
  - A secao de "Boas-vindas" e "Primeiros Passos" foi movida para o topo da tela para melhor orientar novos usuarios.
  - O grafico de "Frequencia de Jogos" (Heatmap) agora exibe um historico de atividades mais completo (100 itens).
  - Remocao do botao flutuante "Criar Jogo" (FAB) da tela Inicial, centralizando essa acao na aba de Jogos para simplificar a navegacao.
- **UI & UX**: Ajustes de layout para garantir fluidez entre os componentes nativos (XML) e Jetpack Compose na tela inicial.

---

## [1.1.4] - 2026-01-02

### Added

- **Firestore Resilience**: Adicionada a anotacao @Exclude em todos os metodos auxiliares e de conversao nas classes de modelo (Game, Group, LiveGame, AppNotification, Location, User). Isso previne crashes criticos relacionados a "conflicting getters" durante a desserializacao de dados do Firestore.

### Fixed

- **Games Section Crash**: Resolvido o erro RuntimeException: Found conflicting getters for name getVisibility que impedia a abertura da secao de Jogos.

---

## [1.1.3] - 2025-12-30

### Fixed

- **Game Creation**:
  - Resolvido bug onde o criador do jogo recebia uma notificacao de convite "fantasma" para o proprio jogo.
  - O criador do jogo agora e automaticamente marcado como "Confirmado" em vez de "Pendente" ao criar a partida.
  - Correcao na validacao de data que causava erro de fuso horario (selecionava um dia anterior).
  - Adicionada verificacao de permissao: apenas Donos ou Administradores de grupos podem criar jogos.
- **UI Improvements**:
  - Correcao de sobreposicao visual nos botoes de "Aceitar/Recusar" na tela de detalhes do jogo para o organizador.
  - Melhoria na disposicao dos elementos nos cartoes de confirmacao de presenca.

---

## [1.1.2] - 2025-12-30

### Changed

- **UI Standardization**: A tela da Liga agora possui paridade visual "pixel-perfect" com as demais telas do aplicativo (Home, Jogos), unificando altura do cabecalho, fontes e cores.
- **Dark Mode Polish**: Correcao do fundo "esverdeado" no tema escuro. Agora utilizamos o padrao Material 3 Neutral (#1D1B20) para um visual mais profissional e coeso.
- **About Screen**: Tela "Sobre" revitalizada com novo design em cartoes e visualizacao automatica deste Changelog.
- **App Icon**: Padronizacao do icone do aplicativo na tela "Sobre" para corresponder ao icone oficial da Play Store.

---

## [1.1.1] - 2025-12-29

### Changed

- **Visual Polish**: Atualizacao da cor de fundo padrao (surface_variant) de Lilas para Cinza Neutro (#F0F2F5).
- **Privacy Policy**: Atualizacao dos links e textos de copyright na pagina publica de exclusao de conta e criacao da pagina de Politica de Privacidade.

### Fixed

- **Play Store Compliance**: Remocao explicita da permissao AD_ID. O app agora esta em conformidade total para responder "Nao" no formulario de uso de ID de publicidade.

---

## [1.1.0] - 2025-12-29

### Added

- **Gamification Automation**: Sistema de promocao e rebaixamento de liga agora e totalmente automatico e mensal.
- **Improved Season Logic**: Correcao na deteccao da "Temporada Ativa", priorizando temporadas mensais e corrigindo conflitos com dados de teste.
- **Season Guardian**: Blindagem contra travamento se nao houver temporada ativa.

### Changed

- **Players Screen (Mercado da Bola)**: Redesign completo para Material 3 com nova barra de busca e filtros em carrossel.
- **League Screen**: Correcao de dados zerados e melhorias de performance.

### Fixed

- **Bug Fantasma**: Resolvido problema com temporadas de teste.
- **Security**: Correcao de regras duplicadas no firestore.rules.
- **Crash Fix**: Correcao de atributo XML invalido na tela de jogadores.
