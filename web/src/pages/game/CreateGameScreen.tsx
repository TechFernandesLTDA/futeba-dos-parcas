import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Container,
  TextField,
  Button,
  Card,
  CardContent,
  MenuItem,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  FormControl,
  FormLabel,
  FormControlLabel,
  Radio,
  RadioGroup,
  Checkbox,
  Switch,
  InputAdornment,
  Alert,
  CircularProgress,
  Typography,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  ArrowForward as NextIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { FormScaffold, AdaptiveFormSheet } from '../../components/layout';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useCreateGame } from '../../hooks/useGames';
import { useGroupDetail, useGroups } from '../../hooks/useGroups';
import { useLocations } from '../../hooks/useLocations';
import { FieldType, PixKeyType, GameVisibility } from '../../types/game';
import { FIELD_TYPE_LABELS, PIX_KEY_TYPE_LABELS } from '../../types/game';
import { Field } from '../../types/location';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useToast } from '../../contexts/ToastContext';
import { createLogger } from '../../utils/logger';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { getFunctionsErrorMessage } from '../../utils/firebaseErrors';

const logger = createLogger('CreateGameScreen');

interface GameFormData {
  locationId: string;
  locationName: string;
  locationAddress: string;
  locationLat?: number;
  locationLng?: number;
  fieldId: string;
  fieldName: string;
  date: string;
  time: string;
  endTime: string;
  fieldType: FieldType;
  gameType: string;
  maxPlayers: number;
  maxGoalkeepers: number;
  numberOfTeams: number;
  dailyPrice: number;
  pixPaymentEnabled: boolean;
  pixKey: string;
  pixKeyType: PixKeyType;
  pixBeneficiaryName: string;
  rules: string;
  groupId?: string;
  groupName?: string;
  visibility: GameVisibility;
  recurrenceEnabled: boolean;
  recurrenceType: 'weekly' | 'biweekly' | 'monthly';
}

const steps = ['Local e Data', 'Configurações', 'Pagamento', 'Regras'];

const CUSTOM_LOCATION = '__custom__';

const defaultFormData: GameFormData = {
  locationId: '',
  locationName: '',
  locationAddress: '',
  fieldId: '',
  fieldName: '',
  date: '',
  time: '',
  endTime: '',
  fieldType: 'SOCIETY',
  gameType: 'SOCIETY',
  maxPlayers: 14,
  maxGoalkeepers: 2,
  numberOfTeams: 2,
  dailyPrice: 0,
  pixPaymentEnabled: false,
  pixKey: '',
  pixKeyType: 'RANDOM',
  pixBeneficiaryName: '',
  rules: '',
  visibility: 'PUBLIC_CLOSED',
  recurrenceEnabled: false,
  recurrenceType: 'weekly',
};

