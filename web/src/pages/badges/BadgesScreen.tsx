import React, { useState, useMemo } from 'react';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  IconButton,
  Button,
  Grid,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  useTheme,
  useMediaQuery,
  alpha,
  Tooltip,
  LinearProgress,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Lock as LockIcon,
  WorkspacePremium as BadgeIcon,
  Close as CloseIcon,
  GridView as GridViewIcon,
  SportsSoccer as SportsSoccerIcon,
  LocalFireDepartment as FireIcon,
  EmojiEvents as TrophyIcon,
  Handshake as HandshakeIcon,
  Star as StarIcon,
  EventAvailable as EventAvailableIcon,
  Groups as GroupsIcon,
  MilitaryTech as MilitaryTechIcon,
} from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useBadges } from '../../hooks/useBadges';
import { LoadingState } from '../../components/common/GameCard';
import { ErrorState } from '../../components/common/ErrorState';
import { BADGE_DEFINITIONS, BadgeDefinition } from '../../types/gamification';
import { rarityColors, rarityColorsDark } from '../../theme';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { ScreenHeader } from '../../components/common/ScreenHeader';

const ALL_CATEGORIES = ['all', ...new Set(BADGE_DEFINITIONS.map((b) => b.category))] as const;
type CategoryFilter = (typeof ALL_CATEGORIES)[number];

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: 'Todas',
  participation: 'Participação',
  streak: 'Sequência',
  mvp: 'MVP',
  goals: 'Gols',
  assists: 'Assistências',
  wins: 'Vitórias',
  performance: 'Desempenho',
  presence: 'Presença',
  community: 'Comunidade',
  level: 'Nível',
};

const CATEGORY_ICONS: Record<CategoryFilter, React.ReactElement> = {
  all: <GridViewIcon fontSize="small" />,
  participation: <SportsSoccerIcon fontSize="small" />,
  streak: <FireIcon fontSize="small" />,
  mvp: <TrophyIcon fontSize="small" />,
  goals: <SportsSoccerIcon fontSize="small" />,
  assists: <HandshakeIcon fontSize="small" />,
  wins: <TrophyIcon fontSize="small" />,
  performance: <StarIcon fontSize="small" />,
  presence: <EventAvailableIcon fontSize="small" />,
  community: <GroupsIcon fontSize="small" />,
  level: <MilitaryTechIcon fontSize="small" />,
};

