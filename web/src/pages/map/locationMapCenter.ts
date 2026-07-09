import type { Location } from '../../types/location';

export interface MapLatLng {
  lat: number;
  lng: number;
}

const DEFAULT_CENTER = { lat: -23.55, lng: -46.63 };

export function getLocationMapCenter(
  locations: Location[],
  userPosition?: { latitude: number; longitude: number } | null,
): MapLatLng {
  if (userPosition) {
    return {
      lat: userPosition.latitude,
      lng: userPosition.longitude,
    };
  }

  const markers = locations.filter(
    (location) => typeof location.latitude === 'number' && typeof location.longitude === 'number',
  );
  if (markers.length === 0) return DEFAULT_CENTER;

  if (markers.length === 1) {
    return {
      lat: markers[0].latitude!,
      lng: markers[0].longitude!,
    };
  }

  const bounds = markers.reduce(
    (acc, location) => ({
      minLat: Math.min(acc.minLat, location.latitude!),
      maxLat: Math.max(acc.maxLat, location.latitude!),
      minLng: Math.min(acc.minLng, location.longitude!),
      maxLng: Math.max(acc.maxLng, location.longitude!),
    }),
    {
      minLat: markers[0].latitude!,
      maxLat: markers[0].latitude!,
      minLng: markers[0].longitude!,
      maxLng: markers[0].longitude!,
    },
  );

  return {
    lat: (bounds.minLat + bounds.maxLat) / 2,
    lng: (bounds.minLng + bounds.maxLng) / 2,
  };
}
