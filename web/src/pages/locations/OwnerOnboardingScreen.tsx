import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Business as BusinessIcon,
} from '@mui/icons-material';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import PageContainer from '../../components/common/PageContainer';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { db } from '../../services/firebase';
import { requestVenueOwnerOnboarding, type VenueOwnerOnboardingStatus } from '../../services/cloudFunctions';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import { createLogger } from '../../utils/logger';
import { getFunctionsErrorMessage } from '../../utils/firebaseErrors';
import { formatCnpj, isValidCnpj, stripCnpj } from '../../utils/cnpjValidator';
import { useHideMobileTopBar } from '../../hooks/useMobileTopBarVisibility';

const logger = createLogger('OwnerOnboardingScreen');

interface OnboardingDoc {
  status?: VenueOwnerOnboardingStatus;
  contactName?: string;
  contactEmail?: string;
  phone?: string;
  businessName?: string;
  commercialDocument?: string;
  cnpjMasked?: string;
  notes?: string;
  reviewReason?: string;
  submittedAt?: Date | null;
  reviewedAt?: Date | null;
}

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  return null;
};

const statusColor = (status?: VenueOwnerOnboardingStatus): 'default' | 'info' | 'success' | 'warning' | 'error' => {
  if (status === 'APPROVED') return 'success';
  if (status === 'IN_REVIEW') return 'info';
  if (status === 'REJECTED') return 'warning';
  if (status === 'SUSPENDED' || status === 'CANCELLED') return 'error';
  return 'default';
};

