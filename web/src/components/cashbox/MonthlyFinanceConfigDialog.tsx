import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import type { MonthlyFinanceConfigRecord } from '../../hooks/useMonthlyFinance';
import type { ConfigureMonthlyFinanceRequest } from '../../services/monthlyFinanceService';
import {
  parseCashboxAmountToCents,
} from '../../utils/cashboxAmount';
import type { MonthlyCourtPricingMode } from '../../utils/monthlyFinance';

export interface MonthlyFinanceConfigDialogProps {
  open: boolean;
  groupId: string;
  config: MonthlyFinanceConfigRecord | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (request: ConfigureMonthlyFinanceRequest) => void;
}

function centsToInput(cents: number | null | undefined) {
  return cents === null || cents === undefined
    ? ''
    : (cents / 100).toFixed(2).replace('.', ',');
}

export function MonthlyFinanceConfigDialog({
  open,
  groupId,
  config,
  saving,
  onClose,
  onSubmit,
}: MonthlyFinanceConfigDialogProps) {
  const { t } = useTranslation();
  const [pricingMode, setPricingMode] = useState<MonthlyCourtPricingMode>('FIXED_MONTHLY');
  const [amount, setAmount] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    const nextMode = config?.pricingMode ?? 'FIXED_MONTHLY';
    setPricingMode(nextMode);
    setAmount(centsToInput(
      nextMode === 'FIXED_MONTHLY'
        ? config?.fixedMonthlyCostCents
        : config?.defaultGameCostCents,
    ));
    setTouched(false);
  }, [config, open]);

  const amountCents = useMemo(() => parseCashboxAmountToCents(amount), [amount]);
  const amountEmpty = amount.trim().length === 0;
  const amountValid = amountCents !== null || (pricingMode === 'PER_GAME' && amountEmpty);
  const amountInvalid = touched && !amountValid;

  const handleModeChange = (_: React.MouseEvent<HTMLElement>, value: MonthlyCourtPricingMode | null) => {
    if (!value) return;
    setPricingMode(value);
    setAmount(centsToInput(
      value === 'FIXED_MONTHLY'
        ? config?.fixedMonthlyCostCents
        : config?.defaultGameCostCents,
    ));
    setTouched(false);
  };

  const handleSubmit = () => {
    setTouched(true);
    if (!amountValid) return;
    if (pricingMode === 'FIXED_MONTHLY') {
      if (amountCents === null) return;
      onSubmit({ groupId, pricingMode, fixedMonthlyCostCents: amountCents });
      return;
    }
    onSubmit({ groupId, pricingMode, defaultGameCostCents: amountCents });
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Configurar mensalidade</DialogTitle>
      <DialogContent>
        <Stack spacing={2} pt={0.5}>
          <Typography variant="body2" color="text.secondary">
            Defina como o custo real da quadra será calculado antes de dividir entre os mensalistas.
          </Typography>
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={pricingMode}
            onChange={handleModeChange}
            disabled={saving}
            aria-label={t('a11y.courtBillingMode')}
          >
            <ToggleButton value="FIXED_MONTHLY">Valor mensal</ToggleButton>
            <ToggleButton value="PER_GAME">Por jogo</ToggleButton>
          </ToggleButtonGroup>
          <TextField
            autoFocus
            fullWidth
            label={pricingMode === 'FIXED_MONTHLY' ? 'Total mensal da quadra' : 'Valor padrão por jogo'}
            placeholder={pricingMode === 'PER_GAME' ? 'Opcional' : undefined}
            value={amount}
            disabled={saving}
            onBlur={() => setTouched(true)}
            onChange={(event) => setAmount(event.target.value)}
            error={amountInvalid}
            helperText={amountInvalid
              ? pricingMode === 'PER_GAME'
                ? 'Use um valor maior que zero ou deixe vazio para informar cada jogo na agenda.'
                : 'Informe um valor maior que zero, com até duas casas decimais.'
              : pricingMode === 'FIXED_MONTHLY'
                ? 'O total permanece mensal, mesmo quando o mês tiver 3, 4 ou 5 jogos.'
                : 'Opcional. Se ficar vazio, defina o custo de cada ocorrência na agenda do mês.'}
            InputProps={{ startAdornment: <Typography sx={{ mr: 1 }}>R$</Typography> }}
            inputProps={{ inputMode: 'decimal', 'aria-label': 'Valor da quadra' }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={saving || !amountValid}
          startIcon={saving ? <CircularProgress size={16} /> : undefined}
        >
          Salvar e recalcular
        </Button>
      </DialogActions>
    </Dialog>
  );
}
