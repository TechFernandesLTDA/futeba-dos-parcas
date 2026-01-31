# Roadmap UX Improvements - Futeba dos Parças

> **Objetivo**: Tornar o app mais friendly, moderno e preparado para iOS (KMP)
> **Total**: 50 melhorias organizadas em 5 sprints
> **Criado**: 2025-01-31

---

## 📊 Visão Geral

| Sprint | Foco | Itens | Status |
|--------|------|-------|--------|
| Sprint 1 | Foundation & Core UX | 10 | 🔄 Em progresso |
| Sprint 2 | Gamification & Engagement | 10 | ⏳ Pendente |
| Sprint 3 | Responsiveness & Multi-platform | 10 | ⏳ Pendente |
| Sprint 4 | Search & Discovery | 10 | ⏳ Pendente |
| Sprint 5 | Polish & Accessibility | 10 | ⏳ Pendente |

---

## 🚀 Sprint 1: Foundation & Core UX

### 1.1 Skeleton Loading Unificado
- **Arquivo**: `app/ui/components/SkeletonComponents.kt`
- **Impacto**: Alto - Melhora percepção de velocidade
- **KMP**: Sim - Config no shared module
- **Status**: ⏳ Pendente

### 1.2 Empty States Ilustrados
- **Arquivo**: `app/ui/components/EmptyStateIllustrations.kt`
- **Impacto**: Alto - Reduz frustração do usuário
- **KMP**: Sim - Enums no shared module
- **Status**: ⏳ Pendente

### 1.3 Micro-animações de Feedback
- **Arquivo**: `app/ui/components/AnimatedComponents.kt`
- **Impacto**: Médio - Melhora feedback tátil
- **KMP**: Parcial - Configs compartilhadas
- **Status**: ⏳ Pendente

### 1.4 Haptic Feedback Contextual
- **Arquivo**: `app/util/HapticFeedbackHelper.kt`
- **Impacto**: Médio - Experiência premium
- **KMP**: Sim - Interface no shared
- **Status**: ⏳ Pendente

### 1.5 Notificações Agrupadas
- **Arquivo**: `app/ui/notifications/GroupedNotifications.kt`
- **Impacto**: Alto - Organização de informações
- **KMP**: Sim - Models no shared
- **Status**: ⏳ Pendente

### 1.6 Notificações com Ações Rápidas
- **Arquivo**: `app/util/NotificationActionsHelper.kt`
- **Impacto**: Alto - Reduz fricção
- **KMP**: Sim - Actions no shared
- **Status**: ⏳ Pendente

### 1.7 Status "A Caminho"
- **Arquivo**: `shared/domain/model/PlayerStatus.kt`
- **Impacto**: Alto - Comunicação em tempo real
- **KMP**: Sim - 100% shared
- **Status**: ⏳ Pendente

### 1.8 Convite por QR Code
- **Arquivo**: `app/ui/components/QRCodeGenerator.kt`
- **Impacto**: Alto - Onboarding facilitado
- **KMP**: Parcial - Lógica shared, UI nativa
- **Status**: ⏳ Pendente

### 1.9 Deep Links Universais
- **Arquivo**: `app/util/DeepLinkHandler.kt`
- **Impacto**: Alto - Compartilhamento cross-platform
- **KMP**: Sim - Routes no shared
- **Status**: ⏳ Pendente

### 1.10 Offline-First com Sync
- **Arquivo**: `shared/data/sync/SyncManager.kt`
- **Impacto**: Alto - Usabilidade offline
- **KMP**: Sim - 100% shared
- **Status**: ⏳ Pendente

---

## 🎮 Sprint 2: Gamification & Engagement

### 2.1 Confetti Animation
- **Arquivo**: `app/ui/components/ConfettiAnimation.kt`
- **Status**: ⏳ Pendente

### 2.2 Streak Visual (Chama)
- **Arquivo**: `app/ui/components/StreakFlame.kt`
- **Status**: ⏳ Pendente

### 2.3 Desafios Semanais
- **Arquivo**: `shared/domain/model/WeeklyChallenge.kt`
- **Status**: ⏳ Pendente

