import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Box,
  Typography,
  Card,
  CardActionArea,
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
  ZoomIn as ZoomInIcon,
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
} from '../../types/gamification';
import { getLevelColor, getLevelTextColor } from '../../types/user';
import { getLevelBadgeImage, getLevelBadgeDescription, handleBadgeImageError } from '../../utils/levelBadge';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { createLogger } from '../../utils/logger';
import { TeamBadge } from '../../components/team/TeamBadge';
import { useTranslation } from 'react-i18next';
import { getExperiencePoints, getLogLevelAfter, getXpEarned } from '../../utils/xpAccounting';
import { useBreadcrumbEntityLabel } from '../../contexts/BreadcrumbEntityContext';
import { LevelDetailsDialog } from './LevelDetailsDialog';
import { useHideMobileTopBar } from '../../hooks/useMobileTopBarVisibility';
import { getNearLevelInsight, getXpGuideEntries, summarizeXpLogBreakdown, type XpBreakdownFields } from '../../utils/gamificationInsights';

const logger = createLogger('LevelJourneyScreen');

interface LevelHistory {
  level: number;
  achievedAt: Date;
  xpGained: number;
  source: string;
  summary: string[];
}

// #2272: LEVEL_TABLE é constante — divide-se uma única vez no nível do módulo,
// em vez de rodar .filter() a cada render do componente.
const BASE_LEVELS = LEVEL_TABLE.filter((e) => e.level <= 10);
const LEGEND_LEVELS = LEVEL_TABLE.filter((e) => e.level >= 11);

