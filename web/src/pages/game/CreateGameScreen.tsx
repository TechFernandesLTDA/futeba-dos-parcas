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
  Tooltip,
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
  AddLocation as AddLocationIcon,
} from '@mui/icons-material';
import Badge from '@mui/material/Badge';
import { AdapterDateFns as AdapterDateFnsV3 } from '@mui/x-date-pickers/AdapterDateFnsV3';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { PickersDay, PickersDayProps } from '@mui/x-date-pickers/PickersDay';
import { ptBR as dateFnsPtBR } from 'date-fns/locale';
import { format as formatDate, isWeekend, isSameDay, addDays, parse } from 'date-fns';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { FormScaffold, AdaptiveFormSheet } from '../../components/layout';
import { ShareDialog } from '../../components/game/ShareDialog';
import { QuickLocationDialog } from '../../components/locations/QuickLocationDialog';
import { FieldAvailabilityTimeline } from '../../components/game/FieldAvailabilityTimeline';
import { useFieldGames } from '../../hooks/useFieldGames';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useCreateGame } from '../../hooks/useGames';
import { useGroupDetail, useGroups } from '../../hooks/useGroups';
import { useLocations } from '../../hooks/useLocations';
import { useGameTemplates } from '../../hooks/useGameTemplates';
import { usePopularTimes } from '../../hooks/usePopularTimes';
import { useHabitualTime } from '../../hooks/useHabitualTime';
import { useDuplicateGame } from '../../hooks/useDuplicateGame';
import { useAutoInviteMembers } from '../../hooks/useAutoInviteMembers';
import { useGameDraft } from '../../hooks/useGameDraft';
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
  [key: string]: unknown;
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
  autoInviteMembers: boolean;
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
  autoInviteMembers: true,
};