### 2.4 Comparação Social
- **Arquivo**: `app/ui/statistics/SocialComparison.kt`
- **Status**: ⏳ Pendente

### 2.5 Recap Semanal (Wrapped)
- **Arquivo**: `app/ui/recap/WeeklyRecapScreen.kt`
- **Status**: ⏳ Pendente

### 2.6 Soundboard de Reações
- **Arquivo**: `app/util/SoundboardHelper.kt`
- **Status**: ⏳ Pendente

### 2.7 Avatar Customizável
- **Arquivo**: `app/ui/profile/AvatarCustomizer.kt`
- **Status**: ⏳ Pendente

### 2.8 Temporadas com Rewards
- **Arquivo**: `shared/domain/model/Season.kt`
- **Status**: ⏳ Pendente

### 2.9 Lembrete Inteligente
- **Arquivo**: `app/util/SmartReminderHelper.kt`
- **Status**: ⏳ Pendente

### 2.10 Mensagens de Voz
- **Arquivo**: `app/ui/components/VoiceMessageRecorder.kt`
- **Status**: ⏳ Pendente

---

## 📱 Sprint 3: Responsiveness & Multi-platform

### 3.1 Adaptive Navigation Rail
- **Arquivo**: `app/ui/navigation/AdaptiveNavigation.kt`
- **Status**: ⏳ Pendente

### 3.2 Split View para Tablets
- **Arquivo**: `app/ui/games/GameListDetailPane.kt`
- **Status**: ⏳ Pendente

### 3.3 Suporte a Foldables
- **Arquivo**: `app/util/FoldableHelper.kt`
- **Status**: ⏳ Pendente

### 3.4 Widget de Próximo Jogo
- **Arquivo**: `app/widget/NextGameWidget.kt`
- **Status**: ⏳ Pendente

### 3.5 Picture-in-Picture Live Game
- **Arquivo**: `app/ui/livegame/PipLiveGame.kt`
- **Status**: ⏳ Pendente

### 3.6 Landscape Otimizado
- **Arquivo**: Múltiplos screens
- **Status**: ⏳ Pendente

### 3.7 Dynamic Island/Live Activities (iOS)
- **Arquivo**: `shared/domain/model/LiveActivityData.kt`
- **Status**: ⏳ Pendente

### 3.8 Typography Scale Responsiva
- **Arquivo**: `shared/ui/ResponsiveTypography.kt`
- **Status**: ⏳ Pendente

### 3.9 Keyboard Navigation
- **Arquivo**: `app/util/KeyboardNavigationHelper.kt`
- **Status**: ⏳ Pendente

### 3.10 CarPlay/Android Auto
- **Arquivo**: `app/auto/FutebaAutoService.kt`
- **Status**: ⏳ Pendente

---

## 🔍 Sprint 4: Search & Discovery

### 4.1 Busca Global
- **Arquivo**: `app/ui/search/GlobalSearchScreen.kt`
- **Status**: ⏳ Pendente

### 4.2 Filtros Avançados
- **Arquivo**: `app/ui/search/AdvancedFilters.kt`
- **Status**: ⏳ Pendente

### 4.3 Histórico de Busca
- **Arquivo**: `app/data/local/SearchHistoryDao.kt`
- **Status**: ⏳ Pendente

### 4.4 Sugestões "Para Você"
- **Arquivo**: `shared/domain/recommendation/RecommendationEngine.kt`
- **Status**: ⏳ Pendente

### 4.5 Mapa de Jogos Públicos
- **Arquivo**: `app/ui/map/PublicGamesMapScreen.kt`
- **Status**: ⏳ Pendente

### 4.6 Prefetch Inteligente
- **Arquivo**: `app/data/prefetch/PrefetchManager.kt`
- **Status**: ⏳ Pendente

### 4.7 Lazy Loading Progressivo
- **Arquivo**: `app/ui/components/ProgressiveLoader.kt`
- **Status**: ⏳ Pendente

### 4.8 Cache Inteligente de Imagens
- **Arquivo**: `app/util/SmartImageCache.kt`
- **Status**: ⏳ Pendente

### 4.9 Compressão de Dados
- **Arquivo**: `shared/data/network/DataCompressor.kt`
- **Status**: ⏳ Pendente

