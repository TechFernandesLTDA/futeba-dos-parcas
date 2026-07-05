import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';
import {
  AssignmentTurnedIn as TriagedIcon,
  BugReport as BugIcon,
  ContentCopy as DuplicateIcon,
  ErrorOutline as CriticalIcon,
  GitHub as GitHubIcon,
  OpenInNew as OpenInNewIcon,
  PublishedWithChanges as ReleasedIcon,
  RateReview as EmptyIcon,
  SupportAgent as SupportIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '../../components/common/PageContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { LoadingState } from '../../components/common/LoadingState';
import { isValidUrl } from '../../utils/validation';
import {
  FEEDBACK_STATUSES,
  type AdminFeedbackItem,
  type AdminFeedbackUpdateInput,
  type FeedbackSeverity,
  type FeedbackStatus,
  useAdminFeedbackQueue,
} from '../../hooks/useAdminFeedbackQueue';
import { useToast } from '../../contexts/ToastContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

type StatusFilter = 'all' | FeedbackStatus;
type SeverityFilter = 'all' | FeedbackSeverity;

interface FeedbackFormState {
  status: FeedbackStatus;
  assignee: string;
  githubIssueNumber: string;
  githubIssueUrl: string;
  githubPrNumber: string;
  githubPrUrl: string;
  releaseVersion: string;
  releaseUrl: string;
  suspectedDuplicateOf: string;
  adminNotes: string;
}

const STATUS_META: Record<FeedbackStatus, { label: string; color: 'default' | 'info' | 'warning' | 'success' | 'error' }> = {
  open: { label: 'Aberto', color: 'default' },
  triaged: { label: 'Triado', color: 'info' },
  issue_created: { label: 'Issue criada', color: 'warning' },
  in_progress: { label: 'Em progresso', color: 'info' },
  released: { label: 'Publicado', color: 'success' },
  rejected: { label: 'Rejeitado', color: 'error' },
};

const SEVERITY_META: Record<FeedbackSeverity, { label: string; color: 'default' | 'info' | 'warning' | 'error' }> = {
  low: { label: 'Baixa', color: 'default' },
  medium: { label: 'Media', color: 'info' },
  high: { label: 'Alta', color: 'warning' },
  critical: { label: 'Critica', color: 'error' },
};

const TYPE_LABELS: Record<string, string> = {
  bug: 'Bug',
  problem: 'Problema',
  improvement: 'Melhoria',
  suggestion: 'Sugestao',
};

function formatDateTime(value?: Date): string {
  if (!value || Number.isNaN(value.getTime())) return 'Sem data';
  return value.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function extractContextText(context: Record<string, unknown>, key: string): string {
  const value = context[key];
  return typeof value === 'string' ? value : '';
}

function normalizeDuplicateKey(feedback: AdminFeedbackItem): string {
  return `${feedback.type}:${feedback.title}`.trim().toLowerCase().replace(/\s+/g, ' ');
}

function toFormState(feedback: AdminFeedbackItem): FeedbackFormState {
  return {
    status: feedback.status,
    assignee: feedback.assignee,
    githubIssueNumber: feedback.githubIssueNumber?.toString() ?? '',
    githubIssueUrl: feedback.githubIssueUrl ?? '',
    githubPrNumber: feedback.githubPrNumber?.toString() ?? '',
    githubPrUrl: feedback.githubPrUrl ?? '',
    releaseVersion: feedback.releaseVersion ?? '',
    releaseUrl: feedback.releaseUrl ?? '',
    suspectedDuplicateOf: feedback.suspectedDuplicateOf ?? '',
    adminNotes: feedback.adminNotes ?? '',
  };
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : NaN;
}

function SummaryCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: 'primary' | 'warning' | 'success' | 'error';
}) {
  return (
    <Card>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ color: `${color}.main`, display: 'flex' }}>{icon}</Box>
        <Box>
          <Typography variant="h5" fontWeight={700}>{value}</Typography>
          <Typography variant="body2" color="text.secondary">{label}</Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