export const LevelJourneyScreen: React.FC = () => {
  useHideMobileTopBar();
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
  const [selectedLevel, setSelectedLevel] = useState<LevelEntry | null>(null);
  // #3884: nome/escudo do usuário-ALVO da rota (pode ser diferente do logado)
  const [targetProfile, setTargetProfile] = useState<{ name: string | null; favoriteTeam?: string }>({
    name: null,
    favoriteTeam: undefined,
  });

  const targetUserId = userId || currentUser?.id;
  const isOwnProfile = !!targetUserId && targetUserId === currentUser?.id;
  useBreadcrumbEntityLabel(
    'user',
    targetUserId,
    targetProfile.name ?? (isOwnProfile ? currentUser?.name : null),
  );

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
        const loadedName = [data.name, data.displayName, data.nickname]
          .find((value): value is string => typeof value === 'string' && value.trim().length > 0);
        setTargetProfile({ name: loadedName ?? null, favoriteTeam: data.favoriteTeam as string | undefined });
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
          summary: summarizeXpLogBreakdown(logData as XpBreakdownFields, t),
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
          const loadedName = [data.name, data.displayName, data.nickname]
            .find((value): value is string => typeof value === 'string' && value.trim().length > 0);
          setTargetProfile({ name: loadedName ?? null, favoriteTeam: data.favoriteTeam as string | undefined });
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
            summary: summarizeXpLogBreakdown(logData as XpBreakdownFields, t),
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
  // #4041: cor segura como TEXTO (prata/ouro puros reprovam AA no light)
  const textColor = getLevelTextColor(currentLevel, theme);
  const nearLevelInsight = getNearLevelInsight(currentXp);
  const xpGuideEntries = getXpGuideEntries(t);
  // #3884: header deve exibir nome/escudo do usuário-ALVO (:userId), não do logado
  const headerName = isOwnProfile
    ? currentUser?.name || t('profile.defaultPlayerName')
    : targetProfile.name || t('profile.defaultPlayerName');
  const headerFavoriteTeam = isOwnProfile ? currentUser?.favoriteTeam : targetProfile.favoriteTeam;

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
                      {headerName}
                    </Typography>
                    <TeamBadge teamId={headerFavoriteTeam} size={24} />
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
                      <Typography variant="caption" fontWeight={600} sx={{ color: textColor }}>
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
                {nearLevelInsight && (
                  <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.warning.main, 0.08) }}>
                    <Typography variant="subtitle2" fontWeight={700} color="warning.main">
                      {t('level.nearLevelTitle')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('level.nearLevelDescription', {
                        xp: nearLevelInsight.remainingXp.toLocaleString('pt-BR'),
                        level: nearLevelInsight.level,
                        levelName: nearLevelInsight.levelName,
                      })}
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
                    <TrophyIcon sx={{ color: textColor, fontSize: 28, mb: 0.5 }} />
                    <Typography variant="body2" sx={{ color: textColor }} fontWeight={600}>
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
                  {xpGuideEntries.map((item, i) => {
                    return (
                    <Box
                      key={item.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        py: 0.8,
                        borderBottom: i < xpGuideEntries.length - 1 ? `1px solid ${theme.palette.divider}` : 'none',
                      }}
                    >
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {item.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.description}
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

            <Typography
              variant="body2"
              color="text.secondary"
              align="center"
              sx={{ mt: 2.5, mb: 1, px: 2 }}
            >
              {t('level.exploreHint')}
            </Typography>

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
                onSelect={setSelectedLevel}
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
                onSelect={setSelectedLevel}
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
                            secondary={item.summary.length > 0 ? `${item.source} • ${item.summary.join(' • ')}` : item.source}
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
      <LevelDetailsDialog
        entry={selectedLevel}
        currentXp={currentXp}
        isUnlocked={selectedLevel ? currentLevel >= selectedLevel.level : false}
        isCurrent={selectedLevel?.level === currentLevel}
        onClose={() => setSelectedLevel(null)}
      />
    </Box>
  );
};

/** Componente de linha de nível individual - estilo card como Android */
export function LevelRow({
  entry,
  isUnlocked,
  isCurrent,
  onSelect,
}: {
  entry: LevelEntry;
  isUnlocked: boolean;
  isCurrent: boolean;
  onSelect: (entry: LevelEntry) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const color = getLevelColor(entry.level, theme);
  // #4041: cor segura como TEXTO (prata/ouro puros reprovam AA no light)
  const textColor = getLevelTextColor(entry.level, theme);

  return (
    <Card
      sx={{
        mb: 1,
        borderRadius: 3,
        border: isCurrent ? `2px solid ${color}` : `1px solid ${theme.palette.divider}`,
        boxShadow: isCurrent ? `0 2px 12px ${alpha(color, 0.2)}` : 'none',
        // #4050: opacity removida — o card é interativo (CardActionArea) e a
        // opacidade herdada multiplicava o contraste do texto abaixo de AA.
        // "Bloqueado" já é sinalizado pelo cadeado + saturate do badge.
        bgcolor: isCurrent ? alpha(color, 0.04) : 'background.paper',
        transition: theme.transitions.create(['transform', 'box-shadow', 'border-color']),
        '&:hover': {
          transform: 'translateY(-1px)',
          borderColor: alpha(color, 0.55),
          boxShadow: `0 6px 18px ${alpha(color, 0.14)}`,
        },
        '&:focus-within': {
          outline: `3px solid ${alpha(theme.palette.primary.main, 0.32)}`,
          outlineOffset: 2,
        },
      }}
    >
      <CardActionArea
        onClick={() => onSelect(entry)}
        aria-label={t('level.viewDetailsAria', {
          level: entry.level,
          name: entry.name,
          status: isCurrent
            ? t('level.statusCurrent')
            : isUnlocked
              ? t('level.statusUnlocked')
              : t('level.statusLocked'),
        })}
        sx={{
          borderRadius: 'inherit',
        }}
      >
        <CardContent
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            py: 1.5,
            px: 2,
            width: '100%',
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
              : 'saturate(0.7) opacity(0.84)',
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
              color={isUnlocked ? 'text.primary' : 'text.secondary'}
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
            color="text.secondary"
            sx={{ fontStyle: 'italic', display: 'block' }}
            noWrap
          >
            {entry.phrase}
          </Typography>
        </Box>

        {/* Status + XP */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
            {isUnlocked ? (
              <CheckIcon sx={{ color: textColor, fontSize: 20 }} />
            ) : (
              <LockIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
            )}
            <ZoomInIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
          </Box>
          <Typography
            variant="caption"
            fontWeight={600}
            sx={{ color: isUnlocked ? textColor : 'text.secondary' }}
          >
            {entry.xpRequired.toLocaleString('pt-BR')}
          </Typography>
        </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
