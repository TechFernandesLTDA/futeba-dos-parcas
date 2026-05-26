import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  IconButton,
  CircularProgress,
  TextField,
  Button,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  useTheme,
  useMediaQuery,
  alpha,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Payments as PaymentsIcon,
  TrendingUp as TrendingIcon,
  TrendingDown as TrendingDownIcon,
  History as HistoryIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { LoadingState } from '../../components/common/GameCard';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { createLogger } from '../../utils/logger';
import { getFirestoreErrorMessage } from '../../utils/firebaseErrors';

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
}

export const CashboxScreen: React.FC = () => {
  useDocumentTitle('Caixinha');
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { groupId } = useParams<{ groupId: string }>();
  const { user, firebaseUser } = useAuth();

  const [transactions, setTransactions] = useState<CashboxTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [isAdminOrOwner, setIsAdminOrOwner] = useState(false);
  const [isConfirmedMember, setIsConfirmedMember] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { showError } = useToast();

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
          return {
            id: d.id,
            ...converted,
            createdAt: (raw.created_at || raw.createdAt)?.toDate?.() || new Date(),
          };
        }) as CashboxTransaction[];
        setTransactions(data);

        const total = data.reduce((sum, t) => {
          return t.type === 'INCOME' ? sum + t.amount : sum - t.amount;
        }, 0);
        setBalance(total);
        setLoading(false);
      },
      (err) => {
        logger.error('Error in cashbox transactions listener:', err);
        setError('Erro ao carregar transações do caixa.');
        setLoading(false);
      }
    );

    // Check if user is admin/owner via members subcollection
    if (user) {
      getDoc(doc(db, 'groups', groupId, 'members', user.id))
        .then((memberDoc) => {
          if (!cancelled && memberDoc.exists()) {
            const memberData = memberDoc.data();
            const memberRole = memberData.role as string | undefined;
            const memberStatus = memberData.status as string | undefined;
            setIsAdminOrOwner(memberRole === 'ADMIN' || memberRole === 'OWNER');
            setIsConfirmedMember(memberStatus === 'ACTIVE');
          }
        })
        .catch((err) => {
          logger.error('Error checking member status:', err);
        });
    }

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [groupId, user, retryCount]);

  const handleAddTransaction = useCallback(async () => {
    const parsedAmount = parseFloat(amount);
    if (!groupId || !user || !description || isNaN(parsedAmount) || parsedAmount <= 0) return;
    setSubmitting(true);
    try {
      const userName = firebaseUser?.displayName || user?.name || 'Usuário';

      await addDoc(collection(db, 'groups', groupId, 'cashbox'), {
        group_id: groupId,
        type: transactionType,
        amount: parsedAmount,
        description,
        created_by: user?.id,
        created_by_name: userName,
        created_at: serverTimestamp(),
      });

      setDialogOpen(false);
      setAmount('');
      setDescription('');
    } catch (err: unknown) {
      showError(getFirestoreErrorMessage(err, 'Erro ao adicionar transação'));
    } finally {
      setSubmitting(false);
    }
  }, [amount, description, groupId, user, firebaseUser, transactionType, showError]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <Box sx={{ pb: 4 }}>
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          bgcolor: 'background.paper',
          zIndex: 10,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', p: 1 }}>
          <IconButton onClick={() => navigate(groupId ? `/group/${groupId}` : '/?tab=2')} aria-label="Voltar">
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1, flex: 1 }}>
            Caixa do Grupo
          </Typography>
          {isConfirmedMember && !isAdminOrOwner && (
            <Chip
              icon={<VisibilityIcon />}
              label="Somente leitura"
              size="small"
              color="info"
              variant="outlined"
            />
          )}
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        <Card sx={{ mb: 2, bgcolor: balance >= 0 ? alpha(theme.palette.success.main, 0.1) : alpha(theme.palette.error.main, 0.1) }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <PaymentsIcon sx={{ fontSize: 40, color: balance >= 0 ? 'success.main' : 'error.main' }} />
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Saldo Atual
                </Typography>
                {/* #1343 (a11y): saldo não pode depender só de cor. Prefixo
                    "+" no positivo (negativo já vem com "-" do Intl) + label
                    textual para leitores de tela = sinal não-cromático. */}
                <Typography
                  variant="h4"
                  fontWeight={700}
                  color={balance >= 0 ? 'success.main' : 'error.main'}
                  aria-label={`Saldo ${balance >= 0 ? 'positivo' : 'negativo'}: ${formatCurrency(balance)}`}
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
                setDialogOpen(true);
              }}
            >
              Entrada
            </Button>
            <Button
              variant="contained"
              color="error"
              fullWidth
              startIcon={<TrendingDownIcon />}
              onClick={() => {
                setTransactionType('EXPENSE');
                setDialogOpen(true);
              }}
            >
              Saída
            </Button>
          </Box>
        )}

        {error ? (
          <Container maxWidth="sm" sx={{ py: 2 }}>
            <Alert severity="error" action={
              <Button color="inherit" size="small" onClick={handleRetry}>
                Tentar novamente
              </Button>
            }>
              {error}
            </Alert>
          </Container>
        ) : loading ? (
          <LoadingState shimmerCount={5} itemType="LIST" />
        ) : transactions.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <HistoryIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Nenhuma transação
            </Typography>
            <Typography variant="body2" color="text.disabled">
              Adicione entradas e saídas para controlar o caixa
            </Typography>
          </Box>
        ) : (
          <List disablePadding aria-label="Histórico de transações">
            {transactions.map((transaction, index) => (
              <Box key={transaction.id}>
                {index > 0 && <Divider />}
                <ListItem sx={{ py: 1.5 }}>
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
                    primary={transaction.description}
                    secondary={`${transaction.createdByName} • ${transaction.createdAt.toLocaleDateString('pt-BR')}`}
                  />
                  <Typography
                    variant="subtitle1"
                    fontWeight={600}
                    color={transaction.type === 'INCOME' ? 'success.main' : 'error.main'}
                  >
                    {transaction.type === 'INCOME' ? '+' : '-'}{formatCurrency(transaction.amount)}
                  </Typography>
                </ListItem>
              </Box>
            ))}
          </List>
        )}
      </Container>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullScreen={isMobile} fullWidth maxWidth="sm" aria-labelledby="cashbox-dialog-title">
        <DialogTitle id="cashbox-dialog-title">
          {transactionType === 'INCOME' ? 'Adicionar Entrada' : 'Adicionar Saída'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="none"
            label="Valor (R$)"
            type="number"
            fullWidth
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="none"
            label="Descrição"
            fullWidth
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            inputProps={{ maxLength: 500 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleAddTransaction} variant="contained" color={transactionType === 'INCOME' ? 'success' : 'error'} disabled={submitting || !amount || !description || parseFloat(amount) <= 0 || isNaN(parseFloat(amount))} startIcon={submitting ? <CircularProgress size={16} /> : undefined}>
            {submitting ? 'Confirmando...' : 'Confirmar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
