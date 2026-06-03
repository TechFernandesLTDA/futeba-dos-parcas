import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Box, Typography, IconButton, Chip,
  ToggleButton, ToggleButtonGroup, CircularProgress,
  useTheme, useMediaQuery, alpha,
} from '@mui/material';
import {
  Close as CloseIcon,
  BugReport as BugIcon,
  ReportProblem as ProblemIcon,
  Lightbulb as ImprovementIcon,
  AddComment as SuggestionIcon,
  Send as SendIcon,
  CheckCircleOutline as SuccessIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useFeedback, UserFeedback } from '../../hooks/useFeedback';
import { captureContext } from '../../utils/captureContext';
import { useTranslation } from 'react-i18next';

const FEEDBACK_TYPES = [
  { value: 'bug', labelKey: 'typeBug', descKey: 'typeBugDesc', icon: <BugIcon /> },
  { value: 'problem', labelKey: 'typeProblem', descKey: 'typeProblemDesc', icon: <ProblemIcon /> },
  { value: 'improvement', labelKey: 'typeImprovement', descKey: 'typeImprovementDesc', icon: <ImprovementIcon /> },
  { value: 'suggestion', labelKey: 'typeSuggestion', descKey: 'typeSuggestionDesc', icon: <SuggestionIcon /> },
] as const;

const SEVERITY_OPTIONS = [
  { value: 'low', labelKey: 'severityLow' },
  { value: 'medium', labelKey: 'severityMedium' },
  { value: 'high', labelKey: 'severityHigh' },
  { value: 'critical', labelKey: 'severityCritical' },
] as const;

interface FeedbackDialogProps {
  open: boolean;
  onClose: () => void;
}

