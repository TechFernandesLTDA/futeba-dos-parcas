import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Box,
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
  EmojiEvents as TrophyIcon,
  Star as StarIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { LoadingState } from '../../components/common/GameCard';
import { PageContainer } from '../../components/common/PageContainer';
import { ErrorState } from '../../components/common/ErrorState';
import {
  LEVEL_TABLE,
  LevelEntry,
  getLevelForXp,
  getXpProgress,
  getXpRemaining,
  XP_VALUES,
} from '../../types/gamification';
import { getLevelColor } from '../../types/user';
import { getLevelBadgeImage, getLevelBadgeDescription, handleBadgeImageError } from '../../utils/levelBadge';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { createLogger } from '../../utils/logger';
import { TeamBadge } from '../../components/team/TeamBadge';
import { useTranslation } from 'react-i18next';
import { getExperiencePoints, getLogLevelAfter, getXpEarned } from '../../utils/xpAccounting';

const logger = createLogger('LevelJourneyScreen');

interface LevelHistory {
  level: number;
  achievedAt: Date;
  xpGained: number;
  source: string;
}

// #2272: LEVEL_TABLE é constante — divide-se uma única vez no nível do módulo,
// em vez de rodar .filter() a cada render do componente.
const BASE_LEVELS = LEVEL_TABLE.filter((e) => e.level <= 10);
const LEGEND_LEVELS = LEVEL_TABLE.filter((e) => e.level >= 11);

