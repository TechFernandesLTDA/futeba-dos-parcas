import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  TextField,
  Button,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Collapse,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  ContentPaste as ContentPasteIcon,
  EventAvailable as EventAvailableIcon,
  Paid as PaidIcon,
  Place as PlaceIcon,
  Rule as RuleIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import { AdapterDateFns as AdapterDateFnsV3 } from '@mui/x-date-pickers/AdapterDateFnsV3';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { ptBR as dateFnsPtBR } from 'date-fns/locale';
import { format as formatDate, parse } from 'date-fns';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { FormScaffold } from '../../components/layout';
import { PageContainer } from '../../components/common/PageContainer';
import { ShareDialog } from '../../components/game/ShareDialog';
import { QuickLocationDialog } from '../../components/locations/QuickLocationDialog';
import { useFieldGames } from '../../hooks/useFieldGames';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useCreateGame } from '../../hooks/useGames';
import { useGroupDetail, useGroups } from '../../hooks/useGroups';
import { useLocationDetail, useLocationsByIds } from '../../hooks/useLocations';
import { useVenueSelector } from '../../hooks/useVenueSelector';
import { isVenueSelectable } from '../../utils/venueSelector';
import { useGameTemplates } from '../../hooks/useGameTemplates';
import { usePopularTimes } from '../../hooks/usePopularTimes';
import { useHabitualTime } from '../../hooks/useHabitualTime';
import { useDuplicateGame } from '../../hooks/useDuplicateGame';
import { useAutoInviteMembers } from '../../hooks/useAutoInviteMembers';
import { useGameDraft } from '../../hooks/useGameDraft';
import { useRecentLocations } from '../../hooks/useRecentLocations';
import { FieldType, GameTemplate, Game, GameVisibility } from '../../types/game';
import { Field, Location as FutebaLocation } from '../../types/location';
import { snakeToCamel, normalizeField } from '../../utils/firestoreHelpers';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { createLogger } from '../../utils/logger';
import { getFieldAvailability } from '../../services/cloudFunctions';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { getFunctionsErrorMessage } from '../../utils/firebaseErrors';
import { useTranslation } from 'react-i18next';
import { GAME_VALIDATION } from '../../utils/validationConstants';
import {
  calculateFieldRentalCost,
  calculatePerPlayerPrice,
  DEFAULT_GAME_DURATION_MINUTES,
  formatGameDurationLabel,
  getGameDurationMinutes,
  normalizeHourlyPriceForGame,
  resolveGamePricingForSave,
} from '../../utils/gamePricing';
import { calculateNextOccurrence } from './recurringGameHelpers';
import {
  buildConflictResult,
  buildNumericDrafts,
  buildRecurrencePreview,
  ConflictSuggestion,
  CreatedGameData,
  defaultFormData,
  FieldPricingSummary,
  formatGameDate,
  formatTime,
  GameFormData,
  getLocationDisplayAddress,
  MIN_GROUP_MEMBERS_TO_CREATE_GAME,
  NumericField,
  parseCurrencyDraft,
  parseIntegerDraft,
  TIME_SLOTS,
  validateCreateGameForm,
  CreateDateTimeSection,
  CreateGameSummary,
  CreateHeroSection,
  CreateLocationSection,
  CreatePaymentSection,
  CreateSettingsSection,
  CreateTemplateAccelerator,
} from './create';

const logger = createLogger('CreateGameScreen');

const parseTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
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
      {collapsible ? (
        <Collapse in={expanded}>
          <Box sx={{ pt: 2 }}>{children}</Box>
        </Collapse>
      ) : (
        <Box sx={{ pt: 2 }}>{children}</Box>
      )}
    </CardContent>
  </Card>
);