export const FeedbackDialog: React.FC<FeedbackDialogProps> = ({ open, onClose }) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const { currentUser } = useAuth();
  const { submitFeedback, loading } = useFeedback();

  const [feedbackType, setFeedbackType] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { t } = useTranslation();

  const resetForm = () => {
    setFeedbackType('');
    setTitle('');
    setDescription('');
    setSeverity('medium');
    setErrors({});
    setSubmitted(false);
  };

  const handleClose = () => {
    if (!loading) {
      resetForm();
      onClose();
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!feedbackType) newErrors.type = 'Selecione o tipo de feedback';
    if (!title.trim()) newErrors.title = 'Título é obrigatório';
    if (title.trim().length > 80) newErrors.title = 'Título deve ter no máximo 80 caracteres';
    if (!description.trim()) newErrors.description = 'Descrição é obrigatória';
    if (description.trim().length > 2000) newErrors.description = 'Descrição deve ter no máximo 2000 caracteres';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !currentUser) return;
    const result = await submitFeedback({
      type: feedbackType as UserFeedback['type'],
      title: title.trim(),
      description: description.trim(),
      severity: severity as UserFeedback['severity'],
      context: captureContext() as unknown as Record<string, unknown>,
    });
    if (result) {
      setSubmitted(true);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullScreen={fullScreen}
      maxWidth="sm"
      fullWidth
      aria-labelledby="feedback-dialog-title"
      PaperProps={{
        sx: {
          borderRadius: { xs: 0, sm: 4 },
          ...(fullScreen && { margin: 0, maxHeight: '100%' }),
        },
      }}
    >
      <DialogTitle id="feedback-dialog-title" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography variant="h5" fontWeight={700}>
          {submitted ? 'Feedback Enviado' : 'Enviar Feedback'}
        </Typography>
        <IconButton onClick={handleClose} disabled={loading} aria-label={t('a11y.close')} size="small">
          <CloseIcon aria-hidden="true" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ pt: 2 }}>
        {submitted ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <SuccessIcon sx={{ fontSize: 64, color: theme.palette.success.main, mb: 2 }} aria-hidden="true" />
            <Typography variant="h6" gutterBottom>
              Feedback enviado!
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Agradecemos sua contribuição. Nossa equipe analisará seu feedback.
            </Typography>
            <Chip
              label='Acompanhe em "Configurações > Meus feedbacks"'
              variant="outlined"
              color="primary"
              sx={{ fontWeight: 500 }}
            />
            <Box sx={{ mt: 3 }}>
              <Button variant="contained" onClick={handleClose}>
                Fechar
              </Button>
            </Box>
          </Box>
        ) : (
          <Box component="form" noValidate>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ mt: 0.5 }}>
              Tipo de feedback
            </Typography>
            <ToggleButtonGroup
              value={feedbackType}
              exclusive
              onChange={(_, val) => {
                if (val !== null) {
                  setFeedbackType(val);
                  setErrors((prev) => ({ ...prev, type: '' }));
                }
              }}
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 1,
                mb: errors.type ? 0.5 : 2,
                // #2144: especificidade dobrada (classe repetida) vence as regras
                // de border-collapse do MUI ToggleButtonGroup sem `!important`.
                '& .MuiToggleButtonGroup-grouped.MuiToggleButtonGroup-grouped': {
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: '12px',
                },
              }}
            >
              {FEEDBACK_TYPES.map(({ value, labelKey, icon }) => (
                <ToggleButton
                  key={value}
                  value={value}
                  aria-label={t(`feedback.${labelKey}`)}
                  sx={{
                    flexDirection: 'column',
                    gap: 0.5,
                    py: 1.5,
                    textTransform: 'none',
                    '&&.Mui-selected': {
                      bgcolor: alpha(theme.palette.primary.main, 0.08),
                      borderColor: theme.palette.primary.main,
                    },
                  }}
                >
                  {icon}
                  <Typography variant="caption" fontWeight={600}>
                    {t(`feedback.${labelKey}`)}
                  </Typography>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            {errors.type && (
              <Typography variant="caption" color="error" sx={{ mb: 1.5, display: 'block', ml: 0.5 }}>
                {errors.type}
              </Typography>
            )}

            <TextField
              label="Título"
              placeholder={t('placeholder.feedbackSummary')}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setErrors((prev) => ({ ...prev, title: '' }));
              }}
              error={!!errors.title}
              helperText={errors.title || `${title.length}/80`}
              fullWidth
              margin="normal"
              inputProps={{ maxLength: 80 }}
              disabled={loading}
            />

            <TextField
              label="Descrição"
              placeholder={t('placeholder.feedbackDescription')}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setErrors((prev) => ({ ...prev, description: '' }));
              }}
              error={!!errors.description}
              helperText={errors.description || `${description.length}/2000`}
              fullWidth
              multiline
              rows={5}
              margin="normal"
              inputProps={{ maxLength: 2000 }}
              disabled={loading}
            />

            <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ mt: 2 }}>
              Severidade
            </Typography>
            <ToggleButtonGroup
              value={severity}
              exclusive
              onChange={(_, val) => {
                if (val !== null) setSeverity(val);
              }}
              size="small"
              fullWidth
              sx={{
                // #2144: especificidade dobrada vence o border-collapse do MUI sem !important
                '& .MuiToggleButtonGroup-grouped.MuiToggleButtonGroup-grouped': {
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: '8px',
                  textTransform: 'none',
                  fontWeight: 500,
                  fontSize: '0.8125rem',
                  py: 0.75,
                },
              }}
            >
              {SEVERITY_OPTIONS.map(({ value, labelKey }) => (
                <ToggleButton key={value} value={value} aria-label={t(`feedback.${labelKey}`)}>
                  {t(`feedback.${labelKey}`)}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        )}
      </DialogContent>

      {!submitted && (
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={handleClose} disabled={loading} color="inherit" sx={{ borderRadius: 2 }}>
            {t('feedback.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading || !currentUser}
            startIcon={loading ? <CircularProgress size={18} color="inherit" aria-hidden="true" /> : <SendIcon aria-hidden="true" />}
            sx={{ borderRadius: 2 }}
          >
            {loading ? t('feedback.sending') : t('feedback.submit')}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};
