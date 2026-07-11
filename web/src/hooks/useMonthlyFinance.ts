import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { getUsersByIds } from '../utils/userBatch';
import type {
  MonthlyCourtPricingMode,
  MonthlyFinanceExclusionReason,
  MonthlyFinanceGame,
  MonthlyFinanceGameSource,
  MonthlyFinanceInput,
  MonthlyFinanceMember,
} from '../utils/monthlyFinance';

export interface MonthlyFinanceConfigRecord {
  pricingMode: MonthlyCourtPricingMode;
  fixedMonthlyCostCents: number | null;
  defaultGameCostCents: number | null;
  revision: number;
}

export interface MonthlyFinancePeriodRecord {
  periodKey: string;
  pricingMode: MonthlyCourtPricingMode;
  fixedMonthlyCostCents: number | null;
  defaultGameCostCents: number | null;
  status: 'DRAFT' | 'FINALIZED' | 'CLOSED';
  revision: number;
  totalCourtCostCents: number;
  gameCount: number;
  excludedGameCount: number;
  groupMemberCount: number;
  monthlyMemberCount: number;
  averagePerGameCents: number | null;
  averagePerMonthlyMemberCents: number | null;
  receivedCents: number;
  openCents: number;
  gameSnapshot: MonthlyFinanceGame[];
}

export interface MonthlyFinancePayerRecord {
  userId: string;
  userName: string;
  userPhotoUrl?: string;
  active: boolean;
  expectedCents: number;
  paidCents: number;
  outstandingCents: number;
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'REMOVED';
  revision: number;
}

interface GroupMemberView {
  userId: string;
  name: string;
  photoUrl?: string;
}

interface LoadingState {
  config: boolean;
  period: boolean;
  members: boolean;
  roster: boolean;
  payers: boolean;
}

