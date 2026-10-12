import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
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
import { alpha } from '@mui/material/styles';
import {
  Add as AddIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  History as HistoryIcon,
  ContentPaste as ContentPasteIcon,
  AddLocation as AddLocationIcon,
  Bolt as BoltIcon,
  CheckCircle as CheckCircleIcon,
  EventAvailable as EventAvailableIcon,
  Groups as GroupsIcon,
  Paid as PaidIcon,
  Place as PlaceIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  Rule as RuleIcon,
  SportsSoccer as SportsSoccerIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import Badge from '@mui/material/Badge';
import { AdapterDateFns as AdapterDateFnsV3 } from '@mui/x-date-pickers/AdapterDateFnsV3';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { PickersDay, PickersDayProps } from '@mui/x-date-pickers/PickersDay';
import { ptBR as dateFnsPtBR } from 'date-fns/locale';
import { format as formatDate, isWeekend, isSameDay, addDays, parse } from 'date-fns';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { FormScaffold } from '../../components/layout';
import { PageContainer } from '../../components/common/PageContainer';
import { ShareDialog } from '../../components/game/ShareDialog';
import { QuickLocationDialog } from '../../components/locations/QuickLocationDialog';
import { FieldAvailabilityTimeline } from '../../components/game/FieldAvailabilityTimeline';
import { useFieldGames } from '../../hooks/useFieldGames';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useCreateGame } from '../../hooks/useGames';
import { useGroupDetail, useGroups } from '../../hooks/useGroups';
import { useLocationDetail, useLocationsByIds } from '../../hooks/useLocations';
import { useVenueSelector } from '../../hooks/useVenueSelector';
import { VenueSelector } from '../../components/locations/VenueSelector';
import { isVenueSelectable } from '../../utils/venueSelector';
import { useGameTemplates } from '../../hooks/useGameTemplates';
import { usePopularTimes } from '../../hooks/usePopularTimes';
import { useHabitualTime } from '../../hooks/useHabitualTime';
import { useDuplicateGame } from '../../hooks/useDuplicateGame';
import { useAutoInviteMembers } from '../../hooks/useAutoInviteMembers';
import { useGameDraft } from '../../hooks/useGameDraft';
import { useRecentLocations } from '../../hooks/useRecentLocations';
import { FieldType, PixKeyType, GameVisibility, GameTemplate, Game, GameGender, GAME_GENDER_LABELS } from '../../types/game';
import { FIELD_TYPE_LABELS, PIX_KEY_TYPE_LABELS } from '../../types/game';
import { Field, Location as FutebaLocation } from '../../types/location';
import { snakeToCamel, normalizeField } from '../../utils/firestoreHelpers';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { createLogger } from '../../utils/logger';
import { getFieldAvailability } from '../../services/cloudFunctions';
import { findAvailabilityConflict } from '../../utils/fieldAvailability';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { getFunctionsErrorMessage } from '../../utils/firebaseErrors';
import { useTranslation } from 'react-i18next';
import { GAME_VALIDATION } from '../../utils/validationConstants';
import { getNextRecurrenceDates, formatRecurrencePreview } from '../../utils/recurrencePreview';
import {
  calculateFieldRentalCost,
  calculatePerPlayerPrice,
  DEFAULT_GAME_DURATION_MINUTES,
  formatGameDurationLabel,
  getGameDurationMinutes,
  normalizeHourlyPriceForGame,
  resolveGamePricingForSave,
} from '../../utils/gamePricing';
import { isScheduledDateTimeInPast } from '../../utils/gameScheduleValidation';
import { calculateNextOccurrence } from './recurringGameHelpers';

const logger = createLogger('CreateGameScreen');

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
  const normalizedMinutes = minutes % (24 * 60);
  const h = Math.floor(normalizedMinutes / 60);
  const m = normalizedMinutes % 60;
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
  // Fim da série (spec #2398): 'forever' = até o teto de 52, 'count' = N jogos
  // no total, 'until' = repete até a data. count XOR end_date no payload.
  recurrenceEndMode: 'forever' | 'count' | 'until';
  recurrenceCount: number;
  recurrenceEndDate: string;
  streamUrl: string;
  autoInviteMembers: boolean;
  gender: GameGender;
}

const MIN_GROUP_MEMBERS_TO_CREATE_GAME = 5;

// Teto inviolável da série recorrente (1 ano de jogos semanais).
// Espelha RECURRENCE_HARD_CAP do backend (functions/src/games/recurrence-limits.ts)
// e a regra Firestore isValidRecurrenceCount (2..52).
const RECURRENCE_HARD_CAP = 52;

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
  recurrenceEndMode: 'forever',
  recurrenceCount: 10,
  recurrenceEndDate: '',
  streamUrl: '',
  autoInviteMembers: true,
  gender: 'MIXED' as GameGender,
};

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

type NumericField =
  | 'maxPlayers'
  | 'maxGoalkeepers'
  | 'numberOfTeams'
  | 'totalCost'
  | 'dailyPrice'
  | 'recurrenceCount';

const buildNumericDrafts = (data: GameFormData): Record<NumericField, string> => ({
  maxPlayers: String(data.maxPlayers),
  maxGoalkeepers: String(data.maxGoalkeepers),
  numberOfTeams: String(data.numberOfTeams),
  totalCost: data.totalCost ? String(data.totalCost) : '',
  dailyPrice: data.dailyPrice ? String(data.dailyPrice) : '',
  recurrenceCount: String(data.recurrenceCount),
});

const parseIntegerDraft = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseCurrencyDraft = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

interface CreateGameSectionProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  statusLabel?: string;
  statusColor?: 'success' | 'warning' | 'default';
  collapsible?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  children: React.ReactNode;
}

const CreateGameSection: React.FC<CreateGameSectionProps> = ({
  icon,
  title,
  subtitle,
  statusLabel,
  statusColor = 'default',
  collapsible = false,
  expanded = true,
  onToggle,
  children,
}) => (
  <Card
    variant="outlined"
    sx={(theme) => ({
      overflow: 'hidden',
      borderColor: alpha(theme.palette.primary.main, 0.14),
      boxShadow: theme.shadowsCustom?.card ?? theme.shadows[1],
      transition: theme.transitions.create(['border-color', 'box-shadow', 'transform'], {
        duration: theme.transitions.duration.short,
      }),
      '&:hover': {
        borderColor: alpha(theme.palette.primary.main, 0.28),
        boxShadow: theme.shadowsCustom?.cardHover ?? theme.shadows[3],
      },
    })}
  >
    <CardContent sx={{ p: { xs: 2, md: 2.5 }, '&:last-child': { pb: { xs: 2, md: 2.5 } } }}>
      <Box
        onClick={collapsible ? onToggle : undefined}
        onKeyDown={(event) => {
          if (!collapsible || !onToggle) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onToggle();
          }
        }}
        role={collapsible ? 'button' : undefined}
        tabIndex={collapsible ? 0 : undefined}
        aria-expanded={collapsible ? expanded : undefined}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          cursor: collapsible ? 'pointer' : 'default',
        }}
      >
        <Box
          sx={(theme) => ({
            width: 44,
            height: 44,
            borderRadius: 3,
            display: 'grid',
            placeItems: 'center',
            color: 'primary.main',
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            flexShrink: 0,
          })}
        >
          {icon}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={800}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        </Box>
        {statusLabel && (
          <Chip
            size="small"
            label={statusLabel}
            color={statusColor === 'default' ? undefined : statusColor}
            variant={statusColor === 'default' ? 'outlined' : 'filled'}
            sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
          />
        )}
        {collapsible && (
          <Box component="span" aria-hidden="true" sx={{ display: 'inline-flex', color: 'text.secondary' }}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </Box>
        )}
      </Box>
      <Collapse in={!collapsible || expanded} timeout="auto" unmountOnExit={collapsible}>
        <Box sx={{ mt: 2.25 }}>
          {children}
        </Box>
      </Collapse>
    </CardContent>
  </Card>
);