export const OwnerOnboardingScreen: React.FC = () => {
  useHideMobileTopBar();
  const { t, i18n } = useTranslation();
  useDocumentTitle(t('ownerOnboarding.pageTitle'));
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const locale = i18n.resolvedLanguage || i18n.language || navigator.language;
  const statusLabels: Record<VenueOwnerOnboardingStatus, string> = {
    LEAD: t('ownerOnboarding.statusLead'),
    IN_REVIEW: t('ownerOnboarding.statusInReview'),
    APPROVED: t('ownerOnboarding.statusApproved'),
    REJECTED: t('ownerOnboarding.statusRejected'),
    SUSPENDED: t('ownerOnboarding.statusSuspended'),
    CANCELLED: t('ownerOnboarding.statusCancelled'),
  };
  const navigate = useNavigate();
  const goBack = useNavigateBack('/settings');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [onboarding, setOnboarding] = useState<OnboardingDoc | null>(null);
  const [contactName, setContactName] = useState(user?.name || '');
  const [contactEmail, setContactEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [commercialDocument, setCommercialDocument] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [notes, setNotes] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return undefined;
    }
    const ref = doc(db, 'venue_owner_onboarding', user.id);
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const next = {
            status: data.status as VenueOwnerOnboardingStatus | undefined,
            contactName: typeof data.contact_name === 'string' ? data.contact_name : undefined,
            contactEmail: typeof data.contact_email === 'string' ? data.contact_email : undefined,
            phone: typeof data.phone === 'string' ? data.phone : undefined,
            businessName: typeof data.business_name === 'string' ? data.business_name : undefined,
            commercialDocument: typeof data.commercial_document === 'string' ? data.commercial_document : undefined,
            cnpjMasked: typeof data.cnpj_masked === 'string' ? data.cnpj_masked : undefined,
            notes: typeof data.notes === 'string' ? data.notes : undefined,
            reviewReason: typeof data.review_reason === 'string' ? data.review_reason : undefined,
            submittedAt: toDate(data.submitted_at),
            reviewedAt: toDate(data.reviewed_at),
          };
          setOnboarding(next);
          setContactName(next.contactName || user.name || '');
          setContactEmail(next.contactEmail || user.email || '');
          setPhone(next.phone || '');
          setBusinessName(next.businessName || '');
          setCommercialDocument(next.commercialDocument || '');
          setNotes(next.notes || '');
        }
        setLoading(false);
      },
      (error) => {
        logger.error('Error loading venue owner onboarding:', error);
        showError(t('ownerOnboarding.loadError'));
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [showError, t, user]);

  // CNPJ é opcional: submit permitido quando vazio OU válido (#3188)
  const cnpjDigits = stripCnpj(cnpj);
  const cnpjInvalid = cnpjDigits.length > 0 && !isValidCnpj(cnpjDigits);

  const handleSubmit = async () => {
    if (!contactName.trim()) {
      showError(t('ownerOnboarding.contactNameRequired'));
      return;
    }
    if (!contactEmail.trim() && !phone.trim()) {
      showError(t('ownerOnboarding.contactRequired'));
      return;
    }
    if (cnpjInvalid) {
      showError(t('ownerOnboarding.cnpjInvalid'));
      return;
    }
    if (!termsAccepted) {
      showError(t('ownerOnboarding.termsRequired'));
      return;
    }
    setSubmitting(true);
    try {
      await requestVenueOwnerOnboarding({
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim() || null,
        phone: phone.trim() || null,
        businessName: businessName.trim() || null,
        commercialDocument: commercialDocument.trim() || null,
        cnpj: cnpjDigits || null,
        notes: notes.trim() || null,
        termsAccepted: true,
      });
      showSuccess(t('ownerOnboarding.submitSuccess'));
      setTermsAccepted(false);
    } catch (error) {
      logger.error('Error submitting venue owner onboarding:', error);
      const code = (error as { code?: string })?.code || '';
      // Anti-enumeration: mensagem genérica quando o CNPJ colide com outra conta
      if (code === 'functions/already-exists' || code === 'already-exists') {
        showError(t('ownerOnboarding.cnpjAlreadyExists'));
      } else {
        showError(getFunctionsErrorMessage(error, 'requestVenueOwnerOnboarding', t('ownerOnboarding.submitError')));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const currentStatus = onboarding?.status || 'LEAD';
  const approved = currentStatus === 'APPROVED';
  const locked = currentStatus === 'SUSPENDED' || currentStatus === 'CANCELLED';

  return (
    <Box sx={{ pb: 4 }}>
      <Box sx={{ position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 10, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', p: 1 }}>
          <IconButton onClick={goBack} aria-label={t('common.back')}>
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1 }}>
            {t('ownerOnboarding.headerTitle')}
          </Typography>
        </Box>
      </Box>

      <PageContainer maxWidth="form">
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <BusinessIcon color="primary" />
              <Typography variant="h6">{t('ownerOnboarding.cardTitle')}</Typography>
              <Chip label={statusLabels[currentStatus]} color={statusColor(currentStatus)} size="small" sx={{ ml: 'auto' }} />
            </Box>
            <Typography variant="body2" color="text.secondary">
              {t('ownerOnboarding.description')}
            </Typography>
          </CardContent>
        </Card>

        {approved && (
          <Alert severity="success" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => navigate('/locations')}>{t('ownerOnboarding.manageAction')}</Button>}>
            {t('ownerOnboarding.approvedAlert')}
          </Alert>
        )}
        {onboarding?.reviewReason && (
          <Alert severity={currentStatus === 'REJECTED' ? 'warning' : 'info'} sx={{ mb: 2 }}>
            {t('ownerOnboarding.reviewReason', { reason: onboarding.reviewReason })}
          </Alert>
        )}

        <Card>
          <CardContent sx={{ display: 'grid', gap: 2 }}>
            {loading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={20} />
                <Typography variant="body2">{t('ownerOnboarding.loading')}</Typography>
              </Box>
            ) : (
              <>
                <TextField
                  label={t('ownerOnboarding.contactNameLabel')}
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                  disabled={submitting || approved || locked}
                  inputProps={{ maxLength: 120 }}
                  required
                />
                <TextField
                  label={t('ownerOnboarding.contactEmailLabel')}
                  type="email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  disabled={submitting || approved || locked}
                  inputProps={{ maxLength: 254 }}
                />
                <TextField
                  label={t('ownerOnboarding.phoneLabel')}
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  disabled={submitting || approved || locked}
                  inputProps={{ maxLength: 40 }}
                  helperText={t('ownerOnboarding.contactHelper')}
                />
                <TextField
                  label={t('ownerOnboarding.businessNameLabel')}
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  disabled={submitting || approved || locked}
                  inputProps={{ maxLength: 120 }}
                />
                <TextField
                  label={t('ownerOnboarding.cnpjLabel')}
                  value={cnpj}
                  onChange={(event) => setCnpj(formatCnpj(event.target.value))}
                  disabled={submitting || approved || locked}
                  error={cnpjInvalid}
                  helperText={
                    cnpjInvalid
                      ? t('ownerOnboarding.cnpjInvalid')
                      : onboarding?.cnpjMasked && !cnpj
                        ? t('ownerOnboarding.cnpjRegistered', { masked: onboarding.cnpjMasked })
                        : t('ownerOnboarding.cnpjHelper')
                  }
                  inputProps={{ maxLength: 18, inputMode: 'numeric', autoComplete: 'off' }}
                />
                <TextField
                  label={t('ownerOnboarding.commercialDocumentLabel')}
                  value={commercialDocument}
                  onChange={(event) => setCommercialDocument(event.target.value)}
                  disabled={submitting || approved || locked}
                  inputProps={{ maxLength: 64 }}
                  helperText={t('ownerOnboarding.commercialDocumentHelper')}
                />
                <TextField
                  label={t('ownerOnboarding.notesLabel')}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  disabled={submitting || approved || locked}
                  multiline
                  minRows={4}
                  inputProps={{ maxLength: 1000 }}
                />
                {!approved && !locked && (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={termsAccepted}
                        onChange={(event) => setTermsAccepted(event.target.checked)}
                        sx={{ p: 1.25 }}
                      />
                    }
                    label={t('ownerOnboarding.termsLabel')}
                    sx={{ alignItems: 'flex-start', minHeight: 44 }}
                  />
                )}
                <Button
                  variant="contained"
                  onClick={handleSubmit}
                  disabled={submitting || approved || locked}
                  startIcon={submitting ? <CircularProgress size={18} /> : undefined}
                >
                  {currentStatus === 'IN_REVIEW' ? t('ownerOnboarding.updateAction') : t('ownerOnboarding.submitAction')}
                </Button>
                {onboarding?.submittedAt && (
                  <Typography variant="caption" color="text.secondary">
                    {t('ownerOnboarding.lastSubmittedAt', {
                      date: onboarding.submittedAt.toLocaleString(locale),
                    })}
                  </Typography>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </PageContainer>
    </Box>
  );
};
