import { httpsCallable } from 'firebase/functions';
import { functions } from './firebaseFunctions';
import type {
  MonthlyCourtPricingMode,
  MonthlyFinanceExclusionReason,
} from '../utils/monthlyFinance';

export interface ConfigureMonthlyFinanceRequest {
  groupId: string;
  pricingMode: MonthlyCourtPricingMode;
  fixedMonthlyCostCents?: number;
  defaultGameCostCents?: number | null;
}

export interface SetMonthlyMemberRequest {
  groupId: string;
  targetUserId: string;
  isMonthly: boolean;
}

export interface RebuildMonthlyCycleRequest {
  groupId: string;
  periodKey: string;
}

export interface SettleMonthlyChargeRequest {
  groupId: string;
  periodKey: string;
  targetUserId: string;
  requestId: string;
  amountCents?: number;
}

export interface SetMonthlyGameOverrideRequest {
  groupId: string;
  periodKey: string;
  occurrenceId: string;
  excluded: boolean;
  costCents?: number | null;
  reason?: MonthlyFinanceExclusionReason | null;
}

type MonthlyFinanceCallableResponse = Record<string, unknown>;
const replayProtectedCallable = { limitedUseAppCheckTokens: true } as const;

export const configureMonthlyFinance = httpsCallable<
  ConfigureMonthlyFinanceRequest,
  MonthlyFinanceCallableResponse
>(functions, 'configureMonthlyFinance', replayProtectedCallable);

export const setMonthlyMember = httpsCallable<
  SetMonthlyMemberRequest,
  MonthlyFinanceCallableResponse
>(functions, 'setMonthlyMember', replayProtectedCallable);

export const rebuildMonthlyCycle = httpsCallable<
  RebuildMonthlyCycleRequest,
  MonthlyFinanceCallableResponse
>(functions, 'rebuildMonthlyCycle', replayProtectedCallable);

export const settleMonthlyCharge = httpsCallable<
  SettleMonthlyChargeRequest,
  MonthlyFinanceCallableResponse
>(functions, 'settleMonthlyCharge', replayProtectedCallable);

export const setMonthlyGameOverride = httpsCallable<
  SetMonthlyGameOverrideRequest,
  MonthlyFinanceCallableResponse
>(functions, 'setMonthlyGameOverride', replayProtectedCallable);
