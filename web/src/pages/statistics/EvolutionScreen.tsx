import { PageContainer } from '../../components/common/PageContainer';
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import Grid from '@mui/material/Unstable_Grid2';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Tabs,
  Tab,
  useTheme,
  alpha,
  Paper,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  SportsSoccer as SoccerIcon,
  EmojiEvents as TrophyIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { LoadingState } from '../../components/common/GameCard';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { createLogger } from '../../utils/logger';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useTranslation } from 'react-i18next';
import { useBreadcrumbEntityLabel } from '../../contexts/BreadcrumbEntityContext';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { normalizePlayerStats } from '../../utils/playerStats';

const logger = createLogger('EvolutionScreen');

interface EvolutionData {
  month: string;
  gamesPlayed: number;
  goals: number;
  assists: number;
  wins: number;
  xpEarned: number;
}

interface StatsSummary {
  totalGames: number;
  totalWins: number;
  totalGoals: number;
  totalAssists: number;
  totalMvps: number;
  avgGoalsPerGame: number;
  winRate: number;
}

// #2276: interfaces tipadas para os docs lidos (substituem Record<string, any>).
interface RawUserName {
  name?: string;
  displayName?: string;
  nickname?: string;
}
interface RawMonthlyStats {
  month?: string;
  gamesPlayed?: number;
  goals?: number;
  assists?: number;
  wins?: number;
  xpEarned?: number;
}

