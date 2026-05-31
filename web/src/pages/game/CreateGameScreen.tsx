import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Container,
  TextField,
  Button,
  Card,
  CardContent,
  MenuItem,
  FormControl,
  FormLabel,
  FormHelperText,
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
  Chip,
  Collapse,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  Add as AddIcon,
  Save as SaveIcon,
  ContentCopy as TemplateIcon,
  Delete as DeleteIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  History as HistoryIcon,
  ContentPaste as ContentPasteIcon,
} from '@mui/icons-material';
import { FormScaffold, AdaptiveFormSheet } from '../../components/layout';
import { ShareDialog } from '../../components/game/ShareDialog';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useCreateGame } from '../../hooks/useGames';
import { useGroupDetail, useGroups } from '../../hooks/useGroups';
import { useLocations } from '../../hooks/useLocations';
import { useGameTemplates } from '../../hooks/useGameTemplates';
import { usePopularTimes } from '../../hooks/usePopularTimes';
import { useDuplicateGame } from '../../hooks/useDuplicateGame';
import { useAutoInviteMembers } from '../../hooks/useAutoInviteMembers';
import { useRecentLocations, toggleFavoriteLocation } from '../../hooks/useRecentLocations';
import { FieldType, PixKeyType, GameVisibility } from '../../types/game';
import { FIELD_TYPE_LABELS, PIX_KEY_TYPE_LABELS } from '../../types/game';
import { Field } from '../../types/location';
import { snakeToCamel, normalizeField } from '../../utils/firestoreHelpers';
import { useToast } from '../../contexts/ToastContext';
import { createLogger } from '../../utils/logger';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { getFunctionsErrorMessage } from '../../utils/firebaseErrors';
import { useTranslation } from 'react-i18next';
import { GAME_VALIDATION } from '../../utils/validationConstants';
import { saveDraft, loadDraft, clearDraft } from '../../utils/gameDraft';
import { getNextRecurrenceDates, formatRecurrencePreview } from '../../utils/recurrencePreview';

const logger = createLogger('CreateGameScreen');

const DEFAULT_GAME_DURATION_MINUTES = 60;
const TIME_SLOTS = [
  '18:00', '18:30', '19:00', '19:30',
  '20:00', '20:30', '21:00', '21:30',
  '22:00', '22:30', '23:00',
];

const parseTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const formatTime = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

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
  totalCost: number;
  dailyPrice: number;
  priceManualOverride: boolean;
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
  maxPlayers: GAME_VALIDATION.MAX_PLAYERS / 2,
  maxGoalkeepers: 2,
  numberOfTeams: 2,
  totalCost: 0,
  dailyPrice: 0,
  priceManualOverride: false,
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

  const { group } = useGroupDetail(groupId || null);
  const { groups: userGroups, loading: groupsLoading } = useGroups();
  const { createGame, loading, error } = useCreateGame();
  const { locations, loading: locationsLoading, error: locationsError } = useLocations();
  const { templates, loading: templatesLoading, saveTemplate, removeTemplate } = useGameTemplates();
  const { autoInvite } = useAutoInviteMembers();
  const { recentGames, loading: duplicateGamesLoading } = useDuplicateGame();
  const { recentIds, favoriteIds, isFavorite } = useRecentLocations();
  const { showSuccess, showError } = useToast();
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;
  const tRef = useRef(t);
  tRef.current = t;

  const [useCustomLocation, setUseCustomLocation] = useState(false);
  const [fields, setFields] = useState<Field[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [fieldsError, setFieldsError] = useState<string | null>(null);
  const fieldLoadRequestId = useRef(0);
  const [cep, setCep] = useState('');
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [paymentExpanded, setPaymentExpanded] = useState(false);
  const [rulesExpanded, setRulesExpanded] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [createdGameData, setCreatedGameData] = useState<{
    gameId: string;
    date: string;
    time: string;
    endTime: string;
    locationName: string;
    fieldName: string;
    locationAddress: string;
    maxPlayers: number;
    dailyPrice: number;
    rules: string;
  } | null>(null);

  const [formData, setFormData] = useState<GameFormData>(() => {
    const initial: GameFormData = {
      ...defaultFormData,
      groupId: groupId || undefined,
      groupName: group?.name || undefined,
      visibility: (groupId ? 'GROUP_ONLY' : 'PUBLIC_CLOSED') as GameVisibility,
    };
    const draft = loadDraft('create_game');
    if (draft) {
      return { ...initial, ...draft.data } as GameFormData;
    }
    return initial;
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [userInteracted, setUserInteracted] = useState(false);
  const isDirty = userInteracted && JSON.stringify(formData) !== JSON.stringify(defaultFormData);
  const [draftRestored, setDraftRestored] = useState(false);

  const { popularTimes } = usePopularTimes(formData.fieldId);

  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraftRestoringRef = useRef(false);

  // Auto-save draft debounced
  useEffect(() => {
    if (!userInteracted || isDraftRestoringRef.current) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      const { ...data } = formData;
      saveDraft('create_game', data as unknown as Record<string, unknown>);
    }, 2000);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [formData, userInteracted]);

  // Mark draft as restored after first render
  useEffect(() => {
    isDraftRestoringRef.current = true;
    const draft = loadDraft('create_game');
    if (draft) setDraftRestored(true);
    const timer = setTimeout(() => {
      isDraftRestoringRef.current = false;
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Recurrence preview
  const recurrencePreview = formData.recurrenceEnabled && formData.date && formData.time
    ? formatRecurrencePreview(getNextRecurrenceDates(formData.date, formData.time, formData.recurrenceType, 4))
    : [];

  // Carregar quadras quando local é selecionado
  useEffect(() => {
    setFields([]);
    if (!formData.locationId || useCustomLocation) return;

    let cancelled = false;
    const currentRequestId = ++fieldLoadRequestId.current;

    const loadFields = async () => {
      setFieldsLoading(true);
      setFieldsError(null);
      try {
        const fieldsRef = collection(db, 'locations', formData.locationId, 'fields');
        const q = query(fieldsRef, orderBy('name', 'asc'));
        const snapshot = await getDocs(q);
        if (cancelled || currentRequestId !== fieldLoadRequestId.current) return;
        let fieldsData = snapshot.docs
          .map((d) => normalizeField<Field>({ ...snakeToCamel<Field>(d.data()), id: d.id }))
          .filter((f) => f.isActive !== false);

        const rootFieldsRef = collection(db, 'fields');
        const rootQ = query(rootFieldsRef, where('location_id', '==', formData.locationId));
        const rootSnapshot = await getDocs(rootQ);
        if (cancelled || currentRequestId !== fieldLoadRequestId.current) return;

        const merged = new Map<string, Field>();
        for (const f of fieldsData) merged.set(f.id, f);
        for (const d of rootSnapshot.docs) {
          const field = normalizeField<Field>({ ...snakeToCamel<Field>(d.data()), id: d.id });
          if (field.isActive !== false && !merged.has(field.id)) {
            merged.set(field.id, field);
          }
        }
        fieldsData = Array.from(merged.values());

        if (cancelled || currentRequestId !== fieldLoadRequestId.current) return;
        setFields(fieldsData);

        if (fieldsData.length === 1) {
          const f = fieldsData[0];
          setFormData((prev) => ({
            ...prev,
            fieldId: f.id,
            fieldName: f.name,
            fieldType: (f.type as FieldType) || prev.fieldType,
            gameType: (f.type as string) || prev.gameType,
            totalCost: f.hourlyPrice || prev.totalCost,
            dailyPrice: prev.priceManualOverride ? prev.dailyPrice : Math.round((f.hourlyPrice || prev.totalCost) / prev.maxPlayers * 100) / 100,
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

  // Auto-calculate price per player
  useEffect(() => {
    if (!formData.priceManualOverride && formData.totalCost > 0 && formData.maxPlayers > 0) {
      const calculated = Math.round((formData.totalCost / formData.maxPlayers) * 100) / 100;
      if (calculated !== formData.dailyPrice) {
        setFormData((prev) => ({ ...prev, dailyPrice: calculated }));
      }
    }
  }, [formData.totalCost, formData.maxPlayers, formData.priceManualOverride, formData.dailyPrice]);

  useEffect(() => {
    if (group && !formData.groupId) {
      setFormData((prev) => ({
        ...prev,
        groupId: groupId,
        groupName: group.name,
      }));
    }
  }, [group, groupId, formData.groupId]);

  const cepAbortRef = useRef<AbortController | null>(null);

  const handleCepChange = async (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    setCep(digits);
    setCepError(null);

    if (digits.length === 8) {
      cepAbortRef.current?.abort();
      const controller = new AbortController();
      cepAbortRef.current = controller;

      setCepLoading(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
          signal: controller.signal,
        });
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
          locationName: prev.locationName || `Quadra ${data.logradouro?.split(' ')[0] || data.localidade || ''}`,
        }));
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') return;
        setCepError('Erro ao buscar CEP. Preencha manualmente.');
      } finally {
        setCepLoading(false);
      }
    }
  };

  const handleInputChange = useCallback(<K extends keyof GameFormData>(field: K, value: GameFormData[K]) => {
    setUserInteracted(true);
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: '' }));
    }
  }, [formErrors]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.locationName.trim()) {
      errors.locationName = useCustomLocation ? t('games.create.errorLocationNameRequired') : t('games.create.errorSelectLocation');
    }
    if (useCustomLocation && !formData.locationAddress.trim()) errors.locationAddress = t('games.create.errorAddressRequired');
    if (!useCustomLocation && formData.locationId && fields.length > 0 && !formData.fieldId) {
      errors.fieldId = t('games.create.errorSelectField');
    }
    if (!formData.date) {
      errors.date = t('games.create.errorDateRequired');
    } else {
      const today = new Date().toISOString().split('T')[0];
      if (formData.date < today) errors.date = t('games.create.errorDatePast');
    }
    if (!formData.time) {
      errors.time = t('games.create.errorTimeRequired');
    } else if (formData.endTime && formData.endTime <= formData.time) {
      errors.endTime = t('games.create.errorEndTimeBeforeStart');
    }
    if (formData.visibility === 'GROUP_ONLY' && !formData.groupId) {
      errors.visibility = t('games.create.errorGroupRequiredForVisibility');
    }
    if (formData.streamUrl.trim() && !/^https?:\/\/.+\..+/.test(formData.streamUrl.trim())) {
      errors.streamUrl = t('games.create.errorStreamUrlInvalid');
    }

    if (formData.maxPlayers < GAME_VALIDATION.MIN_PLAYERS || formData.maxPlayers > GAME_VALIDATION.MAX_PLAYERS) {
      errors.maxPlayers = `Mínimo ${GAME_VALIDATION.MIN_PLAYERS} e máximo ${GAME_VALIDATION.MAX_PLAYERS} jogadores`;
    }
    if (formData.maxGoalkeepers < GAME_VALIDATION.MIN_GOALKEEPERS || formData.maxGoalkeepers > GAME_VALIDATION.MAX_GOALKEEPERS) {
      errors.maxGoalkeepers = `Mínimo ${GAME_VALIDATION.MIN_GOALKEEPERS} e máximo ${GAME_VALIDATION.MAX_GOALKEEPERS} goleiros`;
    }
    if (formData.numberOfTeams < GAME_VALIDATION.MIN_TEAMS || formData.numberOfTeams > GAME_VALIDATION.MAX_TEAMS) {
      errors.numberOfTeams = `Mínimo ${GAME_VALIDATION.MIN_TEAMS} e máximo ${GAME_VALIDATION.MAX_TEAMS} times`;
    }

    if (formData.totalCost < GAME_VALIDATION.MIN_PRICE) {
      errors.totalCost = 'Preço não pode ser negativo';
    }

    if (formData.pixPaymentEnabled) {
      if (!formData.pixKey.trim()) errors.pixKey = t('games.create.errorPixKeyRequired');
      if (!formData.pixBeneficiaryName.trim()) errors.pixBeneficiaryName = t('games.create.errorPixBeneficiaryRequired');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
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

  const handleSaveTemplate = async () => {
    if (templateName.trim().length < 3) {
      showError('O nome do template deve ter pelo menos 3 caracteres.');
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

  const handleDuplicateGame = (gameId: string) => {
    const game = recentGames.find((g) => g.id === gameId);
    if (!game) return;

    setFormData((prev) => ({
      ...prev,
      locationId: game.locationId,
      locationName: game.locationName,
      fieldId: game.fieldId || '',
      fieldName: game.fieldName || '',
      fieldType: (game.fieldType as FieldType) || prev.fieldType,
      gameType: game.fieldType || prev.gameType,
      maxPlayers: game.maxPlayers,
      maxGoalkeepers: game.maxGoalkeepers,
      numberOfTeams: game.numberOfTeams,
      totalCost: game.dailyPrice * game.maxPlayers,
      dailyPrice: game.dailyPrice,
      priceManualOverride: true,
      visibility: game.visibility as GameVisibility,
      groupId: game.groupId || prev.groupId,
      groupName: game.groupName || prev.groupName,
      rules: game.rules,
      recurrenceEnabled: game.recurrence !== 'none',
      recurrenceType: (game.recurrence as 'weekly' | 'biweekly' | 'monthly') || 'weekly',
    }));
    setDuplicateDialogOpen(false);
    setUserInteracted(true);
    showSuccess('Jogo anterior carregado. Ajuste a data e horário.');
  };

  const formatGameDate = (date: string, time: string) => {
    if (!date) return '';
    const [y, m, d] = date.split('-');
    return `${d}/${m}/${y?.slice(2)} ${time}`;
  };

  const closeDestination = groupId ? `/group/${groupId}` : '/?tab=1';

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      const [year, month, day] = formData.date.split('-').map(Number);
      const [hours, minutes] = formData.time.split(':').map(Number);
      const dateTime = Timestamp.fromDate(new Date(year, month - 1, day, hours, minutes));

      // Verificar sobreposição de horários
      if (formData.fieldId && formData.date) {
        try {
          const gamesRef = collection(db, 'games');
          const overlapQuery = query(
            gamesRef,
            where('field_id', '==', formData.fieldId),
            where('date', '==', formData.date),
          );
          const existingGames = await getDocs(overlapQuery);
          const newStart = parseTime(formData.time);
          const newEnd = formData.endTime ? parseTime(formData.endTime) : newStart + DEFAULT_GAME_DURATION_MINUTES;
          const conflicting = existingGames.docs.find((d) => {
            const g = d.data();
            if (g.status === 'CANCELLED') return false;
            const gStart = g.time ? parseTime(g.time) : 0;
            const gEnd = g.end_time ? parseTime(g.end_time) : gStart + DEFAULT_GAME_DURATION_MINUTES;
            return gStart < newEnd && gEnd > newStart;
          });

          if (conflicting) {
            const g = conflicting.data();

            const freeSlots: { start: string; end: string }[] = [];
            const slotDuration = DEFAULT_GAME_DURATION_MINUTES;
            const dayEnd = 23 * 60;

            for (let s = 0; s <= dayEnd - slotDuration; s += 30) {
              const e = s + slotDuration;
              if (e > dayEnd) break;
              const conflicts = existingGames.docs.some((d) => {
                const gd = d.data();
                if (gd.status === 'CANCELLED') return false;
                const gs = gd.time ? parseTime(gd.time) : 0;
                const ge = gd.end_time ? parseTime(gd.end_time) : gs + DEFAULT_GAME_DURATION_MINUTES;
                return gs < e && ge > s;
              });
              if (!conflicts) {
                freeSlots.push({
                  start: formatTime(s),
                  end: formatTime(e),
                });
              }
            }

            const altSlots = freeSlots
              .filter((s) => Math.abs(parseTime(s.start) - newStart) <= 240)
              .slice(0, 3);

            let altMsg = '';
            if (altSlots.length > 0) {
              altMsg = '\n\nHorários disponíveis próximos:\n' +
                altSlots.map((s) => `  • ${s.start} — ${s.end}`).join('\n');
            }

            showError(
              `Já existe um jogo neste campo e horário: ${g.time}${g.end_time ? ` às ${g.end_time}` : ''}${altMsg}`
            );
            return;
          }
        } catch (overlapErr) {
          logger.error('Erro ao verificar sobreposição de horários:', overlapErr);
          showError(t('games.create.conflictCheckFailed'));
          return;
        }
      }

      const gamePayload: Record<string, unknown> = {
        locationName: formData.locationName,
        locationAddress: formData.locationAddress,
        date: formData.date,
        time: formData.time,
        endTime: formData.endTime || null,
        dateTime,
        fieldType: formData.fieldType,
        gameType: formData.gameType || formData.fieldType,
        maxPlayers: formData.maxPlayers,
        maxGoalkeepers: formData.maxGoalkeepers,
        numberOfTeams: formData.numberOfTeams,
        dailyPrice: formData.dailyPrice,
        totalCost: formData.totalCost,
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

      // Auto-invite group members
      if (formData.groupId) {
        const invited = await autoInvite(gameId, formData.groupId);
        if (invited > 0) {
          showSuccess(`Jogo criado e ${invited} membros do grupo convidados!`);
        }
      }

      // Clear draft
      clearDraft('create_game');

      // Open share dialog
      setCreatedGameData({
        gameId,
        date: formData.date,
        time: formData.time,
        endTime: formData.endTime,
        locationName: formData.locationName,
        fieldName: formData.fieldName,
        locationAddress: formData.locationAddress,
        maxPlayers: formData.maxPlayers,
        dailyPrice: formData.dailyPrice,
        rules: formData.rules,
      });
      setShareDialogOpen(true);
    } catch (err: unknown) {
      logger.error('Error creating game:', err);
      showError(getFunctionsErrorMessage(err, 'createGame', t('games.create.createError')));
    }
  };

  const handleShareClose = () => {
    setShareDialogOpen(false);
    if (createdGameData) {
      navigate(`/game/${createdGameData.gameId}`);
    }
  };

  // #2250: render functions for the single-page form
  const renderLocationSection = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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

      {/* Quick-pick: Favoritos e Recentes */}
      {!useCustomLocation && (favoriteIds.length > 0 || recentIds.length > 0) && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {favoriteIds.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
                ⭐
              </Typography>
              {favoriteIds.map((id) => {
                const loc = locations.find((l) => l.id === id);
                if (!loc) return null;
                return (
                  <Chip
                    key={id}
                    size="small"
                    icon={<StarIcon sx={{ fontSize: 14 }} />}
                    label={loc.name}
                    color="warning"
                    variant="outlined"
                    onClick={() => {
                      const streetPart = [loc.street, loc.number].filter(Boolean).join(', ');
                      const areaPart = [loc.district, loc.city].filter(Boolean).join(', ');
                      const constructedAddress = areaPart ? `${streetPart} - ${areaPart}` : streetPart;
                      setUseCustomLocation(false);
                      setFormData((prev) => ({
                        ...prev,
                        locationId: loc.id,
                        locationName: loc.name,
                        locationAddress: loc.address || constructedAddress,
                        locationLat: loc.latitude,
                        locationLng: loc.longitude,
                      }));
                    }}
                  />
                );
              })}
            </Box>
          )}
          {recentIds.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
              <HistoryIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              {recentIds.filter((id) => !favoriteIds.includes(id)).slice(0, 5).map((id) => {
                const loc = locations.find((l) => l.id === id);
                if (!loc) return null;
                return (
                  <Chip
                    key={id}
                    size="small"
                    label={loc.name}
                    variant="outlined"
                    onClick={() => {
                      const streetPart = [loc.street, loc.number].filter(Boolean).join(', ');
                      const areaPart = [loc.district, loc.city].filter(Boolean).join(', ');
                      const constructedAddress = areaPart ? `${streetPart} - ${areaPart}` : streetPart;
                      setUseCustomLocation(false);
                      setFormData((prev) => ({
                        ...prev,
                        locationId: loc.id,
                        locationName: loc.name,
                        locationAddress: loc.address || constructedAddress,
                        locationLat: loc.latitude,
                        locationLng: loc.longitude,
                      }));
                    }}
                  />
                );
              })}
            </Box>
          )}
        </Box>
      )}

      {/* Seletor de localização */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
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
          helperText={formErrors.locationName || (locationsLoading ? t('games.create.loadingFields') : t('games.create.locationsAvailable', { count: locations.length }))}
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
        {formData.locationId && !useCustomLocation && (
          <IconButton
            onClick={() => {
              toggleFavoriteLocation(formData.locationId);
              showSuccess(
                isFavorite(formData.locationId)
                  ? 'Removido dos favoritos'
                  : 'Adicionado aos favoritos!'
              );
            }}
            sx={{ mt: 0.5 }}
            size="small"
          >
            {isFavorite(formData.locationId) ? (
              <StarIcon color="warning" />
            ) : (
              <StarBorderIcon />
            )}
          </IconButton>
        )}
      </Box>

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
            inputProps={{ maxLength: 100 }}
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
            inputProps={{ maxLength: 500 }}
          />
        </>
      )}

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
                  totalCost: field.hourlyPrice || prev.totalCost,
                  dailyPrice: prev.priceManualOverride ? prev.dailyPrice : Math.round((field.hourlyPrice || 0) / prev.maxPlayers * 100) / 100,
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

      {!useCustomLocation && formData.locationName && (
        <Alert severity="success" icon={false}>
          📍 <strong>{formData.locationName}</strong>
          {formData.fieldName && <> — {formData.fieldName}</>}
          <br />
          {formData.locationAddress}
        </Alert>
      )}
    </Box>
  );

  const handleStartTimeChange = (time: string) => {
    handleInputChange('time', time);
    if (time && !formData.endTime) {
      const [h, m] = time.split(':').map(Number);
      const end = formatTime(h * 60 + m + DEFAULT_GAME_DURATION_MINUTES);
      handleInputChange('endTime', end);
    }
  };

  const handleTimeSlotClick = (slot: string) => {
    handleStartTimeChange(slot);
  };

  const renderDateTimeSection = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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

      {/* Quick-select time grid */}
      <Box>
        <Typography variant="caption" color="text.secondary" gutterBottom sx={{ display: 'block', mb: 0.5 }}>
          Toque no horário de início — o fim é preenchido automaticamente com +1h
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {TIME_SLOTS.map((slot) => {
            const isSelected = formData.time === slot;
            const [slotH, slotM] = slot.split(':').map(Number);
            const endSlot = formatTime(slotH * 60 + slotM + DEFAULT_GAME_DURATION_MINUTES);
            return (
              <Chip
                key={slot}
                size="small"
                label={`${slot} → ${endSlot}`}
                color={isSelected ? 'primary' : 'default'}
                variant={isSelected ? 'filled' : 'outlined'}
                onClick={() => handleTimeSlotClick(slot)}
                sx={{
                  minWidth: 90,
                  fontWeight: isSelected ? 600 : 400,
                }}
              />
            );
          })}
        </Box>
      </Box>

      {/* Manual time inputs (pre-filled from chips) */}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <TextField
          label={t('games.create.startTime')}
          type="time"
          value={formData.time}
          onChange={(e) => handleStartTimeChange(e.target.value)}
          error={!!formErrors.time}
          helperText={formErrors.time || 'Início'}
          fullWidth
          required
          InputLabelProps={{ shrink: true }}
          size="small"
        />
        <Typography variant="body2" color="text.secondary" sx={{ mt: -2 }}>
          →
        </Typography>
        <TextField
          label={t('games.create.endTime')}
          type="time"
          value={formData.endTime}
          onChange={(e) => handleInputChange('endTime', e.target.value)}
          error={!!formErrors.endTime}
          helperText={formErrors.endTime || 'Fim (+1h)'}
          fullWidth
          InputLabelProps={{ shrink: true }}
          size="small"
        />
      </Box>

      {/* Popular times chips */}
      {popularTimes.length > 0 && formData.fieldId && (
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <HistoryIcon sx={{ fontSize: 16, color: 'text.secondary', mr: 0.5 }} />
          <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
            Horários populares neste campo:
          </Typography>
          {popularTimes.map((pt) => (
            <Chip
              key={pt.time}
              size="small"
              label={`${pt.time}`}
              color={formData.time === pt.time ? 'primary' : 'default'}
              variant={formData.time === pt.time ? 'filled' : 'outlined'}
              onClick={() => handleStartTimeChange(pt.time)}
            />
          ))}
        </Box>
      )}

      {/* Recurrence preview */}
      {formData.recurrenceEnabled && recurrencePreview.length > 0 && (
        <Card sx={{ bgcolor: (theme) => `${theme.palette.info.main}15` }}>
          <CardContent sx={{ py: 1.5 }}>
            <Typography variant="subtitle2" gutterBottom>
              📅 Próximos jogos recorrentes:
            </Typography>
            {recurrencePreview.map((r, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25 }}>
                <Typography variant="body2" sx={{ fontWeight: r.hasConflict ? 400 : 500 }}>
                  {r.hasConflict ? '⚠' : '✓'} {r.formattedDate} — {r.time}
                </Typography>
              </Box>
            ))}
          </CardContent>
        </Card>
      )}

      <TextField
        label="URL da Live Stream (YouTube/Twitch)"
        value={formData.streamUrl}
        onChange={(e) => handleInputChange('streamUrl', e.target.value)}
        fullWidth
        placeholder="https://youtube.com/watch?v=..."
        helperText="Opcional. Cole uma URL do YouTube ou Twitch para transmitir ao vivo."
        inputProps={{ maxLength: 2048 }}
      />
    </Box>
  );

  const renderSettingsSection = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
          onChange={(e) => { const v = parseInt(e.target.value); handleInputChange('maxPlayers', isNaN(v) ? GAME_VALIDATION.MIN_PLAYERS : v); }}
          error={!!formErrors.maxPlayers}
          helperText={formErrors.maxPlayers || `Mín ${GAME_VALIDATION.MIN_PLAYERS} — Máx ${GAME_VALIDATION.MAX_PLAYERS}`}
          fullWidth
          inputProps={{ min: GAME_VALIDATION.MIN_PLAYERS, max: GAME_VALIDATION.MAX_PLAYERS }}
        />
        <TextField
          label={t('games.create.maxGoalkeepers')}
          type="number"
          value={formData.maxGoalkeepers}
          onChange={(e) => { const v = parseInt(e.target.value); handleInputChange('maxGoalkeepers', isNaN(v) ? 0 : v); }}
          error={!!formErrors.maxGoalkeepers}
          helperText={formErrors.maxGoalkeepers || `Máx ${GAME_VALIDATION.MAX_GOALKEEPERS}`}
          fullWidth
          inputProps={{ min: GAME_VALIDATION.MIN_GOALKEEPERS, max: GAME_VALIDATION.MAX_GOALKEEPERS }}
        />
      </Box>

      <TextField
        label={t('games.create.numberOfTeams')}
        type="number"
        value={formData.numberOfTeams}
        onChange={(e) => { const v = parseInt(e.target.value); handleInputChange('numberOfTeams', isNaN(v) ? 2 : v); }}
        error={!!formErrors.numberOfTeams}
        helperText={formErrors.numberOfTeams || `${GAME_VALIDATION.MIN_TEAMS} a ${GAME_VALIDATION.MAX_TEAMS} times`}
        fullWidth
        inputProps={{ min: GAME_VALIDATION.MIN_TEAMS, max: GAME_VALIDATION.MAX_TEAMS }}
      />

      <FormControl error={!!formErrors.visibility}>
        <FormLabel>{t('games.create.visibility')}</FormLabel>
        <RadioGroup
          value={formData.visibility}
          onChange={(e) => handleInputChange('visibility', e.target.value as GameVisibility)}
        >
          <FormControlLabel value="GROUP_ONLY" control={<Radio />} label={t('games.create.visibilityGroupOnly')} />
          <FormControlLabel value="PUBLIC_CLOSED" control={<Radio />} label={t('games.create.visibilityPublicClosed')} />
          <FormControlLabel value="PUBLIC_OPEN" control={<Radio />} label={t('games.create.visibilityPublicOpen')} />
        </RadioGroup>
        {formErrors.visibility && <FormHelperText>{formErrors.visibility}</FormHelperText>}
      </FormControl>

      <Card sx={{ p: 1, bgcolor: 'action.hover' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="body2" fontWeight={600}>{t('games.create.recurrence')}</Typography>
            <Typography variant="caption" color="text.secondary">{t('games.create.recurrenceDesc')}</Typography>
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

  const renderPaymentSection = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        label="Preço total do aluguel"
        type="number"
        value={formData.totalCost}
        onChange={(e) => { const v = parseFloat(e.target.value); handleInputChange('totalCost', isNaN(v) ? 0 : v); }}
        error={!!formErrors.totalCost}
        helperText={formErrors.totalCost}
        fullWidth
        InputProps={{
          startAdornment: <InputAdornment position="start">R$</InputAdornment>,
        }}
        inputProps={{ min: 0, step: 0.01 }}
      />

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
        <TextField
          label="Preço por jogador"
          type="number"
          value={formData.dailyPrice}
          onChange={(e) => { const v = parseFloat(e.target.value); handleInputChange('dailyPrice', isNaN(v) ? 0 : v); }}
          fullWidth
          disabled={!formData.priceManualOverride}
          InputProps={{
            startAdornment: <InputAdornment position="start">R$</InputAdornment>,
            endAdornment: formData.totalCost > 0 && formData.maxPlayers > 0 && (
              <InputAdornment position="end">
                <Typography variant="caption" color="text.secondary">
                  /{formData.maxPlayers} jogadores
                </Typography>
              </InputAdornment>
            ),
          }}
          inputProps={{ min: 0, step: 0.01 }}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={formData.priceManualOverride}
              onChange={(e) => handleInputChange('priceManualOverride', e.target.checked)}
              size="small"
            />
          }
          label="Manual"
          sx={{ mt: 1, whiteSpace: 'nowrap' }}
        />
      </Box>

      {formData.totalCost > 0 && formData.maxPlayers > 0 && !formData.priceManualOverride && (
        <Alert severity="info" icon={false}>
          R$ {formData.totalCost.toFixed(2)} ÷ {formData.maxPlayers} jogadores = <strong>R$ {formData.dailyPrice.toFixed(2)}</strong> por pessoa
        </Alert>
      )}

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
            inputProps={{ maxLength: 200 }}
          />
          <TextField
            label={t('games.create.pixBeneficiaryName')}
            value={formData.pixBeneficiaryName}
            onChange={(e) => handleInputChange('pixBeneficiaryName', e.target.value)}
            error={!!formErrors.pixBeneficiaryName}
            helperText={formErrors.pixBeneficiaryName}
            fullWidth
            required
            inputProps={{ maxLength: 100 }}
          />
        </Box>
      )}
    </Box>
  );

  return (<>
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
        {draftRestored && (
          <Alert severity="info" sx={{ mb: 2 }} onClose={() => setDraftRestored(false)}>
            Rascunho restaurado! Continue de onde parou.
          </Alert>
        )}

        {/* Templates + Duplicate */}
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
              sx={{ minWidth: 140 }}
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
              Salvar
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<ContentPasteIcon />}
              onClick={() => setDuplicateDialogOpen(true)}
              disabled={recentGames.length === 0}
            >
              Duplicar anterior
            </Button>
          </CardContent>
        </Card>

        {/* Template save dialog */}
        <Dialog open={templateDialogOpen} onClose={() => setTemplateDialogOpen(false)} fullWidth maxWidth="xs" aria-labelledby="save-template-dialog-title">
          <DialogTitle id="save-template-dialog-title">{t('games.create.saveAsTemplate')}</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="none"
              label={t('games.create.templateNameLabel')}
              fullWidth
              required
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder={t('games.create.templateNamePlaceholder')}
              inputProps={{ maxLength: 100 }}
              error={templateName.trim().length > 0 && templateName.trim().length < 3}
              helperText={
                templateName.trim().length > 0 && templateName.trim().length < 3
                  ? t('games.create.templateNameMinLength')
                  : `${templateName.length}/100`
              }
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTemplateDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSaveTemplate} variant="contained" disabled={savingTemplate || templateName.trim().length < 3}>
              {savingTemplate ? <CircularProgress size={20} /> : t('common.save')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Duplicate game dialog */}
        <Dialog open={duplicateDialogOpen} onClose={() => setDuplicateDialogOpen(false)} fullWidth maxWidth="sm" aria-labelledby="duplicate-dialog-title">
          <DialogTitle id="duplicate-dialog-title">Duplicar jogo anterior</DialogTitle>
          <DialogContent>
            {duplicateGamesLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            ) : recentGames.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nenhum jogo anterior encontrado.
              </Typography>
            ) : (
              <List>
                {recentGames.map((game) => (
                  <ListItemButton key={game.id} onClick={() => handleDuplicateGame(game.id)}>
                    <ListItemIcon>
                      <ContentPasteIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary={game.locationName}
                      secondary={`${formatGameDate(game.date, game.time)} — ${game.maxPlayers} jogadores`}
                    />
                  </ListItemButton>
                ))}
              </List>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDuplicateDialogOpen(false)}>{t('common.cancel')}</Button>
          </DialogActions>
        </Dialog>

        <Divider sx={{ mb: 2 }} />

        {/* Single-page form sections */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Section 1: Location */}
          <Card>
            <CardContent sx={{ '&:last-child': { pb: 2 } }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                📍 Local
              </Typography>
              {renderLocationSection()}
            </CardContent>
          </Card>

          {/* Section 2: Date & Time */}
          <Card>
            <CardContent sx={{ '&:last-child': { pb: 2 } }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                📅 Data e Horário
              </Typography>
              {renderDateTimeSection()}
            </CardContent>
          </Card>

          {/* Section 3: Game Settings */}
          <Card>
            <CardContent sx={{ '&:last-child': { pb: 2 } }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                ⚙️ Configurações
              </Typography>
              {renderSettingsSection()}
            </CardContent>
          </Card>

          {/* Section 4: Payment (collapsible) */}
          <Card>
            <CardContent sx={{ '&:last-child': { pb: 2 } }}>
              <Box
                onClick={() => setPaymentExpanded(!paymentExpanded)}
                sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              >
                <Typography variant="subtitle1" fontWeight={600}>
                  💰 Pagamento
                </Typography>
                <IconButton size="small">
                  {paymentExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Box>
              <Collapse in={paymentExpanded}>
                <Box sx={{ mt: 2 }}>
                  {renderPaymentSection()}
                </Box>
              </Collapse>
            </CardContent>
          </Card>

          {/* Section 5: Rules (collapsible) */}
          <Card>
            <CardContent sx={{ '&:last-child': { pb: 2 } }}>
              <Box
                onClick={() => setRulesExpanded(!rulesExpanded)}
                sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              >
                <Typography variant="subtitle1" fontWeight={600}>
                  📋 Regras
                </Typography>
                <IconButton size="small">
                  {rulesExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Box>
              <Collapse in={rulesExpanded}>
                <Box sx={{ mt: 2 }}>
                  <TextField
                    label={t('games.create.gameRules')}
                    value={formData.rules}
                    onChange={(e) => handleInputChange('rules', e.target.value)}
                    fullWidth
                    multiline
                    rows={4}
                    placeholder={t('games.create.gameRulesPlaceholder')}
                    inputProps={{ maxLength: 500 }}
                  />
                  <Alert severity="info" sx={{ mt: 1 }}>
                    {t('games.create.rulesShownInfo')}
                  </Alert>
                </Box>
              </Collapse>
            </CardContent>
          </Card>
        </Box>

        {/* Sticky submit button */}
        <Box sx={{ position: 'sticky', bottom: 0, py: 2, bgcolor: 'background.default', zIndex: 1, mt: 2 }}>
          <Button
            variant="contained"
            fullWidth
            size="large"
            onClick={handleSubmit}
            disabled={loading}
            endIcon={loading ? <CircularProgress size={20} /> : <AddIcon />}
          >
            {loading ? 'Criando...' : t('games.createGame')}
          </Button>
        </Box>
      </Container>
    </FormScaffold>
    </AdaptiveFormSheet>

    {createdGameData && (
      <ShareDialog
        open={shareDialogOpen}
        onClose={handleShareClose}
        game={createdGameData}
      />
    )}
  </>);
};
