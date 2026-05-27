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

const FEEDBACK_TYPES = [
  { value: 'bug', label: 'Bug', icon: <BugIcon />, description: 'Algo quebrado' },
  { value: 'problem', label: 'Problema', icon: <ProblemIcon />, description: 'UX ruim/lento' },
  { value: 'improvement', label: 'Melhoria', icon: <ImprovementIcon />, description: 'Pode ser melhor' },
  { value: 'suggestion', label: 'Sugestão', icon: <SuggestionIcon />, description: 'Nova ideia' },
] as const;

const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
  { value: 'critical', label: 'Crítica' },
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
      PaperProps={{
        sx: {
          borderRadius: { xs: 0, sm: 4 },
          ...(fullScreen && { margin: 0, maxHeight: '100%' }),
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography variant="h5" fontWeight={700}>
          {submitted ? 'Feedback Enviado' : 'Enviar Feedback'}
        </Typography>
        <IconButton onClick={handleClose} disabled={loading} aria-label="Fechar" size="small">
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
                '& .MuiToggleButtonGroup-grouped': {
                  border: `1px solid ${theme.palette.divider} !important`,
                  borderRadius: '12px !important',
                },
              }}
            >
              {FEEDBACK_TYPES.map(({ value, label, icon }) => (
                <ToggleButton
                  key={value}
                  value={value}
                  aria-label={label}
                  sx={{
                    flexDirection: 'column',
                    gap: 0.5,
                    py: 1.5,
                    textTransform: 'none',
                    '&.Mui-selected': {
                      bgcolor: alpha(theme.palette.primary.main, 0.08),
                      borderColor: `${theme.palette.primary.main} !important`,
                    },
                  }}
                >
                  {icon}
                  <Typography variant="caption" fontWeight={600}>
                    {label}
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
              placeholder="Resumo do seu feedback"
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
              placeholder="Descreva em detalhes o que você está reportando..."
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
                '& .MuiToggleButtonGroup-grouped': {
                  border: `1px solid ${theme.palette.divider} !important`,
                  borderRadius: '8px !important',
                  textTransform: 'none',
                  fontWeight: 500,
                  fontSize: '0.8125rem',
                  py: 0.75,
                },
              }}
            >
              {SEVERITY_OPTIONS.map(({ value, label }) => (
                <ToggleButton key={value} value={value} aria-label={label}>
                  {label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        )}
      </DialogContent>

      {!submitted && (
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={handleClose} disabled={loading} color="inherit" sx={{ borderRadius: 2 }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading || !currentUser}
            startIcon={loading ? <CircularProgress size={18} color="inherit" aria-hidden="true" /> : <SendIcon aria-hidden="true" />}
            sx={{ borderRadius: 2 }}
          >
            {loading ? 'Enviando...' : 'Enviar'}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};
