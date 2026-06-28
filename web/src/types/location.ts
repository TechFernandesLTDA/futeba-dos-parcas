export type FieldType = 'SOCIETY' | 'FUTSAL' | 'CAMPO' | 'AREIA' | 'OUTROS';
export type LocationPublicationStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'SUSPENDED' | 'REJECTED';
export type LocationCommercialStatus = 'TRIAL' | 'ACTIVE' | 'OVERDUE' | 'SUSPENDED' | 'CANCELLED';
export type LocationSubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'OVERDUE' | 'SUSPENDED' | 'CANCELLED';

export interface Location {
  id: string;
  name: string;
  address: string;
  
  // Structured Address
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  country: string;
  
  // Detailed Location
  neighborhood: string;
  region: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  
  // Owner
  ownerId: string;
  managers: string[];
  isVerified: boolean;
  isActive: boolean;

  // Commercial publishing and billing
  publicationStatus?: LocationPublicationStatus;
  commercialStatus?: LocationCommercialStatus;
  subscriptionStatus?: LocationSubscriptionStatus;
  monthlyFeeCents?: number;
  billingDueDay?: number;
  billingStartsAt?: Date;
  billingExpiresAt?: Date;
  publishedAt?: Date;
  publishedBy?: string;
  unpublishedReason?: string;
  ownerNotes?: string;
  adminNotes?: string;
  
  // Rating
  rating: number;
  ratingCount: number;
  averageRating?: number;
  reviewCount?: number;
  
  // Description
  description: string;
  photoUrl?: string;
  
  // Amenities
  amenities: string[];
  hasLighting?: boolean;
  hasParking?: boolean;
  hasShowers?: boolean;
  
  // Contact
  phone?: string;
  website?: string;
  instagram?: string;
  
  // Operating Hours
  openingTime: string;
  closingTime: string;
  operatingDays: number[];
  minGameDurationMinutes: number;
  
  // Fields
  fieldCount: number;
  fieldType?: FieldType;
  primaryFieldType?: FieldType;
  playersPerTeam?: number;
  hasActiveFields: boolean;
  
  createdAt?: Date;
  updatedAt?: Date;
  updatedBy?: string;
}

export interface Field {
  id: string;
  locationId: string;
  name: string;
  type: FieldType;
  description?: string;
  photoUrl?: string;
  isActive: boolean;
  hourlyPrice: number;
  photos: string[];
  managers: string[];
  surface?: string;
  isCovered: boolean;
  dimensions?: string;
}

export interface LocationReview {
  id: string;
  locationId: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  rating: number;
  comment: string;
  createdAt: Date;
}

export interface LocationWithFields {
  location: Location;
  fields: Field[];
}

export const FIELD_TYPE_CONFIG: Record<FieldType, { label: string; icon: string }> = {
  SOCIETY: { label: 'Society', icon: 'SportsSoccer' },
  FUTSAL: { label: 'Futsal', icon: 'SportsSoccer' },
  CAMPO: { label: 'Campo', icon: 'Yard' },
  AREIA: { label: 'Areia', icon: 'BeachAccess' },
  OUTROS: { label: 'Outros', icon: 'Sports' },
};

export const AMENITY_LABELS: Record<string, string> = {
  parking: 'Estacionamento',
  bathroom: 'Banheiro',
  locker_room: 'Vestiário',
  shower: 'Chuveiro',
  bar: 'Bar',
  restaurant: 'Restaurante',
  bbq: 'Churrasqueira',
  wifi: 'Wi-Fi',
  air_conditioning: 'Ar Condicionado',
  bleachers: 'Arquibancada',
  scoreboard: 'Placar Eletrônico',
  covered: 'Cobertura',
  security: 'Segurança',
  accessibility: 'Acessibilidade',
};

export const COMMERCIAL_AMENITIES = [
  'parking',
  'bathroom',
  'locker_room',
  'shower',
  'bbq',
  'bar',
  'restaurant',
  'wifi',
  'bleachers',
  'covered',
] as const;

export const LOCATION_PUBLICATION_STATUS_LABELS: Record<LocationPublicationStatus, string> = {
  DRAFT: 'Rascunho',
  PENDING_REVIEW: 'Em revisão',
  PUBLISHED: 'Publicado',
  SUSPENDED: 'Suspenso',
  REJECTED: 'Reprovado',
};

export const LOCATION_SUBSCRIPTION_STATUS_LABELS: Record<LocationSubscriptionStatus, string> = {
  TRIAL: 'Teste',
  ACTIVE: 'Em dia',
  OVERDUE: 'Vencido',
  SUSPENDED: 'Suspenso',
  CANCELLED: 'Cancelado',
};

export function canManageLocation(location: Location, userId: string): boolean {
  return location.ownerId === userId || location.managers.includes(userId);
}

export function isLocationCommerciallyAvailable(location: Location): boolean {
  const publicationStatus = location.publicationStatus ||
    (location.isVerified ? 'PUBLISHED' : 'PENDING_REVIEW');
  const subscriptionStatus = location.subscriptionStatus || 'ACTIVE';
  return location.isActive === true &&
    location.isVerified === true &&
    publicationStatus === 'PUBLISHED' &&
    ['TRIAL', 'ACTIVE'].includes(subscriptionStatus) &&
    location.hasActiveFields !== false;
}

export function getLocationAmenitySet(location: Location): Set<string> {
  const amenities = new Set(location.amenities || []);
  if (location.hasParking) amenities.add('parking');
  if (location.hasShowers) {
    amenities.add('shower');
    amenities.add('locker_room');
  }
  if (location.hasLighting) amenities.add('lighting');
  return amenities;
}

export function locationHasAmenities(location: Location, requiredAmenities: string[]): boolean {
  if (requiredAmenities.length === 0) return true;
  const amenities = getLocationAmenitySet(location);
  return requiredAmenities.every((amenity) => amenities.has(amenity));
}

export function getFullAddress(location: Location): string {
  if (location.city && location.state) {
    return `${location.address} - ${location.city}, ${location.state}`;
  }
  return location.address;
}

export function isOpenNow(location: Location): boolean {
  if (!location.isActive) return false;
  
  const now = new Date();
  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
  
  if (!location.operatingDays.includes(dayOfWeek)) return false;
  
  const currentTime = now.getHours() * 60 + now.getMinutes();
  const [openHour, openMin] = location.openingTime.split(':').map(Number);
  const [closeHour, closeMin] = location.closingTime.split(':').map(Number);
  
  const openMinutes = openHour * 60 + openMin;
  const closeMinutes = closeHour * 60 + closeMin;
  
  return currentTime >= openMinutes && currentTime <= closeMinutes;
}
