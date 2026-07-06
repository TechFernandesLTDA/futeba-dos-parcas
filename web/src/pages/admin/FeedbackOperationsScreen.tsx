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
import { useTranslation } from 'react-i18next';

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

const STATUS_COLORS: Record<FeedbackStatus, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  open: 'default',
  triaged: 'info',
  issue_created: 'warning',
  in_progress: 'info',
  released: 'success',
  rejected: 'error',
};

const SEVERITY_COLORS: Record<FeedbackSeverity, 'default' | 'info' | 'warning' | 'error'> = {
  low: 'default',
  medium: 'info',
  high: 'warning',
  critical: 'error',
};

function formatDateTime(value: Date | undefined, locale: string, fallback: string): string {
  if (!value || Number.isNaN(value.getTime())) return fallback;
  return value.toLocaleString(locale, {
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
  const { t, i18n } = useTranslation();
  useDocumentTitle(t('feedbackOperations.pageTitle'));
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { showError } = useToast();
  const locale = i18n.resolvedLanguage || i18n.language || navigator.language;
  const { feedbacks, loading, savingId, error, summary, updateFeedback } = useAdminFeedbackQueue();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedFeedback, setSelectedFeedback] = useState<AdminFeedbackItem | null>(null);
  const [form, setForm] = useState<FeedbackFormState | null>(null);
  const statusMeta = useMemo<Record<FeedbackStatus, { label: string; color: 'default' | 'info' | 'warning' | 'success' | 'error' }>>(() => ({
    open: { label: t('feedbackOperations.status.open'), color: STATUS_COLORS.open },
    triaged: { label: t('feedbackOperations.status.triaged'), color: STATUS_COLORS.triaged },
    issue_created: { label: t('feedbackOperations.status.issue_created'), color: STATUS_COLORS.issue_created },
    in_progress: { label: t('feedbackOperations.status.in_progress'), color: STATUS_COLORS.in_progress },
    released: { label: t('feedbackOperations.status.released'), color: STATUS_COLORS.released },
    rejected: { label: t('feedbackOperations.status.rejected'), color: STATUS_COLORS.rejected },
  }), [t]);
  const severityMeta = useMemo<Record<FeedbackSeverity, { label: string; color: 'default' | 'info' | 'warning' | 'error' }>>(() => ({
    low: { label: t('feedbackOperations.severity.low'), color: SEVERITY_COLORS.low },
    medium: { label: t('feedbackOperations.severity.medium'), color: SEVERITY_COLORS.medium },
    high: { label: t('feedbackOperations.severity.high'), color: SEVERITY_COLORS.high },
    critical: { label: t('feedbackOperations.severity.critical'), color: SEVERITY_COLORS.critical },
  }), [t]);
  const typeLabels = useMemo<Record<string, string>>(() => ({
    bug: t('feedbackOperations.type.bug'),
    problem: t('feedbackOperations.type.problem'),
    improvement: t('feedbackOperations.type.improvement'),
    suggestion: t('feedbackOperations.type.suggestion'),
  }), [t]);

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
      showError(t('feedbackOperations.errors.issuePrPositive'));
      return;
    }

    const urlFields = [form.githubIssueUrl, form.githubPrUrl, form.releaseUrl].filter((value) => value.trim());
    if (urlFields.some((value) => !isValidUrl(value))) {
      showError(t('feedbackOperations.errors.invalidLinks'));
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
              <Chip icon={<BugIcon fontSize="small" />} label={typeLabels[feedback.type] ?? feedback.type} size="small" />
              <Chip label={statusMeta[feedback.status].label} color={statusMeta[feedback.status].color} size="small" />
              <Chip label={severityMeta[feedback.severity].label} color={severityMeta[feedback.severity].color} size="small" />
              {feedback.legacyStatus && (
                <Chip label={t('feedbackOperations.legacyStatus', { status: feedback.legacyStatus })} size="small" variant="outlined" />
              )}
              {isPossibleDuplicate && (
                <Tooltip title={t('feedbackOperations.possibleDuplicateTooltip')}>
                  <Chip icon={<DuplicateIcon fontSize="small" />} label={t('feedbackOperations.possibleDuplicate')} color="warning" size="small" />
                </Tooltip>
              )}
            </Stack>

            <Box>
              <Typography variant="subtitle1" fontWeight={700}>{feedback.title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {feedback.description || t('feedbackOperations.noDescription')}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Chip label={t('feedbackOperations.createdAt', { date: formatDateTime(feedback.createdAt, locale, t('feedbackOperations.noDate')) })} size="small" variant="outlined" />
              <Chip label={t('feedbackOperations.userLabel', { user: feedback.userEmail || feedback.userId || t('feedbackOperations.notInformed') })} size="small" variant="outlined" />
              <Chip label={t('feedbackOperations.assigneeLabel', { assignee: feedback.assignee || t('feedbackOperations.unassigned') })} size="small" variant="outlined" />
              {route && <Chip label={t('feedbackOperations.routeLabel', { route })} size="small" variant="outlined" />}
              {source && <Chip label={t('feedbackOperations.sourceLabel', { source })} size="small" variant="outlined" />}
              {errorId && <Chip label={t('feedbackOperations.errorLabel', { errorId })} size="small" variant="outlined" color="error" />}
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
                  {t('feedbackOperations.releaseButton', { version: feedback.releaseVersion })}
                </Button>
              )}
              <Button
                variant="contained"
                size="small"
                onClick={() => handleOpenDialog(feedback)}
                disabled={savingId === feedback.id}
                startIcon={savingId === feedback.id ? <CircularProgress size={16} /> : <TriagedIcon />}
              >
                {t('feedbackOperations.triageAction')}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    );
  };

  return (
    <Box sx={{ pb: 4 }}>
      <ScreenHeader title={t('feedbackOperations.pageTitle')} onBack={() => navigate('/admin/users')} />
      <PageContainer maxWidth="dashboard">
        <Stack spacing={2}>
          <Alert severity="info">
            {t('feedbackOperations.infoPrefix')}{' '}
            <Link href="/settings/feedbacks">user_feedback</Link>. {t('feedbackOperations.infoStatuses')}
          </Alert>

          {criticalOpenFeedbacks.length > 0 && (
            <Alert severity="error" icon={<CriticalIcon />}>
              {t('feedbackOperations.criticalAlert', { count: criticalOpenFeedbacks.length })}
            </Alert>
          )}

          <Grid container spacing={2}>
            <Grid xs={6} md={3}>
              <SummaryCard label={t('feedbackOperations.summary.inQueue')} value={summary.total} icon={<SupportIcon />} color="primary" />
            </Grid>
            <Grid xs={6} md={3}>
              <SummaryCard label={t('feedbackOperations.summary.open')} value={summary.open} icon={<TriagedIcon />} color="warning" />
            </Grid>
            <Grid xs={6} md={3}>
              <SummaryCard label={t('feedbackOperations.summary.critical')} value={summary.critical} icon={<CriticalIcon />} color="error" />
            </Grid>
            <Grid xs={6} md={3}>
              <SummaryCard label={t('feedbackOperations.summary.released')} value={summary.released} icon={<ReleasedIcon />} color="success" />
            </Grid>
          </Grid>

          <Card>
            <CardContent>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
                <TextField
                  label={t('feedbackOperations.searchLabel')}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t('feedbackOperations.searchPlaceholder')}
                  fullWidth
                />
                <FormControl fullWidth={isMobile} sx={{ minWidth: 180 }}>
                  <InputLabel id="feedback-status-filter-label">{t('feedbackOperations.statusLabel')}</InputLabel>
                  <Select
                    labelId="feedback-status-filter-label"
                    label={t('feedbackOperations.statusLabel')}
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                  >
                    <MenuItem value="all">{t('feedbackOperations.filterAll')}</MenuItem>
                    {FEEDBACK_STATUSES.map((status) => (
                      <MenuItem key={status} value={status}>{statusMeta[status].label}</MenuItem>
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
                  <ToggleButton value="all">{t('feedbackOperations.filterAllFeminine')}</ToggleButton>
                  <ToggleButton value="critical">{severityMeta.critical.label}</ToggleButton>
                  <ToggleButton value="high">{severityMeta.high.label}</ToggleButton>
                  <ToggleButton value="medium">{severityMeta.medium.label}</ToggleButton>
                  <ToggleButton value="low">{severityMeta.low.label}</ToggleButton>
                </ToggleButtonGroup>
              </Stack>
            </CardContent>
          </Card>

          {loading ? (
            <LoadingState shimmerCount={5} itemType="CARD" />
          ) : error ? (
            <ErrorState message={error} />
          ) : filteredFeedbacks.length === 0 ? (
            <EmptyState icon={<EmptyIcon />} title={t('feedbackOperations.emptyTitle')} description={t('feedbackOperations.emptyDescription')} />
          ) : (
            <Stack spacing={1.5}>
              {filteredFeedbacks.map(renderFeedbackCard)}
            </Stack>
          )}
        </Stack>
      </PageContainer>

      <Dialog open={Boolean(selectedFeedback && form)} onClose={handleCloseDialog} fullWidth maxWidth="md" fullScreen={isMobile}>
        <DialogTitle>{t('feedbackOperations.dialogTitle')}</DialogTitle>
        {selectedFeedback && form && (
          <DialogContent dividers>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Alert severity={selectedFeedback.severity === 'critical' ? 'error' : 'info'}>
                {selectedFeedback.title}
              </Alert>
              <FormControl fullWidth>
                <InputLabel id="feedback-status-label">{t('feedbackOperations.statusLabel')}</InputLabel>
                <Select
                  labelId="feedback-status-label"
                  label={t('feedbackOperations.statusLabel')}
                  value={form.status}
                  onChange={(event) => setForm({ ...form, status: event.target.value as FeedbackStatus })}
                >
                  {FEEDBACK_STATUSES.map((status) => (
                    <MenuItem key={status} value={status}>{statusMeta[status].label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField label={t('feedbackOperations.assigneeField')} value={form.assignee} onChange={(event) => setForm({ ...form, assignee: event.target.value })} fullWidth />
              <Grid container spacing={2}>
                <Grid xs={12} md={4}>
                  <TextField label={t('feedbackOperations.issueField')} value={form.githubIssueNumber} onChange={(event) => setForm({ ...form, githubIssueNumber: event.target.value })} fullWidth inputMode="numeric" />
                </Grid>
                <Grid xs={12} md={8}>
                  <TextField label={t('feedbackOperations.issueUrlField')} value={form.githubIssueUrl} onChange={(event) => setForm({ ...form, githubIssueUrl: event.target.value })} fullWidth />
                </Grid>
                <Grid xs={12} md={4}>
                  <TextField label={t('feedbackOperations.prField')} value={form.githubPrNumber} onChange={(event) => setForm({ ...form, githubPrNumber: event.target.value })} fullWidth inputMode="numeric" />
                </Grid>
                <Grid xs={12} md={8}>
                  <TextField label={t('feedbackOperations.prUrlField')} value={form.githubPrUrl} onChange={(event) => setForm({ ...form, githubPrUrl: event.target.value })} fullWidth />
                </Grid>
                <Grid xs={12} md={4}>
                  <TextField label={t('feedbackOperations.releaseVersionField')} value={form.releaseVersion} onChange={(event) => setForm({ ...form, releaseVersion: event.target.value })} fullWidth />
                </Grid>
                <Grid xs={12} md={8}>
                  <TextField label={t('feedbackOperations.releaseUrlField')} value={form.releaseUrl} onChange={(event) => setForm({ ...form, releaseUrl: event.target.value })} fullWidth />
                </Grid>
              </Grid>
              <TextField
                label={t('feedbackOperations.duplicateOfField')}
                value={form.suspectedDuplicateOf}
                onChange={(event) => setForm({ ...form, suspectedDuplicateOf: event.target.value })}
                placeholder={t('feedbackOperations.duplicatePlaceholder')}
                fullWidth
              />
              <TextField
                label={t('feedbackOperations.adminNotesField')}
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
          <Button onClick={handleCloseDialog} disabled={Boolean(savingId)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!selectedFeedback || savingId === selectedFeedback.id}
            startIcon={selectedFeedback && savingId === selectedFeedback.id ? <CircularProgress size={16} /> : <TriagedIcon />}
          >
            {t('feedbackOperations.saveAction')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
