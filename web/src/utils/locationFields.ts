import { Field, FieldType } from '../types/location';

export interface LocationFieldDraft {
  id: string;
  persistedId?: string;
  name: string;
  type: FieldType;
  hourlyPrice: string;
  surface: string;
  dimensions: string;
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
}

export const DEFAULT_FIELD_TYPE: FieldType = 'SOCIETY';

export function createLocationFieldDraft(index: number): LocationFieldDraft {
  return {
    id: `new-${Date.now()}-${index}`,
    name: index === 1 ? 'Quadra Principal' : `Quadra ${index}`,
    type: DEFAULT_FIELD_TYPE,
    hourlyPrice: '',
    surface: '',
    dimensions: '',
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
    surface: field.surface || '',
    dimensions: field.dimensions || '',
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
  };
}

export function parseHourlyPrice(value: string): number {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN;
}
