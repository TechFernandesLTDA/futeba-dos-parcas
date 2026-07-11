/** MIME types raster aceitos pelas regras do Firebase Storage. */
export const STORAGE_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export const STORAGE_IMAGE_ACCEPT = STORAGE_IMAGE_MIME_TYPES.join(',');

export const LOCATION_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const LOCATION_IMAGE_ACCEPT = LOCATION_IMAGE_MIME_TYPES.join(',');

export function isSupportedStorageImage(file: Pick<File, 'type'>): boolean {
  const contentType = file.type.trim().toLowerCase();
  return STORAGE_IMAGE_MIME_TYPES.some((allowedType) => allowedType === contentType);
}

export function isSupportedLocationImage(file: Pick<File, 'type'>): boolean {
  const contentType = file.type.trim().toLowerCase();
  return LOCATION_IMAGE_MIME_TYPES.some((allowedType) => allowedType === contentType);
}
