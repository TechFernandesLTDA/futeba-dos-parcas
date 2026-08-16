import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Stack,
  Switch,
  TextField,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import {
  CalendarMonth as CalendarMonthIcon,
  CheckCircle as CheckCircleIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  EventBusy as EventBusyIcon,
  Groups as GroupsIcon,
  Payments as PaymentsIcon,
  Restore as RestoreIcon,
  Save as SaveIcon,
  SportsSoccer as SportsSoccerIcon,
} from '@mui/icons-material';
import { parseCashboxAmountToCents } from '../../utils/cashboxAmount';
import {
  calculateMonthlyFinance,
  shiftMonthlyPeriod,
  type MonthlyCourtPricingMode,
  type MonthlyFinanceExclusionReason,
  type MonthlyFinanceGame,
  type MonthlyFinanceInput,
  type MonthlyMemberShare,
  type MonthlyPayerStatus,
} from '../../utils/monthlyFinance';

export interface MonthlyPaymentSettlement {
  periodKey: string;
  userId: string;
  userName: string;
  expectedCents: number;
  alreadyPaidCents: number;
  amountToSettleCents: number;
}

export interface MonthlyGameOverrideChange {
  occurrenceId: string;
  excluded: boolean;
  costCents?: number | null;
  reason?: MonthlyFinanceExclusionReason | null;
}

export interface MonthlyFinancePanelProps {
  input: MonthlyFinanceInput;
  canManage: boolean;
  canManageGames?: boolean;
  canSettle?: boolean;
  locale?: string;
  busyMemberIds?: ReadonlySet<string>;
  busyGameIds?: ReadonlySet<string>;
  gameOverrideErrors?: Readonly<Record<string, string | undefined>>;
  onPeriodChange?: (periodKey: string) => void;
  onToggleMonthlyMember?: (userId: string, isMonthly: boolean) => void;
  onSettleMember?: (settlement: MonthlyPaymentSettlement) => void;
  onSetGameOverride?: (change: MonthlyGameOverrideChange) => void;
}

const STATUS_LABELS: Record<MonthlyPayerStatus, string> = {
  PAID: 'Pago',
  PENDING: 'Pendente',
  PARTIAL: 'Parcial',
  EXEMPT: 'Isento',
};

const STATUS_COLORS: Record<MonthlyPayerStatus, 'success' | 'warning' | 'info' | 'default'> = {
  PAID: 'success',
  PENDING: 'warning',
  PARTIAL: 'info',
  EXEMPT: 'default',
};

const SOURCE_LABELS = {
  GAME: 'Jogo criado',
  SCHEDULE: 'Agenda fixa',
  RECURRENCE: 'Recorrência',
} as const;

const EXCLUSION_LABELS: Record<MonthlyFinanceExclusionReason, string> = {
  HOLIDAY: 'Feriado',
  CANCELLED: 'Cancelado',
  OTHER: 'Fora do rateio',
};

