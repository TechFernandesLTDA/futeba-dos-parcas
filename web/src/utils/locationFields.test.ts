import { describe, expect, it } from 'vitest';
import {
  createLocationFieldDraft,
  fieldToDraft,
  parseHourlyPrice,
  summarizeLocationFields,
} from './locationFields';
import { Field } from '../types/location';

describe('locationFields', () => {
  it('keeps empty price fields empty-compatible and parses Brazilian decimal input', () => {
    expect(parseHourlyPrice('')).toBe(0);
    expect(parseHourlyPrice('120')).toBe(120);
    expect(parseHourlyPrice('120,50')).toBe(120.5);
    expect(parseHourlyPrice('120.75')).toBe(120.75);
  });

  it('rejects invalid or negative prices', () => {
    expect(parseHourlyPrice('abc')).toBeNaN();
    expect(parseHourlyPrice('-1')).toBeNaN();
  });

  it('summarizes active fields for availability and primary type filters', () => {
    const first = createLocationFieldDraft(1);
    const second = {
      ...createLocationFieldDraft(2),
      type: 'FUTSAL' as const,
      isActive: false,
    };

    expect(summarizeLocationFields([first, second])).toEqual({
      fieldCount: 2,
      activeFieldCount: 1,
      hasActiveFields: true,
      primaryFieldType: 'SOCIETY',
      playersPerTeam: null,
    });
  });

  it('falls back to the first field type when all fields are inactive', () => {
    const field = {
      ...createLocationFieldDraft(1),
      type: 'AREIA' as const,
      isActive: false,
    };

    expect(summarizeLocationFields([field])).toEqual({
      fieldCount: 1,
      activeFieldCount: 0,
      hasActiveFields: false,
      primaryFieldType: 'AREIA',
      playersPerTeam: null,
    });
  });

  it('maps persisted fields without forcing zero price back into the form', () => {
    const field: Field = {
      id: 'field-1',
      locationId: 'location-1',
      name: 'Quadra Coberta',
      type: 'FUTSAL',
      photoUrl: 'https://example.com/cover.jpg',
      isActive: true,
      hourlyPrice: 0,
      photos: [],
      managers: [],
      surface: 'Piso',
      isCovered: true,
      dimensions: '40m x 20m',
      playersPerTeam: 5,
      minBookingMinutes: 90,
      rules: 'Sem chuteira de trava.',
      amenities: ['covered', 'lighting'],
    };

    expect(fieldToDraft(field)).toMatchObject({
      id: 'field-1',
      persistedId: 'field-1',
      hourlyPrice: '',
      playersPerTeam: '5',
      minBookingMinutes: '90',
      rules: 'Sem chuteira de trava.',
      amenities: ['covered', 'lighting'],
      existingPhotos: ['https://example.com/cover.jpg'],
      isCovered: true,
    });
  });
});
