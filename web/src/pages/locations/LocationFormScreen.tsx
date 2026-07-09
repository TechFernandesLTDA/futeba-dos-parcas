import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  TextField,
  Button,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  Stack,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import PageContainer from '../../components/common/PageContainer';
import { MyLocation as GeoIcon } from '@mui/icons-material';
import {
  doc,
  getDoc,
  getDocs,
  collection,
  serverTimestamp,
  writeBatch,
  query,
  orderBy,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { FirebaseError } from 'firebase/app';
import { db } from '../../services/firebase';
import { storage } from '../../services/firebaseStorage';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import {
  Location,
  Field,
  COMMERCIAL_AMENITIES,
  AMENITY_LABELS,
} from '../../types/location';
import { LocationFieldsEditor } from '../../components/locations/LocationFieldsEditor';
import {
  LocationFieldDraft,
  createLocationFieldDraft,
  fieldToDraft,
  parseHourlyPrice,
  parseOptionalPositiveInt,
  summarizeLocationFields,
} from '../../utils/locationFields';
import { FormScaffold, AdaptiveFormSheet } from '../../components/layout';
import { createLogger } from '../../utils/logger';
import { syncFieldOwnerClaim } from '../../services/cloudFunctions';
import { useTranslation } from 'react-i18next';

const logger = createLogger('LocationFormScreen');

interface FormState {
  name: string;
  address: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  city: string;
  state: string;
  district: string;
  region: string;
  phone: string;
  whatsapp: string;
  instagram: string;
  website: string;
  description: string;
  hasLighting: boolean;
  hasParking: boolean;
  hasShowers: boolean;
  amenities: string[];
  latitude: number | null;
  longitude: number | null;
  openingTime: string;
  closingTime: string;
  operatingDays: number[];
  minGameDurationMinutes: string;
  photoFiles: File[];
  photoPreviews: string[];
  existingPhotos: string[];
}

const defaultForm: FormState = {
  name: '',
  address: '',
  cep: '',
  street: '',
  number: '',
  complement: '',
  city: '',
  state: '',
  district: '',
  region: '',
  phone: '',
  whatsapp: '',
  instagram: '',
  website: '',
  description: '',
  hasLighting: false,
  hasParking: false,
  hasShowers: false,
  amenities: [],
  latitude: null,
  longitude: null,
  openingTime: '06:00',
  closingTime: '23:00',
  operatingDays: [1, 2, 3, 4, 5, 6, 7],
  minGameDurationMinutes: '60',
  photoFiles: [],
  photoPreviews: [],
  existingPhotos: [],
};

const defaultFieldDrafts = [createLocationFieldDraft(1)];
const OPERATING_DAY_OPTIONS = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
  { value: 7, label: 'Dom' },
];

