import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  TextField,
  Button,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  FormControlLabel,
  Switch,
  MenuItem,
  Stack,
} from '@mui/material';
import PageContainer from '../../components/common/PageContainer';
import { MyLocation as GeoIcon } from '@mui/icons-material';
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { FirebaseError } from 'firebase/app';
import { db } from '../../services/firebase';
import { storage } from '../../services/firebaseStorage';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Location, FieldType, FIELD_TYPE_CONFIG } from '../../types/location';
import { FormScaffold, AdaptiveFormSheet } from '../../components/layout';
import { createLogger } from '../../utils/logger';
import { syncFieldOwnerClaim } from '../../services/cloudFunctions';
import { useTranslation } from 'react-i18next';

const logger = createLogger('LocationFormScreen');

interface FormState {
  name: string;
  address: string;
  city: string;
  state: string;
  district: string;
  phone: string;
  website: string;
  fieldType: FieldType;
  playersPerTeam: number;
  fieldCount: number;
  hourlyPrice: number;
  description: string;
  hasLighting: boolean;
  hasParking: boolean;
  hasShowers: boolean;
  latitude: number | null;
  longitude: number | null;
  photoFile: File | null;
  photoPreview: string | null;
}

const defaultForm: FormState = {
  name: '',
  address: '',
  city: '',
  state: '',
  district: '',
  phone: '',
  website: '',
  fieldType: 'SOCIETY',
  playersPerTeam: 7,
  fieldCount: 1,
  hourlyPrice: 0,
  description: '',
  hasLighting: false,
  hasParking: false,
  hasShowers: false,
  latitude: null,
  longitude: null,
  photoFile: null,
  photoPreview: null,
};

