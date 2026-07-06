interface RealtimeEntity {
  id: string;
}

type RealtimePagePlacement = 'append' | 'prepend';

function dedupeById<T extends RealtimeEntity>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

export function mergeRealtimePageById<T extends RealtimeEntity>(
  existing: T[],
  livePage: T[],
  snapshotIds: string[],
  placement: RealtimePagePlacement,
): T[] {
  const currentSnapshotIds = new Set(snapshotIds);
  const preservedHistory = dedupeById(
    existing.filter((item) => !currentSnapshotIds.has(item.id)),
  );
  const nextLivePage = dedupeById(livePage);

  return placement === 'append'
    ? [...preservedHistory, ...nextLivePage]
    : [...nextLivePage, ...preservedHistory];
}