export const CreateGameScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.createGame'));
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

  const [quickLocationOpen, setQuickLocationOpen] = useState(false);

  const [localRecentIds, setLocalRecentIds] = useLocalStorage<string[]>('recent_locations', []);
  const [conflictSuggestions, setConflictSuggestions] = useState<Array<{
    date: string;
    time: string;
    label: string;
  }>>([]);
  const [conflictMessage, setConflictMessage] = useState('');

  const initialFormData: GameFormData = {
    ...defaultFormData,
    groupId: groupId || undefined,
    groupName: group?.name || undefined,
    visibility: (groupId ? 'GROUP_ONLY' : 'PUBLIC_CLOSED') as GameVisibility,
  };

  const {
    draft,
    hasDraft,
    showPrompt: draftPromptOpen,
    saveDraftData,
    restoreDraft,
    discardDraft,
    clearDraft: clearDraftHook,
  } = useGameDraft<GameFormData>({ key: 'create_game', initialData: initialFormData });

  const [formData, setFormData] = useState<GameFormData>(() => {
    if (draft) {
      return { ...initialFormData, ...draft };
    }
    return initialFormData;
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [userInteracted, setUserInteracted] = useState(false);
  const isDirty = userInteracted && JSON.stringify(formData) !== JSON.stringify(defaultFormData);
  const isRestoringRef = useRef(false);

  const { popularTimes } = usePopularTimes(formData.fieldId);
  const { habitualTime } = useHabitualTime(formData.locationId);

  const { data: fieldGames } = useFieldGames(formData.fieldId, 60);

  // Auto-save draft on form changes
  useEffect(() => {
    if (!userInteracted || isRestoringRef.current) return;
    saveDraftData(formData);
  }, [formData, userInteracted, saveDraftData]);

  // Mark restoration complete after first render
  useEffect(() => {
    isRestoringRef.current = true;
    const timer = setTimeout(() => {
      isRestoringRef.current = false;
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

  // Track recently selected locations in localStorage
  useEffect(() => {
    if (formData.locationId && !useCustomLocation) {
      setLocalRecentIds((prev) => {
        const filtered = prev.filter((id) => id !== formData.locationId);
        return [formData.locationId, ...filtered].slice(0, 5);
      });
    }
  }, [formData.locationId, useCustomLocation, setLocalRecentIds]);

  // Clear conflict suggestions when date/time/field changes
  useEffect(() => {
    setConflictSuggestions([]);
    setConflictMessage('');
  }, [formData.date, formData.time, formData.fieldId]);

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
    if ((formErrors as Record<string, string>)[field as string]) {
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
      showSuccess(t('feedback.templates.removeSuccess'));
    } catch {
      showError(t('feedback.templates.removeError'));
    }
  };

  const handleSaveTemplate = async () => {
    if (templateName.trim().length < 3) {
      showError(t('feedback.templates.nameMinLength'));
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
      showSuccess(t('feedback.templates.saveSuccess'));
      setTemplateDialogOpen(false);
      setTemplateName('');
    } catch {
      showError(t('feedback.templates.saveError'));
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
    showSuccess(t('feedback.games.previousGameLoaded'));
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
            const DAY_LABELS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
            const suggestions: Array<{ date: string; time: string; label: string }> = [];

            // 1. Same-day nearby free slots
            const freeSlots: string[] = [];
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
              if (!conflicts) freeSlots.push(formatTime(s));
            }

            const nearbySameDay = freeSlots
              .filter((s) => Math.abs(parseTime(s) - newStart) <= 240)
              .slice(0, 2);

            for (const t of nearbySameDay) {
              const dayOfWeek = new Date(formData.date + 'T12:00:00').getDay();
              suggestions.push({
                date: formData.date,
                time: t,
                label: `${DAY_LABELS_SHORT[dayOfWeek]} ${formData.date.slice(8)}/${formData.date.slice(5, 7)} ${t}`,
              });
            }

            // 2. Alternative days (next 3 days with free slots near selected time)
            const todayStr = formatDate(new Date(), 'yyyy-MM-dd');
            const selectedEndStr = formatTime(newEnd);

            for (let d = 1; suggestions.length < 3 && d <= 7; d++) {
              const altDate = formatDate(addDays(parse(todayStr, 'yyyy-MM-dd', new Date()), d), 'yyyy-MM-dd');
              if (altDate === formData.date) continue;
              const dayGames = fieldGames.byDate.get(altDate) || [];

              let bestTime = '';
              let bestDiff = Infinity;
              for (let s = 0; s <= dayEnd - slotDuration; s += 30) {
                const e = s + slotDuration;
                if (e > dayEnd) break;
                const occupied = dayGames.some((sl) => sl.startMinutes < e && sl.endMinutes > s);
                if (occupied) continue;
                const diff = Math.abs(s - newStart);
                if (diff < bestDiff) {
                  bestDiff = diff;
                  bestTime = formatTime(s);
                }
              }

              if (bestTime && bestDiff <= 180) {
                const dayOfWeek = new Date(altDate + 'T12:00:00').getDay();
                suggestions.push({
                  date: altDate,
                  time: bestTime,
                  label: `${DAY_LABELS_SHORT[dayOfWeek]} ${altDate.slice(8)}/${altDate.slice(5, 7)} ${bestTime}`,
                });
              }
            }

            const msg = `Horário indisponível: ${g.time}${g.end_time ? ` às ${g.end_time}` : ''} já ocupado.` +
              (selectedEndStr ? ` (${formData.time} às ${selectedEndStr})` : '');

            setConflictMessage(msg);
            setConflictSuggestions(suggestions.slice(0, 4));
            showError(msg);
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

      // Auto-invite group members (only if checkbox is checked)
      if (formData.groupId && formData.autoInviteMembers) {
        const invited = await autoInvite(gameId, formData.groupId);
        if (invited > 0) {
          showSuccess(`Jogo criado e ${invited} membros do grupo convidados!`);
        }
      }

      // Clear draft
      clearDraftHook();

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
          {(localRecentIds.length > 0 || recentIds.length > 0) && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
              <HistoryIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              {(() => {
                const merged = [...new Set([...localRecentIds, ...recentIds])];
                return merged.filter((id) => !favoriteIds.includes(id)).slice(0, 5).map((id) => {
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
                });
              })()}
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
        <IconButton
          onClick={() => setQuickLocationOpen(true)}
          sx={{ mt: 0.5 }}
          size="small"
          color="primary"
          aria-label={t('a11y.createNewLocation')}
        >
          <AddLocationIcon />
        </IconButton>
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

  const renderDateTimeSection = () => {
    const { byDate, fullyBookedDates, conflictDates } = fieldGames;

    const CustomDay = (props: PickersDayProps<Date>) => {
      const { day, outsideCurrentMonth, ...other } = props;
      const dateStr = formatDate(day, 'yyyy-MM-dd');
      const dayGames = byDate.get(dateStr) || [];
      const hasGames = dayGames.length > 0;
      const hasConflict = conflictDates.has(dateStr);
      const isFullyBooked = fullyBookedDates.has(dateStr);
      const isWeekendDay = isWeekend(day);
      const isToday = isSameDay(day, new Date());

      const tooltipTitle = hasGames ? (
        <Box sx={{ textAlign: 'center' }}>
          {dayGames.sort((a, b) => a.startMinutes - b.startMinutes).map((g, i) => (
            <Typography key={i} variant="caption" sx={{ display: 'block', lineHeight: 1.4 }}>
              {formatTime(g.startMinutes)} - {formatTime(g.endMinutes)}
            </Typography>
          ))}
        </Box>
      ) : '';

      return (
        <Tooltip title={tooltipTitle} arrow disableHoverListener={!hasGames}>
          <span>
            <Badge
              key={dateStr}
              overlap="circular"
              variant="dot"
              color={hasConflict ? 'error' : hasGames ? 'warning' : 'default'}
              invisible={!hasGames}
              sx={{
                '& .MuiBadge-dot': {
                  width: 6,
                  height: 6,
                  minWidth: 6,
                  borderRadius: '50%',
                },
              }}
            >
              <PickersDay
                {...other}
                day={day}
                outsideCurrentMonth={outsideCurrentMonth}
                selected={false}
                sx={{
                  ...(isFullyBooked && {
                    bgcolor: (theme) => `${theme.palette.error.main}25`,
                    '&:hover': { bgcolor: (theme) => `${theme.palette.error.main}35` },
                  }),
                  ...(isToday && {
                    border: '2px solid',
                    borderColor: 'primary.main',
                  }),
                  ...(isWeekendDay && !isToday && {
                    color: 'text.secondary',
                  }),
                }}
              />
            </Badge>
          </span>
        </Tooltip>
      );
    };

    return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <DatePicker
        label={t('games.create.date')}
        value={formData.date ? new Date(formData.date + 'T12:00:00') : null}
        onChange={(newValue) => {
          const dateStr = newValue ? formatDate(newValue, 'yyyy-MM-dd') : '';
          handleInputChange('date', dateStr);
        }}
        format="dd/MM/yyyy"
        slots={{ day: CustomDay }}
        slotProps={{
          textField: {
            fullWidth: true,
            required: true,
            error: !!formErrors.date,
            helperText: formErrors.date,
            InputLabelProps: { shrink: true },
          },
          popper: {
            sx: { zIndex: 1300 },
          },
        }}
        disablePast
        shouldDisableDate={(date) => {
          const dateStr = formatDate(date, 'yyyy-MM-dd');
          return fullyBookedDates.has(dateStr);
        }}
      />

      {/* Conflict suggestions */}
      {conflictSuggestions.length > 0 && (
        <Alert
          severity="warning"
          onClose={() => { setConflictSuggestions([]); setConflictMessage(''); }}
          icon={false}
        >
          <Typography variant="body2" fontWeight={500}>{conflictMessage}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            Sugestões de horários livres:
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
            {conflictSuggestions.map((s, i) => (
              <Chip
                key={i}
                size="small"
                label={s.label}
                color="primary"
                variant="outlined"
                onClick={() => {
                  handleInputChange('date', s.date);
                  handleStartTimeChange(s.time);
                  setConflictSuggestions([]);
                  setConflictMessage('');
                }}
              />
            ))}
          </Box>
        </Alert>
      )}

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

      {/* Habitual time chip */}
      {habitualTime && formData.locationId && (
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <HistoryIcon sx={{ fontSize: 16, color: 'primary.main', mr: 0.5 }} />
          <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
            Seu horário habitual:
          </Typography>
          <Chip
            size="small"
            label={`${habitualTime.dayLabel} ${habitualTime.time}`}
            color={formData.time === habitualTime.time ? 'primary' : 'default'}
            variant={formData.time === habitualTime.time ? 'filled' : 'outlined'}
            onClick={() => handleStartTimeChange(habitualTime.time)}
          />
        </Box>
      )}

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

      <FieldAvailabilityTimeline
        fieldId={formData.fieldId}
        selectedDate={formData.date}
        selectedTime={formData.time}
        onSlotSelect={(date, time) => {
          handleInputChange('date', date);
          handleStartTimeChange(time);
        }}
      />

      <TextField
        label="URL da Live Stream (YouTube/Twitch)"
        value={formData.streamUrl}
        onChange={(e) => handleInputChange('streamUrl', e.target.value)}
        fullWidth
        placeholder={t('placeholder.enterYoutubeUrl')}
        helperText="Opcional. Cole uma URL do YouTube ou Twitch para transmitir ao vivo."
        inputProps={{ maxLength: 2048 }}
      />
    </Box>
    );
  };

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

      {formData.groupId && (
        <FormControlLabel
          control={
            <Checkbox
              checked={formData.autoInviteMembers}
              onChange={(e) => handleInputChange('autoInviteMembers', e.target.checked)}
            />
          }
          label={t('games.create.autoInviteMembers') || 'Convidar todos os membros do grupo'}
        />
      )}
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
    <LocalizationProvider dateAdapter={AdapterDateFnsV3} adapterLocale={dateFnsPtBR}>
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
        {hasDraft && !draftPromptOpen && (
          <Alert severity="success" sx={{ mb: 2 }}>
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

        {/* Draft confirmation dialog */}
        <Dialog
          open={draftPromptOpen}
          onClose={() => {}}
          fullWidth
          maxWidth="xs"
          aria-labelledby="draft-prompt-dialog-title"
          disableEscapeKeyDown
        >
          <DialogTitle id="draft-prompt-dialog-title">Rascunho encontrado</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              Você tem um rascunho salvo deste formulário. Deseja continuar de onde parou?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              discardDraft();
              setFormData(initialFormData);
              setUserInteracted(false);
            }} color="error">
              Descartar
            </Button>
            <Button onClick={() => restoreDraft()} variant="contained" autoFocus>
              Continuar
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
    </LocalizationProvider>

    {createdGameData && (
      <ShareDialog
        open={shareDialogOpen}
        onClose={handleShareClose}
        game={createdGameData}
      />
    )}

    <QuickLocationDialog
      open={quickLocationOpen}
      onClose={() => setQuickLocationOpen(false)}
      onLocationCreated={(loc) => {
        setUseCustomLocation(false);
        setFormData((prev) => ({
          ...prev,
          locationId: loc.id,
          locationName: loc.name,
          locationAddress: loc.address,
        }));
        showSuccess(`Local "${loc.name}" selecionado!`);
      }}
    />
  </>);
};