export const LocationFormScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
  const [geoLoading, setGeoLoading] = useState(false);

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
        if (!cancelled) {
          // #1339: um único literal nomeado alimenta form E baseline, para
          // não divergirem se FormState crescer.
          const loaded: FormState = {
            name: data.name || '',
            address: data.address || '',
            city: data.city || '',
            state: data.state || '',
            district: data.district || '',
            phone: data.phone || '',
            website: data.website || '',
            fieldType: data.fieldType || 'SOCIETY',
            playersPerTeam: data.playersPerTeam || 7,
            fieldCount: data.fieldCount || 1,
            hourlyPrice: 0,
            description: data.description || '',
            hasLighting: !!data.hasLighting,
            hasParking: !!data.hasParking,
            hasShowers: !!data.hasShowers,
            latitude: data.latitude ?? null,
            longitude: data.longitude ?? null,
            photoFile: null,
            photoPreview: data.photoUrl || null,
          };
          setForm(loaded);
          setInitialForm(loaded);
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

  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) e.name = t('locations.form.validation.nameRequired');
    else if (form.name.length < 3) e.name = t('locations.form.validation.nameMinLength');
    if (!form.address.trim()) e.address = t('locations.form.validation.addressRequired');
    if (!form.city.trim()) e.city = t('locations.form.validation.cityRequired');
    if (!form.state || form.state.trim().length < 2) {
      e.state = t('locations.form.validation.stateRequired');
    }
    if (form.fieldCount < 1) e.fieldCount = t('locations.form.validation.fieldCountMin');
    if (form.playersPerTeam < 3 || form.playersPerTeam > 11) {
      e.playersPerTeam = t('locations.form.validation.playersPerTeamRange');
    }
    // #1339: telefone é opcional, mas se preenchido deve ter DDD + número
    // (10 dígitos fixo, 11 celular). Não força máscara (mudança de UX maior).
    const phoneDigits = form.phone.replace(/\D/g, '');
    if (phoneDigits && (phoneDigits.length < 10 || phoneDigits.length > 11)) {
      e.phone = t('locations.form.validation.phoneInvalid');
    }
    if (form.website && !/^https?:\/\/.+/.test(form.website)) {
      e.website = t('locations.form.validation.websiteInvalid');
    }
    if (form.latitude !== null && (form.latitude < -90 || form.latitude > 90)) {
      e.latitude = t('locations.form.validation.latitudeRange');
    }
    if (form.longitude !== null && (form.longitude < -180 || form.longitude > 180)) {
      e.longitude = t('locations.form.validation.longitudeRange');
    }
    setErrors(e);
    return Object.keys(e).length === 0;
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

  const handleSubmit = async () => {
    if (!validate() || !user) return;
    setLoading(true);
    try {
      let photoUrl: string | null = null;
      if (form.photoFile) {
        const ref = storageRef(storage, `locations/${isEdit ? locationId : crypto.randomUUID()}/photo.jpg`);
        await uploadBytes(ref, form.photoFile, { contentType: form.photoFile.type });
        photoUrl = await getDownloadURL(ref);
      }

      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        district: form.district.trim(),
        phone: form.phone.trim() || null,
        website: form.website.trim() || null,
        field_type: form.fieldType,
        primary_field_type: form.fieldType,
        players_per_team: form.playersPerTeam,
        field_count: form.fieldCount,
        description: form.description.trim(),
        has_lighting: form.hasLighting,
        has_parking: form.hasParking,
        has_showers: form.hasShowers,
        latitude: form.latitude,
        longitude: form.longitude,
        is_active: true,
        updated_at: serverTimestamp(),
        updated_by: user.id,
      };

      if (photoUrl) payload.photo_url = photoUrl;

      if (isEdit && locationId) {
        await updateDoc(doc(db, 'locations', locationId), payload);
        showSuccess(t('feedback.location.updateSuccess'));
        navigate(`/location/${locationId}`);
      } else {
        const batch = writeBatch(db);
        const newRef = doc(collection(db, 'locations'));

        batch.set(newRef, {
          ...payload,
          owner_id: user.id,
          managers: [user.id],
          is_verified: false,
          rating: 0,
          rating_count: 0,
          amenities: [],
          operating_days: [1, 2, 3, 4, 5, 6, 7],
          opening_time: '06:00',
          closing_time: '23:00',
          min_game_duration_minutes: 60,
          has_active_fields: form.fieldCount > 0,
          country: 'BR',
          neighborhood: form.district.trim(),
          region: form.state.trim(),
          cep: '',
          street: '',
          number: '',
          complement: '',
          created_at: serverTimestamp(),
        });

        for (let i = 1; i <= form.fieldCount; i++) {
          const fieldRef = doc(collection(db, 'locations', newRef.id, 'fields'));
          batch.set(fieldRef, {
            name: form.fieldCount === 1
              ? t('locations.form.defaultPrimaryFieldName')
              : t('locations.form.defaultFieldName', { index: i }),
            location_id: newRef.id,
            type: form.fieldType,
            is_active: true,
            hourly_price: form.hourlyPrice || 0,
            amenities: [],
            photos: [],
            managers: [user.id],
            created_at: serverTimestamp(),
          });
        }

        await batch.commit();
        showSuccess(t('feedback.location.createSuccess'));
        navigate(`/location/${newRef.id}`);
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
          <Box sx={{ display: 'flex', gap: 2, width: '100%' }}>
            <Button variant="outlined" onClick={handleCancel} disabled={loading} fullWidth>
              {t('common.cancel')}
            </Button>
            <Button variant="contained" onClick={handleSubmit} disabled={loading} fullWidth startIcon={loading ? <CircularProgress size={20} /> : null}>
              {isEdit ? t('common.save') : t('locations.form.createTitle')}
            </Button>
          </Box>
        }
      >
        <PageContainer maxWidth="form" disablePadding >
          <Stack spacing={2}>
            <Card>
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
                  <Box>
                    <Button
                      variant="outlined"
                      startIcon={geoLoading ? <CircularProgress size={16} /> : <GeoIcon />}
                      onClick={captureGeolocation}
                      disabled={geoLoading}
                      fullWidth
                    >
                      {form.latitude && form.longitude
                        ? t('locations.form.coordinatesValue', {
                            latitude: form.latitude.toFixed(6),
                            longitude: form.longitude.toFixed(6),
                          })
                        : t('locations.form.captureCoordinates')}
                    </Button>
                  </Box>
                  <Box>
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      id="location-photo-input"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (!file.type.startsWith('image/')) { showError(t('feedback.location.onlyImages')); return; }
                        if (file.size > 5 * 1024 * 1024) { showError(t('feedback.location.imageTooLarge')); return; }
                        const url = URL.createObjectURL(file);
                        setForm((prev) => ({ ...prev, photoFile: file, photoPreview: url }));
                      }}
                    />
                    <Button
                      variant="outlined"
                      component="label"
                      htmlFor="location-photo-input"
                      fullWidth
                    >
                      {form.photoPreview ? t('locations.form.changePhoto') : t('locations.form.addPhoto')}
                    </Button>
                    {form.photoPreview && (
                      <Box
                        component="img"
                        src={form.photoPreview}
                        alt={t('alt.preview')}
                        sx={{ mt: 1, width: '100%', height: 120, objectFit: 'cover', borderRadius: 1 }}
                      />
                    )}
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                  {t('locations.form.fieldsSection')}
                </Typography>
                <Stack spacing={2}>
                  <TextField
                    label={t('locations.form.fieldTypeLabel')}
                    select
                    fullWidth
                    value={form.fieldType}
                    onChange={(e) => handleChange('fieldType', e.target.value as FieldType)}
                  >
                    {(Object.keys(FIELD_TYPE_CONFIG) as FieldType[]).map((type) => (
                      <MenuItem key={type} value={type}>
                        {FIELD_TYPE_CONFIG[type].label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                      label={t('locations.form.playersPerTeamLabel')}
                      type="number"
                      fullWidth
                      value={form.playersPerTeam}
                      onChange={(e) => handleChange('playersPerTeam', parseInt(e.target.value) || 0)}
                      error={!!errors.playersPerTeam}
                      helperText={errors.playersPerTeam}
                      inputProps={{ min: 3, max: 11 }}
                    />
                    <TextField
                      label={t('locations.form.fieldCountLabel')}
                      type="number"
                      fullWidth
                      value={form.fieldCount}
                      onChange={(e) => handleChange('fieldCount', parseInt(e.target.value) || 0)}
                      error={!!errors.fieldCount}
                      helperText={errors.fieldCount}
                      inputProps={{ min: 1, max: 20 }}
                    />
                  </Stack>
                  <TextField
                    label={t('locations.form.hourlyPriceLabel')}
                    type="number"
                    fullWidth
                    value={form.hourlyPrice}
                    onChange={(e) => handleChange('hourlyPrice', parseFloat(e.target.value) || 0)}
                    error={!!errors.hourlyPrice}
                    helperText={errors.hourlyPrice || t('locations.form.hourlyPriceHelper')}
                    inputProps={{ min: 0, step: 10 }}
                  />
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                  {t('locations.form.amenitiesSection')}
                </Typography>
                <Stack>
                  <FormControlLabel
                    control={<Switch checked={form.hasLighting} onChange={(e) => handleChange('hasLighting', e.target.checked)} />}
                    label={t('locations.form.lightingLabel')}
                  />
                  <FormControlLabel
                    control={<Switch checked={form.hasParking} onChange={(e) => handleChange('hasParking', e.target.checked)} />}
                    label={t('locations.form.parkingLabel')}
                  />
                  <FormControlLabel
                    control={<Switch checked={form.hasShowers} onChange={(e) => handleChange('hasShowers', e.target.checked)} />}
                    label={t('locations.form.showersLabel')}
                  />
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
