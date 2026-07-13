import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

export function useCashboxSummary(groupId: string | undefined) {
  const [entryCount, setEntryCount] = useState(0);
  const [balanceCents, setBalanceCents] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) {
      setEntryCount(0);
      setBalanceCents(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    const summaryRef = doc(db, 'groups', groupId, 'cashbox_summary', 'current');

    const unsubscribe = onSnapshot(
      summaryRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setEntryCount(0);
          setBalanceCents(0);
        } else {
          const raw = snapshot.data();
          setEntryCount(Number(raw.entry_count) || 0);
          setBalanceCents(
            Number.isSafeInteger(raw.balance_cents)
              ? (raw.balance_cents as number)
              : 0,
          );
        }
        setLoading(false);
      },
      () => {
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [groupId]);

  return { entryCount, balanceCents, loading };
}
