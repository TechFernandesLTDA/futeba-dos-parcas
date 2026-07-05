import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { createLogger } from '../utils/logger';

const logger = createLogger('useAdminFeedbackQueue');

export const FEEDBACK_STATUSES = [
  'open',
  'triaged',
  'issue_created',
  'in_progress',
  'released',
  'rejected',
] as const;

export type FeedbackStatus = typeof FEEDBACK_STATUSES[number];
export type FeedbackSeverity = 'low' | 'medium' | 'high' | 'critical';
export type FeedbackType = 'bug' | 'problem' | 'improvement' | 'suggestion';

export interface AdminFeedbackItem {
  id: string;
  userId: string;
  userEmail: string;
  type: FeedbackType;
  title: string;
  description: string;
  severity: FeedbackSeverity;
  status: FeedbackStatus;
  legacyStatus?: string;
  assignee: string;
  githubIssueNumber?: number;
  githubIssueUrl?: string;
  githubPrNumber?: number;
  githubPrUrl?: string;
  releaseVersion?: string;
  releaseUrl?: string;
  suspectedDuplicateOf?: string;
  adminNotes?: string;
  triagedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  context: Record<string, unknown>;
}

export interface AdminFeedbackUpdateInput {
  status: FeedbackStatus;
  assignee?: string;
  githubIssueNumber?: number | null;
  githubIssueUrl?: string;
  githubPrNumber?: number | null;
  githubPrUrl?: string;
  releaseVersion?: string;
  releaseUrl?: string;
  suspectedDuplicateOf?: string;
  adminNotes?: string;
}

const LEGACY_STATUS_MAP: Record<string, FeedbackStatus> = {
  resolved: 'released',
  wontfix: 'rejected',
  duplicate: 'rejected',
};

function toDate(value: unknown): Date | undefined {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return undefined;
}

function toNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function toString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeStatus(value: unknown): { status: FeedbackStatus; legacyStatus?: string } {
  if (typeof value === 'string' && FEEDBACK_STATUSES.includes(value as FeedbackStatus)) {
    return { status: value as FeedbackStatus };
  }

  if (typeof value === 'string' && LEGACY_STATUS_MAP[value]) {
    return { status: LEGACY_STATUS_MAP[value], legacyStatus: value };
  }

  return { status: 'open', legacyStatus: typeof value === 'string' ? value : undefined };
}

function normalizeFeedback(id: string, raw: Record<string, unknown>): AdminFeedbackItem {
  const normalizedStatus = normalizeStatus(raw.status);
  return {
    id,
    userId: toString(raw.user_id ?? raw.userId),
    userEmail: toString(raw.user_email ?? raw.userEmail),
    type: (toString(raw.type) || 'bug') as FeedbackType,
    title: toString(raw.title) || 'Sem titulo',
    description: toString(raw.description),
    severity: (toString(raw.severity) || 'medium') as FeedbackSeverity,
    status: normalizedStatus.status,
    legacyStatus: normalizedStatus.legacyStatus,
    assignee: toString(raw.assignee ?? raw.assigned_to ?? raw.responsible),
    githubIssueNumber: toNumber(raw.github_issue_number ?? raw.githubIssueNumber),
    githubIssueUrl: toString(raw.github_issue_url ?? raw.githubIssueUrl),
    githubPrNumber: toNumber(raw.github_pr_number ?? raw.githubPrNumber),
    githubPrUrl: toString(raw.github_pr_url ?? raw.githubPrUrl),
    releaseVersion: toString(raw.release_version ?? raw.releaseVersion),
    releaseUrl: toString(raw.release_url ?? raw.releaseUrl),
    suspectedDuplicateOf: toString(raw.suspected_duplicate_of ?? raw.suspectedDuplicateOf),
    adminNotes: toString(raw.admin_notes ?? raw.adminNotes),
    triagedAt: toDate(raw.triaged_at ?? raw.triagedAt),
    createdAt: toDate(raw.created_at ?? raw.createdAt),
    updatedAt: toDate(raw.updated_at ?? raw.updatedAt),
    context: (raw.context && typeof raw.context === 'object' ? raw.context : {}) as Record<string, unknown>,
  };
}

function compactText(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function useAdminFeedbackQueue() {
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const [feedbacks, setFeedbacks] = useState<AdminFeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== 'ADMIN') {
      setFeedbacks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const feedbackQuery = query(
      collection(db, 'user_feedback'),
      orderBy('created_at', 'desc'),
      limit(100),
    );

    const unsubscribe = onSnapshot(
      feedbackQuery,
      (snapshot) => {
        setFeedbacks(snapshot.docs.map((snapshotDoc) => normalizeFeedback(snapshotDoc.id, snapshotDoc.data())));
        setError(null);
        setLoading(false);
      },
      (snapshotError) => {
        logger.error('Error loading admin feedback queue:', snapshotError);
        setError('Nao foi possivel carregar a fila de feedbacks.');
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user?.role]);

  const updateFeedback = useCallback(async (feedbackId: string, input: AdminFeedbackUpdateInput) => {
    if (!feedbackId.trim()) {
      showError('Feedback invalido.');
      return false;
    }

    setSavingId(feedbackId);
    try {
      const payload: Record<string, unknown> = {
        status: input.status,
        updated_at: serverTimestamp(),
        assignee: compactText(input.assignee) ?? '',
        github_issue_url: compactText(input.githubIssueUrl) ?? '',
        github_pr_url: compactText(input.githubPrUrl) ?? '',
        release_version: compactText(input.releaseVersion) ?? '',
        release_url: compactText(input.releaseUrl) ?? '',
        suspected_duplicate_of: compactText(input.suspectedDuplicateOf) ?? '',
        admin_notes: compactText(input.adminNotes) ?? '',
      };

      if (input.githubIssueNumber !== undefined) {
        payload.github_issue_number = input.githubIssueNumber;
      }
      if (input.githubPrNumber !== undefined) {
        payload.github_pr_number = input.githubPrNumber;
      }
      if (input.status !== 'open') {
        payload.triaged_at = serverTimestamp();
      }

      await updateDoc(doc(db, 'user_feedback', feedbackId), payload);
      showSuccess('Feedback atualizado.');
      return true;
    } catch (updateError) {
      logger.error('Error updating feedback:', updateError);
      showError('Nao foi possivel atualizar o feedback.');
      return false;
    } finally {
      setSavingId(null);
    }
  }, [showError, showSuccess]);

  const summary = useMemo(() => ({
    total: feedbacks.length,
    open: feedbacks.filter((item) => item.status === 'open').length,
    critical: feedbacks.filter((item) => item.severity === 'critical').length,
    withIssue: feedbacks.filter((item) => Boolean(item.githubIssueUrl || item.githubIssueNumber)).length,
    released: feedbacks.filter((item) => item.status === 'released').length,
  }), [feedbacks]);

  return {
    feedbacks,
    loading,
    savingId,
    error,
    summary,
    updateFeedback,
  };
}
