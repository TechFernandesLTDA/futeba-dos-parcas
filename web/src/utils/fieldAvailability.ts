import type { FieldAvailabilitySlot } from '../services/cloudFunctions';

export function findAvailabilityConflict(
  slots: FieldAvailabilitySlot[],
  startMinutes: number,
  endMinutes: number,
): FieldAvailabilitySlot | undefined {
  return slots.find((slot) => slot.startMinutes < endMinutes && slot.endMinutes > startMinutes);
}