export const CreateGameScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.createGame'));
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const groupId = searchParams.get('groupId') || undefined;

  const { group } = useGroupDetail(groupId || null);
  const { groups: userGroups, loading: groupsLoading } = useGroups();
  const { createGame, loading, error } = useCreateGame();
  const { templates, loading: templatesLoading, saveTemplate, removeTemplate } = useGameTemplates();
  const { autoInvite } = useAutoInviteMembers();
  const { recentGames, loading: duplicateGamesLoading } = useDuplicateGame();
  const { recentIds, usedLocationIds, favoriteIds, isFavorite, toggleFavorite } = useRecentLocations();
  const { showSuccess, showError } = useToast();
  const { user, firebaseUser } = useAuth();
  const currentUserId = firebaseUser?.uid || user?.id;
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

  const [numericDrafts, setNumericDrafts] = useState<Record<NumericField, string>>(() => buildNumericDrafts(formData));
  const activeNumericFieldRef = useRef<NumericField | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [userInteracted, setUserInteracted] = useState(false);
  const isDirty = userInteracted && JSON.stringify(formData) !== JSON.stringify(defaultFormData);
  const eligibleOwnedGroups = useMemo(
    () => userGroups.filter((candidateGroup) => {
      const isOwner = candidateGroup.role === 'OWNER' || candidateGroup.ownerId === currentUserId;
      return isOwner && (candidateGroup.memberCount ?? 0) >= MIN_GROUP_MEMBERS_TO_CREATE_GAME;
    }),
    [currentUserId, userGroups],
  );
  const selectedEligibleGroup = useMemo(
    () => eligibleOwnedGroups.find((candidateGroup) => candidateGroup.id === formData.groupId),
    [eligibleOwnedGroups, formData.groupId],
  );
  const hasAnyOwnedGroup = useMemo(
    () => userGroups.some((candidateGroup) => candidateGroup.role === 'OWNER' || candidateGroup.ownerId === currentUserId),
    [currentUserId, userGroups],
  );
  const isRestoringRef = useRef(false);

  const getLocationDisplayAddress = useCallback((loc: FutebaLocation) => {
    const streetPart = [loc.street, loc.number].filter(Boolean).join(', ');
    const areaPart = [loc.district, loc.city].filter(Boolean).join(', ');
    const constructedAddress = areaPart ? `${streetPart} - ${areaPart}` : streetPart;
    return loc.address || constructedAddress;
  }, []);

  const selectCatalogLocation = useCallback((loc: FutebaLocation) => {
    setUseCustomLocation(false);
    setFormData((prev) => ({
      ...prev,
      locationId: loc.id,
      locationName: loc.name,
      locationAddress: getLocationDisplayAddress(loc),
      locationLat: loc.latitude,
      locationLng: loc.longitude,
      fieldId: '',
      fieldName: '',
    }));
    setFormErrors((prev) => ({
      ...prev,
      locationName: '',
      fieldId: '',
    }));
  }, [getLocationDisplayAddress]);

  const { popularTimes } = usePopularTimes(formData.fieldId);
  const { habitualTime } = useHabitualTime(formData.locationId);

  // #4370: quadras da cidade atual (GPS → perfil → última escolhida), com
  // busca inteligente; favoritas/recentes e a quadra escolhida entram por id
  // mesmo quando são de outra cidade.
  const [venueQuery, setVenueQuery] = useState('');
  const venueSelector = useVenueSelector({ searchQuery: venueQuery, recentIds: usedLocationIds });
  const {
    location: selectedLocationDetail,
    loading: selectedLocationLoading,
    error: selectedLocationError,
  } = useLocationDetail(formData.locationId || undefined);
  const quickPickLocations = useLocationsByIds([...favoriteIds, ...localRecentIds, ...recentIds]);
  const locationsLoading = venueSelector.loading || venueSelector.resolvingCity;
  const locationsError = venueSelector.error;
  const locations = useMemo(() => {
    const byId = new Map<string, FutebaLocation>();
    const add = (venue?: FutebaLocation | null) => {
      if (venue && !byId.has(venue.id)) byId.set(venue.id, venue);
    };
    venueSelector.cityVenues.forEach(add);
    venueSelector.otherCities.forEach(add);
    quickPickLocations.forEach(add);
    add(selectedLocationDetail);
    return Array.from(byId.values());
  }, [venueSelector.cityVenues, venueSelector.otherCities, quickPickLocations, selectedLocationDetail]);

  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === formData.locationId),
    [formData.locationId, locations],
  );
  const { data: fieldGames } = useFieldGames(formData.fieldId, 60, {
    openingTime: selectedLocation?.openingTime,
    closingTime: selectedLocation?.closingTime,
  });
  const selectedField = useMemo(
    () => fields.find((field) => field.id === formData.fieldId),
    [fields, formData.fieldId],
  );
  const selectedFieldPricing = useMemo(() => {
    if (!selectedField?.hourlyPrice) return null;
    const hourlyPrice = normalizeHourlyPriceForGame(selectedField.hourlyPrice);
    if (hourlyPrice <= 0) return null;
    const durationMinutes = getGameDurationMinutes(formData.time, formData.endTime);
    const totalCost = calculateFieldRentalCost(selectedField.hourlyPrice, formData.time, formData.endTime);
    return {
      hourlyPrice,
      durationMinutes,
      durationLabel: formatGameDurationLabel(durationMinutes),
      totalCost,
    };
  }, [formData.endTime, formData.time, selectedField?.hourlyPrice]);

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

  useEffect(() => {
    if (activeNumericFieldRef.current) return;
    setNumericDrafts({
      maxPlayers: String(formData.maxPlayers),
      maxGoalkeepers: String(formData.maxGoalkeepers),
      numberOfTeams: String(formData.numberOfTeams),
      totalCost: formData.totalCost ? String(formData.totalCost) : '',
      dailyPrice: formData.dailyPrice ? String(formData.dailyPrice) : '',
      recurrenceCount: String(formData.recurrenceCount),
    });
  }, [
    formData.maxPlayers,
    formData.maxGoalkeepers,
    formData.numberOfTeams,
    formData.totalCost,
    formData.dailyPrice,
    formData.recurrenceCount,
  ]);

  // Recurrence preview — respeita o fim-de-série (spec #2398):
  // 'count' = N jogos no total (mostra count-1 datas futuras),
  // 'until' = gera o máximo e filtra pela data final,
  // 'forever' = prévia de 4 datas (limite real = teto de 52 no backend).
  const recurrencePreview = (() => {
    if (!formData.recurrenceEnabled || !formData.date || !formData.time) return [];
    const PREVIEW_CAP = 12;
    const HARD_CAP_FUTURE = RECURRENCE_HARD_CAP - 1; // série inclui o jogo atual
    let futureCount: number;
    if (formData.recurrenceEndMode === 'count') {
      futureCount = Math.max(0, Math.min(formData.recurrenceCount - 1, HARD_CAP_FUTURE));
    } else if (formData.recurrenceEndMode === 'until') {
      futureCount = HARD_CAP_FUTURE;
    } else {
      futureCount = 4;
    }
    let dates = getNextRecurrenceDates(formData.date, formData.time, formData.recurrenceType, futureCount);
    if (formData.recurrenceEndMode === 'until' && formData.recurrenceEndDate) {
      dates = dates.filter((d) => d.toISOString().split('T')[0] <= formData.recurrenceEndDate);
    }
    return formatRecurrencePreview(dates.slice(0, PREVIEW_CAP));
  })();

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
            totalCost: calculateFieldRentalCost(f.hourlyPrice, prev.time, prev.endTime) || prev.totalCost,
            dailyPrice: prev.priceManualOverride
              ? prev.dailyPrice
              : calculatePerPlayerPrice(
                calculateFieldRentalCost(f.hourlyPrice, prev.time, prev.endTime) || prev.totalCost,
                prev.maxPlayers,
              ),
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
    if (useCustomLocation || selectedLocationLoading || !formData.locationId) return;
    // #4370: a quadra escolhida pode ser de outra cidade; vale a leitura direta
    // do documento (apagada/negada/suspensa/inativa = indisponível).
    const selectedLocationStillAvailable =
      !selectedLocationError && !!selectedLocationDetail && isVenueSelectable(selectedLocationDetail);
    if (selectedLocationStillAvailable) return;

    setFields([]);
    setFormData((prev) => ({
      ...prev,
      locationId: '',
      locationName: '',
      locationAddress: '',
      locationLat: undefined,
      locationLng: undefined,
      fieldId: '',
      fieldName: '',
    }));
    setFormErrors((prev) => ({
      ...prev,
      locationName: tRef.current('games.create.locationUnavailable'),
      fieldId: '',
    }));
    showErrorRef.current(tRef.current('games.create.locationUnavailable'));
  }, [formData.locationId, selectedLocationDetail, selectedLocationError, selectedLocationLoading, useCustomLocation]);

  // Auto-calculate price per player
  useEffect(() => {
    if (!formData.priceManualOverride && formData.totalCost > 0 && formData.maxPlayers > 0) {
      const calculated = calculatePerPlayerPrice(formData.totalCost, formData.maxPlayers);
      if (calculated !== formData.dailyPrice) {
        setFormData((prev) => ({ ...prev, dailyPrice: calculated }));
      }
    }
  }, [formData.totalCost, formData.maxPlayers, formData.priceManualOverride, formData.dailyPrice]);

  useEffect(() => {
    if (useCustomLocation || !selectedFieldPricing || selectedFieldPricing.totalCost <= 0) return;
    setFormData((prev) => {
      if (prev.totalCost === selectedFieldPricing.totalCost) return prev;
      return {
        ...prev,
        totalCost: selectedFieldPricing.totalCost,
        dailyPrice: prev.priceManualOverride
          ? prev.dailyPrice
          : calculatePerPlayerPrice(selectedFieldPricing.totalCost, prev.maxPlayers),
      };
    });
  }, [selectedFieldPricing, useCustomLocation]);

  useEffect(() => {
    if (group && !formData.groupId) {
      setFormData((prev) => ({
        ...prev,
        groupId: groupId,
        groupName: group.name,
      }));
    }
  }, [group, groupId, formData.groupId]);

  // Pré-seleciona gênero do grupo ao carregar; ignora se o usuário já interagiu
  useEffect(() => {
    if (group?.defaultGender && !userInteracted) {
      setFormData((prev) => ({ ...prev, gender: group.defaultGender as GameGender }));
    }
  }, [group?.defaultGender, userInteracted]);

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

  const handleNumericDraftChange = useCallback((
    field: NumericField,
    rawValue: string,
    parser: (value: string) => number | null,
  ) => {
    setUserInteracted(true);
    setNumericDrafts((prev) => ({ ...prev, [field]: rawValue }));
    if ((formErrors as Record<string, string>)[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: '' }));
    }

    if ((field === 'totalCost' || field === 'dailyPrice') && rawValue.trim() === '') {
      setFormData((prev) => ({ ...prev, [field]: 0 }));
      return;
    }

    const parsed = parser(rawValue);
    if (parsed !== null) {
      setFormData((prev) => ({ ...prev, [field]: parsed }));
    }
  }, [formErrors]);

  const handleNumericDraftBlur = useCallback((field: NumericField) => {
    activeNumericFieldRef.current = null;
    if (!numericDrafts[field].trim()) {
      setFormErrors((prev) => ({ ...prev, [field]: t('games.create.errorNumberRequired') }));
    }
  }, [numericDrafts, t]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    const parsedMaxPlayers = parseIntegerDraft(numericDrafts.maxPlayers);
    const parsedMaxGoalkeepers = parseIntegerDraft(numericDrafts.maxGoalkeepers);
    const parsedNumberOfTeams = parseIntegerDraft(numericDrafts.numberOfTeams);
    const parsedTotalCost = parseCurrencyDraft(numericDrafts.totalCost) ?? 0;
    const parsedDailyPrice = parseCurrencyDraft(numericDrafts.dailyPrice) ?? 0;
    const parsedRecurrenceCount = parseIntegerDraft(numericDrafts.recurrenceCount);

    if (!formData.locationName.trim()) {
      errors.locationName = useCustomLocation ? t('games.create.errorLocationNameRequired') : t('games.create.errorSelectLocation');
    }
    if (useCustomLocation && !formData.locationAddress.trim()) errors.locationAddress = t('games.create.errorAddressRequired');
    if (!useCustomLocation && formData.locationId && !formData.fieldId) {
      errors.fieldId = fields.length > 0
        ? t('games.create.errorSelectField')
        : t('games.create.errorActiveFieldRequired');
    }
    if (!formData.date) {
      errors.date = t('games.create.errorDateRequired');
    } else {
      const today = new Date().toISOString().split('T')[0];
      if (formData.date < today) errors.date = t('games.create.errorDatePast');
    }
    if (!formData.time) {
      errors.time = t('games.create.errorTimeRequired');
    } else if (formData.date && isScheduledDateTimeInPast(formData.date, formData.time)) {
      errors.time = t('games.create.errorTimePastToday');
    } else if (formData.endTime && formData.endTime <= formData.time) {
      errors.endTime = t('games.create.errorEndTimeBeforeStart');
    }
    if (!formData.groupId || !selectedEligibleGroup) {
      errors.groupId = t('games.create.errorQualifiedOwnerGroupRequired');
    }
    if (formData.streamUrl.trim() && !/^https?:\/\/.+\..+/.test(formData.streamUrl.trim())) {
      errors.streamUrl = t('games.create.errorStreamUrlInvalid');
    }

    if (parsedMaxPlayers === null || parsedMaxPlayers < GAME_VALIDATION.MIN_PLAYERS || parsedMaxPlayers > GAME_VALIDATION.MAX_PLAYERS) {
      errors.maxPlayers = t('games.create.errorPlayersRange', {
        min: GAME_VALIDATION.MIN_PLAYERS,
        max: GAME_VALIDATION.MAX_PLAYERS,
      });
    }
    if (parsedMaxGoalkeepers === null || parsedMaxGoalkeepers < GAME_VALIDATION.MIN_GOALKEEPERS || parsedMaxGoalkeepers > GAME_VALIDATION.MAX_GOALKEEPERS) {
      errors.maxGoalkeepers = t('games.create.errorGoalkeepersRange', {
        min: GAME_VALIDATION.MIN_GOALKEEPERS,
        max: GAME_VALIDATION.MAX_GOALKEEPERS,
      });
    }
    if (parsedNumberOfTeams === null || parsedNumberOfTeams < GAME_VALIDATION.MIN_TEAMS || parsedNumberOfTeams > GAME_VALIDATION.MAX_TEAMS) {
      errors.numberOfTeams = t('games.create.errorTeamsRange', {
        min: GAME_VALIDATION.MIN_TEAMS,
        max: GAME_VALIDATION.MAX_TEAMS,
      });
    }

    if (parsedTotalCost < GAME_VALIDATION.MIN_PRICE) {
      errors.totalCost = t('games.create.errorPriceNegative');
    }
    if (parsedDailyPrice < GAME_VALIDATION.MIN_PRICE) {
      errors.dailyPrice = t('games.create.errorPriceNegative');
    }
    if (formData.recurrenceEnabled && formData.recurrenceEndMode === 'count' && (
      parsedRecurrenceCount === null ||
      parsedRecurrenceCount < 2 ||
      parsedRecurrenceCount > RECURRENCE_HARD_CAP
    )) {
      errors.recurrenceCount = t('games.create.errorRecurrenceCountRange', {
        min: 2,
        max: RECURRENCE_HARD_CAP,
      });
    }

    if (formData.pixPaymentEnabled) {
      if (!formData.pixKey.trim()) errors.pixKey = t('games.create.errorPixKeyRequired');
      if (!formData.pixBeneficiaryName.trim()) errors.pixBeneficiaryName = t('games.create.errorPixBeneficiaryRequired');
    }

    setFormErrors(errors);
    if (Object.keys(errors).length === 0) {
      setFormData((prev) => ({
        ...prev,
        maxPlayers: parsedMaxPlayers ?? prev.maxPlayers,
        maxGoalkeepers: parsedMaxGoalkeepers ?? prev.maxGoalkeepers,
        numberOfTeams: parsedNumberOfTeams ?? prev.numberOfTeams,
        totalCost: parsedTotalCost,
        dailyPrice: parsedDailyPrice,
        recurrenceCount: parsedRecurrenceCount ?? prev.recurrenceCount,
      }));
    }
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
      time: template.time || prev.time,
      totalCost: template.total_cost || prev.totalCost,
      dailyPrice: template.daily_price || prev.dailyPrice,
      visibility: (template.visibility as GameVisibility) || prev.visibility,
      recurrenceEnabled: !!template.recurrence_type,
      recurrenceType: (template.recurrence_type as 'weekly' | 'biweekly' | 'monthly') || prev.recurrenceType,
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
        time: formData.time || undefined,
        recurrence_type: formData.recurrenceEnabled ? formData.recurrenceType : undefined,
        total_cost: formData.totalCost || undefined,
        daily_price: formData.dailyPrice || undefined,
        visibility: formData.visibility || undefined,
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
    const duplicatedPricing = resolveGamePricingForSave({
      totalCost: game.totalCost || game.dailyPrice * game.maxPlayers,
      maxPlayers: game.maxPlayers,
      dailyPrice: game.dailyPrice,
      priceManualOverride: game.priceManualOverride === true,
    });

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
      totalCost: duplicatedPricing.totalCost,
      dailyPrice: duplicatedPricing.dailyPrice,
      priceManualOverride: duplicatedPricing.priceManualOverride,
      visibility: game.visibility as GameVisibility,
      groupId: game.groupId || prev.groupId,
      groupName: game.groupName || prev.groupName,
      rules: game.rules,
      recurrenceEnabled: false,
      recurrenceType: 'weekly',
    }));
    setDuplicateDialogOpen(false);
    setUserInteracted(true);
    showSuccess(t('feedback.games.previousGameLoaded'));
  };

  const handleQuickCreateFromTemplate = async (template: GameTemplate) => {
    if (!template.time) {
      handleLoadTemplate(template.id);
      showError('Template sem horário definido. Preencha os campos manualmente.');
      return;
    }

    const { date, time } = calculateNextOccurrence(template.time, template.recurrence_type);
    const [year, month, day] = date.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);
    const dateTime = Timestamp.fromDate(new Date(year, month - 1, day, hours, minutes));
    const endMinutes = hours * 60 + minutes + DEFAULT_GAME_DURATION_MINUTES;
    const endTime = formatTime(endMinutes);

    try {
      setFormData((prev) => ({
        ...prev,
        maxPlayers: template.max_players,
        maxGoalkeepers: template.max_goalkeepers,
        locationId: template.location_id || '',
        locationName: template.location_name || '',
        fieldId: template.field_id || '',
        fieldName: template.field_name || '',
        fieldType: template.field_type || 'SOCIETY',
        gameType: template.field_type || 'SOCIETY',
        rules: template.rules || '',
        totalCost: template.total_cost || 0,
        dailyPrice: template.daily_price || 0,
        visibility: (template.visibility as GameVisibility) || 'PUBLIC_OPEN',
        recurrenceEnabled: !!template.recurrence_type,
        recurrenceType: (template.recurrence_type as 'weekly' | 'biweekly' | 'monthly') || 'weekly',
        date,
        time,
        endTime,
      }));

      const gamePayload: Record<string, unknown> = {
        locationId: template.location_id || '',
        locationName: template.location_name || '',
        locationAddress: template.location_name || '',
        fieldId: template.field_id || '',
        fieldName: template.field_name || '',
        date,
        time,
        endTime,
        dateTime,
        fieldType: template.field_type || 'SOCIETY',
        gameType: template.field_type || 'SOCIETY',
        maxPlayers: template.max_players,
        maxGoalkeepers: template.max_goalkeepers,
        numberOfTeams: 2,
        dailyPrice: template.daily_price || 0,
        totalCost: template.total_cost || 0,
        pixPaymentEnabled: false,
        rules: template.rules || '',
        visibility: template.visibility || 'PUBLIC_OPEN',
        recurrence: template.recurrence_type || 'none',
        team1Name: 'Time 1',
        team2Name: 'Time 2',
        confirmationDeadlineHours: 0,
        requireCheckin: false,
        checkinRadiusMeters: 100,
      };

      if (!selectedEligibleGroup) {
        showError(t('games.create.errorQualifiedOwnerGroupRequired'));
        return;
      }

      gamePayload.groupId = selectedEligibleGroup.id;
      gamePayload.groupName = selectedEligibleGroup.name;

      const gameId = await createGame(gamePayload as Partial<Game>);

      if (formData.autoInviteMembers) {
        const invitedCount = await autoInvite(gameId, selectedEligibleGroup.id);
        if (invitedCount > 0) {
          showSuccess(`Jogo "${template.name}" criado e ${invitedCount} membros convidados!`);
        }
      }

      clearDraftHook();
      setCreatedGameData({
        gameId,
        date,
        time,
        endTime,
        locationName: template.location_name || '',
        fieldName: template.field_name || '',
        locationAddress: template.location_name || '',
        maxPlayers: template.max_players,
        dailyPrice: template.daily_price || 0,
        rules: template.rules || '',
      });
      setShareDialogOpen(true);
    } catch (err: unknown) {
      logger.error('Error creating game from template:', err);
      showError(getFunctionsErrorMessage(err, 'createGame', t('games.create.createError')));
    }
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
      const maxPlayersValue = formData.maxPlayers;
      const maxGoalkeepersValue = formData.maxGoalkeepers;
      const numberOfTeamsValue = formData.numberOfTeams;
      const pricingForSave = resolveGamePricingForSave({
        totalCost: formData.totalCost,
        maxPlayers: maxPlayersValue,
        dailyPrice: formData.dailyPrice,
        priceManualOverride: formData.priceManualOverride,
      });
      const totalCostValue = pricingForSave.totalCost;
      const dailyPriceValue = pricingForSave.dailyPrice;
      const recurrenceCountValue = parseIntegerDraft(numericDrafts.recurrenceCount) ?? formData.recurrenceCount;
      const [year, month, day] = formData.date.split('-').map(Number);
      const [hours, minutes] = formData.time.split(':').map(Number);
      const dateTime = Timestamp.fromDate(new Date(year, month - 1, day, hours, minutes));
      const durationMinutes = getGameDurationMinutes(formData.time, formData.endTime);

      // Verificar sobreposição de horários
      if (formData.fieldId && formData.date) {
        try {
          const { data: availability } = await getFieldAvailability({
            fieldId: formData.fieldId,
            startDate: formData.date,
            endDate: formData.date,
          });
          if (availability.truncated) {
            showError(t('feedback.fieldGames.loadError'));
            return;
          }
          const existingSlots = availability.slots;
          const newStart = parseTime(formData.time);
          const parsedNewEnd = formData.endTime ? parseTime(formData.endTime) : newStart + DEFAULT_GAME_DURATION_MINUTES;
          const newEnd = parsedNewEnd <= newStart ? parsedNewEnd + 24 * 60 : parsedNewEnd;
          const conflicting = findAvailabilityConflict(existingSlots, newStart, newEnd);

          if (conflicting) {
            const DAY_LABELS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
            const suggestions: Array<{ date: string; time: string; label: string }> = [];

            // 1. Same-day nearby free slots
            const freeSlots: string[] = [];
            const slotDuration = DEFAULT_GAME_DURATION_MINUTES;
            const dayEnd = 23 * 60;

            for (let s = 0; s <= dayEnd - slotDuration; s += 30) {
              const e = s + slotDuration;
              if (e > dayEnd) break;
              const conflicts = findAvailabilityConflict(existingSlots, s, e) !== undefined;
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

            const msg = `Horário indisponível: ${formatTime(conflicting.startMinutes)} às ${formatTime(conflicting.endMinutes)} já ocupado.` +
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
        durationMinutes,
        dateTime,
        fieldType: formData.fieldType,
        gameType: formData.gameType || formData.fieldType,
        maxPlayers: maxPlayersValue,
        maxGoalkeepers: maxGoalkeepersValue,
        numberOfTeams: numberOfTeamsValue,
        dailyPrice: dailyPriceValue,
        totalCost: totalCostValue,
        priceManualOverride: pricingForSave.priceManualOverride,
        pixPaymentEnabled: formData.pixPaymentEnabled,
        rules: formData.rules || '',
        visibility: formData.visibility,
        recurrence: formData.recurrenceEnabled ? formData.recurrenceType : 'none',
        // Fim-de-série (spec #2398): índice 1-based da 1ª ocorrência + count XOR end_date.
        // Emite no máximo um dos limites; o não usado fica undefined e é removido em useCreateGame.
        ...(formData.recurrenceEnabled ? { recurrenceIndex: 1 } : {}),
        ...(formData.recurrenceEnabled && formData.recurrenceEndMode === 'count'
          ? { recurrenceCount: recurrenceCountValue }
          : {}),
        ...(formData.recurrenceEnabled && formData.recurrenceEndMode === 'until' && formData.recurrenceEndDate
          ? { recurrenceEndDate: formData.recurrenceEndDate }
          : {}),
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
      gamePayload.groupId = selectedEligibleGroup?.id;
      gamePayload.groupName = selectedEligibleGroup?.name;
      if (formData.pixPaymentEnabled) {
        gamePayload.pixKey = formData.pixKey;
        gamePayload.pixKeyType = formData.pixKeyType;
        gamePayload.pixBeneficiaryName = formData.pixBeneficiaryName;
      }
      gamePayload.gender = formData.gender || 'MIXED';

      if (formData.streamUrl.trim()) {
        gamePayload.streamUrl = formData.streamUrl.trim();
      }

      const gameId = await createGame(gamePayload as Partial<import('../../types/game').Game>);

      // Auto-invite group members (only if checkbox is checked)
      if (selectedEligibleGroup && formData.autoInviteMembers) {
        const invited = await autoInvite(gameId, selectedEligibleGroup.id);
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
        dailyPrice: dailyPriceValue,
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
      {selectedEligibleGroup && (
        <Alert severity="info">
          {t('games.create.creatingForGroup')} <strong>{selectedEligibleGroup.name}</strong>
        </Alert>
      )}

      {!groupsLoading && eligibleOwnedGroups.length === 0 && (
        <Alert severity="warning">
          {hasAnyOwnedGroup ? t('games.create.noQualifiedGroups') : t('games.create.noOwnedGroups')}
        </Alert>
      )}

      {groupId && formData.groupId && !groupsLoading && !selectedEligibleGroup && (
        <Alert severity="error">
          {t('games.create.currentGroupNotQualified')}
        </Alert>
      )}

      {!groupId && (
        <TextField
          select
          label={t('games.create.group')}
          value={formData.groupId || ''}
          onChange={(e) => {
            const selectedGroup = eligibleOwnedGroups.find((g) => g.id === e.target.value);
            setFormData((prev) => ({
              ...prev,
              groupId: selectedGroup?.id,
              groupName: selectedGroup?.name,
              visibility: selectedGroup ? 'PUBLIC_OPEN' : prev.visibility,
            }));
          }}
          disabled={groupsLoading || eligibleOwnedGroups.length === 0}
          error={!!formErrors.groupId}
          helperText={
            formErrors.groupId ||
            (groupsLoading ? t('games.create.loadingGroups') : t('games.create.selectQualifiedGroupRequired'))
          }
          fullWidth
        >
          {eligibleOwnedGroups.map((g) => (
            <MenuItem key={g.id} value={g.id}>
              {g.name} ({t('games.create.membersCount', { count: g.memberCount ?? 0 })})
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
                    onClick={() => selectCatalogLocation(loc)}
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
                      onClick={() => selectCatalogLocation(loc)}
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
        <VenueSelector
          label={t('games.create.fieldOrLocation')}
          city={venueSelector.city}
          citySource={venueSelector.citySource}
          resolvingCity={venueSelector.resolvingCity}
          onChangeCity={venueSelector.changeCity}
          inCity={venueSelector.inCity}
          otherCities={venueSelector.otherCities}
          recentIds={usedLocationIds}
          loading={venueSelector.loading}
          loadingOtherCities={venueSelector.loadingOtherCities}
          onSearchQueryChange={setVenueQuery}
          selectedVenue={useCustomLocation ? null : (selectedLocation ?? null)}
          customSelected={useCustomLocation}
          customLabel={t('games.create.otherLocation')}
          onSelectVenue={selectCatalogLocation}
          onSelectCustom={() => {
            setUseCustomLocation(true);
            setFormData((prev) => ({
              ...prev,
              locationId: '',
              locationName: '',
              locationAddress: '',
              locationLat: undefined,
              locationLng: undefined,
              fieldId: '',
              fieldName: '',
            }));
          }}
          onClear={() => {
            setUseCustomLocation(false);
            setFormData((prev) => ({
              ...prev,
              locationId: '',
              locationName: '',
              locationAddress: '',
              locationLat: undefined,
              locationLng: undefined,
              fieldId: '',
              fieldName: '',
            }));
          }}
          error={!!formErrors.locationName}
          helperText={formErrors.locationName || (locationsLoading
            ? t('games.create.loadingFields')
            : venueSelector.city
              ? t('games.create.venueSelector.countInCity', {
                count: venueSelector.cityVenues.length,
                city: venueSelector.city.city,
              })
              : t('games.create.venueSelector.cityUnknown'))}
        />
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
          <Tooltip
            title={isFavorite(formData.locationId)
              ? t('games.create.removeFavorite')
              : t('games.create.addFavorite')}
          >
            <IconButton
              onClick={() => {
                const added = toggleFavorite(formData.locationId);
                showSuccess(t(added
                  ? 'games.create.favoriteAdded'
                  : 'games.create.favoriteRemoved'));
              }}
              sx={{ mt: 0.5 }}
              size="small"
              aria-label={isFavorite(formData.locationId)
                ? t('games.create.removeFavorite')
                : t('games.create.addFavorite')}
              aria-pressed={isFavorite(formData.locationId)}
            >
              {isFavorite(formData.locationId) ? (
                <StarIcon color="warning" />
              ) : (
                <StarBorderIcon />
              )}
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {!useCustomLocation && !locationsLoading && !locationsError && venueSelector.city &&
        venueSelector.cityVenues.length === 0 && (
        <Alert severity="warning" icon={false}>
          {t('games.create.venueSelector.noVenuesInCity', { city: venueSelector.city.city })}
        </Alert>
      )}

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
                const totalCost = calculateFieldRentalCost(field.hourlyPrice, formData.time, formData.endTime);
                setFormData((prev) => ({
                  ...prev,
                  fieldId: field.id,
                  fieldName: field.name,
                  fieldType: (field.type as FieldType) || prev.fieldType,
                  gameType: (field.type as string) || prev.gameType,
                  totalCost: totalCost || prev.totalCost,
                  dailyPrice: prev.priceManualOverride
                    ? prev.dailyPrice
                    : calculatePerPlayerPrice(totalCost || prev.totalCost, prev.maxPlayers),
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
                {normalizeHourlyPriceForGame(f.hourlyPrice)
                  ? ` (${currencyFormatter.format(normalizeHourlyPriceForGame(f.hourlyPrice))}/h)`
                  : ''}
                {f.isCovered ? ` · ${t('games.create.covered')}` : ''}
              </MenuItem>
            ))}
          </TextField>
        ) : (
          <Alert severity="warning" icon={false}>
            {t('games.create.noActiveFieldsAtLocation')}
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

  const suggestedTimeChips = useMemo(() => {
    const seen = new Set<string>();
    const add = (
      time: string,
      source: 'habitual' | 'popular' | 'suggested',
      label?: string,
    ) => {
      if (!time || seen.has(time)) return null;
      seen.add(time);
      const [slotH, slotM] = time.split(':').map(Number);
      const endSlot = Number.isFinite(slotH) && Number.isFinite(slotM)
        ? formatTime(slotH * 60 + slotM + DEFAULT_GAME_DURATION_MINUTES)
        : '';
      return {
        time,
        source,
        label: label || (endSlot ? `${time} → ${endSlot}` : time),
      };
    };

    return [
      habitualTime && formData.locationId
        ? add(habitualTime.time, 'habitual', `Habitual · ${habitualTime.time}`)
        : null,
      ...popularTimes.map((pt) => add(pt.time, 'popular', `Popular · ${pt.time}`)),
      ...TIME_SLOTS.map((slot) => add(slot, 'suggested')),
    ].filter(Boolean) as Array<{ time: string; source: 'habitual' | 'popular' | 'suggested'; label: string }>;
  }, [formData.locationId, habitualTime, popularTimes]);

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
          {/* Perf: sort em CÓPIA — sort in-place mutava o array do Map byDate
              compartilhado entre renders do calendário */}
          {[...dayGames].sort((a, b) => a.startMinutes - b.startMinutes).map((g, i) => (
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

      {/* Quick-select time chips */}
      <Box>
        <Typography variant="caption" color="text.secondary" gutterBottom sx={{ display: 'block', mb: 0.5 }}>
          Horários prontos — sem duplicar habitual, populares e sugestões
        </Typography>
        <Box
          sx={{
            display: 'flex',
            gap: 0.75,
            flexWrap: { xs: 'nowrap', sm: 'wrap' },
            overflowX: { xs: 'auto', sm: 'visible' },
            pb: { xs: 0.5, sm: 0 },
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {suggestedTimeChips.map(({ time, source, label }) => {
            const isSelected = formData.time === time;
            return (
              <Chip
                key={`${source}-${time}`}
                size="small"
                label={label}
                color={isSelected ? 'primary' : source === 'habitual' ? 'success' : source === 'popular' ? 'info' : 'default'}
                variant={isSelected ? 'filled' : 'outlined'}
                onClick={() => handleTimeSlotClick(time)}
                sx={{
                  flex: '0 0 auto',
                  minWidth: source === 'suggested' ? 90 : 'auto',
                  fontWeight: isSelected || source !== 'suggested' ? 700 : 400,
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
        openingTime={selectedLocation?.openingTime}
        closingTime={selectedLocation?.closingTime}
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

      <TextField
        select
        label={t('games.create.gender')}
        value={formData.gender}
        onChange={(e) => { handleInputChange('gender', e.target.value as GameGender); }}
        fullWidth
      >
        {(Object.entries(GAME_GENDER_LABELS) as [GameGender, string][]).map(([value, label]) => (
          <MenuItem key={value} value={value}>
            {label}
          </MenuItem>
        ))}
      </TextField>

      <Box sx={{ display: 'flex', gap: 2 }}>
        <TextField
          label={t('games.create.maxPlayers')}
          type="number"
          value={numericDrafts.maxPlayers}
          onFocus={() => { activeNumericFieldRef.current = 'maxPlayers'; }}
          onBlur={() => handleNumericDraftBlur('maxPlayers')}
          onChange={(e) => handleNumericDraftChange('maxPlayers', e.target.value, parseIntegerDraft)}
          error={!!formErrors.maxPlayers}
          helperText={formErrors.maxPlayers || t('games.create.maxPlayersHelp', {
            min: GAME_VALIDATION.MIN_PLAYERS,
            max: GAME_VALIDATION.MAX_PLAYERS,
          })}
          fullWidth
          placeholder="14"
          inputProps={{ min: GAME_VALIDATION.MIN_PLAYERS, max: GAME_VALIDATION.MAX_PLAYERS, inputMode: 'numeric' }}
        />
        <TextField
          label={t('games.create.maxGoalkeepers')}
          type="number"
          value={numericDrafts.maxGoalkeepers}
          onFocus={() => { activeNumericFieldRef.current = 'maxGoalkeepers'; }}
          onBlur={() => handleNumericDraftBlur('maxGoalkeepers')}
          onChange={(e) => handleNumericDraftChange('maxGoalkeepers', e.target.value, parseIntegerDraft)}
          error={!!formErrors.maxGoalkeepers}
          helperText={formErrors.maxGoalkeepers || t('games.create.maxGoalkeepersHelp', {
            min: GAME_VALIDATION.MIN_GOALKEEPERS,
            max: GAME_VALIDATION.MAX_GOALKEEPERS,
          })}
          fullWidth
          placeholder="2"
          inputProps={{ min: GAME_VALIDATION.MIN_GOALKEEPERS, max: GAME_VALIDATION.MAX_GOALKEEPERS, inputMode: 'numeric' }}
        />
      </Box>

      <TextField
        label={t('games.create.numberOfTeams')}
        type="number"
        value={numericDrafts.numberOfTeams}
        onFocus={() => { activeNumericFieldRef.current = 'numberOfTeams'; }}
        onBlur={() => handleNumericDraftBlur('numberOfTeams')}
        onChange={(e) => handleNumericDraftChange('numberOfTeams', e.target.value, parseIntegerDraft)}
        error={!!formErrors.numberOfTeams}
        helperText={formErrors.numberOfTeams || t('games.create.numberOfTeamsHelp', {
          min: GAME_VALIDATION.MIN_TEAMS,
          max: GAME_VALIDATION.MAX_TEAMS,
        })}
        fullWidth
        placeholder="2"
        inputProps={{ min: GAME_VALIDATION.MIN_TEAMS, max: GAME_VALIDATION.MAX_TEAMS, inputMode: 'numeric' }}
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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
            <TextField
              select
              label={t('games.create.frequency')}
              value={formData.recurrenceType}
              onChange={(e) => handleInputChange('recurrenceType', e.target.value as 'weekly' | 'biweekly' | 'monthly')}
              fullWidth
              size="small"
            >
              <MenuItem value="weekly">{t('games.create.frequencyWeekly')}</MenuItem>
              <MenuItem value="biweekly">{t('games.create.frequencyBiweekly')}</MenuItem>
              <MenuItem value="monthly">{t('games.create.frequencyMonthly')}</MenuItem>
            </TextField>

            <FormControl>
              <FormLabel sx={{ fontSize: '0.8rem' }}>{t('games.create.recurrenceEnd')}</FormLabel>
              <RadioGroup
                value={formData.recurrenceEndMode}
                onChange={(e) => handleInputChange('recurrenceEndMode', e.target.value as 'forever' | 'count' | 'until')}
              >
                <FormControlLabel value="forever" control={<Radio size="small" />} label={t('games.create.recurrenceEndForever')} />
                <FormControlLabel value="count" control={<Radio size="small" />} label={t('games.create.recurrenceEndCount')} />
                <FormControlLabel value="until" control={<Radio size="small" />} label={t('games.create.recurrenceEndUntil')} />
              </RadioGroup>
            </FormControl>

            {formData.recurrenceEndMode === 'count' && (
              <TextField
                type="number"
                size="small"
                label={t('games.create.recurrenceCountLabel')}
                value={numericDrafts.recurrenceCount}
                onFocus={() => { activeNumericFieldRef.current = 'recurrenceCount'; }}
                onBlur={() => handleNumericDraftBlur('recurrenceCount')}
                onChange={(e) => handleNumericDraftChange('recurrenceCount', e.target.value, parseIntegerDraft)}
                error={!!formErrors.recurrenceCount}
                inputProps={{ min: 2, max: RECURRENCE_HARD_CAP, inputMode: 'numeric' }}
                placeholder="10"
                helperText={formErrors.recurrenceCount || t('games.create.recurrenceCountHelp')}
                fullWidth
              />
            )}

            {formData.recurrenceEndMode === 'until' && (
              <TextField
                type="date"
                size="small"
                label={t('games.create.recurrenceUntilLabel')}
                value={formData.recurrenceEndDate}
                onChange={(e) => handleInputChange('recurrenceEndDate', e.target.value)}
                InputLabelProps={{ shrink: true }}
                inputProps={{ min: formData.date || undefined }}
                fullWidth
              />
            )}
          </Box>
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
        value={numericDrafts.totalCost}
        onFocus={() => { activeNumericFieldRef.current = 'totalCost'; }}
        onBlur={() => {
          activeNumericFieldRef.current = null;
          if (numericDrafts.totalCost.trim() === '') {
            handleNumericDraftChange('totalCost', '', parseCurrencyDraft);
          }
        }}
        onChange={(e) => handleNumericDraftChange('totalCost', e.target.value, parseCurrencyDraft)}
        error={!!formErrors.totalCost}
        helperText={formErrors.totalCost || t('games.create.totalCostHelp')}
        fullWidth
        placeholder="180,00"
        InputProps={{
          startAdornment: <InputAdornment position="start">R$</InputAdornment>,
        }}
        inputProps={{ min: 0, step: 0.01, inputMode: 'decimal' }}
      />

      {selectedField && selectedFieldPricing && (
        <Alert severity="info" icon={false}>
          {selectedField.name}: {currencyFormatter.format(selectedFieldPricing.hourlyPrice)}/h x {selectedFieldPricing.durationLabel}
          {' = '}
          <strong>{currencyFormatter.format(selectedFieldPricing.totalCost)}</strong>
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
        <TextField
          label="Preço por jogador"
          type="number"
          value={numericDrafts.dailyPrice}
          onFocus={() => { activeNumericFieldRef.current = 'dailyPrice'; }}
          onBlur={() => {
            activeNumericFieldRef.current = null;
            if (numericDrafts.dailyPrice.trim() === '') {
              handleNumericDraftChange('dailyPrice', '', parseCurrencyDraft);
            }
          }}
          onChange={(e) => handleNumericDraftChange('dailyPrice', e.target.value, parseCurrencyDraft)}
          fullWidth
          disabled={!formData.priceManualOverride}
          error={!!formErrors.dailyPrice}
          helperText={formErrors.dailyPrice || t('games.create.dailyPriceHelp')}
          placeholder="15,00"
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
          inputProps={{ min: 0, step: 0.01, inputMode: 'decimal' }}
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
          {currencyFormatter.format(formData.totalCost)} ÷ {formData.maxPlayers} jogadores = <strong>{currencyFormatter.format(formData.dailyPrice)}</strong> por pessoa
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

  const selectedDateLabel = formData.date
    ? formatDate(parse(formData.date, 'yyyy-MM-dd', new Date()), 'EEE, dd/MM', { locale: dateFnsPtBR })
    : 'Escolha a data';
  const selectedTimeLabel = formData.time
    ? `${formData.time}${formData.endTime ? ` - ${formData.endTime}` : ''}`
    : 'Escolha o horário';
  const maxPlayersReadyValue = parseIntegerDraft(numericDrafts.maxPlayers);
  const maxGoalkeepersReadyValue = parseIntegerDraft(numericDrafts.maxGoalkeepers);
  const numberOfTeamsReadyValue = parseIntegerDraft(numericDrafts.numberOfTeams);
  const locationReady = Boolean(formData.locationName.trim()) && (
    useCustomLocation
      ? Boolean(formData.locationAddress.trim())
      : Boolean(formData.locationId && formData.fieldId)
  );
  const scheduleReady = Boolean(formData.date && formData.time && !formErrors.date && !formErrors.time && !formErrors.endTime);
  const settingsReady = maxPlayersReadyValue !== null
    && maxPlayersReadyValue >= GAME_VALIDATION.MIN_PLAYERS
    && maxPlayersReadyValue <= GAME_VALIDATION.MAX_PLAYERS
    && maxGoalkeepersReadyValue !== null
    && maxGoalkeepersReadyValue >= GAME_VALIDATION.MIN_GOALKEEPERS
    && maxGoalkeepersReadyValue <= GAME_VALIDATION.MAX_GOALKEEPERS
    && numberOfTeamsReadyValue !== null
    && numberOfTeamsReadyValue >= GAME_VALIDATION.MIN_TEAMS
    && numberOfTeamsReadyValue <= GAME_VALIDATION.MAX_TEAMS;
  const paymentReady = !formData.pixPaymentEnabled || Boolean(formData.pixKey.trim() && formData.pixBeneficiaryName.trim());
  const requiredChecklist = [
    { label: 'Local e quadra', done: locationReady },
    { label: 'Data e horário', done: scheduleReady },
    { label: 'Formato do jogo', done: settingsReady },
    { label: 'Pagamento', done: paymentReady },
  ];
  const completedRequired = requiredChecklist.filter((item) => item.done).length;
  const completionPercent = Math.round((completedRequired / requiredChecklist.length) * 100);
  const recurrenceLabel = formData.recurrenceEnabled
    ? formData.recurrenceType === 'weekly'
      ? 'Semanal'
      : formData.recurrenceType === 'biweekly'
        ? 'Quinzenal'
        : 'Mensal'
    : 'Jogo único';

  const renderCreateHero = () => (
    <Card
      variant="outlined"
      sx={(theme) => ({
        mb: 2.5,
        overflow: 'hidden',
        color: 'primary.contrastText',
        border: 0,
        background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 58%, ${theme.palette.secondary.dark} 100%)`,
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 18% 20%, ${alpha(theme.palette.common.white, 0.26)}, transparent 28%), radial-gradient(circle at 92% 12%, ${alpha(theme.palette.common.white, 0.18)}, transparent 22%)`,
          pointerEvents: 'none',
        },
      })}
    >
      <CardContent
        sx={{
          position: 'relative',
          p: { xs: 2.5, md: 3 },
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' },
          gap: 2,
          alignItems: 'center',
        }}
      >
        <Box>
          <Chip
            icon={<SportsSoccerIcon />}
            label={t('games.create.hero.chipLabel')}
            size="small"
            sx={(theme) => ({
              mb: 1.5,
              color: 'primary.contrastText',
              bgcolor: alpha(theme.palette.common.white, 0.16),
              border: 1,
              borderColor: alpha(theme.palette.common.white, 0.24),
              '& .MuiChip-icon': { color: 'primary.contrastText' },
            })}
          />
          <Typography
            variant="h4"
            component="p"
            sx={{ fontWeight: 900, letterSpacing: '-0.04em', maxWidth: 680 }}
          >
            {t('games.create.hero.title')}
          </Typography>
          <Typography
            variant="body1"
            sx={(theme) => ({
              mt: 1,
              maxWidth: 620,
              color: alpha(theme.palette.common.white, 0.88),
            })}
          >
            {t('games.create.hero.subtitle')}
          </Typography>
        </Box>
        {/* #4057: no dark o gradiente é claro (#4ADE80 → #3A8FC4) e o véu branco
            0.14 deixava os dois rótulos pequenos em 3.04/3.34:1 — o véu escurece
            para alpha(black, 0.24) no dark e os rótulos usam branco cheio
            (>= 5.6:1 nos dois temas). */}
        <Box
          sx={(theme) => ({
            minWidth: { xs: '100%', md: 260 },
            borderRadius: 4,
            p: 2,
            bgcolor: theme.palette.mode === 'dark'
              ? alpha(theme.palette.common.black, 0.24)
              : alpha(theme.palette.common.white, 0.14),
            border: 1,
            borderColor: alpha(theme.palette.common.white, 0.24),
            backdropFilter: 'blur(12px)',
          })}
        >
          <Typography variant="caption" sx={{ color: 'common.white' }}>
            {t('games.create.hero.quickPreview')}
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 900, color: 'common.white' }}>
            {formData.locationName || t('games.create.hero.locationFallback')}
          </Typography>
          <Typography variant="body2" sx={{ color: 'common.white' }}>
            {selectedDateLabel} · {selectedTimeLabel}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );

  const renderTemplateAccelerator = () => (
    <Card
      variant="outlined"
      sx={(theme) => ({
        mb: 2.5,
        borderColor: alpha(theme.palette.secondary.main, 0.18),
        boxShadow: theme.shadowsCustom?.card ?? theme.shadows[1],
      })}
    >
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: { xs: 2, md: 2.5 } }}>
        <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flex: 1 }}>
            <Box
              sx={(theme) => ({
                width: 40,
                height: 40,
                borderRadius: 2.5,
                display: 'grid',
                placeItems: 'center',
                color: 'secondary.main',
                bgcolor: alpha(theme.palette.secondary.main, 0.1),
              })}
            >
              <BoltIcon />
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight={800}>
                {t('games.create.quickStartTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('games.create.quickStartDescription')}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, width: { xs: '100%', sm: 'auto' }, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<SaveIcon />}
              onClick={() => setTemplateDialogOpen(true)}
            >
              {t('games.create.saveAsTemplate')}
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<ContentPasteIcon />}
              onClick={() => setDuplicateDialogOpen(true)}
              disabled={recentGames.length === 0}
            >
              {t('games.duplicateGame')}
            </Button>
          </Box>
        </Box>
        <Divider />
        {templatesLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
            <CircularProgress size={20} />
          </Box>
        ) : templates.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('games.create.noTemplatesDescription')}
          </Typography>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1 }}>
            {templates.map((tpl) => (
              <Card key={tpl.id} variant="outlined" sx={{ bgcolor: 'background.default' }}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1.25, '&:last-child': { pb: 1.25 } }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={700} noWrap>
                      {tpl.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {tpl.location_name || t('games.create.noLocationLabel')} {tpl.time ? `· ${tpl.time}` : ''} {tpl.recurrence_type ? `· ${tpl.recurrence_type === 'weekly' ? t('games.create.frequencyWeekly') : tpl.recurrence_type === 'biweekly' ? t('games.create.frequencyBiweekly') : t('games.create.frequencyMonthly')}` : ''} {tpl.max_players ? `· ${tpl.max_players} ${t('games.playersShort')}` : ''}
                    </Typography>
                  </Box>
                  <Button size="small" variant="outlined" onClick={() => handleLoadTemplate(tpl.id)}>
                    {t('common.load')}
                  </Button>
                  <Tooltip title={tpl.time ? t('games.create.quickCreateTooltip') : t('games.create.templateWithoutTimeTooltip')}>
                    <span>
                      <Button
                        size="small"
                        variant="contained"
                        color={tpl.time ? 'primary' : 'inherit'}
                        disabled={!tpl.time}
                        onClick={() => handleQuickCreateFromTemplate(tpl)}
                      >
                        {t('games.createGame')}
                      </Button>
                    </span>
                  </Tooltip>
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteTemplate(tpl.id)}
                    aria-label={`Remover template ${tpl.name}`}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );

  const renderGameSummary = () => (
    <Card
      variant="outlined"
      sx={(theme) => ({
        position: { lg: 'sticky' },
        top: { lg: 88 },
        borderColor: alpha(theme.palette.primary.main, 0.18),
        boxShadow: theme.shadowsCustom?.cardPremium ?? theme.shadows[2],
        overflow: 'hidden',
      })}
    >
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2 }}>
          <Box
            sx={(theme) => ({
              width: 42,
              height: 42,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              color: 'primary.main',
              bgcolor: alpha(theme.palette.primary.main, 0.1),
            })}
          >
            <SportsSoccerIcon />
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={900}>
              Resumo do jogo
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {completedRequired}/{requiredChecklist.length} essenciais prontos
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <CircularProgress
            variant="determinate"
            value={completionPercent}
            size={56}
            thickness={5}
            aria-label={`Progresso do formulário: ${completionPercent}%`}
          />
          <Box>
            <Typography variant="h6" fontWeight={900}>
              {completionPercent}%
            </Typography>
            <Typography variant="caption" color="text.secondary">
              pronto para publicar
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {[
            { icon: <PlaceIcon fontSize="small" />, label: 'Local', value: formData.fieldName || formData.locationName || 'Ainda não definido' },
            { icon: <EventAvailableIcon fontSize="small" />, label: 'Agenda', value: `${selectedDateLabel} · ${selectedTimeLabel}` },
            { icon: <GroupsIcon fontSize="small" />, label: 'Elenco', value: `${formData.maxPlayers} jogadores · ${formData.maxGoalkeepers} goleiros` },
            { icon: <PaidIcon fontSize="small" />, label: 'Valor', value: formData.totalCost > 0 ? `${currencyFormatter.format(formData.dailyPrice)} por jogador` : 'Sem cobrança definida' },
            { icon: <TuneIcon fontSize="small" />, label: 'Ritmo', value: recurrenceLabel },
          ].map((row) => (
            <Box key={row.label} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <Box sx={{ color: 'text.secondary', mt: 0.25 }}>{row.icon}</Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary">
                  {row.label}
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {row.value}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Checklist antes de chamar a galera
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {requiredChecklist.map((item) => (
            <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {item.done ? (
                <CheckCircleIcon color="success" fontSize="small" />
              ) : (
                <RadioButtonUncheckedIcon color="disabled" fontSize="small" />
              )}
              <Typography variant="body2" color={item.done ? 'text.primary' : 'text.secondary'}>
                {item.label}
              </Typography>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );

  return (<>
    <LocalizationProvider dateAdapter={AdapterDateFnsV3} adapterLocale={dateFnsPtBR}>
    <FormScaffold
      title={t('games.createGame')}
      closeDestination={closeDestination}
      closeVariant="X"
      isDirty={isDirty}
      loading={loading}
    >
      <PageContainer maxWidth="detail">
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
          <Alert severity="success" sx={{ mb: 2 }}>{t('games.create.draftRestored')}</Alert>
        )}

        {renderCreateHero()}
        {renderTemplateAccelerator()}

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
          <DialogTitle id="draft-prompt-dialog-title">{t('games.create.draftFoundTitle')}</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              {t('games.create.draftFoundDescription')}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              discardDraft();
              setFormData(initialFormData);
              setUserInteracted(false);
            }} color="error">
              {t('common.discard')}
            </Button>
            <Button onClick={() => restoreDraft()} variant="contained" autoFocus>
              {t('common.continue')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Duplicate game dialog */}
        <Dialog open={duplicateDialogOpen} onClose={() => setDuplicateDialogOpen(false)} fullWidth maxWidth="sm" aria-labelledby="duplicate-dialog-title">
          <DialogTitle id="duplicate-dialog-title">{t('games.duplicateGame')}</DialogTitle>
          <DialogContent>
            {duplicateGamesLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            ) : recentGames.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t('games.create.noPreviousGames')}
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

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 360px' },
            gap: { xs: 2.5, lg: 3 },
            alignItems: 'start',
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, minWidth: 0 }}>
            <CreateGameSection
              icon={<PlaceIcon />}
              title="Local"
              subtitle="Escolha a quadra, use favoritos ou cadastre um local rápido."
              statusLabel={locationReady ? 'Pronto' : 'Pendente'}
              statusColor={locationReady ? 'success' : 'warning'}
            >
              {renderLocationSection()}
            </CreateGameSection>

            <CreateGameSection
              icon={<EventAvailableIcon />}
              title="Data e horário"
              subtitle="Veja disponibilidade, horários populares e conflitos antes de publicar."
              statusLabel={scheduleReady ? 'Pronto' : 'Pendente'}
              statusColor={scheduleReady ? 'success' : 'warning'}
            >
              {renderDateTimeSection()}
            </CreateGameSection>

            <CreateGameSection
              icon={<TuneIcon />}
              title="Configurações"
              subtitle="Defina elenco, visibilidade, gênero, recorrência e convites automáticos."
              statusLabel={settingsReady ? 'Pronto' : 'Revisar'}
              statusColor={settingsReady ? 'success' : 'warning'}
            >
              {renderSettingsSection()}
            </CreateGameSection>

            <CreateGameSection
              icon={<PaidIcon />}
              title="Pagamento"
              subtitle="Calcule o valor por jogador e configure Pix quando necessário."
              statusLabel={paymentReady ? 'Opcional' : 'Pendente'}
              statusColor={paymentReady ? 'default' : 'warning'}
              collapsible
              expanded={paymentExpanded}
              onToggle={() => setPaymentExpanded(!paymentExpanded)}
            >
              {renderPaymentSection()}
            </CreateGameSection>

            <CreateGameSection
              icon={<RuleIcon />}
              title="Regras"
              subtitle="Combine detalhes que evitam dúvida: atraso, colete, goleiro e critérios de presença."
              statusLabel={formData.rules.trim() ? 'Definidas' : 'Opcional'}
              statusColor={formData.rules.trim() ? 'success' : 'default'}
              collapsible
              expanded={rulesExpanded}
              onToggle={() => setRulesExpanded(!rulesExpanded)}
            >
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
            </CreateGameSection>
          </Box>

          <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
            {renderGameSummary()}
          </Box>
        </Box>

        <Box sx={{ display: { xs: 'block', lg: 'none' }, mt: 2.5 }}>
          {renderGameSummary()}
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
      </PageContainer>
    </FormScaffold>
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
        setUseCustomLocation(true);
        setFormData((prev) => ({
          ...prev,
          locationId: '',
          fieldId: '',
          fieldName: '',
          locationName: loc.name,
          locationAddress: loc.address,
          locationLat: undefined,
          locationLng: undefined,
          maxPlayers: loc.capacity && loc.capacity > 0 ? loc.capacity : prev.maxPlayers,
          totalCost: loc.defaultPrice && loc.defaultPrice > 0 ? loc.defaultPrice : prev.totalCost,
        }));
        showSuccess(t('games.create.quickLocationDraftSelected', { name: loc.name }));
      }}
    />
  </>);
};
