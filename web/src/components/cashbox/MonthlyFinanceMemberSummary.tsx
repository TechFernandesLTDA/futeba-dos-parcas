import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import type {
  MonthlyFinancePayerRecord,
  MonthlyFinancePeriodRecord,
} from '../../hooks/useMonthlyFinance';
import { shiftMonthlyPeriod } from '../../utils/monthlyFinance';

export interface MonthlyFinanceMemberSummaryProps {
  period: MonthlyFinancePeriodRecord;
  payer: MonthlyFinancePayerRecord | null;
  isMonthlyMember: boolean;
  accessLimited: boolean;
  locale?: string;
  onPeriodChange: (periodKey: string) => void;
}

function formatCurrency(cents: number, locale: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function formatPeriod(periodKey: string, locale: string) {
  const [year, month] = periodKey.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function MonthlyFinanceMemberSummary({
  period,
  payer,
  isMonthlyMember,
  accessLimited,
  locale = 'pt-BR',
  onPeriodChange,
}: MonthlyFinanceMemberSummaryProps) {
  const theme = useTheme();
  const previousPeriod = shiftMonthlyPeriod(period.periodKey, -1);
  const nextPeriod = shiftMonthlyPeriod(period.periodKey, 1);
  const activePayer = payer?.active ? payer : null;
  const status = activePayer?.status ?? (isMonthlyMember ? 'PENDING' : 'REMOVED');
  const statusLabel = status === 'PAID'
    ? 'Pago'
    : status === 'PARTIAL'
      ? 'Parcial'
      : status === 'PENDING'
        ? 'Pendente'
        : 'Fora do rateio';

  return (
    <Card variant="outlined" sx={{ borderRadius: 1.5, overflow: 'hidden' }}>
      <Box
        sx={{
          px: 2,
          py: 1.5,
          bgcolor: alpha(theme.palette.primary.main, 0.06),
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
          <Box>
            <Typography variant="overline" color="primary.main" fontWeight={800}>Meu mensal</Typography>
            <Typography variant="h6" fontWeight={800} textTransform="capitalize">
              {formatPeriod(period.periodKey, locale)}
            </Typography>
          </Box>
          <Stack direction="row">
            <IconButton
              size="small"
              onClick={() => onPeriodChange(previousPeriod)}
              aria-label={`Ver ${formatPeriod(previousPeriod, locale)}`}
            >
              <ChevronLeftIcon />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => onPeriodChange(nextPeriod)}
              aria-label={`Ver ${formatPeriod(nextPeriod, locale)}`}
            >
              <ChevronRightIcon />
            </IconButton>
          </Stack>
        </Stack>
      </Box>
      <CardContent>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 1.5,
          }}
        >
          <Box>
            <Typography variant="caption" color="text.secondary">Quadra no mês</Typography>
            <Typography fontWeight={800}>{formatCurrency(period.totalCourtCostCents, locale)}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Jogos reais</Typography>
            <Typography fontWeight={800}>{period.gameCount}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Minha mensalidade</Typography>
            <Typography fontWeight={800}>
              {activePayer ? formatCurrency(activePayer.expectedCents, locale) : '—'}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Em aberto</Typography>
            <Typography fontWeight={800} color={activePayer?.outstandingCents ? 'warning.main' : 'success.main'}>
              {activePayer ? formatCurrency(activePayer.outstandingCents, locale) : '—'}
            </Typography>
          </Box>
        </Box>
        <Stack direction="row" alignItems="center" spacing={1} mt={2}>
          <Chip
            size="small"
            label={statusLabel}
            color={status === 'PAID' ? 'success' : status === 'REMOVED' ? 'default' : 'warning'}
            variant={status === 'PAID' ? 'filled' : 'outlined'}
          />
          {activePayer && (
            <Typography variant="caption" color="text.secondary">
              {formatCurrency(activePayer.paidCents, locale)} recebido
            </Typography>
          )}
        </Stack>
        {isMonthlyMember && !activePayer && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Você está na lista mensal. O valor aparecerá após o responsável recalcular este mês.
          </Alert>
        )}
        {accessLimited && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Por privacidade, você vê somente o resumo do mês e o seu próprio pagamento.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