export const BadgesScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('badges.title'));
  const goBack = useNavigateBack();
  const theme = useTheme();
  const isMd = useMediaQuery(theme.breakpoints.up('md'));
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { unlockedIds, loading, error } = useBadges(user?.id);
  const rarityMap = theme.palette.mode === 'dark' ? rarityColorsDark : rarityColors;
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [detailBadge, setDetailBadge] = useState<BadgeDefinition | null>(null);

  const filteredBadges = useMemo(() => {
    if (selectedCategory === 'all') return BADGE_DEFINITIONS;
    return BADGE_DEFINITIONS.filter((b) => b.category === selectedCategory);
  }, [selectedCategory]);

  const progress = useMemo(() => (
    BADGE_DEFINITIONS.length > 0
      ? Math.round((unlockedIds.size / BADGE_DEFINITIONS.length) * 100)
      : 0
  ), [unlockedIds.size]);

  const getRarityStyle = useMemo(() => (rarity: string) => {
    const color = rarityMap[rarity] ?? rarityMap.COMUM;
    return {
      border: `2px solid ${color}`,
      boxShadow: `0 0 10px ${alpha(color, 0.3)}`,
    };
  }, [rarityMap]);

  return (
    <Box sx={{ pb: 4 }}>
      <ScreenHeader title={t('badges.title')} onBack={goBack} />

      <Container maxWidth={isMd ? 'lg' : 'sm'} sx={{ py: 2 }}>
        {error ? (
          <ErrorState
            message={`Erro ao carregar conquistas: ${error}`}
            onRetry={() => queryClient.invalidateQueries()}
          />
        ) : (
          <>
            <Card sx={{ mb: 2, bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <BadgeIcon color="primary" sx={{ fontSize: 40 }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h5" fontWeight={700}>
                      {unlockedIds.size} / {BADGE_DEFINITIONS.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Conquistas desbloqueadas
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={progress}
                      sx={{ mt: 1, height: 6, borderRadius: 3, bgcolor: alpha(theme.palette.primary.main, 0.15) }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      {progress}% completo
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>

            <Tabs
              value={selectedCategory}
              onChange={(_e, val) => setSelectedCategory(val)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ mb: 2 }}
            >
              {ALL_CATEGORIES.map((cat) => (
                <Tab
                  key={cat}
                  value={cat}
                  icon={CATEGORY_ICONS[cat]}
                  iconPosition="start"
                  label={CATEGORY_LABELS[cat]}
                  sx={{ textTransform: 'none', minWidth: 'auto' }}
                />
              ))}
            </Tabs>

            {loading ? (
              <LoadingState shimmerCount={8} itemType="CARD" />
            ) : (
              <Grid container spacing={2}>
                {filteredBadges.map((badge) => (
                  <Grid item xs={6} sm={4} md={3} lg={2} key={badge.id}>
                    <BadgeItem
                      badge={badge}
                      isUnlocked={unlockedIds.has(badge.id)}
                      rarityStyle={getRarityStyle(badge.rarity)}
                      rarityMap={rarityMap}
                      onClick={() => setDetailBadge(badge)}
                    />
                  </Grid>
                ))}
              </Grid>
            )}
          </>
        )}
      </Container>

      <BadgeDetailDialog
        badge={detailBadge}
        isUnlocked={detailBadge ? unlockedIds.has(detailBadge.id) : false}
        onClose={() => setDetailBadge(null)}
        rarityMap={rarityMap}
      />
    </Box>
  );
};

const BadgeItem = React.memo(function BadgeItem({
  badge,
  isUnlocked,
  rarityStyle,
  rarityMap,
  onClick,
}: {
  badge: BadgeDefinition;
  isUnlocked: boolean;
  rarityStyle: { border: string; boxShadow: string };
  rarityMap: Record<string, string>;
  onClick: () => void;
}) {
  return (
    <Tooltip title={isUnlocked ? `Clique para detalhes` : badge.requirement}>
      <Card
        onClick={onClick}
        sx={{
          height: '100%',
          opacity: isUnlocked ? 1 : 0.5,
          ...rarityStyle,
          cursor: 'pointer',
          transition: (t) => t.transitions.create('transform', { duration: t.transitions.duration.shorter }),
          '&:hover': { transform: 'scale(1.04)' },
        }}
      >
        <CardContent sx={{ textAlign: 'center', py: 2 }}>
          <Box
            sx={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              bgcolor: alpha(rarityMap[badge.rarity] ?? rarityMap.COMUM, 0.1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 1,
              fontSize: 32,
              filter: isUnlocked ? 'none' : 'grayscale(100%)',
            }}
          >
            {isUnlocked ? badge.icon : <LockIcon />}
          </Box>
          <Typography variant="subtitle2" fontWeight={600} noWrap>
            {badge.name}
          </Typography>
          <Chip
            label={badge.rarity}
            size="small"
            sx={{
              mt: 0.5,
              bgcolor: alpha(rarityMap[badge.rarity] ?? rarityMap.COMUM, 0.1),
              color: rarityMap[badge.rarity] ?? rarityMap.COMUM,
              fontSize: '0.75rem',
              height: 20,
            }}
          />
          {isUnlocked && (
            <Typography variant="caption" color="success.main" sx={{ display: 'block', mt: 0.5 }}>
              +{badge.xpReward} XP
            </Typography>
          )}
        </CardContent>
      </Card>
    </Tooltip>
  );
});

function BadgeDetailDialog({
  badge,
  isUnlocked,
  onClose,
  rarityMap,
}: {
  badge: BadgeDefinition | null;
  isUnlocked: boolean;
  onClose: () => void;
  rarityMap: Record<string, string>;
}) {
  const theme = useTheme();

  if (!badge) return null;

  const rarityColor = rarityMap[badge.rarity] ?? rarityMap.COMUM;

  return (
    <Dialog open={true} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ textAlign: 'right', p: 1 }}>
        <IconButton onClick={onClose} aria-label="Fechar">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ textAlign: 'center', pb: 4, pt: 0 }}>
        <Box
          sx={{
            width: 100,
            height: 100,
            borderRadius: '50%',
            border: `4px solid ${rarityColor}`,
            boxShadow: `0 0 20px ${alpha(rarityColor, 0.4)}`,
            bgcolor: alpha(rarityColor, 0.1),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2,
            fontSize: 48,
            filter: isUnlocked ? 'none' : 'grayscale(100%)',
          }}
        >
          {isUnlocked ? badge.icon : <LockIcon sx={{ fontSize: 48 }} />}
        </Box>

        <Typography variant="h5" fontWeight={700} gutterBottom>
          {badge.name}
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          {badge.description}
        </Typography>

        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 2 }}>
          <Chip
            label={badge.rarity}
            size="small"
            sx={{
              bgcolor: alpha(rarityColor, 0.15),
              color: rarityColor,
              fontWeight: 600,
            }}
          />
          <Chip
            label={CATEGORY_LABELS[badge.category as CategoryFilter] ?? badge.category}
            size="small"
            variant="outlined"
          />
        </Box>

        <Card sx={{ mb: 2, bgcolor: alpha(theme.palette.success.main, 0.08) }}>
          <CardContent>
            <Typography variant="h6" color="success.main" fontWeight={700}>
              +{badge.xpReward} XP
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Recompensa
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ bgcolor: alpha(theme.palette.info.main, 0.06) }}>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Como desbloquear
            </Typography>
            <Typography variant="body2">{badge.requirement}</Typography>
          </CardContent>
        </Card>

        <Button
          variant="contained"
          onClick={onClose}
          fullWidth
          sx={{ mt: 3, borderRadius: 2 }}
        >
          {isUnlocked ? 'Continuar' : 'Entendido'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
