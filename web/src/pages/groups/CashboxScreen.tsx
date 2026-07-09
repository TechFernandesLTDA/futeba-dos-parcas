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
} from '@mui/material';
import {
  Payments as PaymentsIcon,
  TrendingUp as TrendingIcon,
  TrendingDown as TrendingDownIcon,
  History as HistoryIcon,
  Visibility as VisibilityIcon,
  ReceiptLong as ReceiptIcon,
  Block as VoidIcon,
} from '@mui/icons-material';
import { collection, query, orderBy, onSnapshot, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from '../../services/firebase';
import { storage } from '../../services/firebaseStorage';
import { snakeToCamel } from '../../utils/firestoreHelpers';
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
  cashboxAmountToCents,
  centsToCashboxAmount,
  formatCashboxAmountInput,
  normalizeCashboxAmount,
  parseCashboxAmountToCents,
} from '../../utils/cashboxAmount';
import { createCashboxEntry } from '../../services/cloudFunctions';

const logger = createLogger('CashboxScreen');

interface CashboxTransaction {
  id: string;
  groupId: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  description: string;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
  status?: 'ACTIVE' | 'VOIDED';
  receiptUrl?: string;
  voidedBy?: string;
  voidedAt?: Date;
}

type CashboxFilter = 'ALL' | 'INCOME' | 'EXPENSE' | 'VOIDED';

const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
const RECEIPT_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const RECEIPT_EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const CashboxScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('cashbox.title'));
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { groupId } = useParams<{ groupId: string }>();
  const { firebaseUser } = useAuth();

  const [transactions, setTransactions] = useState<CashboxTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [balanceCents, setBalanceCents] = useState(0);
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
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const createRequestIdRef = useRef<string | null>(null);
  const { showSuccess, showError } = useToast();

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
  const currentUserId = firebaseUser?.uid;
  const balance = centsToCashboxAmount(balanceCents);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    setRetryCount((n) => n + 1);
  };

  useEffect(() => {
    if (!groupId) return;

    let cancelled = false;

    const cashRef = collection(db, 'groups', groupId, 'cashbox');
    const q = query(cashRef, orderBy('created_at', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => {
          const raw = d.data();
          const converted = snakeToCamel(raw);
          const normalizedAmount = normalizeCashboxAmount(raw.amount ?? converted.amount);
          return {
            id: d.id,
            ...converted,
            amount: normalizedAmount,
            createdAt: (raw.created_at || raw.createdAt)?.toDate?.() || new Date(),
          };
        }) as CashboxTransaction[];
        setTransactions(data);

        const totalCents = data.reduce((sum, t) => {
          if (t.status === 'VOIDED') return sum;
          const amountCents = cashboxAmountToCents(t.amount);
          return t.type === 'INCOME' ? sum + amountCents : sum - amountCents;
        }, 0);
        setBalanceCents(totalCents);
        setLoading(false);
      },
      (err) => {
        logger.error('Error in cashbox transactions listener:', err);
        setError(t('feedback.cashbox.loadError'));
        setLoading(false);
      }
    );

    // Check role using the canonical Firebase Auth UID. GroupMemberRoute also
    // allows legacy owners via groups/{groupId}.owner_id, so mirror that here.
    if (currentUserId) {
      Promise.all([
        getDoc(doc(db, 'groups', groupId, 'members', currentUserId)),
        getDoc(doc(db, 'groups', groupId)),
      ])
        .then(([memberDoc, groupDoc]) => {
          if (cancelled) return;

          const memberData = memberDoc.exists() ? memberDoc.data() : null;
          const memberRole = memberData?.role as string | undefined;
          const memberStatus = memberData?.status as string | undefined;
          const isActiveMember = memberStatus === 'ACTIVE';
          const isOwnerByGroupDoc = groupDoc.exists() && groupDoc.data().owner_id === currentUserId;

          setIsAdminOrOwner(isOwnerByGroupDoc || (isActiveMember && (memberRole === 'ADMIN' || memberRole === 'OWNER')));
          setIsConfirmedMember(isOwnerByGroupDoc || isActiveMember);
        })
        .catch((err) => {
          logger.error('Error checking member status:', err);
          showError(t('feedback.cashbox.roleCheckFailed'));
        });
    }

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [groupId, currentUserId, retryCount, t, showError]);

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
      await updateDoc(doc(db, 'groups', groupId, 'cashbox', transactionId), {
        status: 'VOIDED',
        voided_by: currentUserId,
        voided_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      showSuccess(t('cashbox.voidSuccess'));
    } catch (err: unknown) {
      showError(getFirestoreErrorMessage(err, t('cashbox.voidError')));
    } finally {
      setVoidingId(null);
    }
  }, [groupId, currentUserId, showError, showSuccess, t]);

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

        {isAdminOrOwner && (
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

        {error ? (
          <ErrorState message={error} onRetry={handleRetry} />
        ) : loading ? (
          <LoadingState shimmerCount={5} itemType="LIST" />
        ) : transactions.length === 0 ? (
          <EmptyState
            icon={<HistoryIcon />}
            title={t('empty.noTransaction')}
            description={isAdminOrOwner ? t('cashbox.emptyAdminDesc') : t('cashbox.emptyMemberDesc')}
            actionLabel={isAdminOrOwner ? t('cashbox.addIncome') : undefined}
            actionIcon={isAdminOrOwner ? <TrendingIcon /> : undefined}
            onAction={isAdminOrOwner ? () => {
              setTransactionType('INCOME');
              setAmountTouched(false);
              setDescriptionTouched(false);
              setReceiptFile(null);
              setDialogOpen(true);
            } : undefined}
            secondaryActionLabel={isAdminOrOwner ? t('cashbox.addExpense') : undefined}
            secondaryActionIcon={isAdminOrOwner ? <TrendingDownIcon /> : undefined}
            onSecondaryAction={isAdminOrOwner ? () => {
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
          <List disablePadding aria-label={t('a11y.transactionHistory')}>
            {displayedTransactions.map((transaction, index) => (
              <Box key={transaction.id}>
                {index > 0 && <Divider />}
                <ListItem
                  sx={{ py: 1.5, opacity: transaction.status === 'VOIDED' ? 0.64 : 1 }}
                  secondaryAction={
                    isAdminOrOwner && transaction.status !== 'VOIDED' ? (
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
                    sx={{ pr: isAdminOrOwner && transaction.status !== 'VOIDED' ? 5 : 0 }}
                  >
                    {transaction.type === 'INCOME' ? '+' : '-'}{formatCurrency(transaction.amount)}
                  </Typography>
                </ListItem>
              </Box>
            ))}
          </List>
        )}
      </PageContainer>

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
