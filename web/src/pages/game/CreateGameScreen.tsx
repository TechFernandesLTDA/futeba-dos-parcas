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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Divider,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  ArrowForward as NextIcon,
  Add as AddIcon,
  Save as SaveIcon,
  ContentCopy as TemplateIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { FormScaffold, AdaptiveFormSheet } from '../../components/layout';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useCreateGame } from '../../hooks/useGames';
import { useGroupDetail, useGroups } from '../../hooks/useGroups';
import { useLocations } from '../../hooks/useLocations';
import { useGameTemplates } from '../../hooks/useGameTemplates';
import { FieldType, PixKeyType, GameVisibility } from '../../types/game';
import { FIELD_TYPE_LABELS, PIX_KEY_TYPE_LABELS } from '../../types/game';
import { Field } from '../../types/location';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useToast } from '../../contexts/ToastContext';
import { createLogger } from '../../utils/logger';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { getFunctionsErrorMessage } from '../../utils/firebaseErrors';
import { useTranslation } from 'react-i18next';

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
  streamUrl: string;
}

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
  streamUrl: '',
};

export const CreateGameScreen: React.FC = () => {
  useDocumentTitle('Criar Jogo');
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const groupId = searchParams.get('groupId') || undefined;

  const steps = [
    t('games.create.stepLocationDate'),
    t('games.create.stepSettings'),
    t('games.create.stepPayment'),
    t('games.create.stepRules'),
  ];

  const { group } = useGroupDetail(groupId || null);
  const { groups: userGroups, loading: groupsLoading } = useGroups();
  const { createGame, loading, error } = useCreateGame();
  const { locations, loading: locationsLoading, error: locationsError } = useLocations();
  const { templates, loading: templatesLoading, saveTemplate, removeTemplate } = useGameTemplates();
  const { showSuccess, showError } = useToast();
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;
  const tRef = useRef(t);
  tRef.current = t;
  const [useCustomLocation, setUseCustomLocation] = useState(false);
  const [fields, setFields] = useState<Field[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [fieldsError, setFieldsError] = useState<string | null>(null);
  const [cep, setCep] = useState('');
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

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
    } catch (_err) {
        if (cancelled) return;
          logger.error('Erro ao carregar quadras:', _err);
          setFieldsError(tRef.current('games.create.errorLoadFields'));
          showErrorRef.current(tRef.current('games.create.errorLoadFields'));
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

  const handleCepChange = async (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    setCep(digits);
    setCepError(null);

    if (digits.length === 8) {
      setCepLoading(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
        if (!response.ok) throw new Error('CEP não encontrado');
        const data = await response.json();
        if (data.erro) {
          setCepError('CEP não encontrado');
          return;
        }
        const street = [data.logradouro, data.complemento].filter(Boolean).join(', ');
        const area = [data.bairro, data.localidade, data.uf].filter(Boolean).join(', ');
        const fullAddress = area ? `${street} - ${area}` : street;
        setFormData((prev) => ({
          ...prev,
          locationAddress: fullAddress,
          locationName: prev.locationName || data.localidade || '',
        }));
      } catch {
        setCepError('Erro ao buscar CEP. Preencha manualmente.');
      } finally {
        setCepLoading(false);
      }
    }
  };

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
          errors.locationName = useCustomLocation ? t('games.create.errorLocationNameRequired') : t('games.create.errorSelectLocation');
        }
        if (useCustomLocation && !formData.locationAddress.trim()) errors.locationAddress = t('games.create.errorAddressRequired');
        if (!useCustomLocation && formData.locationId && fields.length > 0 && !formData.fieldId) {
          errors.fieldId = t('games.create.errorSelectField');
        }
        if (!formData.date) errors.date = t('games.create.errorDateRequired');
        if (!formData.time) errors.time = t('games.create.errorTimeRequired');
        break;
      case 1:
        if (formData.maxPlayers < 2 || formData.maxPlayers > 50) {
          errors.maxPlayers = t('games.create.errorPlayersRange');
        }
        if (formData.maxGoalkeepers < 0 || formData.maxGoalkeepers > 10) {
          errors.maxGoalkeepers = t('games.create.errorMaxGoalkeepers');
        }
        break;
      case 2:
        if (formData.pixPaymentEnabled) {
          if (!formData.pixKey.trim()) errors.pixKey = t('games.create.errorPixKeyRequired');
          if (!formData.pixBeneficiaryName.trim()) {
            errors.pixBeneficiaryName = t('games.create.errorPixBeneficiaryRequired');
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

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      showError('Digite um nome para o template.');
      return;
    }
    setSavingTemplate(true);
    try {
      await saveTemplate({
        name: templateName.trim(),
        max_players: formData.maxPlayers,
        max_goalkeepers: formData.maxGoalkeepers,
        location_id: formData.locationId || undefined,
        location_name: formData.locationName || undefined,
        field_id: formData.fieldId || undefined,
        field_name: formData.fieldName || undefined,
        field_type: formData.fieldType,
        rules: formData.rules || undefined,
      });
      showSuccess('Template salvo com sucesso!');
      setTemplateDialogOpen(false);
      setTemplateName('');
    } catch {
      showError('Erro ao salvar template.');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleLoadTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    setFormData((prev) => ({
      ...prev,
      maxPlayers: template.max_players,
      maxGoalkeepers: template.max_goalkeepers,
      locationId: template.location_id || '',
      locationName: template.location_name || '',
      fieldId: template.field_id || '',
      fieldName: template.field_name || '',
      fieldType: template.field_type || prev.fieldType,
      gameType: template.field_type || prev.gameType,
      rules: template.rules || '',
    }));
    setUserInteracted(true);
    showSuccess(`Template "${template.name}" carregado.`);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await removeTemplate(templateId);
      showSuccess('Template removido.');
    } catch {
      showError('Erro ao remover template.');
    }
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
            showError(t('games.create.conflictExists', { time: g.time }));
            return;
          }
        } catch (overlapErr) {
          // #1334: a verificação de conflito de horário falhou (ex.: erro
          // transiente do Firestore). NÃO bloqueamos a criação — um erro
          // transiente não deve impedir um jogo legítimo — mas avisamos o
          // usuário em vez de falhar em silêncio (risco de double-booking).
          logger.error('Erro ao verificar sobreposição de horários:', overlapErr);
          showError(t('games.create.conflictCheckFailed'));
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
      if (formData.streamUrl.trim()) {
        gamePayload.streamUrl = formData.streamUrl.trim();
      }

      const gameId = await createGame(gamePayload as Partial<import('../../types/game').Game>);
      showSuccess(t('games.create.createSuccess'));
      navigate(`/game/${gameId}`);
    } catch (err: unknown) {
      logger.error('Error creating game:', err);
      showError(getFunctionsErrorMessage(err, 'createGame', t('games.create.createError')));
    }
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {formData.groupName && (
              <Alert severity="info">
                {t('games.create.creatingForGroup')} <strong>{formData.groupName}</strong>
              </Alert>
            )}

            {!groupId && userGroups && userGroups.length > 0 && (
              <TextField
                select
                label={t('games.create.group')}
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
                helperText={groupsLoading ? t('games.create.loadingGroups') : t('games.create.selectGroupOptional')}
                fullWidth
              >
                <MenuItem value="">
                  <em>{t('games.create.noGroup')}</em>
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
              label={t('games.create.fieldOrLocation')}
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
              helperText={formErrors.locationName || (locationsLoading ? t('games.create.loadingFields') : t('games.create.fieldsAvailable', { count: locations.length }))}
              fullWidth
              required
            >
              {locations.map((loc) => (
                <MenuItem key={loc.id} value={loc.id}>
                  {loc.name} {loc.city ? `— ${loc.city}` : ''}
                </MenuItem>
              ))}
              <MenuItem value={CUSTOM_LOCATION}>
                {t('games.create.otherLocation')}
              </MenuItem>
            </TextField>

            {/* Campos manuais (quando "Outro local" selecionado) */}
            {useCustomLocation && (
              <>
                <TextField
                  label="CEP"
                  value={cep}
                  onChange={(e) => handleCepChange(e.target.value)}
                  fullWidth
                  placeholder="00000000"
                  error={!!cepError}
                  helperText={cepError || (cepLoading ? 'Buscando endereço...' : 'Digite o CEP para preencher automaticamente')}
                  InputProps={{
                    endAdornment: cepLoading ? (
                      <InputAdornment position="end">
                        <CircularProgress size={20} />
                      </InputAdornment>
                    ) : undefined,
                  }}
                  inputProps={{ inputMode: 'numeric', maxLength: 8 }}
                />

                <TextField
                  label={t('games.create.locationName')}
                  value={formData.locationName}
                  onChange={(e) => handleInputChange('locationName', e.target.value)}
                  error={!!formErrors.locationName}
                  helperText={formErrors.locationName}
                  fullWidth
                  required
                  placeholder={t('games.create.locationNamePlaceholder')}
                />

                <TextField
                  label={t('games.create.fullAddress')}
                  value={formData.locationAddress}
                  onChange={(e) => handleInputChange('locationAddress', e.target.value)}
                  error={!!formErrors.locationAddress}
                  helperText={formErrors.locationAddress}
                  fullWidth
                  required
                  placeholder={t('games.create.fullAddressPlaceholder')}
                />
              </>
            )}

            {/* Seletor de quadra (quando local selecionado e tem quadras) */}
            {!useCustomLocation && formData.locationId && (
              fieldsLoading ? (
                <Alert severity="info" icon={false}>
                  {t('games.create.loadingFields')}
                </Alert>
              ) : fieldsError ? (
                <Alert severity="error" icon={false}>
                  {fieldsError}
                </Alert>
              ) : fields.length > 0 ? (
                <TextField
                  select
                  label={t('games.create.field')}
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
                  helperText={formErrors.fieldId || t('games.create.fieldsAtLocation', { count: fields.length })}
                  fullWidth
                  required
                >
                  {fields.map((f) => (
                    <MenuItem key={f.id} value={f.id}>
                      {f.name} — {FIELD_TYPE_LABELS[f.type as FieldType] || f.type}
                      {f.hourlyPrice ? ` (R$ ${f.hourlyPrice})` : ''}
                      {f.isCovered ? ` · ${t('games.create.covered')}` : ''}
                    </MenuItem>
                  ))}
                </TextField>
              ) : (
                <Alert severity="warning" icon={false}>
                  {t('games.create.noFieldsAtLocation')}
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
              label={t('games.create.date')}
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
                label={t('games.create.startTime')}
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
                label={t('games.create.endTime')}
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
              label={t('games.create.fieldTypeLabel')}
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
                label={t('games.create.maxPlayers')}
                type="number"
                value={formData.maxPlayers}
                onChange={(e) => { const v = parseInt(e.target.value); handleInputChange('maxPlayers', isNaN(v) ? 14 : v); }}
                error={!!formErrors.maxPlayers}
                helperText={formErrors.maxPlayers}
                fullWidth
                inputProps={{ min: 2, max: 50 }}
              />

              <TextField
                label={t('games.create.maxGoalkeepers')}
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
              label={t('games.create.numberOfTeams')}
              type="number"
              value={formData.numberOfTeams}
              onChange={(e) => { const v = parseInt(e.target.value); handleInputChange('numberOfTeams', isNaN(v) ? 2 : v); }}
              fullWidth
              inputProps={{ min: 2, max: 4 }}
            />

            <FormControl>
              <FormLabel>{t('games.create.visibility')}</FormLabel>
              <RadioGroup
                value={formData.visibility}
                onChange={(e) => handleInputChange('visibility', e.target.value as GameVisibility)}
              >
                <FormControlLabel
                  value="GROUP_ONLY"
                  control={<Radio />}
                  label={t('games.create.visibilityGroupOnly')}
                />
                <FormControlLabel
                  value="PUBLIC_CLOSED"
                  control={<Radio />}
                  label={t('games.create.visibilityPublicClosed')}
                />
                <FormControlLabel
                  value="PUBLIC_OPEN"
                  control={<Radio />}
                  label={t('games.create.visibilityPublicOpen')}
                />
              </RadioGroup>
            </FormControl>

            <Card sx={{ p: 1, bgcolor: 'action.hover' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    {t('games.create.recurrence')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('games.create.recurrenceDesc')}
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
                  label={t('games.create.frequency')}
                  value={formData.recurrenceType}
                  onChange={(e) => handleInputChange('recurrenceType', e.target.value as 'weekly' | 'biweekly' | 'monthly')}
                  fullWidth
                  size="small"
                  sx={{ mt: 1 }}
                >
                  <MenuItem value="weekly">{t('games.create.frequencyWeekly')}</MenuItem>
                  <MenuItem value="biweekly">{t('games.create.frequencyBiweekly')}</MenuItem>
                  <MenuItem value="monthly">{t('games.create.frequencyMonthly')}</MenuItem>
                </TextField>
              )}
            </Card>
          </Box>
        );

      case 2:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              label={t('games.create.pricePerPlayer')}
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
              label={t('games.create.acceptPix')}
            />

            {formData.pixPaymentEnabled && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pl: 2 }}>
                <TextField
                  select
                  label={t('games.create.pixKeyType')}
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
                  label={t('games.create.pixKey')}
                  value={formData.pixKey}
                  onChange={(e) => handleInputChange('pixKey', e.target.value)}
                  error={!!formErrors.pixKey}
                  helperText={formErrors.pixKey}
                  fullWidth
                  required
                />

                <TextField
                  label={t('games.create.pixBeneficiaryName')}
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
              label={t('games.create.gameRules')}
              value={formData.rules}
              onChange={(e) => handleInputChange('rules', e.target.value)}
              fullWidth
              multiline
              rows={6}
              placeholder={t('games.create.gameRulesPlaceholder')}
            />

            <TextField
              label="URL da Live Stream (YouTube/Twitch)"
              value={formData.streamUrl}
              onChange={(e) => handleInputChange('streamUrl', e.target.value)}
              fullWidth
              placeholder="https://youtube.com/watch?v=... ou https://twitch.tv/..."
              helperText="Opcional. Cole uma URL do YouTube ou Twitch para transmitir ao vivo."
            />

            <Alert severity="info">
              {t('games.create.rulesShownInfo')}
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
      title={t('games.createGame')}
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
            {t('games.create.errorLoadLocations', { error: locationsError })}
          </Alert>
        )}

        <Card sx={{ mb: 2, bgcolor: 'action.hover' }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <TemplateIcon color="action" />
            <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>
              Templates
            </Typography>
            <TextField
              select
              size="small"
              label="Carregar template"
              value=""
              onChange={(e) => handleLoadTemplate(e.target.value)}
              disabled={templatesLoading || templates.length === 0}
              sx={{ minWidth: 160 }}
            >
              {templates.map((tpl) => (
                <MenuItem key={tpl.id} value={tpl.id} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  {tpl.name}
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(tpl.id); }}
                    sx={{ ml: 1 }}
                    aria-label={`Remover template ${tpl.name}`}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </MenuItem>
              ))}
              {templates.length === 0 && (
                <MenuItem disabled value="">
                  <em>Nenhum template salvo</em>
                </MenuItem>
              )}
            </TextField>
            <Button
              variant="outlined"
              size="small"
              startIcon={<SaveIcon />}
              onClick={() => setTemplateDialogOpen(true)}
            >
              Salvar como template
            </Button>
          </CardContent>
        </Card>

        <Dialog open={templateDialogOpen} onClose={() => setTemplateDialogOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>Salvar como Template</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Nome do template"
              fullWidth
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Ex: Jogo de domingo"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTemplateDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveTemplate} variant="contained" disabled={savingTemplate || !templateName.trim()}>
              {savingTemplate ? <CircularProgress size={20} /> : 'Salvar'}
            </Button>
          </DialogActions>
        </Dialog>

        <Divider sx={{ mb: 2 }} />

        <Stepper activeStep={activeStep} orientation="vertical" aria-label={t('games.create.stepperLabel')}>
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
                    {t('common.back')}
                  </Button>
                  <Box sx={{ flex: 1 }} />
                  {activeStep === steps.length - 1 ? (
                    <Button
                      variant="contained"
                      onClick={handleSubmit}
                      disabled={loading}
                      endIcon={loading ? <CircularProgress size={20} /> : <AddIcon />}
                    >
                      {t('games.createGame')}
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      onClick={handleNext}
                      endIcon={<NextIcon />}
                    >
                      {t('common.next')}
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
