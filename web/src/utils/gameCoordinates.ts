/**
 * Coordenadas do local para gravar no jogo (`location_lat` / `location_lng`).
 *
 * O check-in por GPS (`functions/src/voting/check-in.ts`) compara a posição da
 * pessoa com essas coordenadas e recusa com "Jogo sem coordenadas" quando elas
 * faltam. O Android já copia do local para o jogo; o web não copiava
 * (#4629, item 9). Valor ausente ou fora do intervalo fica de fora: o Firestore
 * não aceita `undefined` e as regras recusam latitude ou longitude inválida.
 */
export function gameCoordinatesForSave(
  lat: unknown,
  lng: unknown,
): { locationLat: number; locationLng: number } | Record<string, never> {
  const isLat = typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90;
  const isLng = typeof lng === 'number' && Number.isFinite(lng) && lng >= -180 && lng <= 180;
  if (!isLat || !isLng) return {};
  return { locationLat: lat, locationLng: lng };
}