### 4.10 Indicador de Qualidade de Conexão
- **Arquivo**: `app/ui/components/ConnectionQualityIndicator.kt`
- **Status**: ⏳ Pendente

---

## 🛡️ Sprint 5: Polish & Accessibility

### 5.1 Transições Compartilhadas
- **Arquivo**: `app/ui/navigation/SharedTransitions.kt`
- **Status**: ⏳ Pendente

### 5.2 Glassmorphism Headers
- **Arquivo**: `app/ui/components/GlassTopBar.kt`
- **Status**: ⏳ Pendente

### 5.3 Dark Mode OLED
- **Arquivo**: `app/ui/theme/OledTheme.kt`
- **Status**: ⏳ Pendente

### 5.4 Iconografia Material Symbols
- **Arquivo**: Migração gradual
- **Status**: ⏳ Pendente

### 5.5 Gradientes Sutis
- **Arquivo**: `app/ui/theme/Gradients.kt`
- **Status**: ⏳ Pendente

### 5.6 Modo Alto Contraste
- **Arquivo**: `app/ui/theme/HighContrastTheme.kt`
- **Status**: ⏳ Pendente

### 5.7 Tamanho de Fonte Dinâmico
- **Arquivo**: `app/util/DynamicTypeHelper.kt`
- **Status**: ⏳ Pendente

### 5.8 VoiceOver/TalkBack Otimizado
- **Arquivo**: Auditoria de contentDescriptions
- **Status**: ⏳ Pendente

### 5.9 Background Sync
- **Arquivo**: `app/worker/BackgroundSyncWorker.kt`
- **Status**: ⏳ Pendente

### 5.10 iPad Multitasking
- **Arquivo**: iOS-specific
- **Status**: ⏳ Pendente

---

## 📁 Estrutura de Arquivos a Criar

```
app/src/main/java/com/futebadosparcas/
├── ui/
│   ├── components/
│   │   ├── skeleton/
│   │   │   ├── SkeletonComponents.kt       # 1.1
│   │   │   └── SkeletonConfig.kt
│   │   ├── empty/
│   │   │   └── EmptyStateIllustrations.kt  # 1.2
│   │   ├── animation/
│   │   │   ├── AnimatedComponents.kt       # 1.3
│   │   │   ├── ConfettiAnimation.kt        # 2.1
│   │   │   └── StreakFlame.kt              # 2.2
│   │   ├── qrcode/
│   │   │   └── QRCodeGenerator.kt          # 1.8
│   │   └── feedback/
│   │       └── ConnectionQualityIndicator.kt
│   ├── search/
│   │   ├── GlobalSearchScreen.kt           # 4.1
│   │   ├── GlobalSearchViewModel.kt
│   │   └── AdvancedFilters.kt              # 4.2
│   └── navigation/
│       └── AdaptiveNavigation.kt           # 3.1
├── util/
│   ├── HapticFeedbackHelper.kt             # 1.4
│   ├── DeepLinkHandler.kt                  # 1.9
│   └── SoundboardHelper.kt                 # 2.6
└── widget/
    └── NextGameWidget.kt                   # 3.4

shared/src/commonMain/kotlin/com/futebadosparcas/
├── domain/
│   ├── model/
│   │   ├── PlayerStatus.kt                 # 1.7
│   │   ├── WeeklyChallenge.kt              # 2.3
│   │   └── DeepLinkRoute.kt                # 1.9
│   └── sync/
│       └── SyncManager.kt                  # 1.10
└── ui/
    └── skeleton/
        └── SkeletonConfig.kt               # 1.1
```

---

## 🎯 Métricas de Sucesso

| Métrica | Atual | Meta |
|---------|-------|------|
| App Rating | 4.2 | 4.7+ |
| Crash-free sessions | 98.5% | 99.5% |
| Avg. session duration | 3min | 5min |
| DAU/MAU ratio | 25% | 40% |
| Confirmações via notificação | 10% | 35% |
| Tempo para confirmar presença | 8 taps | 2 taps |

---

## 📝 Changelog

- **2025-01-31**: Criação do roadmap com 50 itens
