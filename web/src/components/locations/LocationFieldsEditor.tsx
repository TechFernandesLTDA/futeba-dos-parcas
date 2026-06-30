import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
  FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  DeleteOutline as DeleteIcon,
  PhotoCamera as PhotoIcon,
} from '@mui/icons-material';
import {
  AMENITY_LABELS,
  COMMERCIAL_AMENITIES,
  FIELD_TYPE_CONFIG,
  FieldType,
} from '../../types/location';
import { LocationFieldDraft, createLocationFieldDraft } from '../../utils/locationFields';

interface LocationFieldsEditorProps {
  fields: LocationFieldDraft[];
  onChange: (fields: LocationFieldDraft[]) => void;
  disabled?: boolean;
  errors?: Record<string, string>;
}

export function LocationFieldsEditor({
  fields,
  onChange,
  disabled = false,
  errors = {},
}: LocationFieldsEditorProps) {
  const updateField = <K extends keyof LocationFieldDraft>(
    id: string,
    key: K,
    value: LocationFieldDraft[K],
  ) => {
    onChange(fields.map((field) => field.id === id ? { ...field, [key]: value } : field));
  };

  const updateFieldPatch = (id: string, patch: Partial<LocationFieldDraft>) => {
    onChange(fields.map((field) => field.id === id ? { ...field, ...patch } : field));
  };

  const addField = () => {
    onChange([...fields, createLocationFieldDraft(fields.length + 1)]);
  };

  const toggleFieldAmenity = (field: LocationFieldDraft, amenity: string) => {
    const nextAmenities = field.amenities.includes(amenity)
      ? field.amenities.filter((item) => item !== amenity)
      : [...field.amenities, amenity];
    updateFieldPatch(field.id, {
      amenities: nextAmenities,
      ...(amenity === 'covered' ? { isCovered: nextAmenities.includes('covered') } : {}),
    });
  };

  const removeField = (field: LocationFieldDraft) => {
    if (field.persistedId) {
      updateField(field.id, 'isActive', false);
      return;
    }
    onChange(fields.filter((item) => item.id !== field.id));
  };

  const handlePhotoFiles = (field: LocationFieldDraft, files: FileList | null) => {
    if (!files?.length) return;
    const accepted = Array.from(files).filter((file) =>
      file.type.startsWith('image/') && file.size <= 5 * 1024 * 1024,
    );
    if (accepted.length === 0) return;
    onChange(fields.map((item) => item.id === field.id ? {
      ...item,
      photoFiles: [...item.photoFiles, ...accepted],
      photoPreviews: [
        ...item.photoPreviews,
        ...accepted.map((file) => URL.createObjectURL(file)),
      ],
    } : item));
  };

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="body2" color="text.secondary">
          Cadastre cada quadra separadamente. Isso alimenta filtros por tipo, preço e disponibilidade.
        </Typography>
      </Box>

      {fields.map((field, index) => (
        <Card
          key={field.id}
          variant="outlined"
          sx={{
            opacity: field.isActive ? 1 : 0.62,
            borderStyle: field.isActive ? 'solid' : 'dashed',
          }}
        >
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
                  Quadra {index + 1}
                </Typography>
                {!field.isActive && <Chip size="small" label="Inativa" color="warning" />}
                <IconButton
                  aria-label={`Remover ${field.name || `quadra ${index + 1}`}`}
                  onClick={() => removeField(field)}
                  disabled={disabled || fields.length === 1}
                  color="error"
                >
                  <DeleteIcon />
                </IconButton>
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Nome da quadra"
                  value={field.name}
                  onChange={(event) => updateField(field.id, 'name', event.target.value)}
                  fullWidth
                  required
                  error={Boolean(errors[`${field.id}.name`])}
                  helperText={errors[`${field.id}.name`]}
                  inputProps={{ maxLength: 100 }}
                  disabled={disabled}
                />
                <TextField
                  label="Tipo"
                  select
                  value={field.type}
                  onChange={(event) => updateField(field.id, 'type', event.target.value as FieldType)}
                  fullWidth
                  disabled={disabled}
                >
                  {(Object.keys(FIELD_TYPE_CONFIG) as FieldType[]).map((type) => (
                    <MenuItem key={type} value={type}>
                      {FIELD_TYPE_CONFIG[type].label}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Preço por hora (R$)"
                  value={field.hourlyPrice}
                  onChange={(event) => updateField(field.id, 'hourlyPrice', event.target.value)}
                  fullWidth
                  error={Boolean(errors[`${field.id}.hourlyPrice`])}
                  helperText={errors[`${field.id}.hourlyPrice`] || 'Pode ficar vazio se ainda não houver preço definido.'}
                  inputProps={{ inputMode: 'decimal' }}
                  disabled={disabled}
                />
                <TextField
                  label="Jogadores por time"
                  value={field.playersPerTeam}
                  onChange={(event) => updateField(
                    field.id,
                    'playersPerTeam',
                    event.target.value.replace(/\D/g, '').slice(0, 2),
                  )}
                  fullWidth
                  error={Boolean(errors[`${field.id}.playersPerTeam`])}
                  helperText={errors[`${field.id}.playersPerTeam`] || 'Ex.: 5 para futsal, 7 para society.'}
                  inputProps={{ inputMode: 'numeric' }}
                  disabled={disabled}
                />
                <TextField
                  label="Duração mínima (min)"
                  value={field.minBookingMinutes}
                  onChange={(event) => updateField(
                    field.id,
                    'minBookingMinutes',
                    event.target.value.replace(/\D/g, '').slice(0, 3),
                  )}
                  fullWidth
                  error={Boolean(errors[`${field.id}.minBookingMinutes`])}
                  helperText={errors[`${field.id}.minBookingMinutes`] || 'Use múltiplos de 30, como 60 ou 90.'}
                  inputProps={{ inputMode: 'numeric' }}
                  disabled={disabled}
                />
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Superfície"
                  value={field.surface}
                  onChange={(event) => updateField(field.id, 'surface', event.target.value)}
                  fullWidth
                  placeholder="Grama sintética, piso, areia..."
                  inputProps={{ maxLength: 80 }}
                  disabled={disabled}
                />
                <TextField
                  label="Dimensões"
                  value={field.dimensions}
                  onChange={(event) => updateField(field.id, 'dimensions', event.target.value)}
                  fullWidth
                  placeholder="Ex.: 40m x 20m"
                  inputProps={{ maxLength: 60 }}
                  disabled={disabled}
                />
              </Stack>

              <TextField
                label="Regras e observações da quadra"
                value={field.rules}
                onChange={(event) => updateField(field.id, 'rules', event.target.value)}
                fullWidth
                multiline
                minRows={2}
                placeholder="Ex.: chuteira society obrigatória, sem bebida na área do campo..."
                inputProps={{ maxLength: 600 }}
                disabled={disabled}
              />

              <Stack spacing={1}>
                <Typography variant="caption" color="text.secondary">
                  Comodidades específicas deste campo
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {COMMERCIAL_AMENITIES.map((amenity) => (
                    <Chip
                      key={amenity}
                      size="small"
                      label={AMENITY_LABELS[amenity] || amenity}
                      color={field.amenities.includes(amenity) ? 'primary' : 'default'}
                      variant={field.amenities.includes(amenity) ? 'filled' : 'outlined'}
                      onClick={() => toggleFieldAmenity(field, amenity)}
                      disabled={disabled}
                      sx={{ minHeight: { xs: 44, sm: 32 }, px: { xs: 0.5, sm: 0 } }}
                    />
                  ))}
                </Stack>
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={field.isCovered}
                      onChange={(event) => {
                        const nextCovered = event.target.checked;
                        updateFieldPatch(field.id, {
                          isCovered: nextCovered,
                          amenities: nextCovered
                            ? Array.from(new Set([...field.amenities, 'covered']))
                            : field.amenities.filter((item) => item !== 'covered'),
                        });
                      }}
                      disabled={disabled}
                    />
                  }
                  label="Coberta"
                  sx={{ minHeight: 44 }}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={field.isActive}
                      onChange={(event) => updateField(field.id, 'isActive', event.target.checked)}
                      disabled={disabled}
                    />
                  }
                  label="Ativa"
                  sx={{ minHeight: 44 }}
                />
              </Stack>

              <Stack spacing={1}>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<PhotoIcon />}
                  disabled={disabled}
                  sx={{ minHeight: { xs: 44, sm: 40 } }}
                >
                  Adicionar fotos da quadra
                  <input
                    hidden
                    multiple
                    type="file"
                    accept="image/*"
                    onChange={(event) => handlePhotoFiles(field, event.target.files)}
                  />
                </Button>
                {(field.existingPhotos.length > 0 || field.photoPreviews.length > 0) && (
                  <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }}>
                    {[...field.existingPhotos, ...field.photoPreviews].map((photo, photoIndex) => (
                      <Box
                        key={`${field.id}-${photoIndex}`}
                        component="img"
                        src={photo}
                        alt={`Foto da quadra ${index + 1}`}
                        sx={{
                          width: 92,
                          height: 68,
                          objectFit: 'cover',
                          borderRadius: 1,
                          flex: '0 0 auto',
                        }}
                      />
                    ))}
                  </Stack>
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ))}

      <Button
        variant="outlined"
        startIcon={<AddIcon />}
        onClick={addField}
        disabled={disabled}
      >
        Adicionar outra quadra
      </Button>
    </Stack>
  );
}
