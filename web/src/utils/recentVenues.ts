/** Utilizações de quadras (jogos criados ou jogados) — #4370. */
export interface RecentLocationUsage {
  locationId: string;
  /** Data do jogo em ms; 0 quando desconhecida. */
  usedAt: number;
}

/**
 * Junta as utilizações de várias fontes e devolve os ids das quadras, da
 * mais recente para a mais antiga, sem repetir. Empates e datas
 * desconhecidas mantêm a ordem de chegada.
 */
export function mergeRecentLocationUsage(
  entries: ReadonlyArray<RecentLocationUsage | null | undefined>,
): string[] {
  const latest = new Map<string, number>();
  const arrival: string[] = [];
  for (const entry of entries) {
    if (!entry?.locationId) continue;
    const current = latest.get(entry.locationId);
    if (current === undefined) arrival.push(entry.locationId);
    latest.set(entry.locationId, Math.max(current ?? 0, entry.usedAt || 0));
  }
  return arrival
    .map((id, order) => ({ id, order, usedAt: latest.get(id) ?? 0 }))
    .sort((a, b) => b.usedAt - a.usedAt || a.order - b.order)
    .map((item) => item.id);
}
