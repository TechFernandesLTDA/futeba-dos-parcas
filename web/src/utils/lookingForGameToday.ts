type TimestampLike = { toDate: () => Date };

export interface LookingForGameTodayFields {
  lookingForGameToday?: boolean | null;
  lookingForGameTodayUntil?: Date | TimestampLike | null;
}

export function getEndOfToday(now = new Date()): Date {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function toLookingForGameDate(value: Date | TimestampLike | null | undefined): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  return value.toDate();
}

export function isLookingForGameToday(
  value: LookingForGameTodayFields | null | undefined,
  now = new Date(),
): boolean {
  if (value?.lookingForGameToday !== true) return false;
  const until = toLookingForGameDate(value.lookingForGameTodayUntil);
  return Boolean(until && until.getTime() > now.getTime());
}
