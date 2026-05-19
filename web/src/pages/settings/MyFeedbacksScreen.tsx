import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  IconButton,
  List,
  ListItemButton,
  Divider,
  Chip,
  Alert,
  Button,
  useTheme,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  BugReport as BugIcon,
  ReportProblem as ProblemIcon,
  Lightbulb as ImprovementIcon,
  AddComment as SuggestionIcon,
  OpenInNew as OpenInNewIcon,
  Refresh as RefreshIcon,
  RateReview as EmptyIcon,
} from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useFeedback } from '../../hooks/useFeedback';
import { LoadingState } from '../../components/common/GameCard';

const STATUS_CONFIG: Record<string, { label: string; color: 'default' | 'info' | 'success' | 'error' | 'warning' }> = {
  open: { label: 'Aberto', color: 'default' },
  triaged: { label: 'Em análise', color: 'info' },
  issue_created: { label: 'Issue criada', color: 'success' },
  resolved: { label: 'Resolvido', color: 'success' },
  wontfix: { label: 'Não corrigiremos', color: 'error' },
  duplicate: { label: 'Duplicado', color: 'warning' },
};

const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactElement }> = {
  bug: { label: 'Bug', icon: <BugIcon fontSize="small" /> },
  problem: { label: 'Problema', icon: <ProblemIcon fontSize="small" /> },
  improvement: { label: 'Melhoria', icon: <ImprovementIcon fontSize="small" /> },
  suggestion: { label: 'Sugestão', icon: <SuggestionIcon fontSize="small" /> },
};

export const MyFeedbacksScreen: React.FC = () => {
  useDocumentTitle('Meus Feedbacks');
  const navigate = useNavigate();
  const theme = useTheme();
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { myFeedbacks, fetching, error } = useFeedback();

  if (!currentUser) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Alert severity="warning">Faça login para ver seus feedbacks</Alert>
      </Container>
    );
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
          <IconButton onClick={() => { if (window.history.length > 1) { navigate(-1); } else { navigate('/', { replace: true }); } }} aria-label="Voltar">
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1 }}>
            Meus Feedbacks
          </Typography>
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        {fetching ? (
          <LoadingState shimmerCount={4} itemType="CARD" />
        ) : error ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => queryClient.invalidateQueries()}>
              Tentar novamente
            </Button>
          </Box>
        ) : myFeedbacks.length === 0 ? (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <EmptyIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                Nenhum feedback enviado
              </Typography>
              <Typography variant="body2" color="text.disabled">
                Seus feedbacks aparecerão aqui com status de acompanhamento
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <List disablePadding aria-label="Meus feedbacks">
              {myFeedbacks.map((feedback, index) => (
                <React.Fragment key={feedback.id}>
                  <ListItemButton
                    onClick={() => {
                      if (feedback.github_issue_url) {
                        window.open(feedback.github_issue_url, '_blank');
                      }
                    }}
                    sx={{ flexDirection: 'column', alignItems: 'flex-start', py: 2 }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, width: '100%' }}>
                      <Chip
                        icon={TYPE_CONFIG[feedback.type]?.icon}
                        label={TYPE_CONFIG[feedback.type]?.label || feedback.type}
                        size="small"
                        sx={{ mr: 'auto' }}
                      />
                      <Chip
                        label={STATUS_CONFIG[feedback.status]?.label || feedback.status}
                        size="small"
                        color={STATUS_CONFIG[feedback.status]?.color || 'default'}
                      />
                    </Box>
                    <Typography variant="body1" fontWeight={500} sx={{ mb: 0.5 }}>
                      {feedback.title}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                      <Typography variant="caption" color="text.secondary">
                        {feedback.created_at?.toLocaleDateString?.('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }) || '-'}
                      </Typography>
                      {feedback.github_issue_url && (
                        <Button
                          size="small"
                          endIcon={<OpenInNewIcon />}
                          sx={{ ml: 'auto', fontSize: '0.75rem' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(feedback.github_issue_url, '_blank');
                          }}
                        >
                          Ver issue
                        </Button>
                      )}
                    </Box>
                  </ListItemButton>
                  {index < myFeedbacks.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </Card>
        )}
      </Container>
    </Box>
  );
};
