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
  useTheme,
  alpha,
  Avatar,
  List,
  Divider,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  EmojiEvents as TrophyIcon,
  TrendingUp as TrendingIcon,
  SportsSoccer as SoccerIcon,
  MilitaryTech as MilitaryTechIcon,
} from '@mui/icons-material';
import { collection, query, orderBy, limit, onSnapshot, where, getDoc, doc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useAuth } from '../../contexts/AuthContext';
import { PlayerAvatar, LoadingState } from '../../components/common/GameCard';
import { DIVISION_CONFIG, LeagueDivision, getLevelForXp } from '../../types/gamification';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

interface LeaguePlayer {
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

export const LeagueScreen: React.FC = () => {
  useDocumentTitle('Liga');
  const navigate = useNavigate();
  const theme = useTheme();
  const { user } = useAuth();

  const [tabValue, setTabValue] = useState(0);
  const [players, setPlayers] = useState<LeaguePlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const seasonRef = collection(db, 'season_participation');
    const q = query(seasonRef, orderBy('points', 'desc'), limit(100));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const playersData = await Promise.all(
        snapshot.docs.map(async (docSnapshot) => {
          const raw = docSnapshot.data();
          const data = snakeToCamel(raw) as Record<string, any>;
          const userId = data.userId || docSnapshot.id;

          let userData = { name: 'Jogador', photoUrl: null, xp: 0 };
          try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
              const d = snakeToCamel(userDoc.data()) as Record<string, any>;
              userData = { name: d.name || 'Jogador', photoUrl: d.photoUrl, xp: d.experiencePoints ?? 0 };
            }
          } catch {
            // ignore
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
          } as LeaguePlayer;
        })
      );

      setPlayers(playersData);
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

  const getFilteredPlayers = () => {
    const divisions: LeagueDivision[] = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'CHAMPION'];
    const targetDivision = divisions[tabValue];
    return players.filter((p) => p.division === targetDivision);
  };

  const filteredPlayers = tabValue === 0 ? players : getFilteredPlayers();

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
            Liga
          </Typography>
        </Box>
        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Divisões da liga"
        >
          <Tab label="Geral" />
          <Tab label="Bronze" />
          <Tab label="Prata" />
          <Tab label="Ouro" />
          <Tab label="Platina" />
          <Tab label="Diamante" />
          <Tab label="Campeão" />
        </Tabs>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        {loading ? (
          <LoadingState shimmerCount={8} itemType="RANKING" />
        ) : filteredPlayers.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <MilitaryTechIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Nenhum jogador nesta divisão
            </Typography>
            <Typography variant="body2" color="text.disabled">
              Participe de jogos para entrar na liga!
            </Typography>
          </Box>
        ) : (
          <List disablePadding aria-label="Classificação da liga">
            {filteredPlayers.map((player, index) => (
              <LeaguePlayerItem
                key={player.id}
                player={player}
                position={index + 1}
                positionStyle={getPositionStyle(index + 1)}
              />
            ))}
          </List>
        )}
      </Container>
    </Box>
  );
};

const LeaguePlayerItem = React.memo(function LeaguePlayerItem({
  player,
  position,
  positionStyle,
}: {
  player: LeaguePlayer;
  position: number;
  positionStyle: { bgcolor: string; color: string };
}) {
  const divisionConfig = DIVISION_CONFIG[player.division] || DIVISION_CONFIG.BRONZE;

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

          <PlayerAvatar
            name={player.userName}
            photoUrl={player.userPhoto}
            size={48}
            level={player.level}
          />

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
              color={divisionConfig.color}
            >
              {player.points}
            </Typography>
            <Chip
              label={divisionConfig.label}
              size="small"
              sx={{
                bgcolor: alpha(divisionConfig.color, 0.1),
                color: divisionConfig.color,
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
