# Changelog

## [1.1.4] - 2026-01-02

### Added

- **Firestore Resilience**: Adicionada a anotação @Exclude em todos os métodos auxiliares e de conversão nas classes de modelo (Game, Group, LiveGame, AppNotification, Location, User). Isso previne crashes críticos relacionados a "conflicting getters" durante a desserialização de dados do Firestore.

### Fixed

- **Games Section Crash**: Resolvido o erro RuntimeException: Found conflicting getters for name getVisibility que impedia a abertura da seção de Jogos.

## [1.1.3] - 2025-12-30

### Fixed

- **Game Creation**:
  - Resolvido bug onde o criador do jogo recebia uma notificação de convite "fantasma" para o próprio jogo.
  - O criador do jogo agora é automaticamente marcado como "Confirmado" em vez de "Pendente" ao criar a partida.
  - Correção na validação de data que causava erro de fuso horário (selecionava um dia anterior).
  - Adicionada verificação de permissão: apenas Donos ou Administradores de grupos podem criar jogos.
- **UI Improvements**:
  - Correção de sobreposição visual nos botões de "Aceitar/Recusar" na tela de detalhes do jogo para o organizador.
  - Melhoria na disposição dos elementos nos cartões de confirmação de presença.

## [1.1.2] - 2025-12-30

### Changed

- **UI Standardization**: A tela da Liga agora possui paridade visual "pixel-perfect" com as demais telas do aplicativo (Home, Jogos), unificando altura do cabeçalho, fontes e cores.
- **Dark Mode Polish**: Correção do fundo "esverdeado" no tema escuro. Agora utilizamos o padrão Material 3 Neutral (#1D1B20) para um visual mais profissional e coeso.
- **About Screen**: Tela "Sobre" revitalizada com novo design em cartões e visualização automática deste Changelog.
- **App Icon**: Padronização do ícone do aplicativo na tela "Sobre" para corresponder ao ícone oficial da Play Store.

## [1.1.1] - 2025-12-29

### Changed

- **Visual Polish**: Atualização da cor de fundo padrão (surface_variant) de Lilás para Cinza Neutro (#F0F2F5).
- **Privacy Policy**: Atualização dos links e textos de copyright na página pública de exclusão de conta e criação da página de Política de Privacidade.

### Fixed

- **Play Store Compliance**: Remoção explícita da permissão AD_ID. O app agora está em conformidade total para responder "Não" no formulário de uso de ID de publicidade.

## [1.1.0] - 2025-12-29

### Added

- **Gamification Automation**: Sistema de promoção e rebaixamento de liga agora é totalmente automático e mensal.
- **Improved Season Logic**: Correção na detecção da "Temporada Ativa", priorizando temporadas mensais e corrigindo conflitos com dados de teste.
- **Season Guardian**: Blindagem contra travamento se não houver temporada ativa.

### Changed

- **Players Screen (Mercado da Bola)**: Redesign completo para Material 3 com nova barra de busca e filtros em carrossel.
- **League Screen**: Correção de dados zerados e melhorias de performance.

### Fixed

- **Bug Fantasma**: Resolvido problema com temporadas de teste.
- **Security**: Correção de regras duplicadas no firestore.rules.
- **Crash Fix**: Correção de atributo XML inválido na tela de jogadores.