export const CreateGameScreen: React.FC = () => {
  useDocumentTitle('Criar Jogo');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const groupId = searchParams.get('groupId') || undefined;

  const { group } = useGroupDetail(groupId || null);
  const { groups: userGroups, loading: groupsLoading } = useGroups();
  const { createGame, loading, error } = useCreateGame();
  const { locations, loading: locationsLoading, error: locationsError } = useLocations();
  const { showSuccess, showError } = useToast();
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;
  const [useCustomLocation, setUseCustomLocation] = useState(false);
  const [fields, setFields] = useState<Field[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [fieldsError, setFieldsError] = useState<string | null>(null);

  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState<GameFormData>({
    ...defaultFormData,
    groupId: groupId || undefined,
    groupName: group?.name || undefined,
    visibility: groupId ? 'GROUP_ONLY' : 'PUBLIC_CLOSED',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [userInteracted, setUserInteracted] = useState(false);
  const isDirty = userInteracted && JSON.stringify(formData) !== JSON.stringify(defaultFormData);
  // beforeunload + useBlocker tratados pelo FormScaffold via useDirtyGuard

  // Carregar quadras quando local é selecionado
  useEffect(() => {
    if (!formData.locationId || useCustomLocation) {
      setFields([]);
      return;
    }

    let cancelled = false;

    const loadFields = async () => {
      setFieldsLoading(true);
      setFieldsError(null);
      try {
        // Buscar quadras na subcoleção do local
        const fieldsRef = collection(db, 'locations', formData.locationId, 'fields');
        const q = query(fieldsRef, orderBy('name', 'asc'));
        const snapshot = await getDocs(q);
        if (cancelled) return;
        let fieldsData = snapshot.docs
          .map((d) => ({ ...snakeToCamel<Field>(d.data()), id: d.id }))
          .filter((f) => f.isActive !== false);

        // Se não encontrou na subcoleção, tentar root collection
        if (fieldsData.length === 0) {
          const rootFieldsRef = collection(db, 'fields');
          const rootQ = query(rootFieldsRef, where('location_id', '==', formData.locationId));
          const rootSnapshot = await getDocs(rootQ);
          if (cancelled) return;
          fieldsData = rootSnapshot.docs
            .map((d) => ({ ...snakeToCamel<Field>(d.data()), id: d.id }))
            .filter((f) => f.isActive !== false);
        }

        if (cancelled) return;
        setFields(fieldsData);

        // Se só tem 1 quadra, selecionar automaticamente
        if (fieldsData.length === 1) {
          const f = fieldsData[0];
          setFormData((prev) => ({
            ...prev,
            fieldId: f.id,
            fieldName: f.name,
            fieldType: (f.type as FieldType) || prev.fieldType,
            gameType: (f.type as string) || prev.gameType,
            dailyPrice: f.hourlyPrice || prev.dailyPrice,
          }));
        }
      } catch (err) {
        if (cancelled) return;
          logger.error('Erro ao carregar quadras:', err);
          setFieldsError('Erro ao carregar quadras. Tente novamente.');
          showErrorRef.current('Erro ao carregar quadras. Tente novamente.');
      } finally {
        if (!cancelled) setFieldsLoading(false);
      }
    };

    loadFields();
    return () => { cancelled = true; };
  }, [formData.locationId, useCustomLocation]);

  useEffect(() => {
    if (group && !formData.groupId) {
      setFormData((prev) => ({
        ...prev,
        groupId: groupId,
        groupName: group.name,
      }));
    }
  }, [group, groupId, formData.groupId]);

  const handleInputChange = <K extends keyof GameFormData>(field: K, value: GameFormData[K]) => {
    setUserInteracted(true);
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validateStep = (step: number): boolean => {
    const errors: Record<string, string> = {};

    switch (step) {
      case 0:
        if (!formData.locationName.trim()) {
          errors.locationName = useCustomLocation ? 'Nome do local é obrigatório' : 'Selecione um local';
        }
        if (useCustomLocation && !formData.locationAddress.trim()) errors.locationAddress = 'Endereço é obrigatório';
        if (!useCustomLocation && formData.locationId && fields.length > 0 && !formData.fieldId) {
          errors.fieldId = 'Selecione uma quadra';
        }
        if (!formData.date) errors.date = 'Data é obrigatória';
        if (!formData.time) errors.time = 'Horário é obrigatório';
        break;
      case 1:
        if (formData.maxPlayers < 2 || formData.maxPlayers > 50) {
          errors.maxPlayers = 'Mínimo 2, máximo 50 jogadores';
        }
        if (formData.maxGoalkeepers < 0 || formData.maxGoalkeepers > 10) {
          errors.maxGoalkeepers = 'Máximo 10 goleiros';
        }
        break;
      case 2:
        if (formData.pixPaymentEnabled) {
          if (!formData.pixKey.trim()) errors.pixKey = 'Chave Pix é obrigatória';
          if (!formData.pixBeneficiaryName.trim()) {
            errors.pixBeneficiaryName = 'Nome do beneficiário é obrigatório';
          }
        }
        break;
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  // Saída agora tratada por FormScaffold (closeDestination + useDirtyGuard)
  const closeDestination = groupId ? `/group/${groupId}` : '/games';

  const handleSubmit = async () => {
    if (!validateStep(activeStep)) return;

    try {
      // Criar dateTime Timestamp a partir de date + time
      const [year, month, day] = formData.date.split('-').map(Number);
      const [hours, minutes] = formData.time.split(':').map(Number);
      const dateTime = Timestamp.fromDate(new Date(year, month - 1, day, hours, minutes));

      // Verificar sobreposição de horários na mesma quadra
      if (formData.fieldId && formData.date) {
        const parseTime = (t: string) => {
          const [h, m] = t.split(':').map(Number);
          return h * 60 + m;
        };
        try {
          const gamesRef = collection(db, 'games');
          const overlapQuery = query(
            gamesRef,
            where('field_id', '==', formData.fieldId),
          );
          const existingGames = await getDocs(overlapQuery);
          const newStart = parseTime(formData.time);
          const newEnd = formData.endTime ? parseTime(formData.endTime) : newStart + 120;
          const conflicting = existingGames.docs.find((d) => {
            const g = d.data();
            if (g.status === 'CANCELLED') return false;
            if (g.date !== formData.date) return false;
            const gStart = g.time ? parseTime(g.time) : 0;
            const gEnd = g.end_time ? parseTime(g.end_time) : gStart + 120;
            return gStart < newEnd && gEnd > newStart;
          });
          if (conflicting) {
            const g = conflicting.data();
            showError(`Já existe um jogo nesta quadra às ${g.time}. Escolha outro horário.`);
            return;
          }
        } catch (overlapErr) {
          // #1334: a verificação de conflito de horário falhou (ex.: erro
          // transiente do Firestore). NÃO bloqueamos a criação — um erro
          // transiente não deve impedir um jogo legítimo — mas avisamos o
          // usuário em vez de falhar em silêncio (risco de double-booking).
          logger.error('Erro ao verificar sobreposição de horários:', overlapErr);
          showError(
            'Não foi possível verificar conflitos de horário nesta quadra. ' +
              'Confira manualmente se já existe outro jogo no mesmo horário.'
          );
        }
      }

      // Montar dados limpos (sem campos undefined)
      const gamePayload: Record<string, unknown> = {
        locationName: formData.locationName,
        locationAddress: formData.locationAddress,
        date: formData.date,
        time: formData.time,
        endTime: formData.endTime || null,
        dateTime,
        fieldType: formData.fieldType,
        gameType: formData.fieldType,
        maxPlayers: formData.maxPlayers,
        maxGoalkeepers: formData.maxGoalkeepers,
        numberOfTeams: formData.numberOfTeams,
        dailyPrice: formData.dailyPrice,
        pixPaymentEnabled: formData.pixPaymentEnabled,
        rules: formData.rules || '',
        visibility: formData.visibility,
        recurrence: formData.recurrenceEnabled ? formData.recurrenceType : 'none',
        team1Name: 'Time 1',
        team2Name: 'Time 2',
        confirmationDeadlineHours: 0,
        requireCheckin: false,
        checkinRadiusMeters: 100,
      };

      // Campos opcionais (só incluir se tiverem valor)
      if (formData.locationId) gamePayload.locationId = formData.locationId;
      if (formData.fieldId) gamePayload.fieldId = formData.fieldId;
      if (formData.fieldName) gamePayload.fieldName = formData.fieldName;
      if (formData.locationLat) gamePayload.locationLat = formData.locationLat;
      if (formData.locationLng) gamePayload.locationLng = formData.locationLng;
      if (formData.groupId) gamePayload.groupId = formData.groupId;
      if (formData.groupName) gamePayload.groupName = formData.groupName;
      if (formData.pixPaymentEnabled) {
        gamePayload.pixKey = formData.pixKey;
        gamePayload.pixKeyType = formData.pixKeyType;
        gamePayload.pixBeneficiaryName = formData.pixBeneficiaryName;
      }

      const gameId = await createGame(gamePayload as Partial<import('../../types/game').Game>);
      showSuccess('Jogo criado com sucesso!');
      navigate(`/game/${gameId}`);
    } catch (err: unknown) {
      logger.error('Error creating game:', err);
      showError(getFunctionsErrorMessage(err, 'createGame', 'Erro ao criar jogo'));
    }
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {formData.groupName && (
              <Alert severity="info">
                Criando jogo para o grupo: <strong>{formData.groupName}</strong>
              </Alert>
            )}

            {!groupId && userGroups && userGroups.length > 0 && (
              <TextField
                select
                label="Grupo"
                value={formData.groupId || ''}
                onChange={(e) => {
                  const selectedGroup = userGroups.find((g) => g.id === e.target.value);
                  setFormData((prev) => ({
                    ...prev,
                    groupId: selectedGroup?.id,
                    groupName: selectedGroup?.name,
                    visibility: selectedGroup ? 'GROUP_ONLY' : prev.visibility,
                  }));
                }}
                helperText={groupsLoading ? 'Carregando grupos...' : 'Selecione um grupo (opcional)'}
                fullWidth
              >
                <MenuItem value="">
                  <em>Sem grupo</em>
                </MenuItem>
                {userGroups.map((g) => (
                  <MenuItem key={g.id} value={g.id}>
                    {g.name}
                  </MenuItem>
                ))}
              </TextField>
            )}

            {/* Seletor de quadras cadastradas */}
            <TextField
              select
              label="Quadra / Local"
              value={useCustomLocation ? CUSTOM_LOCATION : formData.locationId}
              onChange={(e) => {
                const val = e.target.value;
                if (val === CUSTOM_LOCATION) {
                  setUseCustomLocation(true);
                  setFormData((prev) => ({ ...prev, locationId: '', locationName: '', locationAddress: '' }));
                } else {
                  setUseCustomLocation(false);
                  const loc = locations.find((l) => l.id === val);
                  if (loc) {
                    const streetPart = [loc.street, loc.number].filter(Boolean).join(', ');
                    const areaPart = [loc.district, loc.city].filter(Boolean).join(', ');
                    const constructedAddress = areaPart ? `${streetPart} - ${areaPart}` : streetPart;
                    setFormData((prev) => ({
                      ...prev,
                      locationId: loc.id,
                      locationName: loc.name,
                      locationAddress: loc.address || constructedAddress,
                      locationLat: loc.latitude,
                      locationLng: loc.longitude,
                    }));
                  }
                }
              }}
              error={!!formErrors.locationName}
              helperText={formErrors.locationName || (locationsLoading ? 'Carregando quadras...' : `${locations.length} quadras disponíveis`)}
              fullWidth
              required
            >
              {locations.map((loc) => (
                <MenuItem key={loc.id} value={loc.id}>
                  {loc.name} {loc.city ? `— ${loc.city}` : ''}
                </MenuItem>
              ))}
              <MenuItem value={CUSTOM_LOCATION}>
                Outro local (digitar manualmente)
              </MenuItem>
            </TextField>

            {/* Campos manuais (quando "Outro local" selecionado) */}
            {useCustomLocation && (
              <>
                <TextField
                  label="Nome do Local"
                  value={formData.locationName}
                  onChange={(e) => handleInputChange('locationName', e.target.value)}
                  error={!!formErrors.locationName}
                  helperText={formErrors.locationName}
                  fullWidth
                  required
                  placeholder="Ex: Quadra do Parque, Ginásio Municipal"
                />

                <TextField
                  label="Endereço Completo"
                  value={formData.locationAddress}
                  onChange={(e) => handleInputChange('locationAddress', e.target.value)}
                  error={!!formErrors.locationAddress}
                  helperText={formErrors.locationAddress}
                  fullWidth
                  required
                  placeholder="Ex: Rua das Flores, 123 - Centro"
                />
              </>
            )}

            {/* Seletor de quadra (quando local selecionado e tem quadras) */}
            {!useCustomLocation && formData.locationId && (
              fieldsLoading ? (
                <Alert severity="info" icon={false}>
                  Carregando quadras...
                </Alert>
              ) : fieldsError ? (
                <Alert severity="error" icon={false}>
                  {fieldsError}
                </Alert>
              ) : fields.length > 0 ? (
                <TextField
                  select
                  label="Quadra"
                  value={formData.fieldId}
                  onChange={(e) => {
                    const field = fields.find((f) => f.id === e.target.value);
                    if (field) {
                      setFormData((prev) => ({
                        ...prev,
                        fieldId: field.id,
                        fieldName: field.name,
                        fieldType: (field.type as FieldType) || prev.fieldType,
                        gameType: (field.type as string) || prev.gameType,
                        dailyPrice: field.hourlyPrice || prev.dailyPrice,
                      }));
                    }
                  }}
                  error={!!formErrors.fieldId}
                  helperText={formErrors.fieldId || `${fields.length} quadra(s) neste local`}
                  fullWidth
                  required
                >
                  {fields.map((f) => (
                    <MenuItem key={f.id} value={f.id}>
                      {f.name} — {FIELD_TYPE_LABELS[f.type as FieldType] || f.type}
                      {f.hourlyPrice ? ` (R$ ${f.hourlyPrice})` : ''}
                      {f.isCovered ? ' · Coberta' : ''}
                    </MenuItem>
                  ))}
                </TextField>
              ) : (
                <Alert severity="warning" icon={false}>
                  Nenhuma quadra cadastrada neste local. As informações do local serão usadas.
                </Alert>
              )
            )}

            {/* Resumo do local selecionado */}
            {!useCustomLocation && formData.locationName && (
              <Alert severity="success" icon={false}>
                📍 <strong>{formData.locationName}</strong>
                {formData.fieldName && <> — {formData.fieldName}</>}
                <br />
                {formData.locationAddress}
              </Alert>
            )}

            <TextField
              label="Data"
              type="date"
              value={formData.date}
              onChange={(e) => handleInputChange('date', e.target.value)}
              error={!!formErrors.date}
              helperText={formErrors.date}
              fullWidth
              required
              InputLabelProps={{ shrink: true }}
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Horário de Início"
                type="time"
                value={formData.time}
                onChange={(e) => handleInputChange('time', e.target.value)}
                error={!!formErrors.time}
                helperText={formErrors.time}
                fullWidth
                required
                InputLabelProps={{ shrink: true }}
              />

              <TextField
                label="Horário de Término"
                type="time"
                value={formData.endTime}
                onChange={(e) => handleInputChange('endTime', e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Box>
          </Box>
        );

      case 1:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              select
              label="Tipo de Quadra"
              value={formData.fieldType}
              onChange={(e) => { handleInputChange('fieldType', e.target.value as FieldType); }}
              fullWidth
            >
              {Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </TextField>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Máx. Jogadores"
                type="number"
                value={formData.maxPlayers}
                onChange={(e) => { const v = parseInt(e.target.value); handleInputChange('maxPlayers', isNaN(v) ? 14 : v); }}
                error={!!formErrors.maxPlayers}
                helperText={formErrors.maxPlayers}
                fullWidth
                inputProps={{ min: 2, max: 50 }}
              />

              <TextField
                label="Máx. Goleiros"
                type="number"
                value={formData.maxGoalkeepers}
                onChange={(e) => { const v = parseInt(e.target.value); handleInputChange('maxGoalkeepers', isNaN(v) ? 2 : v); }}
                error={!!formErrors.maxGoalkeepers}
                helperText={formErrors.maxGoalkeepers}
                fullWidth
                inputProps={{ min: 0, max: 10 }}
              />
            </Box>

            <TextField
              label="Número de Times"
              type="number"
              value={formData.numberOfTeams}
              onChange={(e) => { const v = parseInt(e.target.value); handleInputChange('numberOfTeams', isNaN(v) ? 2 : v); }}
              fullWidth
              inputProps={{ min: 2, max: 4 }}
            />

            <FormControl>
              <FormLabel>Visibilidade</FormLabel>
              <RadioGroup
                value={formData.visibility}
                onChange={(e) => handleInputChange('visibility', e.target.value as GameVisibility)}
              >
                <FormControlLabel
                  value="GROUP_ONLY"
                  control={<Radio />}
                  label="Apenas membros do grupo"
                />
                <FormControlLabel
                  value="PUBLIC_CLOSED"
                  control={<Radio />}
                  label="Público (lista fechada)"
                />
                <FormControlLabel
                  value="PUBLIC_OPEN"
                  control={<Radio />}
                  label="Público (aceita solicitações)"
                />
              </RadioGroup>
            </FormControl>

            <Card sx={{ p: 1, bgcolor: 'action.hover' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    Recorrência
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Criar jogos automaticamente
                  </Typography>
                </Box>
                <Switch
                  checked={formData.recurrenceEnabled}
                  onChange={(e) => handleInputChange('recurrenceEnabled', e.target.checked)}
                />
              </Box>
              {formData.recurrenceEnabled && (
                <TextField
                  select
                  label="Frequência"
                  value={formData.recurrenceType}
                  onChange={(e) => handleInputChange('recurrenceType', e.target.value as 'weekly' | 'biweekly' | 'monthly')}
                  fullWidth
                  size="small"
                  sx={{ mt: 1 }}
                >
                  <MenuItem value="weekly">Semanal</MenuItem>
                  <MenuItem value="biweekly">Quinzenal</MenuItem>
                  <MenuItem value="monthly">Mensal</MenuItem>
                </TextField>
              )}
            </Card>
          </Box>
        );

      case 2:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              label="Valor por Jogador"
              type="number"
              value={formData.dailyPrice}
              onChange={(e) => { const v = parseFloat(e.target.value); handleInputChange('dailyPrice', isNaN(v) ? 0 : v); }}
              fullWidth
              InputProps={{
                startAdornment: <InputAdornment position="start">R$</InputAdornment>,
              }}
              inputProps={{ min: 0, step: 0.01 }}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.pixPaymentEnabled}
                  onChange={(e) => handleInputChange('pixPaymentEnabled', e.target.checked)}
                />
              }
              label="Aceitar pagamento via Pix"
            />

            {formData.pixPaymentEnabled && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pl: 2 }}>
                <TextField
                  select
                  label="Tipo de Chave Pix"
                  value={formData.pixKeyType}
                  onChange={(e) => handleInputChange('pixKeyType', e.target.value as PixKeyType)}
                  fullWidth
                >
                  {Object.entries(PIX_KEY_TYPE_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  label="Chave Pix"
                  value={formData.pixKey}
                  onChange={(e) => handleInputChange('pixKey', e.target.value)}
                  error={!!formErrors.pixKey}
                  helperText={formErrors.pixKey}
                  fullWidth
                  required
                />

                <TextField
                  label="Nome do Beneficiário"
                  value={formData.pixBeneficiaryName}
                  onChange={(e) => handleInputChange('pixBeneficiaryName', e.target.value)}
                  error={!!formErrors.pixBeneficiaryName}
                  helperText={formErrors.pixBeneficiaryName}
                  fullWidth
                  required
                />
              </Box>
            )}
          </Box>
        );

      case 3:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              label="Regras do Jogo"
              value={formData.rules}
              onChange={(e) => handleInputChange('rules', e.target.value)}
              fullWidth
              multiline
              rows={6}
              placeholder="Ex: Jogadores devem chegar 15min antes...
- Não é permitido chute a gol sem camisa
- Cartão vermelho = R$10 a mais
- Bebidas não permitidas na quadra..."
            />

            <Alert severity="info">
              As regras serão exibidas para todos os jogadores confirmados.
            </Alert>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <AdaptiveFormSheet closeDestination={closeDestination} isDirty={isDirty}>
    <FormScaffold
      title="Criar Jogo"
      closeDestination={closeDestination}
      closeVariant="X"
      isDirty={isDirty}
      loading={loading}
    >
      <Container maxWidth="sm" disableGutters sx={{ py: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} role="alert" aria-live="assertive">
            {error}
          </Alert>
        )}
        {locationsError && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Erro ao carregar locais: {locationsError}. Tente recarregar a página.
          </Alert>
        )}

        <Stepper activeStep={activeStep} orientation="vertical" aria-label="Etapas de criação do jogo">
          {steps.map((label, index) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
              <StepContent>
                <Card sx={{ mt: 2, mb: 2 }}>
                  <CardContent>{renderStepContent(index)}</CardContent>
                </Card>

                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <Button
                    disabled={activeStep === 0}
                    onClick={handleBack}
                    startIcon={<BackIcon />}
                  >
                    Voltar
                  </Button>
                  <Box sx={{ flex: 1 }} />
                  {activeStep === steps.length - 1 ? (
                    <Button
                      variant="contained"
                      onClick={handleSubmit}
                      disabled={loading}
                      endIcon={loading ? <CircularProgress size={20} /> : <AddIcon />}
                    >
                      Criar Jogo
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      onClick={handleNext}
                      endIcon={<NextIcon />}
                    >
                      Próximo
                    </Button>
                  )}
                </Box>
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </Container>
    </FormScaffold>
    </AdaptiveFormSheet>
  );
};
