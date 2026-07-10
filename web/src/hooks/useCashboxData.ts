import { useCallback, useEffect, useRef, useState } from 'react';
import {
  collection,
  doc,
  DocumentData,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  QueryDocumentSnapshot,
  startAfter,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { snakeToCamel } from '../utils/firestoreHelpers';
import {
  cashboxAmountToCents,
  normalizeCashboxAmount,
} from '../utils/cashboxAmount';

export const CASHBOX_HISTORY_PAGE_SIZE = 50;

export interface CashboxTransaction {
  id: string;
  groupId: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  description: string;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
  status?: 'ACTIVE' | 'VOIDED';
  receiptUrl?: string;
  voidedBy?: string;
  voidedAt?: Date;
}

function mapTransaction(snapshot: QueryDocumentSnapshot<DocumentData>): CashboxTransaction {
  const raw = snapshot.data();
  const converted = snakeToCamel(raw);
  return {
    id: snapshot.id,
    ...converted,
    amount: normalizeCashboxAmount(raw.amount ?? converted.amount),
    createdAt: (raw.created_at || raw.createdAt)?.toDate?.() || new Date(),
  } as CashboxTransaction;
}

function mergeTransactions(
  primary: CashboxTransaction[],
  secondary: CashboxTransaction[]
): CashboxTransaction[] {
  const byId = new Map<string, CashboxTransaction>();
  [...secondary, ...primary].forEach((entry) => byId.set(entry.id, entry));
  return [...byId.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function useCashboxData(groupId: string | undefined, retryToken: number) {
  const [transactions, setTransactions] = useState<CashboxTransaction[]>([]);
  const [balanceCents, setBalanceCents] = useState(0);
  const [summaryLoaded, setSummaryLoaded] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [summaryNeedsReconciliation, setSummaryNeedsReconciliation] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const cursorRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const loadedOlderRef = useRef(false);

  useEffect(() => {
    if (!groupId) {
      setSummaryLoaded(true);
      setHistoryLoaded(true);
      return;
    }

    setTransactions([]);
    setSummaryLoaded(false);
    setHistoryLoaded(false);
    setSummaryNeedsReconciliation(false);
    setError(null);
    setHasMore(false);
    cursorRef.current = null;
    loadedOlderRef.current = false;

    const summaryRef = doc(db, 'groups', groupId, 'cashbox_summary', 'current');
    const cashboxRef = collection(db, 'groups', groupId, 'cashbox');
    const firstPageQuery = query(
      cashboxRef,
      orderBy('created_at', 'desc'),
      limit(CASHBOX_HISTORY_PAGE_SIZE)
    );

    const unsubscribeSummary = onSnapshot(summaryRef, (snapshot) => {
      if (!snapshot.exists()) {
        setBalanceCents(0);
        setSummaryNeedsReconciliation(true);
      } else {
        const raw = snapshot.data();
        const cents = Number.isSafeInteger(raw.balance_cents) ?
          raw.balance_cents as number :
          cashboxAmountToCents(raw.balance);
        setBalanceCents(cents);
        setSummaryNeedsReconciliation(
          raw.recomputed_by_server !== true || raw.truncated === true
        );
      }
      setSummaryLoaded(true);
    }, (cause) => {
      setError(cause);
      setSummaryLoaded(true);
    });

    const unsubscribeHistory = onSnapshot(firstPageQuery, (snapshot) => {
      const firstPage = snapshot.docs.map(mapTransaction);
      setTransactions((current) => loadedOlderRef.current ?
        mergeTransactions(firstPage, current) : firstPage);
      if (!loadedOlderRef.current) {
        cursorRef.current = snapshot.docs[snapshot.docs.length - 1] || null;
      }
      setHasMore(snapshot.size === CASHBOX_HISTORY_PAGE_SIZE);
      setHistoryLoaded(true);
    }, (cause) => {
      setError(cause);
      setHistoryLoaded(true);
    });

    return () => {
      unsubscribeSummary();
      unsubscribeHistory();
    };
  }, [groupId, retryToken]);

  const loadMore = useCallback(async () => {
    if (!groupId || !cursorRef.current || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const cashboxRef = collection(db, 'groups', groupId, 'cashbox');
      const nextPage = await getDocs(query(
        cashboxRef,
        orderBy('created_at', 'desc'),
        startAfter(cursorRef.current),
        limit(CASHBOX_HISTORY_PAGE_SIZE)
      ));
      const older = nextPage.docs.map(mapTransaction);
      loadedOlderRef.current = true;
      cursorRef.current = nextPage.docs[nextPage.docs.length - 1] || cursorRef.current;
      setTransactions((current) => mergeTransactions(older, current));
      setHasMore(nextPage.size === CASHBOX_HISTORY_PAGE_SIZE);
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error('Erro ao carregar histórico'));
    } finally {
      setLoadingMore(false);
    }
  }, [groupId, hasMore, loadingMore]);

  return {
    transactions,
    balanceCents,
    loading: !summaryLoaded || !historyLoaded,
    error,
    summaryNeedsReconciliation,
    hasMore,
    loadingMore,
    loadMore,
  };
}