function formatCurrency(cents: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function formatPeriod(periodKey: string, locale: string) {
  const [year, month] = periodKey.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function formatGameDateLong(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

function centsToInput(cents: number | null | undefined) {
  return cents === null || cents === undefined
    ? ''
    : (cents / 100).toFixed(2).replace('.', ',');
}

interface MonthlyGameRowProps {
  game: MonthlyFinanceGame;
  allocatedCostCents: number;
  pricingMode: MonthlyCourtPricingMode;
  defaultGameCostCents?: number;
  locale: string;
  canManage: boolean;
  busy: boolean;
  error?: string;
  onSetOverride?: (change: MonthlyGameOverrideChange) => void;
}

function MonthlyGameRow({
  game,
  allocatedCostCents,
  pricingMode,
  defaultGameCostCents,
  locale,
  canManage,
  busy,
  error,
  onSetOverride,
}: MonthlyGameRowProps) {
  const excluded = game.included === false || game.status === 'CANCELLED';
  const immutableCancellation = game.status === 'CANCELLED';
  const reason = game.manualOverride?.reason ?? game.exclusionReason ??
    (game.status === 'CANCELLED' ? 'CANCELLED' : null);
  const initialCostInput = centsToInput(game.courtCostCents);
  const [costInput, setCostInput] = useState(initialCostInput);
  const [costTouched, setCostTouched] = useState(false);

  useEffect(() => {
    setCostInput(initialCostInput);
    setCostTouched(false);
  }, [initialCostInput]);

  const costEmpty = costInput.trim().length === 0;
  const parsedCostCents = parseCashboxAmountToCents(costInput);
  const needsIndividualCost = pricingMode === 'PER_GAME' &&
    defaultGameCostCents === undefined &&
    !excluded;
  const costValid = parsedCostCents !== null || (costEmpty && !needsIndividualCost);
  const costDirty = costInput.trim() !== initialCostInput;
  const longDate = formatGameDateLong(game.date, locale);

  const saveCost = () => {
    setCostTouched(true);
    if (!costValid || !costDirty) return;
    onSetOverride?.({
      occurrenceId: game.id,
      excluded,
      costCents: parsedCostCents,
      reason: excluded ? reason ?? 'OTHER' : null,
    });
  };

  const toggleExclusion = () => {
    if (immutableCancellation) return;
    onSetOverride?.({
      occurrenceId: game.id,
      excluded: !excluded,
      costCents: game.manualOverride?.costCents ?? null,
      reason: excluded ? null : 'HOLIDAY',
    });
  };

  return (
    <Box
      component="li"
      sx={{
        listStyle: 'none',
        p: { xs: 1.25, sm: 1.5 },
        border: 1,
        borderColor: excluded ? 'warning.main' : 'divider',
        borderRadius: 1,
        bgcolor: excluded ? 'action.hover' : 'background.paper',
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        spacing={1}
      >
        <Box minWidth={0}>
          <Typography variant="body2" fontWeight={800} textTransform="capitalize">
            {longDate}
          </Typography>
          <Stack direction="row" spacing={0.75} mt={0.5} useFlexGap flexWrap="wrap">
            {game.source && (
              <Chip size="small" variant="outlined" label={SOURCE_LABELS[game.source]} />
            )}
            {game.label && <Chip size="small" variant="outlined" label={game.label} />}
            {excluded && (
              <Chip
                size="small"
                color="warning"
                label={reason ? EXCLUSION_LABELS[reason] : 'Fora do rateio'}
              />
            )}
            {game.manualOverride && (
              <Chip size="small" color="info" variant="outlined" label="Ajuste manual" />
            )}
          </Stack>
        </Box>
        <Box sx={{ textAlign: { xs: 'left', sm: 'right' }, flexShrink: 0 }}>
          <Typography variant="caption" color="text.secondary">
            {excluded ? 'Não entra no total' : 'Valor no rateio'}
          </Typography>
          <Typography variant="body2" fontWeight={800}>
            {excluded ? '—' : formatCurrency(allocatedCostCents, locale)}
          </Typography>
        </Box>
      </Stack>

      {canManage && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: pricingMode === 'PER_GAME'
                ? 'minmax(190px, 1fr) auto auto'
                : 'auto',
            },
            gap: 1,
            alignItems: 'start',
            mt: 1.25,
          }}
        >
          {pricingMode === 'PER_GAME' && <TextField
            size="small"
            label="Custo desta ocorrência"
            value={costInput}
            disabled={busy}
            onChange={(event) => setCostInput(event.target.value)}
            onBlur={() => setCostTouched(true)}
            error={costTouched && !costValid}
            helperText={costTouched && !costValid
              ? needsIndividualCost
                ? 'Informe um valor maior que zero; este mês não tem custo padrão.'
                : 'Use um valor maior que zero ou deixe vazio.'
              : defaultGameCostCents !== undefined
                  ? `Vazio usa o padrão de ${formatCurrency(defaultGameCostCents, locale)}.`
                  : 'O custo individual compõe o total do mês.'}
            InputProps={{
              startAdornment: <InputAdornment position="start">R$</InputAdornment>,
            }}
            inputProps={{
              inputMode: 'decimal',
              'aria-label': `Custo de ${longDate}`,
            }}
          />}
          {pricingMode === 'PER_GAME' && <Button
            variant="outlined"
            startIcon={busy ? <CircularProgress size={15} /> : <SaveIcon />}
            disabled={busy || !costDirty || !costValid || !onSetOverride}
            onClick={saveCost}
            sx={{ minHeight: 40 }}
          >
            Salvar custo
          </Button>}
          <Button
            variant={excluded ? 'contained' : 'outlined'}
            color={excluded ? 'success' : 'warning'}
            startIcon={busy ? <CircularProgress size={15} /> : excluded ? <RestoreIcon /> : <EventBusyIcon />}
            disabled={busy || immutableCancellation || !onSetOverride}
            onClick={toggleExclusion}
            aria-label={excluded ? `Incluir ${longDate} no rateio` : `Marcar ${longDate} como feriado`}
            sx={{ minHeight: 40, whiteSpace: 'nowrap' }}
          >
            {immutableCancellation
              ? 'Cancelado no jogo'
              : excluded ? 'Incluir no rateio' : 'Marcar feriado'}
          </Button>
        </Box>
      )}

      {busy && (
        <Typography variant="caption" color="text.secondary" role="status" display="block" mt={0.75}>
          Atualizando rateio em tempo real…
        </Typography>
      )}
      {error && (
        <Typography variant="caption" color="error.main" role="alert" display="block" mt={0.75}>
          {error}
        </Typography>
      )}
    </Box>
  );
}

function memberSecondaryText(member: MonthlyMemberShare, locale: string) {
  if (!member.isMonthly) return 'Jogador avulso — não entra no rateio';
  if (member.status === 'EXEMPT') return 'Isento neste mês';
  if (member.status === 'PAID') return `${formatCurrency(member.paidCents, locale)} recebido`;
  if (member.status === 'PARTIAL') {
    return `${formatCurrency(member.paidCents, locale)} de ${formatCurrency(member.expectedCents, locale)}`;
  }
  return `${formatCurrency(member.expectedCents, locale)} em aberto`;
}

export function MonthlyFinancePanel({
  input,
  canManage,
  canManageGames = canManage,
  canSettle = canManage,
  locale = 'pt-BR',
  busyMemberIds = new Set<string>(),
  busyGameIds = new Set<string>(),
  gameOverrideErrors = {},
  onPeriodChange,
  onToggleMonthlyMember,
  onSettleMember,
  onSetGameOverride,
}: MonthlyFinancePanelProps) {
  const theme = useTheme();
  // Perf: cálculo E sorts derivados memoizados — antes sortedMembers/agendaGames
  // eram reordenados a cada render (todo toggle de rateio re-renderiza o painel).
  const calculation = useMemo(() => {
    try {
      const summary = calculateMonthlyFinance(input);
      const sortedMembers = [...summary.members].sort((left, right) => {
        if (left.isMonthly !== right.isMonthly) return left.isMonthly ? -1 : 1;
        return left.name.localeCompare(right.name, locale);
      });
      const agendaGames = [...input.games].sort((left, right) =>
        left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
      const includedGameById = new Map(summary.games.map((game) => [game.id, game]));
      return {
        summary,
        sortedMembers,
        agendaGames,
        includedGameById,
        error: null as string | null,
      };
    } catch (cause) {
      return {
        summary: null,
        sortedMembers: [],
        agendaGames: [],
        includedGameById: new Map<string, never>(),
        error: cause instanceof Error ? cause.message : 'Não foi possível calcular o rateio.',
      };
    }
  }, [input, locale]);

  if (!calculation.summary) {
    return (
      <Alert severity="error">
        <Typography component="span" fontWeight={700}>Rateio indisponível. </Typography>
        {calculation.error}
      </Alert>
    );
  }

  const { summary } = calculation;
  const { sortedMembers, agendaGames, includedGameById } = calculation;
  const previousPeriod = shiftMonthlyPeriod(summary.periodKey, -1);
  const nextPeriod = shiftMonthlyPeriod(summary.periodKey, 1);

  const summaryItems = [
    {
      label: 'Quadra no mês',
      value: formatCurrency(summary.totalCourtCostCents, locale),
      icon: <PaymentsIcon fontSize="small" />,
    },
    {
      label: 'Jogos reais',
      value: String(summary.games.length),
      icon: <SportsSoccerIcon fontSize="small" />,
    },
    {
      label: 'Por jogo',
      value: summary.averagePerGameCents === null
        ? '—'
        : formatCurrency(summary.averagePerGameCents, locale),
      icon: <CalendarMonthIcon fontSize="small" />,
    },
    {
      label: 'Por pagante',
      value: summary.averagePerPayingMonthlyMemberCents === null
        ? '—'
        : formatCurrency(summary.averagePerPayingMonthlyMemberCents, locale),
      icon: <GroupsIcon fontSize="small" />,
    },
  ];

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 1.5,
        overflow: 'hidden',
        borderColor: alpha(theme.palette.primary.main, 0.24),
      }}
    >
      <Box
        sx={{
          px: { xs: 2, sm: 2.5 },
          py: 2,
          bgcolor: alpha(theme.palette.primary.main, 0.06),
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Box minWidth={0}>
            <Typography variant="overline" color="primary.main" fontWeight={800} letterSpacing={1.1}>
              Mensalistas
            </Typography>
            <Typography variant="h6" component="h2" fontWeight={800} textTransform="capitalize">
              {formatPeriod(summary.periodKey, locale)}
            </Typography>
          </Box>
          <Stack direction="row" alignItems="center" spacing={0.25}>
            <IconButton
              size="small"
              disabled={!onPeriodChange}
              onClick={() => onPeriodChange?.(previousPeriod)}
              aria-label={`Ver ${formatPeriod(previousPeriod, locale)}`}
            >
              <ChevronLeftIcon />
            </IconButton>
            <IconButton
              size="small"
              disabled={!onPeriodChange}
              onClick={() => onPeriodChange?.(nextPeriod)}
              aria-label={`Ver ${formatPeriod(nextPeriod, locale)}`}
            >
              <ChevronRightIcon />
            </IconButton>
          </Stack>
        </Stack>
        <Stack direction="row" spacing={1} mt={1.25} useFlexGap flexWrap="wrap">
          <Chip
            size="small"
            label={summary.pricingMode === 'FIXED_MONTHLY' ? 'Contrato mensal' : 'Cobrança por jogo'}
            color="primary"
            variant="outlined"
          />
          <Chip
            size="small"
            label={summary.exemptMonthlyMembersCount > 0
              ? `${summary.payingMonthlyMembersCount} pagantes · ${summary.exemptMonthlyMembersCount} isentos`
              : `${summary.monthlyMembersCount} de ${summary.groupMembersCount} mensalistas`}
            variant="outlined"
          />
        </Stack>
      </Box>

      <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } } }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' },
            gap: 1,
          }}
        >
          {summaryItems.map((item) => (
            <Box
              key={item.label}
              sx={{
                minWidth: 0,
                p: 1.25,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'background.paper',
              }}
            >
              <Stack direction="row" alignItems="center" spacing={0.75} color="text.secondary">
                {item.icon}
                <Typography variant="caption" fontWeight={700} noWrap>{item.label}</Typography>
              </Stack>
              <Typography mt={0.5} variant="subtitle1" fontWeight={800} noWrap>
                {item.value}
              </Typography>
            </Box>
          ))}
        </Box>

        <Box mt={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1} mb={1}>
            <Typography variant="subtitle2" fontWeight={800}>Agenda que forma o rateio</Typography>
            {summary.excludedGamesCount > 0 && (
              <Typography variant="caption" color="text.secondary">
                {summary.excludedGamesCount} fora do cálculo
              </Typography>
            )}
          </Stack>
          {agendaGames.length === 0 ? (
            <Alert severity="warning">Nenhuma ocorrência encontrada neste mês. Revise a agenda do grupo.</Alert>
          ) : (
            <Box
              component="ul"
              sx={{
                m: 0,
                p: 0,
                display: 'grid',
                gap: 1,
              }}
            >
              {agendaGames.map((game) => {
                const includedGame = includedGameById.get(game.id);
                return (
                <MonthlyGameRow
                  key={game.id}
                  game={game}
                  allocatedCostCents={includedGame?.allocatedCostCents ?? 0}
                  pricingMode={summary.pricingMode}
                  defaultGameCostCents={input.defaultGameCostCents}
                  locale={locale}
                  canManage={canManageGames}
                  busy={busyGameIds.has(game.id)}
                  error={gameOverrideErrors[game.id]}
                  onSetOverride={onSetGameOverride}
                />
                );
              })}
            </Box>
          )}
          {agendaGames.length > 0 && summary.games.length === 0 && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              Todas as ocorrências estão fora do rateio. Inclua ao menos uma para calcular o mês.
            </Alert>
          )}
        </Box>

        <Box
          mt={2}
          p={1.5}
          sx={{
            borderRadius: 1,
            bgcolor: alpha(theme.palette.success.main, 0.07),
            border: 1,
            borderColor: alpha(theme.palette.success.main, 0.24),
          }}
        >
          <Stack direction="row" justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="caption" color="text.secondary">Recebido</Typography>
              <Typography fontWeight={800} color="success.main">
                {formatCurrency(summary.receivedCents, locale)}
              </Typography>
            </Box>
            <Box textAlign="right">
              <Typography variant="caption" color="text.secondary">Em aberto</Typography>
              <Typography fontWeight={800} color={summary.openCents > 0 ? 'warning.main' : 'success.main'}>
                {formatCurrency(summary.openCents, locale)}
              </Typography>
            </Box>
          </Stack>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1}>
          <Typography variant="subtitle1" fontWeight={800}>Lista do grupo</Typography>
          <Typography variant="caption" color="text.secondary">
            {canManage
              ? 'Selecione quem participa do mensal'
              : canSettle
                ? 'Lista fechada; baixas liberadas'
                : 'Somente leitura'}
          </Typography>
        </Stack>

        <List disablePadding aria-label="Mensalistas do grupo">
          {sortedMembers.map((member, index) => {
            const isBusy = busyMemberIds.has(member.userId);
            const canSettleMember = canSettle && member.isMonthly &&
              (member.status === 'PENDING' || member.status === 'PARTIAL') &&
              member.openCents > 0 &&
              Boolean(onSettleMember);

            return (
              <Box key={member.userId}>
                {index > 0 && <Divider component="li" />}
                <ListItem
                  disableGutters
                  sx={{ py: 1.25, alignItems: 'center' }}
                  secondaryAction={
                    canManage ? (
                      <Switch
                        edge="end"
                        checked={member.isMonthly}
                        disabled={isBusy || !onToggleMonthlyMember}
                        onChange={(_, checked) => onToggleMonthlyMember?.(member.userId, checked)}
                        inputProps={{ 'aria-label': `${member.name} é mensalista` }}
                      />
                    ) : undefined
                  }
                >
                  <ListItemAvatar>
                    <Avatar src={member.photoUrl} alt={member.name}>
                      {member.name.trim().charAt(0).toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Stack direction="row" alignItems="center" spacing={1} useFlexGap flexWrap="wrap">
                        <Typography variant="body2" fontWeight={750}>{member.name}</Typography>
                        {member.isMonthly && (
                          <Chip
                            size="small"
                            label={STATUS_LABELS[member.status]}
                            color={STATUS_COLORS[member.status]}
                            variant={member.status === 'PAID' ? 'filled' : 'outlined'}
                          />
                        )}
                      </Stack>
                    }
                    secondary={memberSecondaryText(member, locale)}
                    secondaryTypographyProps={{ variant: 'caption' }}
                    sx={{ pr: canManage ? 6 : 0 }}
                  />
                </ListItem>
                {canSettleMember && (
                  <Box sx={{ mt: -0.75, mb: 1.25, ml: 7 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      color="success"
                      startIcon={isBusy ? <CircularProgress size={14} /> : <CheckCircleIcon />}
                      disabled={isBusy}
                      onClick={() => onSettleMember?.({
                        periodKey: summary.periodKey,
                        userId: member.userId,
                        userName: member.name,
                        expectedCents: member.expectedCents,
                        alreadyPaidCents: member.paidCents,
                        amountToSettleCents: member.openCents,
                      })}
                    >
                      Dar baixa de {formatCurrency(member.openCents, locale)}
                    </Button>
                  </Box>
                )}
              </Box>
            );
          })}
        </List>

        {summary.payingMonthlyMembersCount === 0 && (
          <Alert severity="info" sx={{ mt: 1 }}>
            Escolha ao menos um mensalista pagante para calcular o valor por jogador.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
