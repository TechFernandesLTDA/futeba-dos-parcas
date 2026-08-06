import { PageContainer } from '../../components/common/PageContainer';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  TextField,
  Button,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  Stack,
  IconButton,
  Link,
  useTheme,
  useMediaQuery,
  alpha,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Alert,
} from '@mui/material';
import {
  Payments as PaymentsIcon,
  TrendingUp as TrendingIcon,
  TrendingDown as TrendingDownIcon,
  History as HistoryIcon,
  Visibility as VisibilityIcon,
  ReceiptLong as ReceiptIcon,
  Block as VoidIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { doc, getDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from '../../services/firebase';
import { storage } from '../../services/firebaseStorage';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { LoadingState } from '../../components/common/GameCard';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { createLogger } from '../../utils/logger';
import { getFirestoreErrorMessage } from '../../utils/firebaseErrors';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import {
  centsToCashboxAmount,
  formatCashboxAmountInput,
  parseCashboxAmountToCents,
} from '../../utils/cashboxAmount';
import {
  createCashboxEntry,
  reconcileCashboxSummary,
  voidCashboxEntry,
} from '../../services/cloudFunctions';
import { useCashboxData } from '../../hooks/useCashboxData';
import { useMonthlyFinance } from '../../hooks/useMonthlyFinance';
import {
  MonthlyFinancePanel,
  type MonthlyGameOverrideChange,
  type MonthlyPaymentSettlement,
} from '../../components/cashbox/MonthlyFinancePanel';
import { MonthlyFinanceConfigDialog } from '../../components/cashbox/MonthlyFinanceConfigDialog';
import { MonthlyFinanceMemberSummary } from '../../components/cashbox/MonthlyFinanceMemberSummary';
import {
  configureMonthlyFinance,
  rebuildMonthlyCycle,
  setMonthlyGameOverride,
  setMonthlyMember,
  settleMonthlyCharge,
  type ConfigureMonthlyFinanceRequest,
} from '../../services/monthlyFinanceService';

const logger = createLogger('CashboxScreen');

type CashboxFilter = 'ALL' | 'INCOME' | 'EXPENSE' | 'VOIDED';

const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
const RECEIPT_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const RECEIPT_EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function getCurrentPeriodKey() {
  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return `${year}-${month}`;
}

export const CashboxScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('cashbox.title'));
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { groupId } = useParams<{ groupId: string }>();
  const { firebaseUser } = useAuth();
  const currentUserId = firebaseUser?.uid;

  const [isAdminOrOwner, setIsAdminOrOwner] = useState(false);
  const [isConfirmedMember, setIsConfirmedMember] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  // #2231: rastreia se o campo já foi tocado para só exibir erro após interação.
  const [amountTouched, setAmountTouched] = useState(false);
  const [descriptionTouched, setDescriptionTouched] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [filter, setFilter] = useState<CashboxFilter>('ALL');
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [monthlyPeriodKey, setMonthlyPeriodKey] = useState(getCurrentPeriodKey);
  const [monthlyConfigOpen, setMonthlyConfigOpen] = useState(false);
  const [monthlyConfigSaving, setMonthlyConfigSaving] = useState(false);
  const [monthlyRebuilding, setMonthlyRebuilding] = useState(false);
  const [busyMonthlyMemberIds, setBusyMonthlyMemberIds] = useState<Set<string>>(new Set());
  const [busyMonthlyGameIds, setBusyMonthlyGameIds] = useState<Set<string>>(new Set());
  const [monthlyGameOverrideErrors, setMonthlyGameOverrideErrors] = useState<Record<string, string>>({});
  const createRequestIdRef = useRef<string | null>(null);
  const reconciliationAttemptRef = useRef<string | null>(null);
  const monthlySettlementRequestIdsRef = useRef<Map<string, string>>(new Map());
  const { showSuccess, showError } = useToast();
  const {
    transactions,
    balanceCents,
    loading,
    error: dataError,
    summaryNeedsReconciliation,
    hasMore,
    loadingMore,
    loadMore,
  } = useCashboxData(groupId, retryCount);
  const monthlyFinance = useMonthlyFinance({
    groupId,
    periodKey: monthlyPeriodKey,
    currentUserId,
    canManage: isAdminOrOwner,
    retryToken: retryCount,
  });

  const closeTransactionDialog = useCallback(() => {
    createRequestIdRef.current = null;
    setDialogOpen(false);
  }, []);

  // #2231: validação em tempo real do formulário de transação.
  const parsedAmountCents = parseCashboxAmountToCents(amount);
  const amountValid = parsedAmountCents !== null;
  const descriptionValid = description.trim().length > 0;
  const insufficientBalance = transactionType === 'EXPENSE' &&
    parsedAmountCents !== null &&
    parsedAmountCents > balanceCents;
  const formValid = amountValid && descriptionValid && !insufficientBalance;
  const balance = centsToCashboxAmount(balanceCents);
  const canManageCashbox = isAdminOrOwner &&
    !loading &&
    !dataError &&
    !summaryNeedsReconciliation;
  const canManageMonthly = isAdminOrOwner &&
    !monthlyFinance.loading &&
    !monthlyFinance.error;
  const viewingCurrentMonthlyPeriod = monthlyPeriodKey === getCurrentPeriodKey();
  const canEditMonthlyRoster = canManageMonthly &&
    viewingCurrentMonthlyPeriod &&
    (!monthlyFinance.period || monthlyFinance.period.status === 'DRAFT');
  const canEditMonthlyGames = canManageMonthly && monthlyFinance.period?.status === 'DRAFT';
  const canSettleMonthly = canManageMonthly &&
    Boolean(monthlyFinance.period) &&
    monthlyFinance.period?.status !== 'CLOSED';

  const handleRetry = () => {
    setRetryCount((n) => n + 1);
  };

  useEffect(() => {
    if (!groupId || !currentUserId) return;
    let cancelled = false;
    Promise.all([
      getDoc(doc(db, 'groups', groupId, 'members', currentUserId)),
      getDoc(doc(db, 'groups', groupId)),
    ]).then(([memberDoc, groupDoc]) => {
      if (cancelled) return;
      const memberData = memberDoc.exists() ? memberDoc.data() : null;
      const memberRole = memberData?.role as string | undefined;
      const memberStatus = memberData?.status as string | undefined;
      const isActiveMember = memberStatus === 'ACTIVE';
      const isOwnerByGroupDoc = groupDoc.exists() &&
        groupDoc.data().owner_id === currentUserId;
      setIsAdminOrOwner(
        isOwnerByGroupDoc ||
        (isActiveMember && (memberRole === 'ADMIN' || memberRole === 'OWNER'))
      );
      setIsConfirmedMember(isOwnerByGroupDoc || isActiveMember);
    }).catch((cause) => {
      logger.error('Error checking member status:', cause);
      showError(t('feedback.cashbox.roleCheckFailed'));
    });
    return () => {
      cancelled = true;
    };
  }, [groupId, currentUserId, retryCount, t, showError]);

  useEffect(() => {
    if (!groupId || !isAdminOrOwner || !summaryNeedsReconciliation) return;
    const attemptKey = `${groupId}:${retryCount}`;
    if (reconciliationAttemptRef.current === attemptKey) return;
    reconciliationAttemptRef.current = attemptKey;
    void reconcileCashboxSummary({ groupId }).catch((cause) => {
      logger.error('Error reconciling cashbox summary:', cause);
      showError(getFirestoreErrorMessage(cause, t('feedback.cashbox.loadError')));
    });
  }, [groupId, isAdminOrOwner, retryCount, showError, summaryNeedsReconciliation, t]);

  const displayedTransactions = transactions.filter((transaction) => {
    if (filter === 'VOIDED') return transaction.status === 'VOIDED';
    if (transaction.status === 'VOIDED') return false;
    if (filter === 'ALL') return true;
    return transaction.type === filter;
  });

  const handleReceiptChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!RECEIPT_ACCEPTED_TYPES.includes(file.type)) {
      showError(t('cashbox.receiptInvalidType'));
      return;
    }

    if (file.size > RECEIPT_MAX_BYTES) {
      showError(t('cashbox.receiptTooLarge'));
      return;
    }

    setReceiptFile(file);
  };

  const uploadReceipt = useCallback(async (): Promise<string | null> => {
    if (!receiptFile || !groupId) return null;
    const extension = RECEIPT_EXTENSION_BY_TYPE[receiptFile.type] || 'jpg';
    const receiptPath = `groups/${groupId}/receipts/${Date.now()}.${extension}`;
    const receiptRef = storageRef(storage, receiptPath);
    await uploadBytes(receiptRef, receiptFile, { contentType: receiptFile.type });
    return getDownloadURL(receiptRef);
  }, [groupId, receiptFile]);

  const handleAddTransaction = useCallback(async () => {
    if (!groupId || !currentUserId || !description.trim() || parsedAmountCents === null) return;
    if (transactionType === 'EXPENSE' && parsedAmountCents > balanceCents) {
      showError(t('cashbox.insufficientBalance'));
      return;
    }
    setSubmitting(true);
    try {
      const receiptUrl = await uploadReceipt();
      const requestId = createRequestIdRef.current ?? crypto.randomUUID();
      createRequestIdRef.current = requestId;

      await createCashboxEntry({
        groupId,
        requestId,
        type: transactionType,
        amount: centsToCashboxAmount(parsedAmountCents),
        description: description.trim(),
        receiptUrl,
      });

      closeTransactionDialog();
      setAmount('');
      setDescription('');
      setReceiptFile(null);
      setAmountTouched(false);
      setDescriptionTouched(false);
      showSuccess(t('cashbox.addSuccess'));
    } catch (err: unknown) {
      showError(getFirestoreErrorMessage(err, t('cashbox.addError')));
    } finally {
      setSubmitting(false);
    }
  }, [balanceCents, closeTransactionDialog, currentUserId, description, groupId, parsedAmountCents, showError, showSuccess, t, transactionType, uploadReceipt]);

  const handleVoidTransaction = useCallback(async (transactionId: string) => {
    if (!groupId || !currentUserId) return;
    setVoidingId(transactionId);
    try {
      await voidCashboxEntry({ groupId, entryId: transactionId });
      showSuccess(t('cashbox.voidSuccess'));
    } catch (err: unknown) {
      showError(getFirestoreErrorMessage(err, t('cashbox.voidError')));
    } finally {
      setVoidingId(null);
    }
  }, [groupId, currentUserId, showError, showSuccess, t]);

  const handleMonthlyRebuild = useCallback(async () => {
    if (!groupId || !canEditMonthlyRoster) return;
    setMonthlyRebuilding(true);
    try {
      await rebuildMonthlyCycle({ groupId, periodKey: monthlyPeriodKey });
      showSuccess('Mensalidade recalculada com os jogos e mensalistas deste mês.');
    } catch (cause: unknown) {
      showError(getFirestoreErrorMessage(cause, 'Não foi possível recalcular a mensalidade.'));
    } finally {
      setMonthlyRebuilding(false);
    }
  }, [canEditMonthlyRoster, groupId, monthlyPeriodKey, showError, showSuccess]);

  const handleMonthlyConfigSubmit = useCallback(async (
    request: ConfigureMonthlyFinanceRequest,
  ) => {
    if (!groupId || !canEditMonthlyRoster || request.groupId !== groupId) return;
    setMonthlyConfigSaving(true);
    try {
      await configureMonthlyFinance(request);
      await rebuildMonthlyCycle({ groupId, periodKey: monthlyPeriodKey });
      setMonthlyConfigOpen(false);
      showSuccess('Configuração salva e mês recalculado.');
    } catch (cause: unknown) {
      showError(getFirestoreErrorMessage(cause, 'Não foi possível salvar a configuração mensal.'));
    } finally {
      setMonthlyConfigSaving(false);
    }
  }, [canEditMonthlyRoster, groupId, monthlyPeriodKey, showError, showSuccess]);

  const handleToggleMonthlyMember = useCallback(async (
    targetUserId: string,
    isMonthly: boolean,
  ) => {
    if (!groupId || !canEditMonthlyRoster) return;
    setBusyMonthlyMemberIds((current) => new Set(current).add(targetUserId));
    try {
      await setMonthlyMember({ groupId, targetUserId, isMonthly });
      await rebuildMonthlyCycle({ groupId, periodKey: monthlyPeriodKey });
      showSuccess(isMonthly ? 'Jogador incluído nos mensalistas.' : 'Jogador removido dos mensalistas.');
    } catch (cause: unknown) {
      showError(getFirestoreErrorMessage(cause, 'Não foi possível atualizar a lista de mensalistas.'));
    } finally {
      setBusyMonthlyMemberIds((current) => {
        const next = new Set(current);
        next.delete(targetUserId);
        return next;
      });
    }
  }, [canEditMonthlyRoster, groupId, monthlyPeriodKey, showError, showSuccess]);

  const handleSettleMonthlyMember = useCallback(async (
    settlement: MonthlyPaymentSettlement,
  ) => {
    if (!groupId || !canSettleMonthly || settlement.amountToSettleCents <= 0) return;
    const actionKey = [
      settlement.periodKey,
      settlement.userId,
      settlement.amountToSettleCents,
    ].join(':');
    const requestId = monthlySettlementRequestIdsRef.current.get(actionKey) ?? crypto.randomUUID();
    monthlySettlementRequestIdsRef.current.set(actionKey, requestId);
    setBusyMonthlyMemberIds((current) => new Set(current).add(settlement.userId));
    try {
      await settleMonthlyCharge({
        groupId,
        periodKey: settlement.periodKey,
        targetUserId: settlement.userId,
        requestId,
        amountCents: settlement.amountToSettleCents,
      });
      monthlySettlementRequestIdsRef.current.delete(actionKey);
      showSuccess(`Baixa registrada para ${settlement.userName}.`);
    } catch (cause: unknown) {
      showError(getFirestoreErrorMessage(cause, 'Não foi possível registrar a baixa. Tente novamente.'));
    } finally {
      setBusyMonthlyMemberIds((current) => {
        const next = new Set(current);
        next.delete(settlement.userId);
        return next;
      });
    }
  }, [canSettleMonthly, groupId, showError, showSuccess]);

  const handleMonthlyGameOverride = useCallback(async (
    change: MonthlyGameOverrideChange,
  ) => {
    if (!groupId || !canEditMonthlyGames) return;
    const occurrenceId = change.occurrenceId;
    setBusyMonthlyGameIds((current) => new Set(current).add(occurrenceId));
    setMonthlyGameOverrideErrors((current) => {
      const next = { ...current };
      delete next[occurrenceId];
      return next;
    });
    try {
      await setMonthlyGameOverride({
        groupId,
        periodKey: monthlyPeriodKey,
        ...change,
      });
      showSuccess(change.costCents !== undefined
        ? 'Custo do jogo atualizado no rateio.'
        : change.excluded
          ? 'Ocorrência marcada como feriado e retirada do rateio.'
          : 'Ocorrência incluída novamente no rateio.');
    } catch (cause: unknown) {
      const message = getFirestoreErrorMessage(
        cause,
        'Não foi possível atualizar esta ocorrência.',
      );
      setMonthlyGameOverrideErrors((current) => ({ ...current, [occurrenceId]: message }));
      showError(message);
    } finally {
      setBusyMonthlyGameIds((current) => {
        const next = new Set(current);
        next.delete(occurrenceId);
        return next;
      });
    }
  }, [canEditMonthlyGames, groupId, monthlyPeriodKey, showError, showSuccess]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(navigator.language || 'pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <Box sx={{ pb: 4 }}>
      <ScreenHeader
        title={t('cashbox.groupTitle')}
        onBack={() => navigate(groupId ? `/group/${groupId}` : '/?tab=2')}
        actions={
          isConfirmedMember && !isAdminOrOwner ? (
            <Chip
              icon={<VisibilityIcon />}
              label={t('cashbox.readOnly')}
              size="small"
              color="info"
              variant="outlined"
            />
          ) : undefined
        }
      />

      <PageContainer maxWidth="form">
        <Card sx={{ mb: 2, bgcolor: balance >= 0 ? alpha(theme.palette.success.main, 0.1) : alpha(theme.palette.error.main, 0.1) }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <PaymentsIcon sx={{ fontSize: 40, color: balance >= 0 ? 'success.main' : 'error.main' }} />
              <Box>
                <Typography variant="body2" color="text.secondary">
                  {t('cashbox.currentBalance')}
                </Typography>
                {/* #1343 (a11y): saldo não pode depender só de cor. Prefixo
                    "+" no positivo (negativo já vem com "-" do Intl) + label
                    textual para leitores de tela = sinal não-cromático. */}
                <Typography
                  variant="h4"
                  fontWeight={700}
                  color={balance >= 0 ? 'success.main' : 'error.main'}
                  aria-label={t('cashbox.balanceAriaLabel', {
                    status: balance >= 0 ? t('cashbox.balancePositive') : t('cashbox.balanceNegative'),
                    value: formatCurrency(balance),
                  })}
                >
                  {balance >= 0 ? '+' : ''}{formatCurrency(balance)}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Box sx={{ mb: 2 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            justifyContent="space-between"
            spacing={1}
            sx={{ mb: 1 }}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="subtitle1" fontWeight={800}>Mensal do grupo</Typography>
              {monthlyFinance.period && (
                <Chip
                  size="small"
                  label={monthlyFinance.period.status === 'DRAFT'
                    ? 'Em cálculo'
                    : monthlyFinance.period.status === 'FINALIZED'
                      ? 'Lista fechada'
                      : 'Mês encerrado'}
                  color={monthlyFinance.period.status === 'CLOSED' ? 'default' : 'primary'}
                  variant="outlined"
                />
              )}
            </Stack>
            {isAdminOrOwner && (
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<SettingsIcon />}
                  disabled={!canEditMonthlyRoster || monthlyConfigSaving}
                  onClick={() => setMonthlyConfigOpen(true)}
                >
                  Configurar
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={monthlyRebuilding ? <CircularProgress size={16} /> : <RefreshIcon />}
                  disabled={!monthlyFinance.config || !canEditMonthlyRoster || monthlyRebuilding}
                  onClick={() => void handleMonthlyRebuild()}
                >
                  Recalcular
                </Button>
              </Stack>
            )}
          </Stack>

          {isAdminOrOwner && !viewingCurrentMonthlyPeriod && (
            <Alert severity="info" sx={{ mb: 1 }}>
              Meses anteriores preservam a lista de pagantes. Em um rascunho, a agenda ainda pode ser corrigida;
              mensalistas e configuração só mudam no mês atual.
            </Alert>
          )}

          {monthlyFinance.error ? (
            <ErrorState
              message="Não foi possível carregar a mensalidade do grupo."
              onRetry={handleRetry}
            />
          ) : monthlyFinance.loading ? (
            <LoadingState shimmerCount={3} itemType="LIST" />
          ) : !monthlyFinance.period ? (
            <EmptyState
              icon={<PaymentsIcon />}
              title="Mensalidade ainda não calculada"
              description={isAdminOrOwner
                ? monthlyFinance.config
                  ? 'Recalcule o mês para considerar os jogos reais e a lista atual de mensalistas.'
                  : 'Configure o valor da quadra para criar o primeiro rateio mensal.'
                : 'O responsável pelo grupo ainda não publicou o rateio deste mês.'}
              actionLabel={canEditMonthlyRoster
                ? monthlyFinance.config ? 'Calcular este mês' : 'Configurar mensalidade'
                : undefined}
              actionIcon={canEditMonthlyRoster
                ? monthlyFinance.config ? <RefreshIcon /> : <SettingsIcon />
                : undefined}
              onAction={canEditMonthlyRoster
                ? monthlyFinance.config
                  ? () => void handleMonthlyRebuild()
                  : () => setMonthlyConfigOpen(true)
                : undefined}
            />
          ) : isAdminOrOwner && monthlyFinance.input ? (
            <MonthlyFinancePanel
              input={monthlyFinance.input}
              canManage={canEditMonthlyRoster}
              canManageGames={canEditMonthlyGames}
              canSettle={canSettleMonthly}
              busyMemberIds={busyMonthlyMemberIds}
              busyGameIds={busyMonthlyGameIds}
              gameOverrideErrors={monthlyGameOverrideErrors}
              onPeriodChange={setMonthlyPeriodKey}
              onToggleMonthlyMember={handleToggleMonthlyMember}
              onSettleMember={handleSettleMonthlyMember}
              onSetGameOverride={handleMonthlyGameOverride}
            />
          ) : !isAdminOrOwner ? (
            <MonthlyFinanceMemberSummary
              period={monthlyFinance.period}
              payer={monthlyFinance.ownPayer}
              isMonthlyMember={monthlyFinance.isMonthlyMember}
              accessLimited={monthlyFinance.accessLimited}
              onPeriodChange={setMonthlyPeriodKey}
            />
          ) : (
            <ErrorState
              message="Os dados deste rateio estão incompletos. Recalcule o mês."
              onRetry={() => void handleMonthlyRebuild()}
            />
          )}
        </Box>

        {canManageCashbox && (
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Button
              variant="contained"
              color="success"
              fullWidth
              startIcon={<TrendingIcon />}
              onClick={() => {
                setTransactionType('INCOME');
                setAmountTouched(false);
                setDescriptionTouched(false);
                setReceiptFile(null);
                setDialogOpen(true);
              }}
            >
              {t('cashbox.income')}
            </Button>
            <Button
              variant="contained"
              color="error"
              fullWidth
              startIcon={<TrendingDownIcon />}
              onClick={() => {
                setTransactionType('EXPENSE');
                setAmountTouched(false);
                setDescriptionTouched(false);
                setReceiptFile(null);
                setDialogOpen(true);
              }}
            >
              {t('cashbox.expense')}
            </Button>
          </Box>
        )}

        <Stack direction="row" spacing={1} sx={{ mb: 2, overflowX: 'auto', pb: 0.5 }} aria-label={t('cashbox.filtersAria')}>
          {(['ALL', 'INCOME', 'EXPENSE', 'VOIDED'] as CashboxFilter[]).map((item) => (
            <Chip
              key={item}
              label={t(`cashbox.filters.${item.toLowerCase()}`)}
              clickable
              color={filter === item ? 'primary' : 'default'}
              variant={filter === item ? 'filled' : 'outlined'}
              onClick={() => setFilter(item)}
              sx={{ flexShrink: 0 }}
            />
          ))}
        </Stack>

        {dataError ? (
          <ErrorState message={t('feedback.cashbox.loadError')} onRetry={handleRetry} />
        ) : loading ? (
          <LoadingState shimmerCount={5} itemType="LIST" />
        ) : transactions.length === 0 ? (
          <EmptyState
            icon={<HistoryIcon />}
            title={t('empty.noTransaction')}
            description={canManageCashbox ? t('cashbox.emptyAdminDesc') : t('cashbox.emptyMemberDesc')}
            actionLabel={canManageCashbox ? t('cashbox.addIncome') : undefined}
            actionIcon={canManageCashbox ? <TrendingIcon /> : undefined}
            onAction={canManageCashbox ? () => {
              setTransactionType('INCOME');
              setAmountTouched(false);
              setDescriptionTouched(false);
              setReceiptFile(null);
              setDialogOpen(true);
            } : undefined}
            secondaryActionLabel={canManageCashbox ? t('cashbox.addExpense') : undefined}
            secondaryActionIcon={canManageCashbox ? <TrendingDownIcon /> : undefined}
            onSecondaryAction={canManageCashbox ? () => {
              setTransactionType('EXPENSE');
              setAmountTouched(false);
              setDescriptionTouched(false);
              setReceiptFile(null);
              setDialogOpen(true);
            } : undefined}
          />
        ) : displayedTransactions.length === 0 ? (
          <EmptyState
            icon={<HistoryIcon />}
            title={t('cashbox.noFilteredTransactions')}
            description={t('cashbox.noFilteredTransactionsDesc')}
          />
        ) : (
          <>
            <List disablePadding aria-label={t('a11y.transactionHistory')}>
              {displayedTransactions.map((transaction, index) => (
                <Box key={transaction.id}>
                {index > 0 && <Divider />}
                <ListItem
                  sx={{ py: 1.5, opacity: transaction.status === 'VOIDED' ? 0.64 : 1 }}
                  secondaryAction={
                    canManageCashbox && transaction.status !== 'VOIDED' ? (
                      <IconButton
                        edge="end"
                        color="warning"
                        disabled={voidingId === transaction.id}
                        aria-label={t('cashbox.voidTransaction')}
                        onClick={() => handleVoidTransaction(transaction.id)}
                      >
                        {voidingId === transaction.id ? <CircularProgress size={18} /> : <VoidIcon />}
                      </IconButton>
                    ) : undefined
                  }
                >
                  <ListItemAvatar>
                    <Avatar
                      sx={{
                        bgcolor: transaction.type === 'INCOME' ? alpha(theme.palette.success.main, 0.1) : alpha(theme.palette.error.main, 0.1),
                        color: transaction.type === 'INCOME' ? 'success.main' : 'error.main',
                      }}
                    >
                      {transaction.type === 'INCOME' ? <TrendingIcon /> : <TrendingDownIcon />}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    secondaryTypographyProps={{ component: 'div' }}
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Typography variant="body1">{transaction.description}</Typography>
                        {transaction.status === 'VOIDED' && <Chip size="small" label={t('cashbox.voided')} color="warning" variant="outlined" />}
                      </Stack>
                    }
                    secondary={
                      <Stack spacing={0.25}>
                        <span>{`${transaction.createdByName} • ${transaction.createdAt.toLocaleDateString(navigator.language || 'pt-BR')}`}</span>
                        {transaction.receiptUrl && (
                          <Link href={transaction.receiptUrl} target="_blank" rel="noopener noreferrer" underline="hover">
                            {t('cashbox.receipt')}
                          </Link>
                        )}
                      </Stack>
                    }
                  />
                  <Typography
                    variant="subtitle1"
                    fontWeight={600}
                    color={transaction.status === 'VOIDED' ? 'text.disabled' : transaction.type === 'INCOME' ? 'success.main' : 'error.main'}
                    sx={{ pr: canManageCashbox && transaction.status !== 'VOIDED' ? 5 : 0 }}
                  >
                    {transaction.type === 'INCOME' ? '+' : '-'}{formatCurrency(transaction.amount)}
                  </Typography>
                </ListItem>
                </Box>
              ))}
            </List>
            {hasMore && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <Button onClick={() => void loadMore()} disabled={loadingMore}>
                  {loadingMore ? t('common.loadingMore') : t('common.loadMore')}
                </Button>
              </Box>
            )}
          </>
        )}
      </PageContainer>

      {groupId && (
        <MonthlyFinanceConfigDialog
          open={monthlyConfigOpen}
          groupId={groupId}
          config={monthlyFinance.config}
          saving={monthlyConfigSaving}
          onClose={() => setMonthlyConfigOpen(false)}
          onSubmit={(request) => void handleMonthlyConfigSubmit(request)}
        />
      )}

      <Dialog open={dialogOpen} onClose={closeTransactionDialog} fullScreen={isMobile} fullWidth maxWidth="sm" aria-labelledby="cashbox-dialog-title">
        <DialogTitle id="cashbox-dialog-title">
          {transactionType === 'INCOME' ? t('cashbox.addIncome') : t('cashbox.addExpense')}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="none"
            label={t('cashbox.amountLabel')}
            type="text"
            fullWidth
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onBlur={() => {
              setAmountTouched(true);
              const normalizedAmountCents = parseCashboxAmountToCents(amount);
              if (normalizedAmountCents !== null) {
                setAmount(formatCashboxAmountInput(centsToCashboxAmount(normalizedAmountCents)));
              }
            }}
            error={amountTouched && (!amountValid || insufficientBalance)}
            helperText={
              amountTouched && !amountValid ?
                t('cashbox.amountError') :
                amountTouched && insufficientBalance ?
                  t('cashbox.insufficientBalance') :
                  ' '
            }
            inputProps={{ inputMode: 'decimal' }}
            sx={{ mb: 1 }}
          />
          <TextField
            margin="none"
            label={t('cashbox.descriptionLabel')}
            fullWidth
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => setDescriptionTouched(true)}
            error={descriptionTouched && !descriptionValid}
            helperText={descriptionTouched && !descriptionValid ? t('cashbox.descriptionError') : ' '}
            inputProps={{ maxLength: 500 }}
          />
          <Button
            component="label"
            variant="outlined"
            startIcon={<ReceiptIcon />}
            fullWidth
            sx={{ mt: 1, justifyContent: 'flex-start' }}
          >
            {receiptFile ? t('cashbox.receiptSelected', { name: receiptFile.name }) : t('cashbox.addReceipt')}
            <input
              type="file"
              hidden
              accept={RECEIPT_ACCEPTED_TYPES.join(',')}
              onChange={handleReceiptChange}
            />
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeTransactionDialog} disabled={submitting}>{t('common.cancel')}</Button>
          <Button onClick={handleAddTransaction} variant="contained" color={transactionType === 'INCOME' ? 'success' : 'error'} disabled={submitting || !formValid} startIcon={submitting ? <CircularProgress size={16} /> : undefined}>
            {submitting ? t('cashbox.confirming') : t('common.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
