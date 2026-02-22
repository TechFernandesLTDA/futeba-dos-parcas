#!/usr/bin/env node

/**
 * Script para criar Issues no GitHub mapeando a migração Android → Web
 *
 * Uso: node scripts/create-web-migration-issues.js
 */

const { execSync } = require('child_process');

// Repositório
const REPO = 'TechFernandesLTDA/futeba-dos-parcas';

// Labels para aplicar
const LABELS = ['web', 'enhancement', 'wasmJs', 'CMP'];

// Função helper para criar issue
function createIssue(title, body, additionalLabels = []) {
  const labels = [...LABELS, ...additionalLabels].join(',');

  console.log(`\n📝 Criando issue: ${title}`);

  try {
    const command = `gh issue create --repo ${REPO} --title "${title}" --body "${body}" --label "${labels}"`;
    const output = execSync(command, { encoding: 'utf-8' });
    console.log(`✅ ${output.trim()}`);
  } catch (error) {
    console.error(`❌ Erro ao criar issue: ${error.message}`);
  }
}

// ============================================================================
// MÓDULOS PARA MIGRAÇÃO
// ============================================================================

const modules = [
  // --------------------------------------------------
  // 1. AUTENTICAÇÃO E PERFIL
  // --------------------------------------------------
  {
    title: '[Web] Autenticação - Firebase Auth real + Login/Registro',
    body: `## 📋 Descrição

Implementar autenticação completa na versão web usando Firebase Auth real (substituir mock atual).

## 🎯 Escopo

### Telas a implementar:
- \`LoginScreen\` - Login com email/senha ✅ (mock já existe)
- \`RegisterScreen\` - Registro de novos usuários
- Logout
- Recuperação de senha

### Backend:
- Integrar Firebase Auth JS SDK com external declarations
- Substituir FirebaseManager mock por implementação real
- Sincronizar com Firestore (criar documento de usuário no \`onUserCreated\`)

## 📦 Arquivos Android de referência:
- \`app/.../ui/auth/LoginScreen.kt\`
- \`app/.../ui/auth/RegisterScreen.kt\`
- \`app/.../ui/auth/LoginActivityCompose.kt\`

## ✅ Checklist:
- [ ] Criar \`FirebaseAuth.kt\` com external declarations
- [ ] Implementar \`signInWithEmailAndPassword()\`
- [ ] Implementar \`createUserWithEmailAndPassword()\`
- [ ] Implementar \`sendPasswordResetEmail()\`
- [ ] Implementar \`signOut()\`
- [ ] Criar RegisterScreen.kt
- [ ] Integrar onAuthStateChanged listener
- [ ] Criar documento de usuário no Firestore após registro
- [ ] Testar fluxo completo de auth`,
    labels: ['authentication', 'firebase']
  },

  {
    title: '[Web] Perfil - Tela de edição e visualização de perfil',
    body: `## 📋 Descrição

Implementar telas de perfil do usuário (visualização e edição).

## 🎯 Escopo

### Telas:
- \`ProfileScreen\` - Visualização do perfil (foto, nome, email, XP, level, badges)
- \`EditProfileScreen\` - Editar nome, foto, bio

### Funcionalidades:
- Upload de foto de perfil (Firebase Storage)
- Edição de dados básicos
- Visualização de estatísticas gerais

## 📦 Arquivos Android de referência:
- \`app/.../ui/profile/ProfileScreen.kt\`
- \`app/.../ui/profile/EditProfileScreen.kt\`

## ✅ Checklist:
- [ ] Criar ProfileScreen.kt
- [ ] Criar EditProfileScreen.kt
- [ ] Implementar upload de imagem (Firebase Storage)
- [ ] Integrar com Firestore (ler/atualizar dados)
- [ ] Mostrar XP, level, badges`,
    labels: ['profile']
  },

  // --------------------------------------------------
  // 2. GRUPOS
  // --------------------------------------------------
  {
    title: '[Web] Grupos - Listagem, criação e detalhes',
    body: `## 📋 Descrição

Implementar funcionalidades completas de Grupos (peladas).

## 🎯 Escopo

### Telas:
- \`GroupsScreen\` - Lista de grupos (meus grupos + buscar) ✅ (dados mock já existem)
- \`GroupDetailScreen\` - Detalhes do grupo (membros, próximos jogos, estatísticas)
- \`CreateGroupScreen\` - Criar novo grupo
- \`InvitePlayersScreen\` - Convidar jogadores para o grupo
- \`CashboxScreen\` - Controle financeiro do grupo

### Funcionalidades:
- CRUD de grupos
- Adicionar/remover membros
- Sistema de convites
- Cashbox (mensalidades, pagamentos)
- Estatísticas do grupo

## 📦 Arquivos Android de referência:
- \`app/.../ui/groups/GroupsScreen.kt\`
- \`app/.../ui/groups/GroupDetailScreen.kt\`
- \`app/.../ui/groups/CreateGroupScreen.kt\`
- \`app/.../ui/groups/InvitePlayersScreen.kt\`
- \`app/.../ui/groups/CashboxScreen.kt\`

## ✅ Checklist:
- [ ] Criar GroupDetailScreen.kt
- [ ] Criar CreateGroupScreen.kt
- [ ] Criar InvitePlayersScreen.kt
- [ ] Criar CashboxScreen.kt
- [ ] Integrar com Firestore (coleções \`groups\`, \`group_invites\`, \`cashbox\`)
- [ ] Implementar lógica de convites
- [ ] Implementar lógica de cashbox`,
    labels: ['groups', 'firestore']
  },

  // --------------------------------------------------
  // 3. JOGOS
  // --------------------------------------------------
  {
    title: '[Web] Jogos - Listagem, criação e detalhes',
    body: `## 📋 Descrição

Implementar funcionalidades completas de Jogos.

## 🎯 Escopo

### Telas:
- \`GamesScreen\` - Lista de jogos (próximos, passados, convites) ✅ (dados mock já existem)
- \`GameDetailScreen\` - Detalhes do jogo (local, data, jogadores confirmados)
- \`CreateGameScreen\` - Criar novo jogo
- \`LocationSelectorScreen\` - Selecionar local do jogo

### Funcionalidades:
- CRUD de jogos
- Confirmação de presença
- Lista de espera (waitlist)
- Bloqueio de jogadores (owner only)
- Compartilhar jogo

## 📦 Arquivos Android de referência:
- \`app/.../ui/games/GamesScreen.kt\`
- \`app/.../ui/games/GameDetailScreen.kt\`
- \`app/.../ui/games/CreateGameScreen.kt\`
- \`app/.../ui/games/LocationSelectorScreen.kt\`

## ✅ Checklist:
- [ ] Criar GameDetailScreen.kt
- [ ] Criar CreateGameScreen.kt
- [ ] Criar LocationSelectorScreen.kt
- [ ] Integrar com Firestore (coleção \`games\`)
- [ ] Implementar confirmação/cancelamento de presença
- [ ] Implementar waitlist
- [ ] Implementar bloqueio de jogadores`,
    labels: ['games', 'firestore']
  },

  {
    title: '[Web] Live Game - Eventos ao vivo e formação de times',
    body: `## 📋 Descrição

Implementar funcionalidades de jogo ao vivo (live tracking).

## 🎯 Escopo

### Telas:
- \`LiveEventsScreen\` - Registrar eventos (gols, assistências, cartões)
- \`TeamFormationScreen\` - Formação automática/manual de times
- \`PostGameReportScreen\` - Relatório pós-jogo (owner only)

### Funcionalidades:
- Real-time events (gols, assistências, cartões, substituições)
- Formação de times (algoritmo balanceado ou manual)
- Placar ao vivo
- Estatísticas do jogo

## 📦 Arquivos Android de referência:
- \`app/.../ui/livegame/LiveEventsScreen.kt\`
- \`app/.../ui/games/teamformation/TeamFormationScreen.kt\`
- \`app/.../ui/games/owner/PostGameReportScreen.kt\`

## ✅ Checklist:
- [ ] Criar LiveEventsScreen.kt
- [ ] Criar TeamFormationScreen.kt
- [ ] Criar PostGameReportScreen.kt
- [ ] Implementar Firestore realtime listeners para eventos
- [ ] Implementar algoritmo de formação de times
- [ ] Integrar com XP system (processar XP ao finalizar jogo)`,
    labels: ['games', 'realtime', 'firestore']
  },

  {
    title: '[Web] MVP Voting - Votação pós-jogo',
    body: `## 📋 Descrição

Implementar sistema de votação de MVP e Bola Murcha.

## 🎯 Escopo

### Telas:
- \`MVPVoteScreen\` - Votar em MVP e Bola Murcha
- \`VoteResultScreen\` - Resultado da votação

### Funcionalidades:
- Votação anônima
- Contagem de votos
- +50 XP para MVP
- -20 XP para Bola Murcha
- Mostrar resultado

## 📦 Arquivos Android de referência:
- \`app/.../ui/game_experience/MVPVoteScreen.kt\`
- \`app/.../ui/game_experience/VoteResultScreen.kt\`

## ✅ Checklist:
- [ ] Criar MVPVoteScreen.kt
- [ ] Criar VoteResultScreen.kt
- [ ] Integrar com Firestore (coleção \`votes\`)
- [ ] Implementar lógica de votação anônima
- [ ] Processar XP após votação
- [ ] Mostrar resultado final`,
    labels: ['games', 'gamification']
  },

  // --------------------------------------------------
  // 4. GAMIFICAÇÃO
  // --------------------------------------------------
  {
    title: '[Web] Gamificação - XP, Levels e Badges',
    body: `## 📋 Descrição

Implementar sistema completo de gamificação (XP, levels, badges).

## 🎯 Escopo

### Telas:
- \`LevelJourney\` - Jornada de progressão (levels 1-100)
- \`BadgesScreen\` - Badges desbloqueadas e bloqueadas
- \`Evolution\` - Gráfico de evolução de XP

### Funcionalidades:
- Sistema de XP (participação, gols, vitórias, MVP, streaks)
- Levels (1-100)
- Badges (50+ tipos diferentes)
- Histórico de XP (\`xp_logs\`)

## 📦 Arquivos Android de referência:
- \`app/.../ui/profile/LevelJourneyScreen.kt\`
- \`app/.../ui/badges/BadgesScreen.kt\`
- \`app/.../ui/statistics/EvolutionScreen.kt\`
- \`domain/gamification/XPCalculator.kt\`

## ✅ Checklist:
- [ ] Criar LevelJourneyScreen.kt
- [ ] Criar BadgesScreen.kt
- [ ] Criar EvolutionScreen.kt
- [ ] Implementar lógica de XP (portar XPCalculator)
- [ ] Implementar lógica de badges (50+ badges)
- [ ] Integrar com Firestore (\`xp_logs\`, \`user_badges\`)
- [ ] Criar gráfico de evolução (Chart library para wasmJs)`,
    labels: ['gamification', 'firestore']
  },

  {
    title: '[Web] Rankings e Ligas - Sistema de classificação',
    body: `## 📋 Descrição

Implementar sistema de rankings e ligas (divisões).

## 🎯 Escopo

### Telas:
- \`LeagueScreen\` - Ranking da liga (Diamond, Gold, Silver, Bronze)
- \`RankingScreen\` - Ranking global
- \`StatisticsScreen\` - Estatísticas detalhadas

### Funcionalidades:
- League rating (ELO-based)
- Divisões (Diamond, Gold, Silver, Bronze)
- Promoção/rebaixamento mensal
- Ranking global
- Estatísticas por grupo

## 📦 Arquivos Android de referência:
- \`app/.../ui/league/LeagueScreen.kt\`
- \`app/.../ui/statistics/RankingScreen.kt\`
- \`app/.../ui/statistics/StatisticsScreen.kt\`

## ✅ Checklist:
- [ ] Criar LeagueScreen.kt
- [ ] Criar RankingScreen.kt
- [ ] Criar StatisticsScreen.kt
- [ ] Integrar com Firestore (\`season_participation\`, \`statistics\`)
- [ ] Implementar lógica de divisões
- [ ] Implementar ranking global`,
    labels: ['gamification', 'statistics']
  },

  // --------------------------------------------------
  // 5. LOCATIONS
  // --------------------------------------------------
  {
    title: '[Web] Locations - Campos e mapas',
    body: `## 📋 Descrição

Implementar funcionalidades de locais de jogos (campos).

## 🎯 Escopo

### Telas:
- \`LocationsMapScreen\` - Mapa com campos próximos
- \`LocationDetailScreen\` - Detalhes do campo (fotos, avaliações, preços)
- \`ManageLocationsScreen\` - Gerenciar campos (owner)
- \`FieldOwnerDashboard\` - Dashboard para donos de campo

### Funcionalidades:
- Buscar campos próximos (geolocalização)
- Avaliações e reviews
- Fotos dos campos
- Preços e disponibilidade
- Dashboard para donos de campo

## 📦 Arquivos Android de referência:
- \`app/.../ui/locations/LocationsMapScreen.kt\`
- \`app/.../ui/locations/LocationDetailScreen.kt\`
- \`app/.../ui/locations/ManageLocationsScreen.kt\`

## ⚠️ Limitações Web:
- **Geolocalização:** Usar Web Geolocation API (menos preciso que GPS nativo)
- **Mapas:** Avaliar Google Maps JS API ou Leaflet
- **Sem background location** (não suportado no browser)

## ✅ Checklist:
- [ ] Criar LocationsMapScreen.kt (avaliar biblioteca de mapas)
- [ ] Criar LocationDetailScreen.kt
- [ ] Criar ManageLocationsScreen.kt
- [ ] Implementar Web Geolocation API
- [ ] Integrar com Firestore (\`locations\`)
- [ ] Implementar avaliações`,
    labels: ['locations', 'maps']
  },

  // --------------------------------------------------
  // 6. NAVEGAÇÃO E INFRA
  // --------------------------------------------------
  {
    title: '[Web] Navegação - Sistema de rotas e deep links',
    body: `## 📋 Descrição

Implementar sistema completo de navegação para web.

## 🎯 Escopo

### Funcionalidades:
- Router web (substituir NavController Android)
- Deep links (compartilhar URLs de jogos, grupos, perfis)
- Browser history integration
- Type-safe navigation (como Android)

### Bibliotecas a avaliar:
- \`voyager\` (Compose Multiplatform Router)
- \`decompose\` (navegação KMP)
- Custom router com \`window.history API\`

## 📦 Arquivos Android de referência:
- \`app/.../ui/navigation/NavDestinations.kt\`
- \`app/.../ui/navigation/AppNavGraph.kt\`

## ✅ Checklist:
- [ ] Escolher biblioteca de navegação para wasmJs
- [ ] Criar NavRouter.kt
- [ ] Portar todas as rotas de NavDestinations.kt
- [ ] Implementar deep links (\`/game/:id\`, \`/group/:id\`, etc.)
- [ ] Integrar com browser history
- [ ] Testar navegação completa`,
    labels: ['navigation', 'infrastructure']
  },

  {
    title: '[Web] Notificações - Sistema de notificações web',
    body: `## 📋 Descrição

Implementar sistema de notificações para web.

## 🎯 Escopo

### Telas:
- \`NotificationsScreen\` - Centro de notificações

### Funcionalidades:
- Push notifications (via Service Worker)
- In-app notifications
- Notificações de convites, jogos, MVP, etc.

## ⚠️ Limitações Web:
- **Requer HTTPS** (Service Worker requirement)
- **Requer permissão do usuário** (Notification API)
- **Não funciona em todas as plataformas** (iOS Safari limitado)

## 📦 Arquivos Android de referência:
- \`app/.../ui/notifications/NotificationsScreen.kt\`

## ✅ Checklist:
- [ ] Criar NotificationsScreen.kt
- [ ] Implementar Service Worker para push
- [ ] Integrar com Firebase Cloud Messaging (FCM)
- [ ] Implementar in-app notifications
- [ ] Testar em diferentes browsers`,
    labels: ['notifications', 'PWA']
  },

  {
    title: '[Web] PWA - Progressive Web App',
    body: `## 📋 Descrição

Transformar a versão web em PWA completo.

## 🎯 Escopo

### Funcionalidades:
- Service Worker (cache, offline support)
- Web App Manifest
- Install prompt
- App icons
- Splash screen
- Offline fallback

### Arquivos já existentes:
- \`composeApp/src/wasmJsMain/resources/index.html\` (já tem estrutura básica)

## ✅ Checklist:
- [ ] Criar service-worker.js completo
- [ ] Criar manifest.json
- [ ] Adicionar ícones PWA (192x192, 512x512)
- [ ] Implementar cache strategy (Cache-First para assets)
- [ ] Implementar offline fallback
- [ ] Testar instalação em Chrome/Edge
- [ ] Testar offline mode`,
    labels: ['PWA', 'infrastructure']
  },

  // --------------------------------------------------
  // 7. OUTRAS FUNCIONALIDADES
  // --------------------------------------------------
  {
    title: '[Web] Jogadores - Busca e perfis de jogadores',
    body: `## 📋 Descrição

Implementar funcionalidades de busca e visualização de jogadores.

## 🎯 Escopo

### Telas:
- \`PlayersScreen\` - Buscar jogadores
- \`PlayerDetailScreen\` - Perfil público de jogador

### Funcionalidades:
- Buscar jogadores por nome
- Ver estatísticas públicas
- Enviar convite para grupo

## 📦 Arquivos Android de referência:
- \`app/.../ui/players/PlayersScreen.kt\`
- \`app/.../ui/player/PlayerDetailScreen.kt\`

## ✅ Checklist:
- [ ] Criar PlayersScreen.kt
- [ ] Criar PlayerDetailScreen.kt
- [ ] Implementar busca (Firestore query)
- [ ] Integrar com estatísticas`,
    labels: ['players']
  },

  {
    title: '[Web] Settings - Configurações e preferências',
    body: `## 📋 Descrição

Implementar telas de configurações.

## 🎯 Escopo

### Telas:
- \`PreferencesScreen\` - Configurações gerais
- \`ThemeSettingsScreen\` - Tema claro/escuro
- \`GamificationSettingsScreen\` - Configurações de gamificação
- \`AboutScreen\` - Sobre o app

## 📦 Arquivos Android de referência:
- \`app/.../ui/preferences/PreferencesScreen.kt\`
- \`app/.../ui/settings/ThemeSettingsScreen.kt\`
- \`app/.../ui/about/AboutScreen.kt\`

## ✅ Checklist:
- [ ] Criar PreferencesScreen.kt
- [ ] Criar ThemeSettingsScreen.kt
- [ ] Criar AboutScreen.kt
- [ ] Implementar localStorage para settings
- [ ] Implementar toggle dark/light theme`,
    labels: ['settings']
  },

  {
    title: '[Web] Schedules - Agenda de jogos',
    body: `## 📋 Descrição

Implementar calendário/agenda de jogos.

## 🎯 Escopo

### Telas:
- \`SchedulesScreen\` - Calendário mensal de jogos

### Funcionalidades:
- Visualização em calendário
- Filtros por grupo
- Adicionar ao Google Calendar

## 📦 Arquivos Android de referência:
- \`app/.../ui/schedules/SchedulesScreen.kt\`

## ✅ Checklist:
- [ ] Criar SchedulesScreen.kt
- [ ] Implementar calendário (avaliar biblioteca)
- [ ] Integrar com Firestore
- [ ] Implementar export para Google Calendar`,
    labels: ['schedules']
  },

  {
    title: '[Web] Tactical Board - Quadro tático',
    body: `## 📋 Descrição

Implementar quadro tático para desenhar jogadas.

## 🎯 Escopo

### Telas:
- \`TacticalBoardScreen\` - Canvas para desenhar jogadas

### Funcionalidades:
- Desenhar jogadas
- Posicionar jogadores
- Salvar/compartilhar jogadas

## ⚠️ Desafio Web:
- Requer Canvas API ou biblioteca de desenho
- Touch gestures vs mouse events

## 📦 Arquivos Android de referência:
- \`app/.../ui/tactical/TacticalBoardScreen.kt\`

## ✅ Checklist:
- [ ] Criar TacticalBoardScreen.kt
- [ ] Avaliar biblioteca de canvas (Skiko Canvas?)
- [ ] Implementar touch/mouse gestures
- [ ] Salvar/compartilhar jogadas`,
    labels: ['tactical', 'canvas']
  },

  {
    title: '[Web] Admin - Painel administrativo',
    body: `## 📋 Descrição

Implementar painel administrativo (apenas para ADMIN role).

## 🎯 Escopo

### Telas:
- \`UserManagementScreen\` - Gerenciar usuários (promover/banir)

### Funcionalidades:
- Listar usuários
- Promover para ADMIN
- Banir/desbanir usuários

## 📦 Arquivos Android de referência:
- \`app/.../ui/admin/UserManagementScreen.kt\`

## ✅ Checklist:
- [ ] Criar UserManagementScreen.kt
- [ ] Implementar verificação de role
- [ ] Integrar com Cloud Functions (\`setUserRole\`)`,
    labels: ['admin']
  },

  {
    title: '[Web] Developer Tools - Ferramentas de debug',
    body: `## 📋 Descrição

Implementar ferramentas de debug/desenvolvimento.

## 🎯 Escopo

### Telas:
- \`DeveloperScreen\` - Opções de debug
- \`DevToolsScreen\` - Console de debug

### Funcionalidades:
- Limpar cache
- Ver logs
- Simular estados
- Performance metrics

## 📦 Arquivos Android de referência:
- \`app/.../ui/developer/DeveloperScreen.kt\`
- \`app/.../ui/devtools/DevToolsScreen.kt\`

## ✅ Checklist:
- [ ] Criar DeveloperScreen.kt
- [ ] Criar DevToolsScreen.kt
- [ ] Implementar debug tools`,
    labels: ['devtools']
  },

  // --------------------------------------------------
  // 8. INFRAESTRUTURA E OTIMIZAÇÃO
  // --------------------------------------------------
  {
    title: '[Web] Performance - Otimizações e bundle size',
    body: `## 📋 Descrição

Otimizar performance da versão web.

## 🎯 Escopo

### Otimizações:
- Code splitting (lazy loading de telas)
- Image optimization
- Bundle size reduction
- Lazy compilation
- WebAssembly optimization

### Métricas alvo:
- FCP (First Contentful Paint) < 1.5s
- LCP (Largest Contentful Paint) < 2.5s
- TTI (Time to Interactive) < 3.5s
- Bundle size < 5MB (gzipped)

## ✅ Checklist:
- [ ] Implementar code splitting por rota
- [ ] Otimizar imagens (WebP)
- [ ] Minificar e comprimir bundles
- [ ] Lazy load heavy components
- [ ] Medir e documentar métricas`,
    labels: ['performance', 'optimization']
  },

  {
    title: '[Web] Testing - Testes automatizados',
    body: `## 📋 Descrição

Implementar testes para a versão web.

## 🎯 Escopo

### Tipos de testes:
- Unit tests (ViewModels, UseCases)
- Integration tests (Firestore, Auth)
- E2E tests (Selenium ou Playwright)

## ✅ Checklist:
- [ ] Configurar test framework para wasmJs
- [ ] Criar tests para ViewModels
- [ ] Criar tests para Firebase integration
- [ ] Criar E2E tests para fluxos críticos
- [ ] Integrar com CI`,
    labels: ['testing', 'quality']
  },

  {
    title: '[Web] Documentação - Guia de uso e deploy',
    body: `## 📋 Descrição

Criar documentação completa da versão web.

## 🎯 Escopo

### Documentos:
- README_WEB.md (guia de desenvolvimento)
- DEPLOY_WEB.md (guia de deploy)
- ARCHITECTURE_WEB.md (arquitetura)
- FAQ_WEB.md (perguntas frequentes)

## ✅ Checklist:
- [ ] Criar README_WEB.md
- [ ] Criar DEPLOY_WEB.md (Firebase Hosting)
- [ ] Criar ARCHITECTURE_WEB.md
- [ ] Documentar limitações web vs Android
- [ ] Criar troubleshooting guide`,
    labels: ['documentation']
  }
];

// ============================================================================
// EXECUTAR CRIAÇÃO DE ISSUES
// ============================================================================

console.log(`\n🚀 Criando ${modules.length} issues no GitHub...\n`);
console.log(`Repositório: ${REPO}`);
console.log(`Labels padrão: ${LABELS.join(', ')}\n`);

modules.forEach((module, index) => {
  console.log(`\n[${index + 1}/${modules.length}]`);
  createIssue(module.title, module.body, module.labels);

  // Delay para evitar rate limiting (sleep compatível com Git Bash)
  if (index < modules.length - 1) {
    execSync('sleep 1', { shell: true });
  }
});

console.log(`\n\n✅ Concluído! ${modules.length} issues criadas com sucesso.\n`);
console.log(`🔗 Ver todas: https://github.com/${REPO}/issues?q=is%3Aissue+is%3Aopen+label%3Aweb\n`);
