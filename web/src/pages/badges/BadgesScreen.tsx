import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  IconButton,
  Grid,
  Chip,
  Skeleton,
  useTheme,
  alpha,
  Avatar,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  EmojiEvents as TrophyIcon,
  Lock as LockIcon,
  WorkspacePremium as BadgeIcon,
} from '@mui/icons-material';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingState } from '../../components/common/GameCard';
import { BADGE_DEFINITIONS, BadgeDefinition } from '../../types/gamification';
import { createLogger } from '../../utils/logger';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const logger = createLogger('BadgesScreen');

interface UserBadge {
  badgeId: string;
  unlockedAt: Date;
}

const RARITY_COLORS: Record<string, string> = {
  COMMON: '#9E9E9E',
  RARE: '#2196F3',
  EPIC: '#9C27B0',
  LEGENDARY: '#FF9800',
};

export const BadgesScreen: React.FC = () => {
  useDocumentTitle('Badges');
  const navigate = useNavigate();
  const theme = useTheme();
  const { user } = useAuth();

  const [userBadges, setUserBadges] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const fetchUserBadges = async () => {
      try {
        const badgesRef = collection(db, 'user_badges');
        const q = query(badgesRef, where('user_id', '==', user.id));
        const snapshot = await getDocs(q);
        const badgeIds = new Set(snapshot.docs.map((d) => {
          const data = snakeToCamel(d.data()) as Record<string, any>;
          return data.badgeId;
        }));
        setUserBadges(badgeIds);
      } catch (error) {
        logger.error('Error fetching badges:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserBadges();
  }, [user?.id]);

  const getRarityStyle = (rarity: string) => {
    const color = RARITY_COLORS[rarity] || RARITY_COLORS.COMMON;
    return {
      border: `2px solid ${color}`,
      boxShadow: `0 0 10px ${alpha(color, 0.3)}`,
    };
  };

  return (
    <Box sx={{ pb: 4 }}>
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          bgcolor: 'background.paper',
          zIndex: 10,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', p: 1 }}>
          <IconButton onClick={() => navigate(-1)} aria-label="Voltar">
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1 }}>
            Conquistas
          </Typography>
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        <Card sx={{ mb: 2, bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <BadgeIcon color="primary" sx={{ fontSize: 40 }} />
              <Box>
                <Typography variant="h5" fontWeight={700}>
                  {userBadges.size} / {BADGE_DEFINITIONS.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Conquistas desbloqueadas
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {loading ? (
          <LoadingState shimmerCount={8} itemType="CARD" />
        ) : (
          <Grid container spacing={2}>
            {BADGE_DEFINITIONS.map((badge) => (
              <Grid xs={6} key={badge.id}>
                <BadgeItem
                  badge={badge}
                  isUnlocked={userBadges.has(badge.id)}
                  rarityStyle={getRarityStyle(badge.rarity)}
                />
              </Grid>
            ))}
          </Grid>
        )}
      </Container>
    </Box>
  );
};

const BadgeItem = React.memo(function BadgeItem({
  badge,
  isUnlocked,
  rarityStyle,
}: {
  badge: BadgeDefinition;
  isUnlocked: boolean;
  rarityStyle: { border: string; boxShadow: string };
}) {
  return (
    <Tooltip title={isUnlocked ? badge.description : badge.requirement}>
      <Card
        sx={{
          height: '100%',
          opacity: isUnlocked ? 1 : 0.5,
          ...rarityStyle,
          cursor: 'pointer',
          transition: 'transform 0.2s',
          '&:hover': { transform: 'scale(1.02)' },
        }}
      >
        <CardContent sx={{ textAlign: 'center', py: 2 }}>
          <Box
            sx={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              bgcolor: alpha(RARITY_COLORS[badge.rarity], 0.1),
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
              bgcolor: alpha(RARITY_COLORS[badge.rarity], 0.1),
              color: RARITY_COLORS[badge.rarity],
              fontSize: '0.65rem',
              height: 18,
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