export const CreateGameScreen: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const groupId = searchParams.get('groupId');
  const locationIdParam = searchParams.get('locationId');
  const { user, firebaseUser } = useAuth();
  const currentUserId = firebaseUser?.uid || user?.id;
  const { showSuccess, showError } = useToast();
  const { t } = useTranslation();
  useDocumentTitle(t('games.createGame'));

  const [formData, setFormData] = useState<GameFormData>(defaultFormData);
  const [useCustomLocation, setUseCustomLocation] = useState(false);
  const [fields, setFields] = useState<Field[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [fieldsError, setFieldsError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [cep, setCep] = useState('');
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userInteracted, setUserInteracted] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [createdGameData, setCreatedGameData] = useState<CreatedGameData | null>(null);
  const [quickLocationOpen, setQuickLocationOpen] = useState(false);
  const [venueQuery, setVenueQuery] = useState('');
  const [paymentExpanded, setPaymentExpanded] = useState(false);
  const [rulesExpanded, setRulesExpanded] = useState(false);

  const [numericDrafts, setNumericDrafts] = useState<Record<NumericField, string>>(() =>
    buildNumericDrafts(defaultFormData)
  );
  const activeNumericFieldRef = useRef<NumericField | null>(null);

  const [localRecentIds, setLocalRecentIds] = useLocalStorage<string[]>('recent_locations', []);
  const { recentIds, usedLocationIds, favoriteIds, isFavorite, toggleFavorite } = useRecentLocations();

  const [conflictSuggestions, setConflictSuggestions] = useState<ConflictSuggestion[]>([]);
  const [conflictMessage, setConflictMessage] = useState<string>('');

  const { createGame } = useCreateGame();
  const { groups, loading: groupsLoading } = useGroups();
  const { group: preselectedGroup } = useGroupDetail(groupId || null);
  const { location: initialLocation } = useLocationDetail(locationIdParam || undefined);
  const venueSelector = useVenueSelector({ searchQuery: venueQuery, recentIds: usedLocationIds });
  const { location: selectedLocationDetail } = useLocationDetail(formData.locationId || undefined);
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
  const { templates, loading: templatesLoading, saveTemplate, removeTemplate } = useGameTemplates();
  const { recentGames, loading: duplicateGamesLoading } = useDuplicateGame();
  const { autoInvite } = useAutoInviteMembers();
  const { habitualTime } = useHabitualTime(formData.locationId);
  const { popularTimes = [] } = usePopularTimes(formData.fieldId);

  const eligibleOwnedGroups = useMemo(() => {
    if (!currentUserId) return [];
    return groups.filter((g) => {
      const isOwner = g.role === 'OWNER' || g.ownerId === currentUserId;
      const count = g.memberCount ?? 0;
      return isOwner && count >= MIN_GROUP_MEMBERS_TO_CREATE_GAME;
    });
  }, [groups, currentUserId]);

  const hasAnyOwnedGroup = useMemo(() => {
    if (!currentUserId) return false;
    return groups.some((g) => g.role === 'OWNER' || g.ownerId === currentUserId);
  }, [groups, currentUserId]);

  const selectedEligibleGroup = useMemo(() => {
    if (!formData.groupId) return undefined;
    return eligibleOwnedGroups.find((g) => g.id === formData.groupId);
  }, [eligibleOwnedGroups, formData.groupId]);

  const initialFormData = useMemo<GameFormData>(() => {
    let base: GameFormData = { ...defaultFormData };
    if (groupId) {
      base.groupId = groupId;
      base.visibility = 'PUBLIC_OPEN';
    }
    if (locationIdParam && initialLocation) {
      base = {
        ...base,
        locationId: initialLocation.id,
        locationName: initialLocation.name,
        locationAddress: getLocationDisplayAddress(initialLocation),
        locationLat: initialLocation.latitude,
        locationLng: initialLocation.longitude,
      };
    }
    return base;
  }, [groupId, locationIdParam, initialLocation]);

  const {
    draft,
    hasDraft,
    showPrompt: draftPromptOpen,
    saveDraftData,
    restoreDraft,
    discardDraft,
  } = useGameDraft<GameFormData>({ key: 'create_game', initialData: initialFormData });

  useEffect(() => {
    if (draft && !userInteracted) {
      setFormData((prev) => ({ ...prev, ...draft }));
      setNumericDrafts(buildNumericDrafts(draft));
    }
  }, [draft, userInteracted]);

  useEffect(() => {
    if (userInteracted && JSON.stringify(formData) !== JSON.stringify(defaultFormData)) {
      saveDraftData(formData);
    }
  }, [formData, userInteracted, saveDraftData]);

  const selectedField = useMemo(() => {
    return fields.find((f) => f.id === formData.fieldId);
  }, [fields, formData.fieldId]);

  const selectedFieldPricing = useMemo<FieldPricingSummary | null>(() => {
    if (!selectedField) return null;
    const hourlyPrice = normalizeHourlyPriceForGame(selectedField.hourlyPrice);
    if (!hourlyPrice) return null;
    const durationMinutes = getGameDurationMinutes(formData.time, formData.endTime);
    return {
      hourlyPrice,
      durationMinutes,
      durationLabel: formatGameDurationLabel(durationMinutes),
      totalCost: calculateFieldRentalCost(selectedField.hourlyPrice, formData.time, formData.endTime),
    };
  }, [selectedField, formData.time, formData.endTime]);

  const recurrencePreview = useMemo(() => {
    return buildRecurrencePreview(formData);
  }, [formData]);

  const handleInputChange = useCallback(
    (field: string, value: unknown) => {
      setUserInteracted(true);
      setFormData((prev) => {
        const next = { ...prev, [field]: value };
        if (field === 'groupId' && value && !prev.groupId) {
          next.visibility = 'PUBLIC_OPEN';
        }
        return next;
      });
      if (formErrors[field]) {
        setFormErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    },
    [formErrors]
  );

  const handleNumericDraftChange = useCallback(
    (field: NumericField, rawValue: string, parser: (value: string) => number | null) => {
      setUserInteracted(true);
      setNumericDrafts((prev) => ({ ...prev, [field]: rawValue }));
      const parsed = parser(rawValue);
      if (parsed !== null) {
        setFormData((prev) => {
          const next = { ...prev, [field]: parsed };
          if (field === 'totalCost' && !prev.priceManualOverride) {
            next.dailyPrice = calculatePerPlayerPrice(parsed, prev.maxPlayers);
          }
          if (field === 'maxPlayers' && !prev.priceManualOverride) {
            next.dailyPrice = calculatePerPlayerPrice(prev.totalCost, parsed);
          }
          return next;
        });
      }
      if (formErrors[field]) {
        setFormErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    },
    [formErrors]
  );

  const handleNumericDraftBlur = useCallback(
    (field: NumericField) => {
      activeNumericFieldRef.current = null;
      setNumericDrafts((prev) => ({
        ...prev,
        [field]: String(formData[field] ?? ''),
      }));
    },
    [formData]
  );

  useEffect(() => {
    if (preselectedGroup && !formData.groupId) {
      const isOwner = preselectedGroup.ownerId === currentUserId;
      const count = preselectedGroup.memberCount ?? 0;
      if (isOwner && count >= MIN_GROUP_MEMBERS_TO_CREATE_GAME) {
        setFormData((prev) => ({
          ...prev,
          groupId: preselectedGroup.id,
          groupName: preselectedGroup.name,
          visibility: 'PUBLIC_OPEN',
        }));
      }
    }
  }, [preselectedGroup, formData.groupId, currentUserId]);

  useEffect(() => {
    if (initialLocation && !formData.locationId) {
      setFormData((prev) => ({
        ...prev,
        locationId: initialLocation.id,
        locationName: initialLocation.name,
        locationAddress: getLocationDisplayAddress(initialLocation),
        locationLat: initialLocation.latitude,
        locationLng: initialLocation.longitude,
      }));
    }
  }, [initialLocation, formData.locationId]);

  useEffect(() => {
    if (!formData.locationId) {
      setFields([]);
      setFieldsError(null);
      return;
    }
    let cancelled = false;
    const fetchFields = async () => {
      setFieldsLoading(true);
      setFieldsError(null);
      try {
        const fieldsRef = collection(db, 'locations', formData.locationId, 'fields');
        const q = query(fieldsRef, where('isActive', '==', true));
        const snapshot = await getDocs(q);
        if (cancelled) return;
        const fetchedFields = snapshot.docs.map((d) =>
          normalizeField<Field>({ ...snakeToCamel<Field>(d.data()), id: d.id })
        );
        setFields(fetchedFields);
        if (fetchedFields.length === 1 && !formData.fieldId) {
          const singleField = fetchedFields[0];
          const totalCost = calculateFieldRentalCost(singleField.hourlyPrice, formData.time, formData.endTime);
          setFormData((prev) => ({
            ...prev,
            fieldId: singleField.id,
            fieldName: singleField.name,
            fieldType: (singleField.type as FieldType) || prev.fieldType,
            gameType: (singleField.type as string) || prev.gameType,
            totalCost: totalCost || prev.totalCost,
            dailyPrice: prev.priceManualOverride
              ? prev.dailyPrice
              : calculatePerPlayerPrice(totalCost || prev.totalCost, prev.maxPlayers),
          }));
        }
      } catch (err) {
        if (cancelled) return;
        logger.error('Erro ao buscar quadras:', err);
        setFieldsError(t('games.create.errorLoadFields'));
        showError(t('games.create.errorLoadFields'));
      } finally {
        if (!cancelled) setFieldsLoading(false);
      }
    };
    fetchFields();
    return () => {
      cancelled = true;
    };
  }, [formData.locationId, formData.time, formData.endTime, formData.fieldId, t, showError]);

  useEffect(() => {
    if (!selectedFieldPricing || formData.priceManualOverride) return;
    setFormData((prev) => {
      const nextTotalCost = selectedFieldPricing.totalCost;
      const nextDailyPrice = calculatePerPlayerPrice(nextTotalCost, prev.maxPlayers);
      if (prev.totalCost === nextTotalCost && prev.dailyPrice === nextDailyPrice) {
        return prev;
      }
      return {
        ...prev,
        totalCost: nextTotalCost,
        dailyPrice: nextDailyPrice,
      };
    });
  }, [selectedFieldPricing, formData.priceManualOverride]);

  useEffect(() => {
    setNumericDrafts((prev) => {
      const activeField = activeNumericFieldRef.current;
      const nextDrafts: Record<NumericField, string> = {
        maxPlayers: activeField === 'maxPlayers' ? prev.maxPlayers : String(formData.maxPlayers),
        maxGoalkeepers: activeField === 'maxGoalkeepers' ? prev.maxGoalkeepers : String(formData.maxGoalkeepers),
        numberOfTeams: activeField === 'numberOfTeams' ? prev.numberOfTeams : String(formData.numberOfTeams),
        totalCost: activeField === 'totalCost' ? prev.totalCost : formData.totalCost ? String(formData.totalCost) : '',
        dailyPrice: activeField === 'dailyPrice' ? prev.dailyPrice : formData.dailyPrice ? String(formData.dailyPrice) : '',
        recurrenceCount: activeField === 'recurrenceCount' ? prev.recurrenceCount : String(formData.recurrenceCount),
      };
      const hasChanged = (Object.keys(nextDrafts) as NumericField[]).some((k) => nextDrafts[k] !== prev[k]);
      return hasChanged ? nextDrafts : prev;
    });
  }, [
    formData.maxPlayers,
    formData.maxGoalkeepers,
    formData.numberOfTeams,
    formData.totalCost,
    formData.dailyPrice,
    formData.recurrenceCount,
  ]);

  const selectCatalogLocation = useCallback(
    (loc: FutebaLocation) => {
      if (!isVenueSelectable(loc)) return;
      setUseCustomLocation(false);
      setLocalRecentIds((prev) => [loc.id, ...prev.filter((id) => id !== loc.id)].slice(0, 5));
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
    },
    [setLocalRecentIds]
  );

  const handleCepChange = async (value: string) => {
    const cleanCep = value.replace(/\D/g, '');
    setCep(cleanCep);
    setCepError('');
    if (cleanCep.length === 8) {
      setCepLoading(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await response.json();
        if (data.erro) {
          setCepError(t('locations.quickCreate.cepNotFound'));
        } else {
          const address = `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`;
          handleInputChange('locationAddress', address);
          if (!formData.locationName) {
            handleInputChange('locationName', `${data.logradouro}`);
          }
        }
      } catch (err) {
        logger.error('Erro ao buscar CEP:', err);
        setCepError(t('locations.quickCreate.cepError'));
        showError(t('locations.quickCreate.cepError'));
      } finally {
        setCepLoading(false);
      }
    }
  };

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

  useEffect(() => {
    if (!formData.fieldId || !formData.date || !formData.time) {
      setConflictSuggestions([]);
      setConflictMessage('');
      return;
    }
    let cancelled = false;
    const checkAvailability = async () => {
      try {
        const { data: availability } = await getFieldAvailability({
          fieldId: formData.fieldId,
          startDate: formData.date,
          endDate: formData.date,
        });
        if (cancelled) return;
        const conflict = buildConflictResult({
          existingSlots: availability.slots,
          date: formData.date,
          time: formData.time,
          endTime: formData.endTime,
          byDate: fieldGames.byDate,
        });
        if (conflict) {
          setConflictMessage(conflict.message);
          setConflictSuggestions(conflict.suggestions);
        } else {
          setConflictSuggestions([]);
          setConflictMessage('');
        }
      } catch (err) {
        logger.error('Erro ao checar disponibilidade:', err);
        showError(t('games.create.conflictCheckFailed'));
      }
    };
    checkAvailability();
    return () => {
      cancelled = true;
    };
  }, [formData.fieldId, formData.date, formData.time, formData.endTime, fieldGames.byDate, showError, t]);

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

  const handleQuickCreateFromTemplate = async (template: GameTemplate) => {
    if (!template.time) {
      showError(t('games.create.templateWithoutTimeTooltip'));
      return;
    }
    const targetGroup = selectedEligibleGroup || eligibleOwnedGroups[0];
    if (!targetGroup) {
      showError(hasAnyOwnedGroup
        ? t('games.create.noQualifiedGroupQuickCreate')
        : t('games.create.noOwnedGroupQuickCreate'));
      return;
    }
    const { date: nextDate } = calculateNextOccurrence(template.time, template.recurrence_type || 'weekly');
    const quickData: GameFormData = {
      ...defaultFormData,
      locationId: template.location_id || '',
      locationName: template.location_name || '',
      locationAddress: template.location_name || '',
      fieldId: template.field_id || '',
      fieldName: template.field_name || '',
      fieldType: template.field_type || 'SOCIETY',
      gameType: template.field_type || 'SOCIETY',
      maxPlayers: template.max_players || 14,
      maxGoalkeepers: template.max_goalkeepers ?? 2,
      numberOfTeams: 2,
      dailyPrice: template.daily_price || 0,
      totalCost: template.total_cost || 0,
      rules: template.rules || '',
      visibility: (template.visibility as GameVisibility) || 'PUBLIC_OPEN',
      recurrenceEnabled: !!template.recurrence_type,
      recurrenceType: (template.recurrence_type as 'weekly' | 'biweekly' | 'monthly') || 'weekly',
      time: template.time,
      endTime: formatTime(parseTime(template.time) + DEFAULT_GAME_DURATION_MINUTES),
      date: nextDate,
      groupId: targetGroup.id,
      groupName: targetGroup.name,
      autoInviteMembers: true,
    };
    await submitGame(quickData);
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
      visibility: (game.visibility as GameVisibility) || prev.visibility,
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

  const submitGame = async (data: GameFormData) => {
    setLoading(true);
    setError(null);
    try {
      const finalPricing = resolveGamePricingForSave({
        totalCost: data.totalCost,
        dailyPrice: data.dailyPrice,
        priceManualOverride: data.priceManualOverride,
        maxPlayers: data.maxPlayers,
      });

      const gamePayload: Record<string, unknown> = {
        name: `${data.gameType || 'Jogo'} - ${data.locationName}`,
        date: data.date,
        time: data.time,
        endTime: data.endTime,
        locationId: data.locationId || '',
        locationName: data.locationName,
        locationAddress: data.locationAddress,
        fieldId: data.fieldId || '',
        fieldName: data.fieldName,
        fieldType: data.fieldType,
        gameType: data.gameType,
        maxPlayers: data.maxPlayers,
        maxGoalkeepers: data.maxGoalkeepers,
        numberOfTeams: data.numberOfTeams,
        totalCost: finalPricing.totalCost,
        dailyPrice: finalPricing.dailyPrice,
        priceManualOverride: finalPricing.priceManualOverride,
        pixPaymentEnabled: data.pixPaymentEnabled,
        pixKey: data.pixKey,
        pixKeyType: data.pixKeyType,
        pixBeneficiaryName: data.pixBeneficiaryName,
        rules: data.rules,
        groupId: data.groupId || '',
        groupName: data.groupName || '',
        visibility: data.visibility,
        recurrenceEnabled: data.recurrenceEnabled,
        recurrenceType: data.recurrenceType,
        streamUrl: data.streamUrl.trim(),
        autoInviteMembers: data.autoInviteMembers,
        gender: data.gender,
        createdBy: currentUserId,
      };

      if (data.recurrenceEnabled) {
        if (data.recurrenceEndMode === 'count') {
          gamePayload.recurrenceCount = data.recurrenceCount;
        } else if (data.recurrenceEndMode === 'until' && data.recurrenceEndDate) {
          gamePayload.recurrenceEndDate = data.recurrenceEndDate;
        }
      }

      const newGameId = await createGame(gamePayload as unknown as Omit<Game, 'id'>);
      discardDraft();

      if (data.autoInviteMembers && data.groupId) {
        try {
          await autoInvite(newGameId, data.groupId);
        } catch (inviteErr) {
          logger.error('Erro ao convidar membros:', inviteErr);
          showError(t('feedback.groups.autoInviteError'));
        }
      }

      setCreatedGameData({
        gameId: newGameId,
        date: data.date,
        time: data.time,
        endTime: data.endTime,
        locationName: data.locationName,
        fieldName: data.fieldName,
        locationAddress: data.locationAddress,
        maxPlayers: data.maxPlayers,
        dailyPrice: finalPricing.dailyPrice,
        rules: data.rules,
      });
      setShareDialogOpen(true);
    } catch (err: unknown) {
      logger.error('Erro ao criar jogo:', err);
      const friendlyMessage = getFunctionsErrorMessage(err, 'createGame');
      setError(friendlyMessage);
      showError(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    const { errors, normalizedNumericValues } = validateCreateGameForm({
      formData,
      numericDrafts,
      useCustomLocation,
      fields,
      hasSelectedEligibleGroup: Boolean(selectedEligibleGroup),
      t,
    });

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      showError(t('games.create.fillRequiredFields'));
      return;
    }

    const submissionData: GameFormData = {
      ...formData,
      ...normalizedNumericValues,
    };

    await submitGame(submissionData);
  };

  const handleShareClose = () => {
    setShareDialogOpen(false);
    if (createdGameData) {
      navigate(`/games/${createdGameData.gameId}`);
    } else {
      navigate('/games');
    }
  };

  const isDirty = userInteracted;
  const closeDestination = groupId ? `/groups/${groupId}` : '/games';

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

  return (
    <>
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

            <CreateHeroSection
              formData={formData}
              selectedDateLabel={selectedDateLabel}
              selectedTimeLabel={selectedTimeLabel}
            />

            <CreateTemplateAccelerator
              templatesLoading={templatesLoading}
              templates={templates}
              recentGames={recentGames}
              onOpenSaveTemplate={() => setTemplateDialogOpen(true)}
              onOpenDuplicate={() => setDuplicateDialogOpen(true)}
              onLoadTemplate={handleLoadTemplate}
              onQuickCreateFromTemplate={handleQuickCreateFromTemplate}
              onDeleteTemplate={handleDeleteTemplate}
            />

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
                  <CreateLocationSection
                    formData={formData}
                    formErrors={formErrors}
                    selectedEligibleGroup={selectedEligibleGroup}
                    eligibleOwnedGroups={eligibleOwnedGroups}
                    hasAnyOwnedGroup={hasAnyOwnedGroup}
                    groupsLoading={groupsLoading}
                    groupId={groupId}
                    useCustomLocation={useCustomLocation}
                    setUseCustomLocation={setUseCustomLocation}
                    setFormData={setFormData}
                    handleInputChange={handleInputChange}
                    favoriteIds={favoriteIds}
                    recentIds={recentIds}
                    localRecentIds={localRecentIds}
                    locations={locations}
                    locationsLoading={locationsLoading}
                    locationsError={locationsError}
                    selectCatalogLocation={selectCatalogLocation}
                    venueSelector={venueSelector}
                    usedLocationIds={usedLocationIds}
                    setVenueQuery={setVenueQuery}
                    selectedLocation={selectedLocation}
                    setQuickLocationOpen={setQuickLocationOpen}
                    isFavorite={isFavorite}
                    toggleFavorite={toggleFavorite}
                    showSuccess={showSuccess}
                    cep={cep}
                    cepError={cepError}
                    cepLoading={cepLoading}
                    handleCepChange={handleCepChange}
                    fieldsLoading={fieldsLoading}
                    fieldsError={fieldsError}
                    fields={fields}
                    calculateFieldRentalCost={calculateFieldRentalCost}
                    calculatePerPlayerPrice={calculatePerPlayerPrice}
                    normalizeHourlyPriceForGame={normalizeHourlyPriceForGame}
                  />
                </CreateGameSection>

                <CreateGameSection
                  icon={<EventAvailableIcon />}
                  title="Data e horário"
                  subtitle="Veja disponibilidade, horários populares e conflitos antes de publicar."
                  statusLabel={scheduleReady ? 'Pronto' : 'Pendente'}
                  statusColor={scheduleReady ? 'success' : 'warning'}
                >
                  <CreateDateTimeSection
                    formData={formData}
                    formErrors={formErrors}
                    fieldGames={fieldGames}
                    handleInputChange={handleInputChange}
                    handleStartTimeChange={handleStartTimeChange}
                    handleTimeSlotClick={handleTimeSlotClick}
                    conflictSuggestions={conflictSuggestions}
                    conflictMessage={conflictMessage}
                    setConflictSuggestions={setConflictSuggestions}
                    setConflictMessage={setConflictMessage}
                    suggestedTimeChips={suggestedTimeChips}
                    recurrencePreview={recurrencePreview}
                    selectedLocation={selectedLocation}
                  />
                </CreateGameSection>

                <CreateGameSection
                  icon={<TuneIcon />}
                  title="Configurações"
                  subtitle="Defina elenco, visibilidade, gênero, recorrência e convites automáticos."
                  statusLabel={settingsReady ? 'Pronto' : 'Revisar'}
                  statusColor={settingsReady ? 'success' : 'warning'}
                >
                  <CreateSettingsSection
                    formData={formData}
                    formErrors={formErrors}
                    numericDrafts={numericDrafts}
                    activeNumericFieldRef={activeNumericFieldRef}
                    handleInputChange={handleInputChange}
                    handleNumericDraftChange={handleNumericDraftChange}
                    handleNumericDraftBlur={handleNumericDraftBlur}
                    parseIntegerDraft={parseIntegerDraft}
                  />
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
                  <CreatePaymentSection
                    formData={formData}
                    formErrors={formErrors}
                    numericDrafts={numericDrafts}
                    activeNumericFieldRef={activeNumericFieldRef}
                    handleInputChange={handleInputChange}
                    handleNumericDraftChange={handleNumericDraftChange}
                    parseCurrencyDraft={parseCurrencyDraft}
                    selectedField={selectedField}
                    selectedFieldPricing={selectedFieldPricing}
                  />
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
                <CreateGameSummary
                  formData={formData}
                  selectedDateLabel={selectedDateLabel}
                  selectedTimeLabel={selectedTimeLabel}
                  recurrenceLabel={recurrenceLabel}
                  requiredChecklist={requiredChecklist}
                  completedRequired={completedRequired}
                  completionPercent={completionPercent}
                />
              </Box>
            </Box>

            <Box sx={{ display: { xs: 'block', lg: 'none' }, mt: 2.5 }}>
              <CreateGameSummary
                formData={formData}
                selectedDateLabel={selectedDateLabel}
                selectedTimeLabel={selectedTimeLabel}
                recurrenceLabel={recurrenceLabel}
                requiredChecklist={requiredChecklist}
                completedRequired={completedRequired}
                completionPercent={completionPercent}
              />
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
    </>
  );
};