export const LevelJourneyScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.levelJourney'));
  const navigateBack = useNavigateBack();
  const theme = useTheme();
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const { showError } = useToast();
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;

  const [currentXp, setCurrentXp] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [history, setHistory] = useState<LevelHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [xpGuideOpen, setXpGuideOpen] = useState(false);

  const targetUserId = userId || currentUser?.id;

  // #2215: estado de erro dedicado (antes só havia toast) + retry.
  const cancelledRef = useRef(false);
  const fetchLevelData = useCallback(async () => {
    if (!targetUserId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const userDoc = await getDoc(doc(db, 'users', targetUserId));
      if (cancelledRef.current) return;
      if (userDoc.exists()) {
        const raw = userDoc.data();
        const data = snakeToCamel(raw) as Record<string, unknown>;
        const xp = getExperiencePoints({ ...raw, ...data });
        setCurrentXp(xp);
        setCurrentLevel(getLevelForXp(xp));
      }

      const xpLogsRef = collection(db, 'xp_logs');
      const q = query(xpLogsRef, where('user_id', '==', targetUserId), orderBy('created_at', 'desc'), limit(10));
      const snapshot = await getDocs(q);

      if (cancelledRef.current) return;

      const historyData = snapshot.docs.map((d) => {
        const rawLog = d.data();
        const logData = snakeToCamel(rawLog) as Record<string, unknown>;
        const xpAfter = getExperiencePoints({ ...rawLog, ...logData });
        return {
          level: getLogLevelAfter({ ...rawLog, ...logData }, xpAfter),
          achievedAt: (logData.createdAt as { toDate?: () => Date })?.toDate?.() || new Date(),
          xpGained: getXpEarned({ ...rawLog, ...logData }),
          source: (logData.source as string) || t('level.xpSourceGame'),
        };
      });

      setHistory(historyData);
    } catch (err) {
      if (!cancelledRef.current) {
        logger.error('Error fetching level data:', err);
        const message = t('profile.levelHistoryLoadError');
        setError(message);
        showErrorRef.current(message);
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [targetUserId, t]);

  useEffect(() => {
    cancelledRef.current = false;
    if (!targetUserId) {
      setLoading(false);
      return () => { cancelledRef.current = true; };
    }

    setLoading(true);
    setError(null);
    let userReady = false;
    let historyReady = false;
    const markReady = () => {
      if (userReady && historyReady && !cancelledRef.current) setLoading(false);
    };
    const handleSnapshotError = (err: unknown) => {
      if (cancelledRef.current) return;
      logger.error('Error subscribing to level data:', err);
      const message = t('profile.levelHistoryLoadError');
      setError(message);
      setLoading(false);
      showErrorRef.current(message);
    };

    const unsubscribeUser = onSnapshot(
      doc(db, 'users', targetUserId),
      (userDoc) => {
        if (cancelledRef.current) return;
        if (userDoc.exists()) {
          const raw = userDoc.data();
          const data = snakeToCamel(raw) as Record<string, unknown>;
          const xp = getExperiencePoints({ ...raw, ...data });
          setCurrentXp(xp);
          setCurrentLevel(getLevelForXp(xp));
        }
        userReady = true;
        markReady();
      },
      handleSnapshotError,
    );

    const xpLogsRef = collection(db, 'xp_logs');
    const q = query(xpLogsRef, where('user_id', '==', targetUserId), orderBy('created_at', 'desc'), limit(10));
    const unsubscribeHistory = onSnapshot(
      q,
      (snapshot) => {
        if (cancelledRef.current) return;
        const historyData = snapshot.docs.map((d) => {
          const rawLog = d.data();
          const logData = snakeToCamel(rawLog) as Record<string, unknown>;
          return {
            level: getLogLevelAfter({ ...rawLog, ...logData }),
            achievedAt: (logData.createdAt as { toDate?: () => Date })?.toDate?.() || new Date(),
            xpGained: getXpEarned({ ...rawLog, ...logData }),
            source: (logData.source as string) || t('level.xpSourceGame'),
          };
        });
        setHistory(historyData);
        historyReady = true;
        markReady();
      },
      handleSnapshotError,
    );

    return () => {
      cancelledRef.current = true;
      unsubscribeUser();
      unsubscribeHistory();
    };
  }, [targetUserId, t]);

  const progress = getXpProgress(currentXp);
  const xpRemaining = getXpRemaining(currentXp);
  const currentEntry = LEVEL_TABLE[currentLevel];
  const nextEntry = currentLevel < 20 ? LEVEL_TABLE[currentLevel + 1] : null;
  const color = getLevelColor(currentLevel, theme);

  return (
    <Box>
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
          <IconButton onClick={navigateBack} aria-label={t('common.back')}>
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1 }}>
            {t('profile.starRoad')}
          </Typography>
        </Box>
      </Box>

      <PageContainer maxWidth="list">
        {loading ? (
          <LoadingState shimmerCount={4} itemType="CARD" />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchLevelData} />
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
                      onError={handleBadgeImageError}
                      loading="lazy"
                      decoding="async"
                      alt={getLevelBadgeDescription(currentLevel, currentEntry.name)}
                      sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                      }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">
                      {currentUser?.name || t('profile.defaultPlayerName')}
                    </Typography>
                    <TeamBadge teamId={currentUser?.favoriteTeam} size={24} />
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
                    {t('level.xpTotal', { xp: currentXp.toLocaleString('pt-BR') })}
                  </Typography>
                </Box>

                {/* Barra de progresso */}
                {currentLevel < 20 && nextEntry && (
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        {t('profile.levelLabel', { level: currentLevel })}
                      </Typography>
                      <Typography variant="caption" fontWeight={600} color={color}>
                        {Math.round(progress * 100)}%
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('profile.levelLabel', { level: currentLevel + 1 })}
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
                          transition: (t) => t.transitions.create('width', { duration: 500 }),
                          boxShadow: `0 0 8px ${alpha(color, 0.4)}`,
                        }}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: 'center' }}>
                      {t('profile.xpToNextLevel', { xp: xpRemaining.toLocaleString('pt-BR'), levelName: nextEntry.name })}
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
                      {t('level.maxReached')}
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>

            {/* Guia de XP - Colapsável como Android */}
            <Card sx={{ mb: 2 }}>
              <CardContent
                role="button"
                tabIndex={0}
                aria-expanded={xpGuideOpen}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setXpGuideOpen(!xpGuideOpen);
                  }
                }}
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
                    {t('level.howToEarnXp')}
                  </Typography>
                </Box>
                {xpGuideOpen ? <ExpandLessIcon color="action" /> : <ExpandMoreIcon color="action" />}
              </CardContent>
              <Collapse in={xpGuideOpen}>
                <Box sx={{ px: 2, pb: 2 }}>
                  <Divider sx={{ mb: 1.5 }} />
                  {[
                    { key: 'participation', value: XP_VALUES.PARTICIPATION },
                    { key: 'goal', value: XP_VALUES.GOAL },
                    { key: 'assist', value: XP_VALUES.ASSIST },
                    { key: 'save', value: XP_VALUES.SAVE },
                    { key: 'win', value: XP_VALUES.WIN },
                    { key: 'mvp', value: XP_VALUES.MVP },
                    { key: 'bestGk', value: XP_VALUES.BEST_GK },
                    { key: 'streak3', value: XP_VALUES.STREAK_3 },
                    { key: 'streak7', value: XP_VALUES.STREAK_7 },
                    { key: 'streak10', value: XP_VALUES.STREAK_10 },
                  ].map((item, i) => {
                    const label = t(`level.xpGuide.${item.key}.label`);
                    const desc = t(`level.xpGuide.${item.key}.desc`);
                    return (
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
                          {label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {desc}
                        </Typography>
                      </Box>
                      <Typography variant="body2" fontWeight={700} color="success.main">
                        +{item.value}
                      </Typography>
                    </Box>
                )})}
                  <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.info.main, 0.08) }}>
                    <Typography variant="caption" color="text.secondary">
                      {t('level.xpGuideTip')}
                    </Typography>
                  </Box>
                </Box>
              </Collapse>
            </Card>

            {/* Progressão Base (0-10) */}
            <Box sx={{ mb: 1, mt: 3 }}>
              <Divider sx={{ mb: 1.5 }}>
                <Typography variant="caption" fontWeight={600} color="text.secondary">
                  {t('level.baseProgression')}
                </Typography>
              </Divider>
            </Box>

            {BASE_LEVELS.map((entry) => (
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
                  {t('level.legendsOfFootball')}
                </Typography>
              </Divider>
            </Box>

            {LEGEND_LEVELS.map((entry) => (
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
                  {t('level.recentHistory')}
                </Typography>
              </Divider>
            </Box>
            <Card>
              <CardContent>
                {history.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 3 }}>
                    <FireIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      {t('level.noRecordsYet')}
                    </Typography>
                  </Box>
                ) : (
                  <List disablePadding aria-label={t('a11y.recentXpHistory')}>
                    {history.slice(0, 10).map((item, index) => (
                      <Box key={`${item.achievedAt.getTime()}-${item.source}-${index}`}>
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
      </PageContainer>
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
  const { t } = useTranslation();
  const color = getLevelColor(entry.level, theme);

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
            onError={handleBadgeImageError}
            loading="lazy"
            decoding="async"
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
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  letterSpacing: 0.5,
                }}
              >
                {t('level.currentBadge')}
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
