import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  IconButton,
  Grid,
  Chip,
  LinearProgress,
  useTheme,
  alpha,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';

interface PerformanceRecord {
  id: string;
  screenName: string;
  timestamp: number;
  timeToInteractive: number;
  lcp?: number;
  fid?: number;
  cls?: number;
  fcp?: number;
  firestoreQueries: number;
  dataDownloaded: number;
  performanceViolations: string;
}

const PERFORMANCE_BUDGETS = {
  tti: { good: 3000, poor: 7300, label: 'Time to Interactive' },
  lcp: { good: 2500, poor: 4000, label: 'Largest Contentful Paint' },
  fid: { good: 100, poor: 300, label: 'First Input Delay' },
  cls: { good: 0.1, poor: 0.25, label: 'Cumulative Layout Shift' },
  fcp: { good: 1800, poor: 3000, label: 'First Contentful Paint' },
};

function getScoreColor(value: number, good: number, poor: number): string {
  if (value <= good) return 'success.main';
  if (value <= poor) return 'warning.main';
  return 'error.main';
}

export const PerformanceDashboard: React.FC = () => {
  const goBack = useNavigateBack('/');
  const theme = useTheme();
  const { user } = useAuth();
  const [records, setRecords] = useState<PerformanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loadRecords = async () => {
      try {
        const perfRef = collection(db, 'performance_metrics');
        const q = query(perfRef, orderBy('timestamp', 'desc'), limit(100));
        const snapshot = await getDocs(q);
        
        const data: PerformanceRecord[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as PerformanceRecord));

        setRecords(data);
      } catch (err) {
        console.error('Error loading performance records:', err);
      } finally {
        setLoading(false);
      }
    };

    loadRecords();
  }, [user]);

  // Agrupar por tela
  const screenStats = records.reduce((acc, record) => {
    if (!acc[record.screenName]) {
      acc[record.screenName] = {
        count: 0,
        avgTTI: 0,
        avgLCP: 0,
        violations: 0,
      };
    }
    
    const stats = acc[record.screenName];
    stats.count++;
    stats.avgTTI = (stats.avgTTI * (stats.count - 1) + record.timeToInteractive) / stats.count;
    if (record.lcp) {
      stats.avgLCP = (stats.avgLCP * (stats.count - 1) + record.lcp) / stats.count;
    }
    if (record.performanceViolations) {
      stats.violations++;
    }
    
    return acc;
  }, {} as Record<string, { count: number; avgTTI: number; avgLCP: number; violations: number }>);

  const sortedScreens = Object.entries(screenStats).sort((a, b) => b[1].count - a[1].count);

  return (
    <Box sx={{ pb: 8 }}>
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          bgcolor: 'background.paper',
          zIndex: 10,
          borderBottom: `1px solid ${theme.palette.divider}`,
          p: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={goBack} aria-label="Voltar">
            <BackIcon />
          </IconButton>
          <SpeedIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h6" fontWeight={700}>
            Performance Dashboard
          </Typography>
        </Box>
      </Box>

      <Container maxWidth="lg" sx={{ py: 3 }}>
        {loading ? (
          <LinearProgress />
        ) : records.length === 0 ? (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <SpeedIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                Nenhuma métrica coletada ainda
              </Typography>
              <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
                As métricas serão coletadas automaticamente conforme você navega pelo app
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Resumo Geral */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  Resumo Geral
                </Typography>
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" fontWeight={700} color="primary">
                        {records.length}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total de Registros
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" fontWeight={700} color="primary">
                        {Object.keys(screenStats).length}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Telas Monitoradas
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" fontWeight={700} color="success.main">
                        {Math.round(records.reduce((sum, r) => sum + r.timeToInteractive, 0) / records.length)}ms
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        TTI Médio
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" fontWeight={700} color="warning.main">
                        {records.filter(r => r.performanceViolations).length}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Violações
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Performance por Tela */}
            <Typography variant="h6" fontWeight={700} gutterBottom sx={{ mt: 4, mb: 2 }}>
              Performance por Tela
            </Typography>
            <Grid container spacing={2}>
              {sortedScreens.map(([screenName, stats]) => (
                <Grid item xs={12} sm={6} md={4} key={screenName}>
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                        {screenName}
                      </Typography>
                      
                      <Box sx={{ mb: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            TTI Médio
                          </Typography>
                          <Typography 
                            variant="caption" 
                            fontWeight={700}
                            sx={{ color: getScoreColor(stats.avgTTI, PERFORMANCE_BUDGETS.tti.good, PERFORMANCE_BUDGETS.tti.poor) }}
                          >
                            {Math.round(stats.avgTTI)}ms
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min((stats.avgTTI / PERFORMANCE_BUDGETS.tti.poor) * 100, 100)}
                          sx={{
                            height: 8,
                            borderRadius: 4,
                            bgcolor: alpha(theme.palette.grey[300], 0.3),
                            '& .MuiLinearProgress-bar': {
                              bgcolor: getScoreColor(stats.avgTTI, PERFORMANCE_BUDGETS.tti.good, PERFORMANCE_BUDGETS.tti.poor),
                            },
                          }}
                        />
                      </Box>

                      {stats.avgLCP > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              LCP Médio
                            </Typography>
                            <Typography 
                              variant="caption" 
                              fontWeight={700}
                              sx={{ color: getScoreColor(stats.avgLCP, PERFORMANCE_BUDGETS.lcp.good, PERFORMANCE_BUDGETS.lcp.poor) }}
                            >
                              {Math.round(stats.avgLCP)}ms
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min((stats.avgLCP / PERFORMANCE_BUDGETS.lcp.poor) * 100, 100)}
                            sx={{
                              height: 8,
                              borderRadius: 4,
                              bgcolor: alpha(theme.palette.grey[300], 0.3),
                              '& .MuiLinearProgress-bar': {
                                bgcolor: getScoreColor(stats.avgLCP, PERFORMANCE_BUDGETS.lcp.good, PERFORMANCE_BUDGETS.lcp.poor),
                              },
                            }}
                          />
                        </Box>
                      )}

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                        <Chip 
                          label={`${stats.count} visitas`} 
                          size="small" 
                          variant="outlined"
                        />
                        {stats.violations > 0 && (
                          <Chip 
                            label={`${stats.violations} violações`} 
                            size="small" 
                            color="warning"
                          />
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {/* Performance Budgets */}
            <Typography variant="h6" fontWeight={700} gutterBottom sx={{ mt: 4, mb: 2 }}>
              Performance Budgets
            </Typography>
            <Card>
              <CardContent>
                <Grid container spacing={2}>
                  {Object.entries(PERFORMANCE_BUDGETS).map(([key, budget]) => (
                    <Grid item xs={12} sm={6} md={4} key={key}>
                      <Box sx={{ p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
                        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                          {budget.label}
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            Good:
                          </Typography>
                          <Typography variant="caption" fontWeight={700} sx={{ color: 'success.main' }}>
                            ≤ {budget.good}{key === 'cls' ? '' : 'ms'}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">
                            Poor:
                          </Typography>
                          <Typography variant="caption" fontWeight={700} sx={{ color: 'error.main' }}>
                            {'>'} {budget.poor}{key === 'cls' ? '' : 'ms'}
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </>
        )}
      </Container>
    </Box>
  );
};