export const EvolutionScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.evolution'));
  const goBack = useNavigateBack();
  const navigate = useNavigate();
  const theme = useTheme();
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const { showError } = useToast();
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;

  const [tabValue, setTabValue] = useState(0);
  const [evolutionData, setEvolutionData] = useState<EvolutionData[]>([]);
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  // SECFIX #493: estado de erro pra distinguir falha de rede vs sem dados
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [breadcrumbUserName, setBreadcrumbUserName] = useState<string | null>(null);

  const targetUserId = userId || currentUser?.id;
  const isOwnProfile = !!targetUserId && targetUserId === currentUser?.id;
  useBreadcrumbEntityLabel(
    'user',
    targetUserId,
    breadcrumbUserName ?? (targetUserId === currentUser?.id ? currentUser?.name : null),
  );

  useEffect(() => {
    if (!targetUserId) {
      setLoading(false);
      return;
    }

    setError(null);
    setLoading(true);
    // #2278: evita setState após unmount
    let cancelled = false;

    const fetchData = async () => {
      try {
        // Os números ficam em statistics/{uid}, gravado pelo processamento de XP;
        // users/{uid} serve de reserva para contas antigas e para o nome (#4629, item 12).
        const [userDoc, statsDoc] = await Promise.all([
          getDoc(doc(db, 'users', targetUserId)),
          getDoc(doc(db, 'statistics', targetUserId)),
        ]);
        if (!cancelled && userDoc.exists()) {
          const data = snakeToCamel<RawUserName>(userDoc.data());
          const loadedName = [data.name, data.displayName, data.nickname]
            .find((value): value is string => typeof value === 'string' && value.trim().length > 0);
          setBreadcrumbUserName(loadedName ?? null);
        }
        if (!cancelled && (userDoc.exists() || statsDoc.exists())) {
          const stats = normalizePlayerStats(
            statsDoc.exists() ? statsDoc.data() : undefined,
            userDoc.exists() ? userDoc.data() : undefined,
            targetUserId,
          );
          setSummary({
            totalGames: stats.totalGames,
            totalWins: stats.totalWins,
            totalGoals: stats.totalGoals,
            totalAssists: stats.totalAssists,
            totalMvps: stats.mvpCount,
            avgGoalsPerGame: stats.avgGoalsPerGame,
            winRate: stats.winRate * 100,
          });
        }

        const statsRef = collection(db, 'monthly_stats');
        const q = query(statsRef, where('user_id', '==', targetUserId), orderBy('month', 'desc'), limit(12));
        const snapshot = await getDocs(q);

        const data: EvolutionData[] = snapshot.docs.map((d) => {
          const docData = snakeToCamel<RawMonthlyStats>(d.data());
          return {
            month: docData.month ?? '',
            gamesPlayed: docData.gamesPlayed || 0,
            goals: docData.goals || 0,
            assists: docData.assists || 0,
            wins: docData.wins || 0,
            xpEarned: docData.xpEarned || 0,
          };
        });

        if (!cancelled) setEvolutionData(data);
      } catch (err) {
        logger.error('Error fetching evolution data:', err);
        if (!cancelled) {
          showErrorRef.current(t('statistics.loadEvolutionError'));
          setError(t('statistics.loadEvolutionError'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [targetUserId, reloadKey, t]);

  const maxValue = Math.max(...evolutionData.map((d) => d.gamesPlayed), 1);

  return (
    <Box sx={{ pb: 4 }}>
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          bgcolor: 'background.default',
          zIndex: 10,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <ScreenHeader
          title={t('page.title.evolution')}
          onBack={goBack}
          backAriaLabel={t('a11y.back')}
          sticky={false}
        />
        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          variant="fullWidth"
          aria-label={t('a11y.evolutionPeriod')}
        >
          <Tab label="Visão Geral" />
          <Tab label="Mensal" />
        </Tabs>
      </Box>

      <PageContainer maxWidth="dashboard">
        {loading ? (
          <LoadingState shimmerCount={6} itemType="CARD" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : !summary ? (
          <EmptyState
            arte="placar_zerado"
            icon={<TimelineIcon />}
            title={t('empty.noDataAvailable')}
          />
        ) : summary.totalGames === 0 ? (
          // Sem jogo finalizado, a tela só teria zeros: diz o que fazer.
          <EmptyState
            arte="placar_zerado"
            icon={<TimelineIcon />}
            title={t('statistics.evolutionEmptyTitle')}
            description={t(isOwnProfile ? 'statistics.evolutionEmptyDesc' : 'statistics.evolutionEmptyOtherDesc')}
            actionLabel={isOwnProfile ? t('statistics.evolutionEmptyAction') : undefined}
            onAction={isOwnProfile ? () => navigate('/public-games') : undefined}
          />
        ) : (
          <>
            {tabValue === 0 && (
              <>
                <Card sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                      Resumo Geral
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid xs={12} sm={6}>
                        <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                          <SoccerIcon color="primary" sx={{ mb: 0.5 }} />
                          <Typography variant="h5" fontWeight={600}>
                            {summary.totalGames}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Jogos
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid xs={12} sm={6}>
                        <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                          <TrophyIcon color="warning" sx={{ mb: 0.5 }} />
                          <Typography variant="h5" fontWeight={600}>
                            {summary.totalWins}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Vitórias
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid xs={12} sm={6}>
                        <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                          <Typography variant="h5" fontWeight={600} color="success.main">
                            {summary.totalGoals}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Gols
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid xs={12} sm={6}>
                        <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                          <Typography variant="h5" fontWeight={600} color="info.main">
                            {summary.totalAssists}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Assistências
                          </Typography>
                        </Paper>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>

                <Card sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                      Métricas
                    </Typography>
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2">Taxa de Vitória</Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {summary.winRate.toFixed(1)}%
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          height: 8,
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                          borderRadius: 4,
                          overflow: 'hidden',
                        }}
                      >
                        <Box
                          sx={{
                            height: '100%',
                            width: `${summary.winRate}%`,
                            bgcolor: theme.palette.primary.main,
                            borderRadius: 4,
                          }}
                        />
                      </Box>
                    </Box>
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2">Média de Gols/Jogo</Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {summary.avgGoalsPerGame.toFixed(2)}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          height: 8,
                          bgcolor: alpha(theme.palette.success.main, 0.1),
                          borderRadius: 4,
                          overflow: 'hidden',
                        }}
                      >
                        <Box
                          sx={{
                            height: '100%',
                            width: `${Math.min(summary.avgGoalsPerGame * 20, 100)}%`,
                            bgcolor: theme.palette.success.main,
                            borderRadius: 4,
                          }}
                        />
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </>
            )}

            {tabValue === 1 && (
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                    Últimos 12 Meses
                  </Typography>
                  {evolutionData.length === 0 ? (
                    <EmptyState
                      icon={<TrendingUpIcon />}
                      title={t('statistics.evolutionMonthlyEmptyTitle')}
                      description={t('statistics.evolutionMonthlyEmptyDesc')}
                    />
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 150 }}>
                      {evolutionData.slice(0, 12).reverse().map((data, _index) => (
                        <Box
                          key={data.month}
                          sx={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                          }}
                        >
                          <Box
                            sx={{
                              width: '100%',
                              bgcolor: theme.palette.primary.main,
                              borderRadius: '4px 4px 0 0',
                              height: `${(data.gamesPlayed / maxValue) * 100}px`,
                              minHeight: 4,
                              transition: (t) => t.transitions.create('height', { duration: t.transitions.duration.standard }),
                            }}
                          />
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                            {data.month.slice(5)}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </PageContainer>
    </Box>
  );
};
