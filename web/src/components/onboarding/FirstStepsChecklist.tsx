/**
 * FirstStepsChecklist — Card de Primeiros Passos exibido na HomeTab.
 *
 * Os passos são derivados de dados de domínio existentes — NÃO são checkboxes manuais.
 * Spec: feat-2026-05-16-modern-onboarding-tour §2.3
 *
 * Acessibilidade: aria-labels, contraste adequado, links semânticos.
 */
import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Collapse,
  IconButton,
  LinearProgress,
  Stack,
  Typography,
  Button,
  alpha,
  useTheme,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as UncheckedIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export type OnboardingStepId =
  | 'complete_profile'
  | 'join_or_create_group'
  | 'confirm_presence'
  | 'play_first_game'
  | 'configure_group'
  | 'invite_players'
  | 'reach_min_members'
  | 'create_first_game'
  | 'open_cashbox';

export interface ChecklistStep {
  id: OnboardingStepId;
  label: string;
  subtitle: string;
  actionLabel: string;
  navigateTo: string;
  onAction?: () => void;
  completed: boolean;
}

interface FirstStepsChecklistProps {
  steps: ChecklistStep[];
  visible: boolean;
  onDismiss: () => void;
  title?: string;
  progressLabel?: string;
  /** Max incomplete items shown before truncation (default: all). */
  maxIncomplete?: number;
}

export function FirstStepsChecklist({ steps, visible, onDismiss, title, progressLabel, maxIncomplete }: FirstStepsChecklistProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  const completedCount = steps.filter(s => s.completed).length;
  const progress = steps.length > 0 ? completedCount / steps.length : 0;

  const visibleSteps: ChecklistStep[] = [];
  const hiddenSteps: ChecklistStep[] = [];
  let incompleteShown = 0;
  const limit = maxIncomplete ?? steps.length;

  for (const step of steps) {
    if (step.completed) {
      visibleSteps.push(step);
    } else if (incompleteShown < limit) {
      visibleSteps.push(step);
      incompleteShown++;
    } else {
      hiddenSteps.push(step);
    }
  }
  const truncated = hiddenSteps.length > 0;

  return (
    <Collapse in={visible} unmountOnExit>
      <Card
        sx={{
          mb: 3,
          bgcolor: alpha(theme.palette.primary.main, 0.06),
          border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
          borderRadius: 3,
        }}
      >
        <CardContent>
          {/* Cabeçalho */}
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1}>
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>
                {title || t('onboarding.firstStepsTitle')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {progressLabel || t('onboarding.checklistProgress', { completed: completedCount, total: steps.length })}
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={onDismiss}
              aria-label={t('a11y.closeFirstStepsChecklist')}
              sx={{ mt: -0.5, mr: -0.5 }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>

          {/* Barra de progresso */}
          <LinearProgress
            variant="determinate"
            value={progress * 100}
            aria-label={`${completedCount} de ${steps.length} passos concluídos`}
            sx={{
              mb: 2,
              height: 6,
              borderRadius: 3,
              bgcolor: alpha(theme.palette.primary.main, 0.12),
              '& .MuiLinearProgress-bar': {
                borderRadius: 3,
              },
            }}
          />

          {/* Lista de passos */}
          <Stack spacing={1.5}>
            {visibleSteps.map(step => (
              <Stack
                key={step.id}
                direction="row"
                alignItems="center"
                spacing={1.5}
              >
                {step.completed ? (
                  <CheckCircleIcon
                    fontSize="small"
                    sx={{ color: 'primary.main', flexShrink: 0 }}
                    aria-label={t('a11y.completed')}
                  />
                ) : (
                  <UncheckedIcon
                    fontSize="small"
                    sx={{ color: 'text.disabled', flexShrink: 0 }}
                    aria-label={t('a11y.pending')}
                  />
                )}

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: step.completed ? 400 : 600,
                      color: step.completed ? 'text.disabled' : 'text.primary',
                      textDecoration: step.completed ? 'line-through' : 'none',
                    }}
                  >
                    {step.label}
                  </Typography>
                  {!step.completed && (
                    <Typography variant="caption" color="text.secondary">
                      {step.subtitle}
                    </Typography>
                  )}
                </Box>

                {!step.completed && (
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => step.onAction?.() ?? navigate(step.navigateTo)}
                    aria-label={step.actionLabel}
                    sx={{ flexShrink: 0, minHeight: 36 }}
                  >
                    {step.actionLabel}
                  </Button>
                )}
              </Stack>
            ))}

            {truncated && (
              <>
                <Collapse in={expanded}>
                  <Stack spacing={1.5}>
                    {hiddenSteps.map(step => (
                      <Stack
                        key={step.id}
                        direction="row"
                        alignItems="center"
                        spacing={1.5}
                      >
                        <UncheckedIcon
                          fontSize="small"
                          sx={{ color: 'text.disabled', flexShrink: 0 }}
                          aria-label={t('a11y.pending')}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600}>
                            {step.label}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {step.subtitle}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => step.onAction?.() ?? navigate(step.navigateTo)}
                          aria-label={step.actionLabel}
                          sx={{ flexShrink: 0, minHeight: 36 }}
                        >
                          {step.actionLabel}
                        </Button>
                      </Stack>
                    ))}
                  </Stack>
                </Collapse>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => setExpanded(!expanded)}
                  endIcon={expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                  sx={{ alignSelf: 'center', fontSize: '0.75rem' }}
                >
                  {expanded ? t('onboarding.showLess') : t('onboarding.showAllSteps', { count: hiddenSteps.length })}
                </Button>
              </>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Collapse>
  );
}
