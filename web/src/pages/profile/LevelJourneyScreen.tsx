import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  IconButton,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse,
  useTheme,
  alpha,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  MilitaryTech as MilitaryTechIcon,
  LocalFireDepartment as FireIcon,
  Lock as LockIcon,
  CheckCircle as CheckIcon,
  SportsSoccer as SoccerIcon,
  EmojiEvents as TrophyIcon,
  Star as StarIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { LoadingState } from '../../components/common/GameCard';
import {
  LEVEL_TABLE,
  LevelEntry,
  getLevelForXp,
  getXpProgress,
  getXpRemaining,
  XP_VALUES,
} from '../../types/gamification';
import { getLevelColor } from '../../types/user';
import { getLevelBadgeImage, getLevelBadgeDescription } from '../../utils/levelBadge';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { createLogger } from '../../utils/logger';

const logger = createLogger('LevelJourneyScreen');

interface LevelHistory {
  level: number;
  achievedAt: Date;
  xpGained: number;
  source: string;
}

export const LevelJourneyScreen: React.FC = () => {
  useDocumentTitle('Jornada de Nível');
  const navigate = useNavigate();
  const theme = useTheme();
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const { showError } = useToast();

  const [currentXp, setCurrentXp] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [history, setHistory] = useState<LevelHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [xpGuideOpen, setXpGuideOpen] = useState(false);

  const targetUserId = userId || currentUser?.id;

  useEffect(() => {
    if (!targetUserId) {
      setLoading(false);
      return;
    }

    const fetchLevelData = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', targetUserId));
        if (userDoc.exists()) {
          const data = snakeToCamel(userDoc.data()) as Record<string, any>;
          const xp = data.experiencePoints || data.xp || 0;
          setCurrentXp(xp);
          setCurrentLevel(getLevelForXp(xp));
        }

        const xpLogsRef = collection(db, 'xp_logs');
        const q = query(xpLogsRef, where('user_id', '==', targetUserId), orderBy('created_at', 'desc'), limit(10));
        const snapshot = await getDocs(q);

        const historyData = snapshot.docs.map((d) => {
          const logData = snakeToCamel(d.data()) as Record<string, any>;
          return {
            level: logData.newLevel || 0,
            achievedAt: logData.createdAt?.toDate?.() || new Date(),
            xpGained: logData.xpGained || 0,
            source: logData.source || 'Jogo',
          };
        });

        setHistory(historyData);
      } catch (error) {
        logger.error('Error fetching level data:', error);
        showError('Erro ao carregar histórico de nível.');
      } finally {
        setLoading(false);
      }
    };

    fetchLevelData();
  }, [targetUserId]);

  const progress = getXpProgress(currentXp);
  const xpRemaining = getXpRemaining(currentXp);
  const currentEntry = LEVEL_TABLE[currentLevel];
  const nextEntry = currentLevel < 20 ? LEVEL_TABLE[currentLevel + 1] : null;
  const color = getLevelColor(currentLevel);

  return (
    <Box sx={{ pb: 4 }}>
      {/* Header */}
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
            Rumo ao Estrelato
          </Typography>
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        {loading ? (
          <LoadingState shimmerCount={4} itemType="CARD" />
        ) : (
          <>
            {/* Card do nível atual - com efeito glow como Android */}
            <Card
              sx={{
                mb: 2,
                borderRadius: 4,
                overflow: 'visible',
                position: 'relative',
                border: `2px solid ${alpha(color, 0.3)}`,
                boxShadow: `0 4px 20px ${alpha(color, 0.15)}`,
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ textAlign: 'center', mb: 3 }}>
                  {/* Badge image */}
                  <Box
                    sx={{
                      width: 140,
                      height: 140,
                      mx: 'auto',
                      mb: 2,
                      position: 'relative',
                      filter: `drop-shadow(0 4px 16px ${alpha(color, 0.4)})`,
                    }}
                  >
                    <Box
                      component="img"
                      src={getLevelBadgeImage(currentLevel)}
                      alt={getLevelBadgeDescription(currentLevel, currentEntry.name)}
                      sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                      }}
                    />
                  </Box>
                  <Typography variant="h5" fontWeight={700}>
                    {currentEntry.name}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.5, fontStyle: 'italic', px: 2 }}
                  >
                    "{currentEntry.phrase}"
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {currentXp.toLocaleString('pt-BR')} XP total
                  </Typography>
                </Box>

                {/* Barra de progresso */}
                {currentLevel < 20 && nextEntry && (
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        Nível {currentLevel}
                      </Typography>
                      <Typography variant="caption" fontWeight={600} color={color}>
                        {Math.round(progress * 100)}%
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Nível {currentLevel + 1}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        height: 10,
                        bgcolor: alpha(color, 0.1),
                        borderRadius: 5,
                        overflow: 'hidden',
                      }}
                    >
                      <Box
                        sx={{
                          height: '100%',
                          width: `${progress * 100}%`,
                          background: `linear-gradient(90deg, ${color}, ${alpha(color, 0.7)})`,
                          borderRadius: 5,
                          transition: 'width 0.5s ease',
                          boxShadow: `0 0 8px ${alpha(color, 0.4)}`,
                        }}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: 'center' }}>
                      Faltam <b>{xpRemaining.toLocaleString('pt-BR')}</b> XP para <b>{nextEntry.name}</b>
                    </Typography>
                  </Box>
                )}

                {currentLevel >= 20 && (
                  <Box
                    sx={{
                      textAlign: 'center',
                      mt: 1,
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: alpha(color, 0.08),
                    }}
                  >
                    <TrophyIcon sx={{ color, fontSize: 28, mb: 0.5 }} />
                    <Typography variant="body2" color={color} fontWeight={600}>
                      Nível máximo atingido! Você é o Rei do Futebol!
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>

            {/* Guia de XP - Colapsável como Android */}
            <Card sx={{ mb: 2, borderRadius: 3 }}>
              <CardContent
                sx={{
                  py: 1.5,
                  px: 2,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  '&:last-child': { pb: 1.5 },
                }}
                onClick={() => setXpGuideOpen(!xpGuideOpen)}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <StarIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle2" fontWeight={600}>
                    Como ganhar XP
                  </Typography>
                </Box>
                {xpGuideOpen ? <ExpandLessIcon color="action" /> : <ExpandMoreIcon color="action" />}
              </CardContent>
              <Collapse in={xpGuideOpen}>
                <Box sx={{ px: 2, pb: 2 }}>
                  <Divider sx={{ mb: 1.5 }} />
                  {[
                    { label: 'Participação', desc: 'Jogue uma partida', value: XP_VALUES.PARTICIPATION },
                    { label: 'Gol', desc: 'Marque um gol', value: XP_VALUES.GOAL },
                    { label: 'Assistência', desc: 'Dê uma assistência', value: XP_VALUES.ASSIST },
                    { label: 'Defesa', desc: 'Faça uma defesa (goleiro)', value: XP_VALUES.SAVE },
                    { label: 'Vitória', desc: 'Vença a partida', value: XP_VALUES.WIN },
                    { label: 'MVP', desc: 'Seja eleito o melhor da partida', value: XP_VALUES.MVP },
                    { label: 'Melhor Goleiro', desc: 'Seja eleito o melhor goleiro', value: XP_VALUES.BEST_GK },
                    { label: 'Sequência 3+', desc: 'Jogue 3+ partidas seguidas', value: XP_VALUES.STREAK_3 },
                    { label: 'Sequência 7+', desc: 'Jogue 7+ partidas seguidas', value: XP_VALUES.STREAK_7 },
                    { label: 'Sequência 10+', desc: 'Jogue 10+ partidas seguidas', value: XP_VALUES.STREAK_10 },
                  ].map((item, i) => (
                    <Box
                      key={i}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        py: 0.8,
                        borderBottom: i < 9 ? `1px solid ${theme.palette.divider}` : 'none',
                      }}
                    >
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {item.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.desc}
                        </Typography>
                      </Box>
                      <Typography variant="body2" fontWeight={700} color="success.main">
                        +{item.value}
                      </Typography>
                    </Box>
                  ))}
                  <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.info.main, 0.08) }}>
                    <Typography variant="caption" color="text.secondary">
                      💡 Dica: Jogue regularmente e mantenha sua sequência para ganhar bônus de XP!
                    </Typography>
                  </Box>
                </Box>
              </Collapse>
            </Card>

            {/* Progressão Base (0-10) */}
            <Box sx={{ mb: 1, mt: 3 }}>
              <Divider sx={{ mb: 1.5 }}>
                <Typography variant="caption" fontWeight={600} color="text.secondary">
                  PROGRESSÃO BASE
                </Typography>
              </Divider>
            </Box>

            {LEVEL_TABLE.filter((e) => e.level <= 10).map((entry) => (
              <LevelRow
                key={entry.level}
                entry={entry}
                isUnlocked={currentLevel >= entry.level}
                isCurrent={currentLevel === entry.level}
              />
            ))}

            {/* Lendas do Futebol (11-20) */}
            <Box sx={{ mb: 1, mt: 3 }}>
              <Divider sx={{ mb: 1.5 }}>
                <Typography variant="caption" fontWeight={600} color="text.secondary">
                  LENDAS DO FUTEBOL
                </Typography>
              </Divider>
            </Box>

            {LEVEL_TABLE.filter((e) => e.level >= 11).map((entry) => (
              <LevelRow
                key={entry.level}
                entry={entry}
                isUnlocked={currentLevel >= entry.level}
                isCurrent={currentLevel === entry.level}
              />
            ))}

            {/* Histórico recente */}
            <Box sx={{ mt: 3 }}>
              <Divider sx={{ mb: 1.5 }}>
                <Typography variant="caption" fontWeight={600} color="text.secondary">
                  HISTÓRICO RECENTE
                </Typography>
              </Divider>
            </Box>
            <Card sx={{ borderRadius: 3 }}>
              <CardContent>
                {history.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 3 }}>
                    <FireIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      Nenhum registro ainda
                    </Typography>
                  </Box>
                ) : (
                  <List disablePadding aria-label="Histórico de XP recente">
                    {history.slice(0, 10).map((item, index) => (
                      <Box key={index}>
                        {index > 0 && <Divider />}
                        <ListItem sx={{ px: 0 }}>
                          <ListItemIcon sx={{ minWidth: 40 }}>
                            <MilitaryTechIcon color="primary" />
                          </ListItemIcon>
                          <ListItemText
                            primary={`+${item.xpGained} XP`}
                            secondary={item.source}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {item.achievedAt.toLocaleDateString('pt-BR')}
                          </Typography>
                        </ListItem>
                      </Box>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </Container>
    </Box>
  );
};

/** Componente de linha de nível individual - estilo card como Android */
function LevelRow({
  entry,
  isUnlocked,
  isCurrent,
}: {
  entry: LevelEntry;
  isUnlocked: boolean;
  isCurrent: boolean;
}) {
  const theme = useTheme();
  const color = getLevelColor(entry.level);

  return (
    <Card
      sx={{
        mb: 1,
        borderRadius: 3,
        border: isCurrent ? `2px solid ${color}` : `1px solid ${theme.palette.divider}`,
        boxShadow: isCurrent ? `0 2px 12px ${alpha(color, 0.2)}` : 'none',
        opacity: isUnlocked ? 1 : 0.5,
        bgcolor: isCurrent ? alpha(color, 0.04) : 'background.paper',
      }}
    >
      <CardContent
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          py: 1.5,
          px: 2,
          '&:last-child': { pb: 1.5 },
        }}
      >
        {/* Badge do nível */}
        <Box
          sx={{
            width: isCurrent ? 52 : 44,
            height: isCurrent ? 52 : 44,
            flexShrink: 0,
            filter: isUnlocked
              ? isCurrent ? `drop-shadow(0 2px 8px ${alpha(color, 0.4)})` : 'none'
              : 'grayscale(1) opacity(0.4)',
          }}
        >
          <Box
            component="img"
            src={getLevelBadgeImage(entry.level)}
            alt={getLevelBadgeDescription(entry.level, entry.name)}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />
        </Box>

        {/* Info do nível */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography
              variant="body2"
              fontWeight={isCurrent ? 700 : 500}
              color={isUnlocked ? 'text.primary' : 'text.disabled'}
              noWrap
            >
              {entry.name}
            </Typography>
            {isCurrent && (
              <Box
                sx={{
                  bgcolor: color,
                  color: theme.palette.getContrastText(color),
                  px: 0.8,
                  py: 0.1,
                  borderRadius: 1,
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  letterSpacing: 0.5,
                }}
              >
                ATUAL
              </Box>
            )}
          </Box>
          <Typography
            variant="caption"
            color={isUnlocked ? 'text.secondary' : 'text.disabled'}
            sx={{ fontStyle: 'italic', display: 'block' }}
            noWrap
          >
            {entry.phrase}
          </Typography>
        </Box>

        {/* Status + XP */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
          {isUnlocked ? (
            <CheckIcon sx={{ color, fontSize: 20, mb: 0.25 }} />
          ) : (
            <LockIcon sx={{ color: theme.palette.grey[400], fontSize: 18, mb: 0.25 }} />
          )}
          <Typography
            variant="caption"
            fontWeight={600}
            color={isUnlocked ? color : 'text.disabled'}
          >
            {entry.xpRequired.toLocaleString('pt-BR')}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
