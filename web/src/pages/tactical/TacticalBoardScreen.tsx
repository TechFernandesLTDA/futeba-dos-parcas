import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  IconButton,
  Avatar,
  Grid,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  alpha,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  SportsSoccer as SoccerIcon,
} from '@mui/icons-material';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingState } from '../../components/common/GameCard';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { createLogger } from '../../utils/logger';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const logger = createLogger('TacticalBoardScreen');

interface TacticalPlayer {
  id: string;
  name: string;
  photoUrl?: string;
  x: number;
  y: number;
  team: 'A' | 'B';
}

const FORMATIONS = [
  { name: '4-4-2', positions: [[50, 90], [20, 70], [40, 70], [60, 70], [80, 70], [20, 45], [40, 45], [60, 45], [80, 45], [35, 20], [65, 20]] },
  { name: '4-3-3', positions: [[50, 90], [20, 70], [40, 70], [60, 70], [80, 70], [30, 45], [50, 45], [70, 45], [25, 20], [50, 15], [75, 20]] },
  { name: '3-5-2', positions: [[50, 90], [30, 70], [50, 70], [70, 70], [15, 45], [35, 45], [50, 45], [65, 45], [85, 45], [35, 20], [65, 20]] },
];

export const TacticalBoardScreen: React.FC = () => {
  useDocumentTitle('Prancheta Tática');
  const navigate = useNavigate();
  const theme = useTheme();
  const { gameId } = useParams<{ gameId: string }>();
  useAuth();

  const [players, setPlayers] = useState<TacticalPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFormation, setSelectedFormation] = useState(0);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  useEffect(() => {
    if (!gameId) return;

    const fetchPlayers = async () => {
      try {
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        if (gameDoc.exists()) {
          const data = snakeToCamel(gameDoc.data()) as Record<string, any>;
          const teamA = (data.teamA || []).map((p: any, i: number) => ({
            id: p.id || `a-${i}`,
            name: p.name || 'Jogador',
            photoUrl: p.photoUrl,
            x: FORMATIONS[0].positions[i]?.[0] || 50,
            y: FORMATIONS[0].positions[i]?.[1] || 70,
            team: 'A' as const,
          }));
          const teamB = (data.teamB || []).map((p: any, i: number) => ({
            id: p.id || `b-${i}`,
            name: p.name || 'Jogador',
            photoUrl: p.photoUrl,
            x: FORMATIONS[0].positions[i]?.[0] || 50,
            y: FORMATIONS[0].positions[i]?.[1] || 30,
            team: 'B' as const,
          }));
          setPlayers([...teamA, ...teamB]);
        }
      } catch (error) {
        logger.error('Error fetching players:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayers();
  }, [gameId]);

  const applyFormation = (formationIndex: number) => {
    setSelectedFormation(formationIndex);
    const positions = FORMATIONS[formationIndex].positions;
    setPlayers((prev) => {
      const teamA = prev.filter((p) => p.team === 'A');
      const teamB = prev.filter((p) => p.team === 'B');
      
      teamA.forEach((p, i) => {
        if (positions[i]) {
          p.x = positions[i][0];
          p.y = positions[i][1];
        }
      });
      
      teamB.forEach((p, i) => {
        if (positions[i]) {
          p.x = positions[i][0];
          p.y = 100 - positions[i][1];
        }
      });
      
      return [...teamA, ...teamB];
    });
  };

  if (loading) {
    return <LoadingState shimmerCount={3} itemType="CARD" />;
  }

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
          <Typography variant="h6" sx={{ ml: 1, flex: 1 }}>
            Quadro Tático
          </Typography>
          <IconButton onClick={() => setSelectedFormation(0)} aria-label="Resetar formação">
            <RefreshIcon />
          </IconButton>
          <IconButton aria-label="Salvar formação">
            <SaveIcon />
          </IconButton>
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        <ToggleButtonGroup
          value={selectedFormation}
          exclusive
          onChange={(_, v) => v !== null && applyFormation(v)}
          fullWidth
          sx={{ mb: 2 }}
          aria-label="Selecionar formação"
        >
          {FORMATIONS.map((f, i) => (
            <ToggleButton key={f.name} value={i}>
              {f.name}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Paper
          sx={{
            aspectRatio: '3/4',
            bgcolor: '#2E7D32',
            position: 'relative',
            borderRadius: 2,
            overflow: 'hidden',
            mb: 2,
          }}
        >
          {/* Field lines */}
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: 0,
              right: 0,
              borderTop: '2px solid rgba(255,255,255,0.5)',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 80,
              height: 80,
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.5)',
            }}
          />
          
          {/* Goal areas */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              left: '25%',
              right: '25%',
              height: '15%',
              borderTop: '2px solid rgba(255,255,255,0.5)',
              borderLeft: '2px solid rgba(255,255,255,0.5)',
              borderRight: '2px solid rgba(255,255,255,0.5)',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: '25%',
              right: '25%',
              height: '15%',
              borderBottom: '2px solid rgba(255,255,255,0.5)',
              borderLeft: '2px solid rgba(255,255,255,0.5)',
              borderRight: '2px solid rgba(255,255,255,0.5)',
            }}
          />

          {/* Players */}
          {players.map((player) => (
            <Box
              key={player.id}
              onClick={() => setSelectedPlayer(player.id)}
              sx={{
                position: 'absolute',
                left: `${player.x}%`,
                top: `${player.y}%`,
                transform: 'translate(-50%, -50%)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <Avatar
                src={player.photoUrl}
                alt={player.name}
                sx={{
                  width: selectedPlayer === player.id ? 48 : 36,
                  height: selectedPlayer === player.id ? 48 : 36,
                  border: `2px solid ${player.team === 'A' ? theme.palette.primary.main : theme.palette.secondary.main}`,
                  bgcolor: player.team === 'A' ? alpha(theme.palette.primary.main, 0.8) : alpha(theme.palette.secondary.main, 0.8),
                }}
              >
                {player.name?.charAt(0)?.toUpperCase()}
              </Avatar>
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  textAlign: 'center',
                  color: 'white',
                  fontSize: 10,
                  mt: 0.5,
                  textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                }}
              >
                {player.name.split(' ')[0]}
              </Typography>
            </Box>
          ))}

          {/* Ball */}
          <Box
            sx={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 20,
              height: 20,
              borderRadius: '50%',
              bgcolor: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SoccerIcon sx={{ fontSize: 16, color: '#333' }} />
          </Box>
        </Paper>

        <Grid container spacing={2}>
          <Grid xs={6}>
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Time A
              </Typography>
              <Typography variant="body2">
                {players.filter((p) => p.team === 'A').length} jogadores
              </Typography>
            </Paper>
          </Grid>
          <Grid xs={6}>
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="subtitle2" color="secondary" gutterBottom>
                Time B
              </Typography>
              <Typography variant="body2">
                {players.filter((p) => p.team === 'B').length} jogadores
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};
