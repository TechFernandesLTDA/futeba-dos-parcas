import React from 'react';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import {
  Box,
  Container,
  Typography,
  Card,
  Button,
  List,
  ListItemButton,
  Divider,
  Chip,
  Alert,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  BugReport as BugIcon,
  ReportProblem as ProblemIcon,
  Lightbulb as ImprovementIcon,
  AddComment as SuggestionIcon,
  OpenInNew as OpenInNewIcon,
  RateReview as EmptyIcon,
} from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useFeedback } from '../../hooks/useFeedback';
import { isValidUrl } from '../../utils/validation';
import { LoadingState } from '../../components/common/GameCard';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.myFeedbacks'));
  const goBack = useNavigateBack();
  const theme = useTheme();
  const isMd = useMediaQuery(theme.breakpoints.up('md'));
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
      <ScreenHeader title="Meus Feedbacks" onBack={goBack} />

      <Container maxWidth={isMd ? 'md' : 'sm'} sx={{ py: 2 }}>
        {fetching ? (
          <LoadingState shimmerCount={4} itemType="CARD" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => queryClient.invalidateQueries()} />
        ) : myFeedbacks.length === 0 ? (
          <EmptyState
            icon={<EmptyIcon />}
            title={t('feedback.myFeedbacksEmpty')}
            description={t('feedback.myFeedbacksEmptyDesc')}
          />
        ) : (
          <Card>
            <List disablePadding aria-label={t('a11y.myFeedbacks')}>
              {myFeedbacks.map((feedback, index) => (
                <React.Fragment key={feedback.id}>
                  <ListItemButton
                    onClick={() => {
                      if (feedback.github_issue_url && isValidUrl(feedback.github_issue_url)) {
                        window.open(feedback.github_issue_url, '_blank', 'noopener,noreferrer');
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
                        {feedback.created_at?.toLocaleDateString?.(navigator.language || 'pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }) || '-'}
                      </Typography>
                      {feedback.github_issue_url && (
                        <Button
                          size="small"
                          endIcon={<OpenInNewIcon />}
                          sx={{ ml: 'auto', fontSize: '0.75rem' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isValidUrl(feedback.github_issue_url)) {
                              window.open(feedback.github_issue_url, '_blank', 'noopener,noreferrer');
                            }
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
