import type { OfficialGroup } from '../types/group';

export interface GroupMatchmakingFilters {
  region: string;
  schedule: string;
}

export interface GroupMatchSuggestion {
  group: OfficialGroup;
  score: number;
  reasons: string[];
}

export interface GroupMatchmakingLabels {
  officialSuggestion: string;
  regionMatch: string;
  scheduleMatch: string;
  regionCategory: string;
  scheduleCategory: string;
  activeCommunity: string;
}

export function rankOfficialGroupsForMatchmaking(
  groups: OfficialGroup[],
  filters: GroupMatchmakingFilters,
  labels: GroupMatchmakingLabels
): GroupMatchSuggestion[] {
  return groups
    .map((group) => buildGroupMatchSuggestion(group, filters, labels))
    .sort(compareGroupMatchSuggestions);
}

export function buildGroupMatchSuggestion(
  group: OfficialGroup,
  filters: GroupMatchmakingFilters,
  labels: GroupMatchmakingLabels
): GroupMatchSuggestion {
  const haystack = normalizeText(`${group.name} ${group.description ?? ''}`);
  const region = normalizeText(filters.region);
  const schedule = normalizeText(filters.schedule);
  const reasons: string[] = [];
  let score = 40;

  if (region && haystack.includes(region)) {
    score += 35;
    reasons.push(labels.regionMatch);
  } else if (region && group.category === 'REGIAO') {
    score += 18;
    reasons.push(labels.regionCategory);
  }

  if (schedule && haystack.includes(schedule)) {
    score += 35;
    reasons.push(labels.scheduleMatch);
  } else if (schedule && group.category === 'DIA_SEMANA') {
    score += 18;
    reasons.push(labels.scheduleCategory);
  }

  if (!region && !schedule) {
    reasons.push(labels.officialSuggestion);
  }

  if ((group.memberCount ?? 0) >= 12) {
    score += 5;
    reasons.push(labels.activeCommunity);
  }

  return {
    group,
    score: Math.min(score, 100),
    reasons: dedupeReasons(reasons).slice(0, 3),
  };
}

function compareGroupMatchSuggestions(a: GroupMatchSuggestion, b: GroupMatchSuggestion): number {
  if (b.score !== a.score) return b.score - a.score;
  if ((b.group.memberCount ?? 0) !== (a.group.memberCount ?? 0)) {
    return (b.group.memberCount ?? 0) - (a.group.memberCount ?? 0);
  }
  return a.group.name.localeCompare(b.group.name, 'pt-BR', { sensitivity: 'base' });
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function dedupeReasons(reasons: string[]): string[] {
  return [...new Set(reasons.filter(Boolean))];
}