export const FeedbackOperationsScreen: React.FC = () => {
  useDocumentTitle('Operacao de feedbacks');
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { showError } = useToast();
  const { feedbacks, loading, savingId, error, summary, updateFeedback } = useAdminFeedbackQueue();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedFeedback, setSelectedFeedback] = useState<AdminFeedbackItem | null>(null);
  const [form, setForm] = useState<FeedbackFormState | null>(null);

  const duplicateKeys = useMemo(() => {
    const counts = new Map<string, number>();
    feedbacks.forEach((feedback) => {
      const key = normalizeDuplicateKey(feedback);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [feedbacks]);

  const filteredFeedbacks = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return feedbacks.filter((feedback) => {
      if (statusFilter !== 'all' && feedback.status !== statusFilter) return false;
      if (severityFilter !== 'all' && feedback.severity !== severityFilter) return false;
      if (!normalizedSearch) return true;
      const haystack = [
        feedback.id,
        feedback.title,
        feedback.description,
        feedback.userEmail,
        feedback.userId,
        feedback.assignee,
        feedback.githubIssueNumber?.toString(),
        feedback.githubIssueUrl,
        feedback.githubPrNumber?.toString(),
        feedback.githubPrUrl,
        feedback.releaseVersion,
        extractContextText(feedback.context, 'route'),
        extractContextText(feedback.context, 'errorId'),
      ].join(' ').toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [feedbacks, search, severityFilter, statusFilter]);

  const criticalOpenFeedbacks = useMemo(
    () => feedbacks.filter((feedback) => feedback.severity === 'critical' && feedback.status !== 'released' && feedback.status !== 'rejected'),
    [feedbacks],
  );

  const handleOpenDialog = (feedback: AdminFeedbackItem) => {
    setSelectedFeedback(feedback);
    setForm(toFormState(feedback));
  };

  const handleCloseDialog = () => {
    setSelectedFeedback(null);
    setForm(null);
  };

  const handleSubmit = async () => {
    if (!selectedFeedback || !form) return;

    const githubIssueNumber = parseOptionalNumber(form.githubIssueNumber);
    const githubPrNumber = parseOptionalNumber(form.githubPrNumber);
    if (Number.isNaN(githubIssueNumber) || Number.isNaN(githubPrNumber)) {
      showError('Issue e PR devem ser numeros positivos.');
      return;
    }

    const urlFields = [form.githubIssueUrl, form.githubPrUrl, form.releaseUrl].filter((value) => value.trim());
    if (urlFields.some((value) => !isValidUrl(value))) {
      showError('Revise os links informados.');
      return;
    }

    const payload: AdminFeedbackUpdateInput = {
      status: form.status,
      assignee: form.assignee,
      githubIssueNumber,
      githubIssueUrl: form.githubIssueUrl,
      githubPrNumber,
      githubPrUrl: form.githubPrUrl,
      releaseVersion: form.releaseVersion,
      releaseUrl: form.releaseUrl,
      suspectedDuplicateOf: form.suspectedDuplicateOf,
      adminNotes: form.adminNotes,
    };

    const ok = await updateFeedback(selectedFeedback.id, payload);
    if (ok) handleCloseDialog();
  };

  const renderFeedbackCard = (feedback: AdminFeedbackItem) => {
    const duplicateCount = duplicateKeys.get(normalizeDuplicateKey(feedback)) ?? 0;
    const isPossibleDuplicate = duplicateCount > 1 || Boolean(feedback.suspectedDuplicateOf);
    const route = extractContextText(feedback.context, 'route');
    const errorId = extractContextText(feedback.context, 'errorId');
    const source = extractContextText(feedback.context, 'source');

    return (
      <Card key={feedback.id} variant="outlined">
        <CardContent>
          <Stack spacing={1.5}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }}>
              <Chip icon={<BugIcon fontSize="small" />} label={TYPE_LABELS[feedback.type] ?? feedback.type} size="small" />
              <Chip label={STATUS_META[feedback.status].label} color={STATUS_META[feedback.status].color} size="small" />
              <Chip label={SEVERITY_META[feedback.severity].label} color={SEVERITY_META[feedback.severity].color} size="small" />
              {feedback.legacyStatus && (
                <Chip label={`Legado: ${feedback.legacyStatus}`} size="small" variant="outlined" />
              )}
              {isPossibleDuplicate && (
                <Tooltip title="Possivel duplicidade por titulo/tipo ou campo de duplicidade preenchido">
                  <Chip icon={<DuplicateIcon fontSize="small" />} label="Possivel duplicado" color="warning" size="small" />
                </Tooltip>
              )}
            </Stack>

            <Box>
              <Typography variant="subtitle1" fontWeight={700}>{feedback.title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {feedback.description || 'Sem descricao.'}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Chip label={`Criado: ${formatDateTime(feedback.createdAt)}`} size="small" variant="outlined" />
              <Chip label={`Usuario: ${feedback.userEmail || feedback.userId || 'nao informado'}`} size="small" variant="outlined" />
              <Chip label={`Responsavel: ${feedback.assignee || 'sem responsavel'}`} size="small" variant="outlined" />
              {route && <Chip label={`Rota: ${route}`} size="small" variant="outlined" />}
              {source && <Chip label={`Origem: ${source}`} size="small" variant="outlined" />}
              {errorId && <Chip label={`Erro: ${errorId}`} size="small" variant="outlined" color="error" />}
            </Stack>

            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {feedback.githubIssueUrl && isValidUrl(feedback.githubIssueUrl) && (
                <Button size="small" startIcon={<GitHubIcon />} endIcon={<OpenInNewIcon />} href={feedback.githubIssueUrl} target="_blank" rel="noopener noreferrer">
                  Issue {feedback.githubIssueNumber ? `#${feedback.githubIssueNumber}` : ''}
                </Button>
              )}
              {feedback.githubPrUrl && isValidUrl(feedback.githubPrUrl) && (
                <Button size="small" startIcon={<GitHubIcon />} endIcon={<OpenInNewIcon />} href={feedback.githubPrUrl} target="_blank" rel="noopener noreferrer">
                  PR {feedback.githubPrNumber ? `#${feedback.githubPrNumber}` : ''}
                </Button>
              )}
              {feedback.releaseUrl && isValidUrl(feedback.releaseUrl) && (
                <Button size="small" startIcon={<ReleasedIcon />} endIcon={<OpenInNewIcon />} href={feedback.releaseUrl} target="_blank" rel="noopener noreferrer">
                  Release {feedback.releaseVersion}
                </Button>
              )}
              <Button
                variant="contained"
                size="small"
                onClick={() => handleOpenDialog(feedback)}
                disabled={savingId === feedback.id}
                startIcon={savingId === feedback.id ? <CircularProgress size={16} /> : <TriagedIcon />}
              >
                Triar
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    );
  };

  return (
    <Box sx={{ pb: 4 }}>
      <ScreenHeader title="Operacao de feedbacks" onBack={() => navigate('/admin/users')} />
      <PageContainer maxWidth="dashboard">
        <Stack spacing={2}>
          <Alert severity="info">
            Fila operacional de feedbacks e erros reportados em <Link href="/settings/feedbacks">user_feedback</Link>. Status padrao: open, triaged, issue_created, in_progress, released, rejected.
          </Alert>

          {criticalOpenFeedbacks.length > 0 && (
            <Alert severity="error" icon={<CriticalIcon />}>
              {criticalOpenFeedbacks.length} feedback(s) critico(s) ainda precisam de acao.
            </Alert>
          )}

          <Grid container spacing={2}>
            <Grid xs={6} md={3}>
              <SummaryCard label="Na fila" value={summary.total} icon={<SupportIcon />} color="primary" />
            </Grid>
            <Grid xs={6} md={3}>
              <SummaryCard label="Abertos" value={summary.open} icon={<TriagedIcon />} color="warning" />
            </Grid>
            <Grid xs={6} md={3}>
              <SummaryCard label="Criticos" value={summary.critical} icon={<CriticalIcon />} color="error" />
            </Grid>
            <Grid xs={6} md={3}>
              <SummaryCard label="Publicados" value={summary.released} icon={<ReleasedIcon />} color="success" />
            </Grid>
          </Grid>

          <Card>
            <CardContent>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
                <TextField
                  label="Buscar"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Titulo, usuario, issue, rota ou erro"
                  fullWidth
                />
                <FormControl fullWidth={isMobile} sx={{ minWidth: 180 }}>
                  <InputLabel id="feedback-status-filter-label">Status</InputLabel>
                  <Select
                    labelId="feedback-status-filter-label"
                    label="Status"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                  >
                    <MenuItem value="all">Todos</MenuItem>
                    {FEEDBACK_STATUSES.map((status) => (
                      <MenuItem key={status} value={status}>{STATUS_META[status].label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <ToggleButtonGroup
                  value={severityFilter}
                  exclusive
                  onChange={(_, value: SeverityFilter | null) => value && setSeverityFilter(value)}
                  size="small"
                  sx={{ flexWrap: 'wrap' }}
                >
                  <ToggleButton value="all">Todas</ToggleButton>
                  <ToggleButton value="critical">Critica</ToggleButton>
                  <ToggleButton value="high">Alta</ToggleButton>
                  <ToggleButton value="medium">Media</ToggleButton>
                  <ToggleButton value="low">Baixa</ToggleButton>
                </ToggleButtonGroup>
              </Stack>
            </CardContent>
          </Card>

          {loading ? (
            <LoadingState shimmerCount={5} itemType="CARD" />
          ) : error ? (
            <ErrorState message={error} />
          ) : filteredFeedbacks.length === 0 ? (
            <EmptyState icon={<EmptyIcon />} title="Nenhum feedback encontrado" description="A fila atual nao tem itens para os filtros selecionados." />
          ) : (
            <Stack spacing={1.5}>
              {filteredFeedbacks.map(renderFeedbackCard)}
            </Stack>
          )}
        </Stack>
      </PageContainer>

      <Dialog open={Boolean(selectedFeedback && form)} onClose={handleCloseDialog} fullWidth maxWidth="md" fullScreen={isMobile}>
        <DialogTitle>Triar feedback</DialogTitle>
        {selectedFeedback && form && (
          <DialogContent dividers>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Alert severity={selectedFeedback.severity === 'critical' ? 'error' : 'info'}>
                {selectedFeedback.title}
              </Alert>
              <FormControl fullWidth>
                <InputLabel id="feedback-status-label">Status</InputLabel>
                <Select
                  labelId="feedback-status-label"
                  label="Status"
                  value={form.status}
                  onChange={(event) => setForm({ ...form, status: event.target.value as FeedbackStatus })}
                >
                  {FEEDBACK_STATUSES.map((status) => (
                    <MenuItem key={status} value={status}>{STATUS_META[status].label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField label="Responsavel" value={form.assignee} onChange={(event) => setForm({ ...form, assignee: event.target.value })} fullWidth />
              <Grid container spacing={2}>
                <Grid xs={12} md={4}>
                  <TextField label="Issue" value={form.githubIssueNumber} onChange={(event) => setForm({ ...form, githubIssueNumber: event.target.value })} fullWidth inputMode="numeric" />
                </Grid>
                <Grid xs={12} md={8}>
                  <TextField label="Link da issue" value={form.githubIssueUrl} onChange={(event) => setForm({ ...form, githubIssueUrl: event.target.value })} fullWidth />
                </Grid>
                <Grid xs={12} md={4}>
                  <TextField label="PR" value={form.githubPrNumber} onChange={(event) => setForm({ ...form, githubPrNumber: event.target.value })} fullWidth inputMode="numeric" />
                </Grid>
                <Grid xs={12} md={8}>
                  <TextField label="Link do PR" value={form.githubPrUrl} onChange={(event) => setForm({ ...form, githubPrUrl: event.target.value })} fullWidth />
                </Grid>
                <Grid xs={12} md={4}>
                  <TextField label="Versao release" value={form.releaseVersion} onChange={(event) => setForm({ ...form, releaseVersion: event.target.value })} fullWidth />
                </Grid>
                <Grid xs={12} md={8}>
                  <TextField label="Link da release" value={form.releaseUrl} onChange={(event) => setForm({ ...form, releaseUrl: event.target.value })} fullWidth />
                </Grid>
              </Grid>
              <TextField
                label="Duplicado de"
                value={form.suspectedDuplicateOf}
                onChange={(event) => setForm({ ...form, suspectedDuplicateOf: event.target.value })}
                placeholder="ID do feedback, issue ou palavra-chave"
                fullWidth
              />
              <TextField
                label="Notas internas"
                value={form.adminNotes}
                onChange={(event) => setForm({ ...form, adminNotes: event.target.value })}
                fullWidth
                multiline
                minRows={3}
              />
            </Stack>
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={Boolean(savingId)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!selectedFeedback || savingId === selectedFeedback.id}
            startIcon={selectedFeedback && savingId === selectedFeedback.id ? <CircularProgress size={16} /> : <TriagedIcon />}
          >
            Salvar triagem
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