const INITIAL_LOADING: LoadingState = {
  config: false,
  period: false,
  members: false,
  roster: false,
  payers: false,
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asInteger(value: unknown, fallback = 0): number {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : fallback;
}

function asNullableInteger(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : null;
}

function asPricingMode(value: unknown): MonthlyCourtPricingMode {
  return value === 'PER_GAME' ? 'PER_GAME' : 'FIXED_MONTHLY';
}

function asPayerStatus(value: unknown): MonthlyFinancePayerRecord['status'] {
  return value === 'PARTIAL' || value === 'PAID' || value === 'REMOVED'
    ? value
    : 'PENDING';
}

function asGameStatus(value: unknown): MonthlyFinanceGame['status'] {
  return value === 'CONFIRMED' || value === 'LIVE' || value === 'FINISHED' || value === 'CANCELLED'
    ? value
    : 'SCHEDULED';
}

function asGameSource(value: unknown): MonthlyFinanceGameSource | undefined {
  return value === 'GAME' || value === 'SCHEDULE' || value === 'RECURRENCE'
    ? value
    : undefined;
}

function asExclusionReason(value: unknown): MonthlyFinanceExclusionReason | undefined {
  if (value === 'HOLIDAY') return 'HOLIDAY';
  if (value === 'CANCELLED' || value === 'CANCELLED_OR_DELETED') return 'CANCELLED';
  if (value === 'OTHER' || value === 'EXPLICIT_EXCLUSION' || value === 'UNSUPPORTED_STATUS') {
    return 'OTHER';
  }
  return undefined;
}

export function mapMonthlyFinanceConfig(raw: DocumentData): MonthlyFinanceConfigRecord {
  const data = snakeToCamel<Record<string, unknown>>(raw);
  return {
    pricingMode: asPricingMode(data.pricingMode),
    fixedMonthlyCostCents: asNullableInteger(data.fixedMonthlyCostCents),
    defaultGameCostCents: asNullableInteger(data.defaultGameCostCents),
    revision: asInteger(data.revision),
  };
}

export function mapMonthlyFinancePeriod(raw: DocumentData): MonthlyFinancePeriodRecord {
  const data = snakeToCamel<Record<string, unknown>>(raw);
  const gameSnapshot = Array.isArray(data.gameSnapshot) ? data.gameSnapshot : [];
  return {
    periodKey: asString(data.periodKey),
    pricingMode: asPricingMode(data.pricingMode),
    fixedMonthlyCostCents: asNullableInteger(data.fixedMonthlyCostCents),
    defaultGameCostCents: asNullableInteger(data.defaultGameCostCents),
    status: data.status === 'FINALIZED' || data.status === 'CLOSED' ? data.status : 'DRAFT',
    revision: asInteger(data.revision),
    totalCourtCostCents: asInteger(data.totalCourtCostCents),
    gameCount: asInteger(data.gameCount),
    excludedGameCount: asInteger(data.excludedGameCount),
    groupMemberCount: asInteger(data.groupMemberCount),
    monthlyMemberCount: asInteger(data.monthlyMemberCount),
    averagePerGameCents: asNullableInteger(data.averagePerGameCents),
    averagePerMonthlyMemberCents: asNullableInteger(data.averagePerMonthlyMemberCents),
    receivedCents: asInteger(data.receivedCents),
    openCents: asInteger(data.openCents),
    gameSnapshot: gameSnapshot.map((item, index) => {
      const game = asRecord(item);
      const rawManualOverride = asRecord(game.manualOverride);
      const manualReason = asExclusionReason(rawManualOverride.reason);
      const hasManualOverride = Object.keys(rawManualOverride).length > 0;
      return {
        id: asString(game.id, `game-${index}`),
        date: asString(game.date),
        status: asGameStatus(game.status),
        source: asGameSource(game.source),
        scheduleId: asString(game.scheduleId) || undefined,
        label: asString(game.label) || undefined,
        courtCostCents: asNullableInteger(game.courtCostCents) ?? undefined,
        authoritativeAllocatedCostCents: asInteger(game.allocatedCostCents),
        included: game.included === true,
        exclusionReason: asExclusionReason(game.exclusionReason),
        manualOverride: hasManualOverride ? {
          excluded: rawManualOverride.excluded === true,
          costCents: asNullableInteger(rawManualOverride.costCents),
          reason: manualReason ?? null,
        } : undefined,
      };
    }),
  };
}

export function mapMonthlyFinancePayer(
  documentId: string,
  raw: DocumentData,
): MonthlyFinancePayerRecord {
  const data = snakeToCamel<Record<string, unknown>>(raw);
  const status = asPayerStatus(data.status);
  return {
    userId: asString(data.userId, documentId),
    userName: asString(data.userName, 'Jogador'),
    userPhotoUrl: asString(data.userPhotoUrl) || undefined,
    active: data.active === true && status !== 'REMOVED',
    expectedCents: asInteger(data.expectedCents),
    paidCents: asInteger(data.paidCents),
    outstandingCents: asInteger(data.outstandingCents),
    status,
    revision: asInteger(data.revision),
  };
}

export function buildMonthlyFinanceInput(
  period: MonthlyFinancePeriodRecord | null,
  config: MonthlyFinanceConfigRecord | null,
  members: GroupMemberView[],
  _roster: Record<string, boolean>,
  payers: Record<string, MonthlyFinancePayerRecord>,
): MonthlyFinanceInput | null {
  if (!period) return null;

  const memberIds = new Set(members.map((member) => member.userId));
  const snapshotOnlyMembers: GroupMemberView[] = Object.values(payers)
    .filter((payer) => payer.active && !memberIds.has(payer.userId))
    .map((payer) => ({
      userId: payer.userId,
      name: payer.userName,
      photoUrl: payer.userPhotoUrl,
    }));
  const mappedMembers = [...members, ...snapshotOnlyMembers].map<MonthlyFinanceMember>((member) => {
    const payer = payers[member.userId];
    // Um período materializado é um registro histórico. O snapshot de pagantes
    // define o divisor inclusive enquanto está em DRAFT; o roster atual serve
    // somente para preparar uma nova materialização.
    const isMonthly = payer?.active ?? false;
    return {
      userId: member.userId,
      name: payer?.userName || member.name,
      photoUrl: payer?.userPhotoUrl || member.photoUrl,
      isMonthly,
      paidCents: payer?.paidCents ?? 0,
      authoritativeExpectedCents: payer?.active ? payer.expectedCents : undefined,
      exempt: false,
    };
  });

  return {
    periodKey: period.periodKey,
    pricingMode: period.pricingMode,
    fixedMonthlyCostCents: period.fixedMonthlyCostCents ?? config?.fixedMonthlyCostCents ?? undefined,
    defaultGameCostCents: period.defaultGameCostCents ?? config?.defaultGameCostCents ?? undefined,
    authoritativeTotalCourtCostCents: period.totalCourtCostCents,
    games: period.gameSnapshot,
    members: mappedMembers,
  };
}

export interface UseMonthlyFinanceOptions {
  groupId?: string;
  periodKey: string;
  currentUserId?: string;
  canManage: boolean;
  retryToken: number;
}

export function useMonthlyFinance({
  groupId,
  periodKey,
  currentUserId,
  canManage,
  retryToken,
}: UseMonthlyFinanceOptions) {
  const [config, setConfig] = useState<MonthlyFinanceConfigRecord | null>(null);
  const [period, setPeriod] = useState<MonthlyFinancePeriodRecord | null>(null);
  const [members, setMembers] = useState<GroupMemberView[]>([]);
  const [roster, setRoster] = useState<Record<string, boolean>>({});
  const [payers, setPayers] = useState<Record<string, MonthlyFinancePayerRecord>>({});
  const [loaded, setLoaded] = useState<LoadingState>(INITIAL_LOADING);
  const [error, setError] = useState<Error | null>(null);
  const [accessLimited, setAccessLimited] = useState(false);

  useEffect(() => {
    if (!groupId || !currentUserId) {
      setConfig(null);
      setPeriod(null);
      setMembers([]);
      setRoster({});
      setPayers({});
      setLoaded({ config: true, period: true, members: true, roster: true, payers: true });
      return;
    }

    let cancelled = false;
    let membersVersion = 0;
    const unsubscribes: Unsubscribe[] = [];
    const markLoaded = (key: keyof LoadingState) => {
      if (!cancelled) setLoaded((current) => ({ ...current, [key]: true }));
    };
    const handleReadError = (key: keyof LoadingState, cause: Error, soft: boolean) => {
      if (cancelled) return;
      if (soft) setAccessLimited(true);
      else setError(cause);
      markLoaded(key);
    };

    setConfig(null);
    setPeriod(null);
    setMembers([]);
    setRoster({});
    setPayers({});
    setLoaded({ ...INITIAL_LOADING, members: !canManage });
    setError(null);
    setAccessLimited(false);

    const groupRef = doc(db, 'groups', groupId);
    const configRef = doc(groupRef, 'monthly_finance_config', 'current');
    const periodRef = doc(groupRef, 'monthly_finance_periods', periodKey);

    unsubscribes.push(onSnapshot(configRef, (snapshot) => {
      if (cancelled) return;
      setConfig(snapshot.exists() ? mapMonthlyFinanceConfig(snapshot.data()) : null);
      markLoaded('config');
    }, (cause) => handleReadError('config', cause, !canManage)));

    unsubscribes.push(onSnapshot(periodRef, (snapshot) => {
      if (cancelled) return;
      setPeriod(snapshot.exists() ? mapMonthlyFinancePeriod(snapshot.data()) : null);
      markLoaded('period');
    }, (cause) => handleReadError('period', cause, !canManage)));

    if (canManage) {
      unsubscribes.push(onSnapshot(collection(groupRef, 'members'), (snapshot) => {
        const version = ++membersVersion;
        const activeDocs = snapshot.docs.filter((memberDoc) => {
          const data = snakeToCamel<Record<string, unknown>>(memberDoc.data());
          return asString(data.userId, memberDoc.id) === memberDoc.id &&
            asString(data.status, 'ACTIVE') === 'ACTIVE';
        });

        void getUsersByIds(activeDocs.map((memberDoc) => memberDoc.id)).then((users) => {
          if (cancelled || version !== membersVersion) return;
          setMembers(activeDocs.map((memberDoc) => {
            const member = snakeToCamel<Record<string, unknown>>(memberDoc.data());
            const profile: Record<string, unknown> = users.get(memberDoc.id) ?? {};
            return {
              userId: memberDoc.id,
              name: asString(
                profile.name ?? profile.displayName ?? profile.userName ?? member.userName,
                'Jogador',
              ),
              photoUrl: asString(
                profile.photoUrl ?? profile.photoURL ?? member.userPhotoUrl,
              ) || undefined,
            };
          }));
          markLoaded('members');
        }).catch((cause: unknown) => {
          handleReadError(
            'members',
            cause instanceof Error ? cause : new Error('Falha ao carregar membros.'),
            false,
          );
        });
      }, (cause) => handleReadError('members', cause, false)));

      unsubscribes.push(onSnapshot(collection(groupRef, 'monthly_member_roster'), (snapshot) => {
        if (cancelled) return;
        const nextRoster: Record<string, boolean> = {};
        snapshot.docs.forEach((rosterDoc) => {
          const data = snakeToCamel<Record<string, unknown>>(rosterDoc.data());
          if (asString(data.userId, rosterDoc.id) === rosterDoc.id) {
            nextRoster[rosterDoc.id] = data.active === true;
          }
        });
        setRoster(nextRoster);
        markLoaded('roster');
      }, (cause) => handleReadError('roster', cause, false)));

      unsubscribes.push(onSnapshot(collection(periodRef, 'payers'), (snapshot) => {
        if (cancelled) return;
        const nextPayers: Record<string, MonthlyFinancePayerRecord> = {};
        snapshot.docs.forEach((payerDoc) => {
          const payer = mapMonthlyFinancePayer(payerDoc.id, payerDoc.data());
          if (payer.userId === payerDoc.id) nextPayers[payerDoc.id] = payer;
        });
        setPayers(nextPayers);
        markLoaded('payers');
      }, (cause) => handleReadError('payers', cause, false)));
    } else {
      const ownRosterRef = doc(groupRef, 'monthly_member_roster', currentUserId);
      const ownPayerRef = doc(periodRef, 'payers', currentUserId);
      unsubscribes.push(onSnapshot(ownRosterRef, (snapshot) => {
        if (cancelled) return;
        const data = snapshot.exists()
          ? snakeToCamel<Record<string, unknown>>(snapshot.data())
          : null;
        setRoster(data ? { [currentUserId]: data.active === true } : {});
        markLoaded('roster');
      }, (cause) => handleReadError('roster', cause, true)));

      unsubscribes.push(onSnapshot(ownPayerRef, (snapshot) => {
        if (cancelled) return;
        setPayers(snapshot.exists()
          ? { [currentUserId]: mapMonthlyFinancePayer(currentUserId, snapshot.data()) }
          : {});
        markLoaded('payers');
      }, (cause) => handleReadError('payers', cause, true)));
    }

    return () => {
      cancelled = true;
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [canManage, currentUserId, groupId, periodKey, retryToken]);

  const requiredLoaded = canManage
    ? loaded.config && loaded.period && loaded.members && loaded.roster && loaded.payers
    : loaded.config && loaded.period && loaded.roster && loaded.payers;
  const input = useMemo(
    () => canManage
      ? buildMonthlyFinanceInput(period, config, members, roster, payers)
      : null,
    [canManage, config, members, payers, period, roster],
  );

  return {
    config,
    period,
    input,
    ownPayer: currentUserId ? payers[currentUserId] ?? null : null,
    isMonthlyMember: currentUserId ? roster[currentUserId] === true : false,
    loading: !requiredLoaded,
    error,
    accessLimited,
  };
}
