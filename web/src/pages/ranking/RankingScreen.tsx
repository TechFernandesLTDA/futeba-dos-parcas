import React, { useState, useEffect } from 'react';
import { gamificationColors } from '../../theme';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  IconButton,
  Tabs,
  Tab,
  Chip,
  Skeleton,
  List,
  useTheme,
  alpha,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  EmojiEvents as TrophyIcon,
} from '@mui/icons-material';
import { collection, query, orderBy, limit, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { PlayerAvatar } from '../../components/common/GameCard';
import { PlayerCard } from '../../components/player/PlayerCard';
import { DIVISION_CONFIG, LeagueDivision, getLevelForXp } from '../../types/gamification';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

interface RankingUser {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  level: number;
  points: number;
  gamesPlayed: number;
  wins: number;
  goals: number;
  assists: number;
  mvpCount: number;
  division: LeagueDivision;
  isCurrentUser?: boolean;
}

export const RankingScreen: React.FC = () => {
  useDocumentTitle('Ranking');
  const navigate = useNavigate();
  const theme = useTheme();
  const { user } = useAuth();

  const [tabValue, setTabValue] = useState(0);
  const [ranking, setRanking] = useState<RankingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  useEffect(() => {
    const rankingRef = collection(db, 'ranking');
    const q = query(rankingRef, orderBy('points', 'desc'), limit(50));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const rankingData = await Promise.all(
        snapshot.docs.map(async (docSnapshot, _index) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = snakeToCamel(docSnapshot.data()) as Record<string, any>;
          const userId = data.userId || docSnapshot.id;

          let userData = { name: 'Jogador', photoUrl: null as string | null, xp: 0 };
          try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const d = snakeToCamel(userDoc.data()) as Record<string, any>;
              userData = { name: d.name || 'Jogador', photoUrl: d.photoUrl, xp: d.experiencePoints ?? 0 };
            }
          } catch (_e) {
              // ignorar erro ao buscar dados do usuário
          }

          return {
            id: docSnapshot.id,
            userId,
            userName: userData.name,
            userPhoto: userData.photoUrl || undefined,
            level: getLevelForXp(userData.xp),
            points: data.points || 0,
            gamesPlayed: data.gamesPlayed || 0,
            wins: data.wins || 0,
            goals: data.goals || 0,
            assists: data.assists || 0,
            mvpCount: data.mvpCount || 0,
            division: data.division || 'BRONZE',
            isCurrentUser: userId === user?.id,
          } as RankingUser;
        })
      );

      setRanking(rankingData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.id]);

  const getPositionStyle = (position: number) => {
    switch (position) {
      case 1:
        return { bgcolor: gamificationColors.gold, color: '#000' };
      case 2:
        return { bgcolor: gamificationColors.silver, color: '#000' };
      case 3:
        return { bgcolor: gamificationColors.bronze, color: '#fff' };
      default:
        return { bgcolor: theme.palette.grey[200], color: theme.palette.text.primary };
    }
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
            Ranking
          </Typography>
        </Box>
        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          variant="fullWidth"
          aria-label="Categorias do ranking"
        >
          <Tab label="Geral" />
          <Tab label="MVPs" />
          <Tab label="Artilheiros" />
        </Tabs>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} sx={{ mb: 1 }}>
              <CardContent sx={{ py: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Skeleton variant="circular" width={48} height={48} />
                  <Box sx={{ flex: 1 }}>
                    <Skeleton variant="text" width="60%" />
                    <Skeleton variant="text" width="40%" />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))
        ) : (
          <List disablePadding>
            {ranking
              .sort((a, b) => {
                if (tabValue === 1) return b.mvpCount - a.mvpCount;
                if (tabValue === 2) return b.goals - a.goals;
                return b.points - a.points;
              })
              .map((player, index) => (
                <RankingItem
                  key={player.id}
                  player={player}
                  position={index + 1}
                  positionStyle={getPositionStyle(index + 1)}
                  tabValue={tabValue}
                  onAvatarClick={setSelectedPlayerId}
                />
              ))}
          </List>
        )}

        {ranking.length === 0 && !loading && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <TrophyIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Nenhum jogador no ranking
            </Typography>
            <Typography variant="body2" color="text.disabled">
              Participe de jogos para entrar no ranking!
            </Typography>
          </Box>
        )}
      </Container>

      {/* Figurinha do jogador */}
      <PlayerCard
        userId={selectedPlayerId}
        onClose={() => setSelectedPlayerId(null)}
      />
    </Box>
  );
};

const RankingItem = React.memo(function RankingItem({
  player,
  position,
  positionStyle,
  tabValue,
  onAvatarClick,
}: {
  player: RankingUser;
  position: number;
  positionStyle: { bgcolor: string; color: string };
  tabValue: number;
  onAvatarClick: (userId: string) => void;
}) {
  return (
    <Card
      sx={{
        mb: 1,
        bgcolor: player.isCurrentUser ? (theme) => alpha(theme.palette.primary.main, 0.1) : 'background.paper',
        border: player.isCurrentUser ? (theme) => `2px solid ${theme.palette.primary.main}` : '1px solid',
        borderColor: player.isCurrentUser ? 'primary.main' : 'divider',
      }}
    >
      <CardContent sx={{ py: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              ...positionStyle,
            }}
          >
            {position <= 3 ? <TrophyIcon fontSize="small" /> : position}
          </Box>

          {/* Avatar — clique abre a figurinha do jogador */}
          <Box
            onClick={() => onAvatarClick(player.userId)}
            sx={{ cursor: 'pointer' }}
            role="button"
            aria-label={`Ver figurinha de ${player.userName}`}
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onAvatarClick(player.userId)}
          >
            <PlayerAvatar
              name={player.userName}
              photoUrl={player.userPhoto}
              size={48}
              level={player.level}
            />
          </Box>

          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                {player.userName}
              </Typography>
              {player.isCurrentUser && (
                <Chip label="Você" size="small" color="primary" />
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="caption" color="text.secondary">
                {player.gamesPlayed} jogos
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {player.wins}V
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {player.goals}⚽
              </Typography>
            </Box>
          </Box>

          <Box sx={{ textAlign: 'right' }}>
            <Typography
              variant="h6"
              fontWeight={700}
              color={DIVISION_CONFIG[player.division]?.color || 'text.primary'}
            >
              {tabValue === 1 ? player.mvpCount : tabValue === 2 ? player.goals : player.points}
            </Typography>
            <Chip
              label={DIVISION_CONFIG[player.division]?.label || 'Bronze'}
              size="small"
              sx={{
                bgcolor: alpha(DIVISION_CONFIG[player.division]?.color || '#5D4037', 0.1),
                color: DIVISION_CONFIG[player.division]?.color || '#5D4037',
                fontSize: '0.7rem',
                height: 20,
              }}
            />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
});
