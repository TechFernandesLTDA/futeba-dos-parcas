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
import PageContainer from '../../components/common/PageContainer';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { db } from '../../services/firebase';
import { requestVenueOwnerOnboarding, type VenueOwnerOnboardingStatus } from '../../services/cloudFunctions';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import { createLogger } from '../../utils/logger';
import { getFunctionsErrorMessage } from '../../utils/firebaseErrors';

const logger = createLogger('OwnerOnboardingScreen');

interface OnboardingDoc {
  status?: VenueOwnerOnboardingStatus;
  contactName?: string;
  contactEmail?: string;
  phone?: string;
  businessName?: string;
  commercialDocument?: string;
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

const statusLabel: Record<VenueOwnerOnboardingStatus, string> = {
  LEAD: 'Lead',
  IN_REVIEW: 'Em revisão',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
  SUSPENDED: 'Suspenso',
  CANCELLED: 'Cancelado',
};

const statusColor = (status?: VenueOwnerOnboardingStatus): 'default' | 'info' | 'success' | 'warning' | 'error' => {
  if (status === 'APPROVED') return 'success';
  if (status === 'IN_REVIEW') return 'info';
  if (status === 'REJECTED') return 'warning';
  if (status === 'SUSPENDED' || status === 'CANCELLED') return 'error';
  return 'default';
};

export const OwnerOnboardingScreen: React.FC = () => {
  useDocumentTitle('Onboarding comercial de quadra');
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
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
        showError('Não foi possível carregar seu onboarding comercial.');
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [showError, user]);

  const handleSubmit = async () => {
    if (!contactName.trim()) {
      showError('Informe o nome do responsável.');
      return;
    }
    if (!contactEmail.trim() && !phone.trim()) {
      showError('Informe email ou telefone comercial.');
      return;
    }
    if (!termsAccepted) {
      showError('Aceite os termos comerciais para enviar a solicitação.');
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
        notes: notes.trim() || null,
        termsAccepted: true,
      });
      showSuccess('Solicitação enviada para revisão do administrador.');
      setTermsAccepted(false);
    } catch (error) {
      logger.error('Error submitting venue owner onboarding:', error);
      showError(getFunctionsErrorMessage(error, 'requestVenueOwnerOnboarding', 'Não foi possível enviar a solicitação.'));
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
          <IconButton onClick={goBack} aria-label="Voltar">
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1 }}>
            Quero cadastrar minha quadra
          </Typography>
        </Box>
      </Box>

      <PageContainer maxWidth="form">
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <BusinessIcon color="primary" />
              <Typography variant="h6">Onboarding comercial</Typography>
              <Chip label={statusLabel[currentStatus]} color={statusColor(currentStatus)} size="small" sx={{ ml: 'auto' }} />
            </Box>
            <Typography variant="body2" color="text.secondary">
              Envie seus dados para virar dono de quadra no Futeba dos Parças. Um administrador revisa contato,
              cadastro comercial, termos e pendências antes de liberar publicação de quadras.
            </Typography>
          </CardContent>
        </Card>

        {approved && (
          <Alert severity="success" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => navigate('/locations')}>Gerenciar</Button>}>
            Sua conta de dono de quadra está aprovada. Faça login novamente se o menu de quadras ainda não aparecer.
          </Alert>
        )}
        {onboarding?.reviewReason && (
          <Alert severity={currentStatus === 'REJECTED' ? 'warning' : 'info'} sx={{ mb: 2 }}>
            Motivo da revisão: {onboarding.reviewReason}
          </Alert>
        )}

        <Card>
          <CardContent sx={{ display: 'grid', gap: 2 }}>
            {loading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={20} />
                <Typography variant="body2">Carregando solicitação...</Typography>
              </Box>
            ) : (
              <>
                <TextField
                  label="Responsável comercial"
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                  disabled={submitting || approved || locked}
                  inputProps={{ maxLength: 120 }}
                  required
                />
                <TextField
                  label="Email comercial"
                  type="email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  disabled={submitting || approved || locked}
                  inputProps={{ maxLength: 254 }}
                />
                <TextField
                  label="Telefone/WhatsApp"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  disabled={submitting || approved || locked}
                  inputProps={{ maxLength: 40 }}
                  helperText="Informe email ou telefone para o admin conseguir revisar."
                />
                <TextField
                  label="Nome da empresa/quadra"
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  disabled={submitting || approved || locked}
                  inputProps={{ maxLength: 120 }}
                />
                <TextField
                  label="Documento comercial (opcional)"
                  value={commercialDocument}
                  onChange={(event) => setCommercialDocument(event.target.value)}
                  disabled={submitting || approved || locked}
                  inputProps={{ maxLength: 64 }}
                  helperText="Use CNPJ/CPF ou observação que ajude o cadastro comercial."
                />
                <TextField
                  label="Observações para revisão"
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
                      />
                    }
                    label="Entendo que a publicação das quadras e a mensalidade dependem de aprovação administrativa."
                  />
                )}
                <Button
                  variant="contained"
                  onClick={handleSubmit}
                  disabled={submitting || approved || locked}
                  startIcon={submitting ? <CircularProgress size={18} /> : undefined}
                >
                  {currentStatus === 'IN_REVIEW' ? 'Atualizar solicitação' : 'Enviar para revisão'}
                </Button>
                {onboarding?.submittedAt && (
                  <Typography variant="caption" color="text.secondary">
                    Último envio: {onboarding.submittedAt.toLocaleString()}
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