const safeStorageName = (name: string) =>
  name.replace(/\.[^.]+$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'foto';

function buildSafeStorageFileName(file: File, index: number) {
  const extension = file.type.split('/')[1] || 'jpg';
  return `${Date.now()}-${index}-${safeStorageName(file.name)}.${extension.replace('jpeg', 'jpg')}`;
}

export const LocationFormScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const { locationId } = useParams<{ locationId: string }>();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;
  const tRef = useRef(t);
  tRef.current = t;

  const isEdit = !!locationId;
  useDocumentTitle(t(isEdit ? 'page.title.editLocation' : 'page.title.createLocation'));

  const [form, setForm] = useState<FormState>(defaultForm);
  const [initialForm, setInitialForm] = useState<FormState>(defaultForm);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(isEdit);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [fields, setFields] = useState<LocationFieldDraft[]>(defaultFieldDrafts);
  const [initialFields, setInitialFields] = useState<LocationFieldDraft[]>(defaultFieldDrafts);
  const [geoLoading, setGeoLoading] = useState(false);
  const basicInfoRef = useRef<HTMLDivElement | null>(null);
  const photosRef = useRef<HTMLDivElement | null>(null);
  const fieldsRef = useRef<HTMLDivElement | null>(null);

  // Carrega dados existentes quando em modo edição
  useEffect(() => {
    if (!isEdit || !locationId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'locations', locationId));
        if (cancelled) return;
        if (!snap.exists()) {
          setFetchError(tRef.current('feedback.location.notFound'));
          setFetchLoading(false);
          return;
        }
        const data = snakeToCamel<Location>(snap.data());
        const fieldsSnapshot = await getDocs(
          query(collection(db, 'locations', locationId, 'fields'), orderBy('name', 'asc')),
        );
        if (cancelled) return;
        const loadedFields = fieldsSnapshot.docs.map((fieldDoc) =>
          fieldToDraft({
            ...snakeToCamel<Field>(fieldDoc.data()),
            id: fieldDoc.id,
          }),
        );
        if (!cancelled) {
          // #1339: um único literal nomeado alimenta form E baseline, para
          // não divergirem se FormState crescer.
          const loaded: FormState = {
            name: data.name || '',
            address: data.address || '',
            cep: data.cep || '',
            street: data.street || '',
            number: data.number || '',
            complement: data.complement || '',
            city: data.city || '',
            state: data.state || '',
            district: data.district || '',
            region: data.region || '',
            phone: data.phone || '',
            whatsapp: data.whatsapp || '',
            instagram: data.instagram || '',
            website: data.website || '',
            description: data.description || '',
            hasLighting: !!data.hasLighting,
            hasParking: !!data.hasParking,
            hasShowers: !!data.hasShowers,
            amenities: data.amenities || [],
            latitude: data.latitude ?? null,
            longitude: data.longitude ?? null,
            openingTime: data.openingTime || '06:00',
            closingTime: data.closingTime || '23:00',
            operatingDays: data.operatingDays?.length ? data.operatingDays : [1, 2, 3, 4, 5, 6, 7],
            minGameDurationMinutes: data.minGameDurationMinutes ? String(data.minGameDurationMinutes) : '60',
            photoFiles: [],
            photoPreviews: [],
            existingPhotos: data.photos?.length ? data.photos : (data.photoUrl ? [data.photoUrl] : []),
          };
          const nextFields = loadedFields.length > 0 ? loadedFields : [createLocationFieldDraft(1)];
          setForm(loaded);
          setInitialForm(loaded);
          setFields(nextFields);
          setInitialFields(nextFields);
          setFetchError(null);
        }
      } catch (err) {
        if (!cancelled) {
          logger.error('Erro ao carregar local:', err);
          const message = tRef.current('feedback.location.loadWithRetryError');
          showErrorRef.current(message);
          setFetchError(message);
        }
      } finally {
        if (!cancelled) setFetchLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [isEdit, locationId]);

  useEffect(() => {
    if (fetchLoading) return;
    const sectionMap: Record<string, { current: HTMLDivElement | null }> = {
      '#basic-info': basicInfoRef,
      '#photos': photosRef,
      '#fields': fieldsRef,
    };
    const sectionRef = sectionMap[routeLocation.hash];
    if (!sectionRef?.current) return;

    const timer = window.setTimeout(() => {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [fetchLoading, routeLocation.hash]);

  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm) ||
    JSON.stringify(fields) !== JSON.stringify(initialFields);

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) e.name = t('locations.form.validation.nameRequired');
    else if (form.name.length < 3) e.name = t('locations.form.validation.nameMinLength');
    if (!form.address.trim()) e.address = t('locations.form.validation.addressRequired');
    if (!form.city.trim()) e.city = t('locations.form.validation.cityRequired');
    if (!form.state || form.state.trim().length < 2) {
      e.state = t('locations.form.validation.stateRequired');
    }
    const nextFieldErrors: Record<string, string> = {};
    const activeFields = fields.filter((field) => field.isActive);
    if (fields.length < 1 || activeFields.length < 1) {
      nextFieldErrors.form = t('locations.form.validation.fieldCountMin');
    }
    fields.forEach((field) => {
      if (!field.name.trim()) {
        nextFieldErrors[`${field.id}.name`] = 'Nome da quadra é obrigatório.';
      } else if (field.name.trim().length < 2) {
        nextFieldErrors[`${field.id}.name`] = 'Mínimo 2 caracteres.';
      }
      const hourlyPrice = parseHourlyPrice(field.hourlyPrice);
      if (Number.isNaN(hourlyPrice)) {
        nextFieldErrors[`${field.id}.hourlyPrice`] = 'Informe um preço válido ou deixe vazio.';
      }
      const playersPerTeam = parseOptionalPositiveInt(field.playersPerTeam);
      if (Number.isNaN(playersPerTeam) || (playersPerTeam !== null && (playersPerTeam < 3 || playersPerTeam > 11))) {
        nextFieldErrors[`${field.id}.playersPerTeam`] = 'Informe entre 3 e 11 jogadores por time ou deixe vazio.';
      }
      const minBookingMinutes = parseOptionalPositiveInt(field.minBookingMinutes);
      if (Number.isNaN(minBookingMinutes) ||
        (minBookingMinutes !== null && (minBookingMinutes < 30 || minBookingMinutes > 240 || minBookingMinutes % 30 !== 0))) {
        nextFieldErrors[`${field.id}.minBookingMinutes`] = 'Use 30, 60, 90, 120, 150, 180, 210 ou 240 minutos.';
      }
    });
    // #1339: telefone é opcional, mas se preenchido deve ter DDD + número
    // (10 dígitos fixo, 11 celular). Não força máscara (mudança de UX maior).
    const phoneDigits = form.phone.replace(/\D/g, '');
    if (phoneDigits && (phoneDigits.length < 10 || phoneDigits.length > 11)) {
      e.phone = t('locations.form.validation.phoneInvalid');
    }
    if (form.website && !/^https?:\/\/.+/.test(form.website)) {
      e.website = t('locations.form.validation.websiteInvalid');
    }
    const hasLatitude = form.latitude !== null;
    const hasLongitude = form.longitude !== null;
    if (hasLatitude !== hasLongitude) {
      const message = t('locations.form.validation.coordinatesPairRequired');
      if (!hasLatitude) e.latitude = message;
      if (!hasLongitude) e.longitude = message;
    }
    if (form.latitude !== null && (form.latitude < -90 || form.latitude > 90)) {
      e.latitude = t('locations.form.validation.latitudeRange');
    }
    if (form.longitude !== null && (form.longitude < -180 || form.longitude > 180)) {
      e.longitude = t('locations.form.validation.longitudeRange');
    }
    if (!/^\d{2}:\d{2}$/.test(form.openingTime)) {
      e.openingTime = 'Informe um horário de abertura válido.';
    }
    if (!/^\d{2}:\d{2}$/.test(form.closingTime)) {
      e.closingTime = 'Informe um horário de fechamento válido.';
    }
    if (form.openingTime && form.closingTime && form.openingTime === form.closingTime) {
      e.closingTime = 'Abertura e fechamento não podem ser iguais.';
    }
    if (form.operatingDays.length === 0) {
      e.operatingDays = 'Selecione pelo menos um dia de funcionamento.';
    }
    const minGameDuration = parseOptionalPositiveInt(form.minGameDurationMinutes);
    if (Number.isNaN(minGameDuration) ||
      minGameDuration === null ||
      minGameDuration < 30 ||
      minGameDuration > 240 ||
      minGameDuration % 30 !== 0) {
      e.minGameDurationMinutes = 'Use 30, 60, 90, 120, 150, 180, 210 ou 240 minutos.';
    }
    setErrors(e);
    setFieldErrors(nextFieldErrors);
    return Object.keys(e).length === 0 && Object.keys(nextFieldErrors).length === 0;
  };

  const captureGeolocation = () => {
    if (!navigator.geolocation) {
      showError(t('feedback.location.geolocationUnsupported'));
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((prev) => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }));
        showSuccess(t('feedback.location.coordinatesSuccess'));
        setGeoLoading(false);
      },
      (err) => {
        logger.error('Erro ao capturar geolocalização:', err);
        showError(t('feedback.location.captureError'));
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleChange = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleAmenityToggle = (amenity: string) => {
    setForm((prev) => {
      const amenities = prev.amenities.includes(amenity)
        ? prev.amenities.filter((item) => item !== amenity)
        : [...prev.amenities, amenity];
      return {
        ...prev,
        amenities,
        hasParking: amenities.includes('parking'),
        hasShowers: amenities.includes('shower') || amenities.includes('locker_room'),
        hasLighting: amenities.includes('lighting'),
      };
    });
  };

  const handleOperatingDayToggle = (day: number) => {
    setForm((prev) => {
      const operatingDays = prev.operatingDays.includes(day)
        ? prev.operatingDays.filter((item) => item !== day)
        : [...prev.operatingDays, day].sort((a, b) => a - b);
      return { ...prev, operatingDays };
    });
    if (errors.operatingDays) setErrors((prev) => ({ ...prev, operatingDays: undefined }));
  };

  const handleLocationPhotos = (files: FileList | null) => {
    if (!files?.length) return;
    const accepted = Array.from(files).filter((file) => {
      if (!file.type.startsWith('image/')) {
        showError(t('feedback.location.onlyImages'));
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        showError(t('feedback.location.imageTooLarge'));
        return false;
      }
      return true;
    });
    if (accepted.length === 0) return;
    setForm((prev) => ({
      ...prev,
      photoFiles: [...prev.photoFiles, ...accepted],
      photoPreviews: [
        ...prev.photoPreviews,
        ...accepted.map((file) => URL.createObjectURL(file)),
      ],
    }));
  };

  const uploadFiles = async (basePath: string, files: File[]) => {
    const urls: string[] = [];
    for (const [index, file] of files.entries()) {
      const ref = storageRef(storage, `${basePath}/${buildSafeStorageFileName(file, index)}`);
      await uploadBytes(ref, file, { contentType: file.type });
      urls.push(await getDownloadURL(ref));
    }
    return urls;
  };

  const handleSubmit = async () => {
    if (!validate() || !user) return;
    setLoading(true);
    try {
      const batch = writeBatch(db);
      const locationRef = isEdit && locationId
        ? doc(db, 'locations', locationId)
        : doc(collection(db, 'locations'));
      const locationDocId = locationRef.id;
      const uploadedLocationPhotos = await uploadFiles(
        `locations/${locationDocId}/photos`,
        form.photoFiles,
      );
      const locationPhotos = [...form.existingPhotos, ...uploadedLocationPhotos];
      const fieldSummary = summarizeLocationFields(fields);
      const amenities = Array.from(new Set([
        ...form.amenities,
        ...(form.hasParking ? ['parking'] : []),
        ...(form.hasShowers ? ['shower', 'locker_room'] : []),
        ...(form.hasLighting ? ['lighting'] : []),
      ]));
      const composedAddress = form.address.trim() ||
        [form.street.trim(), form.number.trim()].filter(Boolean).join(', ');

      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        address: composedAddress,
        cep: form.cep.replace(/\D/g, ''),
        street: form.street.trim(),
        number: form.number.trim(),
        complement: form.complement.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        district: form.district.trim(),
        neighborhood: form.district.trim(),
        region: form.region.trim() || form.state.trim(),
        phone: form.phone.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        instagram: form.instagram.trim() || null,
        website: form.website.trim() || null,
        field_type: fieldSummary.primaryFieldType,
        primary_field_type: fieldSummary.primaryFieldType,
        field_count: fieldSummary.fieldCount,
        players_per_team: fieldSummary.playersPerTeam,
        has_active_fields: fieldSummary.hasActiveFields,
        description: form.description.trim(),
        has_lighting: form.hasLighting,
        has_parking: form.hasParking,
        has_showers: form.hasShowers,
        amenities,
        photos: locationPhotos,
        photo_url: locationPhotos[0] || null,
        latitude: form.latitude,
        longitude: form.longitude,
        operating_days: form.operatingDays,
        opening_time: form.openingTime,
        closing_time: form.closingTime,
        min_game_duration_minutes: parseOptionalPositiveInt(form.minGameDurationMinutes),
        updated_at: serverTimestamp(),
        updated_by: user.id,
      };

      if (isEdit && locationId) {
        batch.update(locationRef, payload);
        for (const field of fields) {
          const fieldRef = field.persistedId
            ? doc(db, 'locations', locationDocId, 'fields', field.persistedId)
            : doc(collection(db, 'locations', locationDocId, 'fields'));
          const uploadedFieldPhotos = await uploadFiles(
            `locations/${locationDocId}/fields/${fieldRef.id}/photos`,
            field.photoFiles,
          );
          const fieldPhotos = [...field.existingPhotos, ...uploadedFieldPhotos];
          const fieldAmenities = Array.from(new Set([
            ...field.amenities,
            ...(field.isCovered ? ['covered'] : []),
          ]));
          const fieldPayload = {
            name: field.name.trim(),
            location_id: locationDocId,
            type: field.type,
            is_active: field.isActive,
            hourly_price: parseHourlyPrice(field.hourlyPrice),
            price_per_hour: parseHourlyPrice(field.hourlyPrice),
            players_per_team: parseOptionalPositiveInt(field.playersPerTeam),
            min_booking_minutes: parseOptionalPositiveInt(field.minBookingMinutes),
            surface: field.surface.trim() || null,
            dimensions: field.dimensions.trim() || null,
            rules: field.rules.trim() || null,
            is_covered: field.isCovered,
            amenities: fieldAmenities,
            photos: fieldPhotos,
            photo_url: fieldPhotos[0] || null,
            managers: [user.id],
            updated_at: serverTimestamp(),
          };
          if (field.persistedId) {
            batch.update(fieldRef, fieldPayload);
          } else {
            batch.set(fieldRef, {
              ...fieldPayload,
              created_at: serverTimestamp(),
            });
          }
        }
        await batch.commit();
        showSuccess(t('feedback.location.updateSuccess'));
        navigate(`/location/${locationId}`);
      } else {
        batch.set(locationRef, {
          ...payload,
          owner_id: user.id,
          managers: [user.id],
          is_verified: false,
          is_active: true,
          rating: 0,
          rating_count: 0,
          publication_status: 'PENDING_REVIEW',
          commercial_status: 'TRIAL',
          subscription_status: 'TRIAL',
          monthly_fee_cents: null,
          billing_due_day: null,
          billing_starts_at: null,
          billing_expires_at: null,
          published_at: null,
          published_by: null,
          unpublished_reason: null,
          owner_notes: null,
          admin_notes: null,
          country: 'BR',
          created_at: serverTimestamp(),
        });

        for (const field of fields) {
          const fieldRef = doc(collection(db, 'locations', locationDocId, 'fields'));
          const uploadedFieldPhotos = await uploadFiles(
            `locations/${locationDocId}/fields/${fieldRef.id}/photos`,
            field.photoFiles,
          );
          const fieldPhotos = [...field.existingPhotos, ...uploadedFieldPhotos];
          const fieldAmenities = Array.from(new Set([
            ...field.amenities,
            ...(field.isCovered ? ['covered'] : []),
          ]));
          batch.set(fieldRef, {
            name: field.name.trim(),
            location_id: locationDocId,
            type: field.type,
            is_active: field.isActive,
            hourly_price: parseHourlyPrice(field.hourlyPrice),
            price_per_hour: parseHourlyPrice(field.hourlyPrice),
            players_per_team: parseOptionalPositiveInt(field.playersPerTeam),
            min_booking_minutes: parseOptionalPositiveInt(field.minBookingMinutes),
            surface: field.surface.trim() || null,
            dimensions: field.dimensions.trim() || null,
            rules: field.rules.trim() || null,
            is_covered: field.isCovered,
            amenities: fieldAmenities,
            photos: fieldPhotos,
            photo_url: fieldPhotos[0] || null,
            managers: [user.id],
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
          });
        }

        await batch.commit();
        showSuccess(t('feedback.location.createSuccess'));
        navigate(`/location/${locationDocId}`);
      }
    } catch (err) {
      logger.error('Erro ao salvar local:', err);
      if (err instanceof FirebaseError && err.code === 'permission-denied') {
        syncFieldOwnerClaim().catch(() => {});
        showError(t('feedback.location.noPermissionFields'));
        return;
      }
      showError(t('feedback.location.saveError'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate(closeDestination);
  };

  const closeDestination = isEdit && locationId ? `/location/${locationId}` : '/locations';

  if (fetchLoading) {
    return (
      <AdaptiveFormSheet closeDestination={closeDestination}>
        <FormScaffold title={isEdit ? t('locations.form.editTitle') : t('locations.form.createTitle')} closeDestination={closeDestination} closeVariant="X">
          <PageContainer maxWidth="form" sx={{ textAlign: 'center' }}>
            <CircularProgress />
          </PageContainer>
        </FormScaffold>
      </AdaptiveFormSheet>
    );
  }

  if (fetchError) {
    return (
      <AdaptiveFormSheet closeDestination={closeDestination}>
        <FormScaffold title={t('locations.form.editTitle')} closeDestination={closeDestination} closeVariant="X">
          <PageContainer maxWidth="form" sx={{}}>
            <Alert severity="error" sx={{ mb: 2 }} role="alert" aria-live="assertive">{fetchError}</Alert>
            <Button variant="outlined" fullWidth onClick={() => navigate('/locations')}>
              {t('locations.form.backToLocations')}
            </Button>
          </PageContainer>
        </FormScaffold>
      </AdaptiveFormSheet>
    );
  }

  return (
    <AdaptiveFormSheet closeDestination={closeDestination} isDirty={isDirty}>
      <FormScaffold
        title={isEdit ? t('locations.form.editTitle') : t('locations.form.createTitle')}
        closeDestination={closeDestination}
        closeVariant="X"
        isDirty={isDirty}
        loading={loading}
        footer={
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, width: '100%' }}>
            <Button variant="outlined" onClick={handleCancel} disabled={loading} fullWidth>
              {t('common.cancel')}
            </Button>
            <Button variant="contained" onClick={handleSubmit} disabled={loading} fullWidth startIcon={loading ? <CircularProgress size={20} /> : null}>
              {isEdit ? t('common.save') : t('locations.form.createTitle')}
            </Button>
          </Box>
        }
      >
        <PageContainer maxWidth="form" disablePadding>
          <Stack spacing={2}>
            <Card ref={basicInfoRef} id="location-form-basic-info">
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                  {t('locations.form.basicInfo')}
                </Typography>
                <Stack spacing={2}>
                  <TextField
                    label={t('locations.form.nameLabel')}
                    fullWidth
                    required
                    value={form.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    error={!!errors.name}
                    helperText={errors.name}
                    inputProps={{ maxLength: 100 }}
                  />
                  <TextField
                    label={t('locations.form.addressLabel')}
                    fullWidth
                    required
                    value={form.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    error={!!errors.address}
                    helperText={errors.address}
                    inputProps={{ maxLength: 500 }}
                  />
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                      label="CEP"
                      value={form.cep}
                      onChange={(e) => handleChange('cep', e.target.value.replace(/\D/g, '').slice(0, 8))}
                      fullWidth
                      placeholder="00000-000"
                      inputProps={{ inputMode: 'numeric', maxLength: 8 }}
                    />
                    <TextField
                      label="Número"
                      value={form.number}
                      onChange={(e) => handleChange('number', e.target.value)}
                      sx={{ minWidth: { sm: 140 } }}
                      placeholder="123"
                      inputProps={{ maxLength: 20 }}
                    />
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                      label="Rua"
                      fullWidth
                      value={form.street}
                      onChange={(e) => handleChange('street', e.target.value)}
                      placeholder="Rua, avenida ou alameda"
                      inputProps={{ maxLength: 200 }}
                    />
                    <TextField
                      label="Complemento"
                      fullWidth
                      value={form.complement}
                      onChange={(e) => handleChange('complement', e.target.value)}
                      placeholder="Bloco, portão, referência"
                      inputProps={{ maxLength: 100 }}
                    />
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                      label={t('locations.form.cityLabel')}
                      fullWidth
                      required
                      value={form.city}
                      onChange={(e) => handleChange('city', e.target.value)}
                      error={!!errors.city}
                      helperText={errors.city}
                      inputProps={{ maxLength: 100 }}
                    />
                    <TextField
                      label={t('locations.form.stateLabel')}
                      sx={{ minWidth: { sm: 120 } }}
                      inputProps={{ maxLength: 2 }}
                      value={form.state}
                      onChange={(e) => handleChange('state', e.target.value.toUpperCase())}
                      error={!!errors.state}
                      helperText={errors.state}
                    />
                  </Stack>
                  <TextField
                    label={t('locations.form.districtLabel')}
                    fullWidth
                    value={form.district}
                    onChange={(e) => handleChange('district', e.target.value)}
                    inputProps={{ maxLength: 100 }}
                  />
                  <TextField
                    label="Região"
                    fullWidth
                    value={form.region}
                    onChange={(e) => handleChange('region', e.target.value)}
                    helperText="Use para zona, região comercial ou referência local."
                    placeholder="Ex.: Zona Sul"
                    inputProps={{ maxLength: 100 }}
                  />
                  <Box>
                    <Button
                      variant="outlined"
                      startIcon={geoLoading ? <CircularProgress size={16} /> : <GeoIcon />}
                      onClick={captureGeolocation}
                      disabled={geoLoading}
                      fullWidth
                    >
                      {form.latitude !== null && form.longitude !== null
                        ? t('locations.form.coordinatesValue', {
                            latitude: form.latitude.toFixed(6),
                            longitude: form.longitude.toFixed(6),
                          })
                        : t('locations.form.captureCoordinates')}
                    </Button>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                      Funcionamento
                    </Typography>
                    <Stack spacing={1.5}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                        <TextField
                          label="Abre às"
                          type="time"
                          value={form.openingTime}
                          onChange={(e) => handleChange('openingTime', e.target.value)}
                          error={!!errors.openingTime}
                          helperText={errors.openingTime || 'Horário em que a primeira reserva pode começar.'}
                          fullWidth
                          InputLabelProps={{ shrink: true }}
                        />
                        <TextField
                          label="Fecha às"
                          type="time"
                          value={form.closingTime}
                          onChange={(e) => handleChange('closingTime', e.target.value)}
                          error={!!errors.closingTime}
                          helperText={errors.closingTime || 'Pode passar da meia-noite, ex.: 02:00.'}
                          fullWidth
                          InputLabelProps={{ shrink: true }}
                        />
                        <TextField
                          label="Duração mínima do jogo (min)"
                          value={form.minGameDurationMinutes}
                          onChange={(e) => handleChange('minGameDurationMinutes', e.target.value.replace(/\D/g, '').slice(0, 3))}
                          error={!!errors.minGameDurationMinutes}
                          helperText={errors.minGameDurationMinutes || 'Use múltiplos de 30, como 60 ou 90.'}
                          inputProps={{ inputMode: 'numeric' }}
                          fullWidth
                        />
                      </Stack>
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>
                          Dias disponíveis para reserva
                        </Typography>
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                          {OPERATING_DAY_OPTIONS.map((day) => (
                            <FormControlLabel
                              key={day.value}
                              control={
                                <Checkbox
                                  checked={form.operatingDays.includes(day.value)}
                                  onChange={() => handleOperatingDayToggle(day.value)}
                                  sx={{ p: 1.25 }}
                                />
                              }
                              label={day.label}
                              sx={{
                                border: `1px solid ${form.operatingDays.includes(day.value) ? 'currentColor' : 'transparent'}`,
                                borderRadius: 999,
                                minHeight: 44,
                                px: 1,
                                mr: 0,
                              }}
                            />
                          ))}
                        </Stack>
                        {errors.operatingDays && (
                          <Typography variant="caption" color="error" role="alert">
                            {errors.operatingDays}
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                  </Box>
                  <Box ref={photosRef} id="location-form-photos">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      hidden
                      id="location-photo-input"
                      onChange={(e) => handleLocationPhotos(e.target.files)}
                    />
                    <Button
                      variant="outlined"
                      component="label"
                      htmlFor="location-photo-input"
                      fullWidth
                      sx={{ minHeight: { xs: 44, sm: 40 } }}
                    >
                      {form.existingPhotos.length || form.photoPreviews.length
                        ? t('locations.form.changePhoto')
                        : t('locations.form.addPhoto')}
                    </Button>
                    {(form.existingPhotos.length > 0 || form.photoPreviews.length > 0) && (
                      <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', mt: 1, pb: 0.5, pr: 1 }}>
                        {[...form.existingPhotos, ...form.photoPreviews].map((photo, index) => (
                          <Box
                            key={`${photo}-${index}`}
                            component="img"
                            src={photo}
                            alt={t('alt.preview')}
                            sx={{ width: 120, height: 88, objectFit: 'cover', borderRadius: 1, flex: '0 0 auto' }}
                          />
                        ))}
                      </Stack>
                    )}
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Card ref={fieldsRef} id="location-form-fields">
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                  {t('locations.form.fieldsSection')}
                </Typography>
                {fieldErrors.form && <Alert severity="warning" sx={{ mb: 2 }}>{fieldErrors.form}</Alert>}
                <LocationFieldsEditor
                  fields={fields}
                  onChange={(nextFields) => {
                    setFields(nextFields);
                    setFieldErrors({});
                  }}
                  disabled={loading}
                  errors={fieldErrors}
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                  {t('locations.form.amenitiesSection')}
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {COMMERCIAL_AMENITIES.map((amenity) => (
                    <Chip
                      key={amenity}
                      label={AMENITY_LABELS[amenity] || amenity}
                      color={form.amenities.includes(amenity) ? 'primary' : 'default'}
                      variant={form.amenities.includes(amenity) ? 'filled' : 'outlined'}
                      onClick={() => handleAmenityToggle(amenity)}
                      sx={{ mb: 1, minHeight: { xs: 44, sm: 32 }, px: { xs: 0.5, sm: 0 } }}
                    />
                  ))}
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                  {t('locations.form.contactSection')}
                </Typography>
                <Stack spacing={2}>
                  <TextField
                    label={t('locations.form.phoneLabel')}
                    fullWidth
                    value={form.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    error={!!errors.phone}
                    helperText={errors.phone}
                    placeholder="(00) 00000-0000"
                    inputProps={{ maxLength: 20 }}
                  />
                  <TextField
                    label="WhatsApp"
                    fullWidth
                    value={form.whatsapp}
                    onChange={(e) => handleChange('whatsapp', e.target.value)}
                    placeholder="(00) 00000-0000"
                    inputProps={{ maxLength: 20 }}
                  />
                  <TextField
                    label="Instagram"
                    fullWidth
                    value={form.instagram}
                    onChange={(e) => handleChange('instagram', e.target.value)}
                    placeholder="@arena"
                    inputProps={{ maxLength: 80 }}
                  />
                  <TextField
                    label={t('locations.form.websiteLabel')}
                    fullWidth
                    value={form.website}
                    onChange={(e) => handleChange('website', e.target.value)}
                    placeholder={t('placeholder.enterUrl')}
                    type="url"
                    error={!!errors.website}
                    helperText={errors.website}
                    inputProps={{ maxLength: 2048 }}
                  />
                  <TextField
                    label={t('locations.form.descriptionLabel')}
                    fullWidth
                    multiline
                    rows={3}
                    value={form.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    inputProps={{ maxLength: 500 }}
                    helperText={`${form.description.length}/500`}
                  />
                </Stack>
              </CardContent>
            </Card>

          </Stack>
        </PageContainer>
      </FormScaffold>
    </AdaptiveFormSheet>
  );
};
