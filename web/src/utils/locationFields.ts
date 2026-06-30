import { Field, FieldType } from '../types/location';

export interface LocationFieldDraft {
  id: string;
  persistedId?: string;
  name: string;
  type: FieldType;
  hourlyPrice: string;
  playersPerTeam: string;
  minBookingMinutes: string;
  surface: string;
  dimensions: string;
  rules: string;
  amenities: string[];
  isCovered: boolean;
  isActive: boolean;
  existingPhotos: string[];
  photoFiles: File[];
  photoPreviews: string[];
}

export interface LocationFieldSummary {
  fieldCount: number;
  activeFieldCount: number;
  hasActiveFields: boolean;
  primaryFieldType: FieldType;
  playersPerTeam: number | null;
}

export const DEFAULT_FIELD_TYPE: FieldType = 'SOCIETY';

export function createLocationFieldDraft(index: number): LocationFieldDraft {
  return {
    id: `new-${Date.now()}-${index}`,
    name: index === 1 ? 'Quadra Principal' : `Quadra ${index}`,
    type: DEFAULT_FIELD_TYPE,
    hourlyPrice: '',
    playersPerTeam: '',
    minBookingMinutes: '60',
    surface: '',
    dimensions: '',
    rules: '',
    amenities: [],
    isCovered: false,
    isActive: true,
    existingPhotos: [],
    photoFiles: [],
    photoPreviews: [],
  };
}

export function fieldToDraft(field: Field): LocationFieldDraft {
  const photos = field.photos?.length ? field.photos : (field.photoUrl ? [field.photoUrl] : []);
  return {
    id: field.id,
    persistedId: field.id,
    name: field.name || 'Quadra',
    type: field.type || DEFAULT_FIELD_TYPE,
    hourlyPrice: Number.isFinite(field.hourlyPrice) && field.hourlyPrice > 0
      ? String(field.hourlyPrice)
      : '',
    playersPerTeam: Number.isFinite(field.playersPerTeam) && field.playersPerTeam
      ? String(field.playersPerTeam)
      : '',
    minBookingMinutes: Number.isFinite(field.minBookingMinutes) && field.minBookingMinutes
      ? String(field.minBookingMinutes)
      : '60',
    surface: field.surface || '',
    dimensions: field.dimensions || '',
    rules: field.rules || '',
    amenities: field.amenities || [],
    isCovered: Boolean(field.isCovered),
    isActive: field.isActive !== false,
    existingPhotos: photos,
    photoFiles: [],
    photoPreviews: [],
  };
}

export function summarizeLocationFields(fields: LocationFieldDraft[]): LocationFieldSummary {
  const activeFields = fields.filter((field) => field.isActive);
  const primaryField = activeFields[0] || fields[0];
  return {
    fieldCount: fields.length,
    activeFieldCount: activeFields.length,
    hasActiveFields: activeFields.length > 0,
    primaryFieldType: primaryField?.type || DEFAULT_FIELD_TYPE,
    playersPerTeam: parseOptionalPositiveInt(primaryField?.playersPerTeam || ''),
  };
}

export function parseHourlyPrice(value: string): number {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN;
}

export function parseOptionalPositiveInt(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  if (!/^\d+$/.test(normalized)) return Number.NaN;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Number.NaN;
}
