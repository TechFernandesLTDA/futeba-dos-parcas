const GENERIC_VIDEO_TYPES = new Set([
  '',
  'application/octet-stream',
  'video/quicktime',
  'video/mp4',
]);

/** Returns the canonical media type accepted by the group wall. */
export function getWallMediaType(file: File): string | null {
  const type = file.type.toLowerCase();
  if (['image/jpeg', 'image/png', 'image/webp'].includes(type)) return type;
  if (type === 'video/mp4') return 'video/mp4';

  // Android/iOS browsers sometimes expose a selected MP4 as an empty,
  // generic or QuickTime MIME type even though the file extension is .mp4.
  if (/\.mp4$/i.test(file.name) && GENERIC_VIDEO_TYPES.has(type)) {
    return 'video/mp4';
  }
  return null;
}

export function isWallVideoFile(file: File): boolean {
  return getWallMediaType(file) === 'video/mp4';
}

export function isWallPostVideo(
  mediaType: string | null,
  mediaUrl: string | null,
  mediaPath: string | null,
): boolean {
  if (mediaType?.toLowerCase().startsWith('video/')) return true;
  return [mediaUrl, mediaPath].some((value) =>
    typeof value === 'string' && /\.mp4(?:$|[?#])/i.test(value),
  );
}

