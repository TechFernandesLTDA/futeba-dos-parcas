import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { createLogger } from '../utils/logger';
import { useTranslation } from 'react-i18next';

const logger = createLogger('useFeedback');
const FEEDBACK_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const FEEDBACK_DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface UserFeedback {
  id: string;
  user_id: string;
  user_email: string;
  type: 'bug' | 'problem' | 'improvement' | 'suggestion';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'triaged' | 'issue_created' | 'in_progress' | 'released' | 'rejected' | 'resolved' | 'wontfix' | 'duplicate';
  github_issue_number?: number;
  github_issue_url?: string;
  context: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

interface SubmitFeedbackInput {
  type: UserFeedback['type'];
  title: string;
  description: string;
  severity: UserFeedback['severity'];
  context: Record<string, unknown>;
}

function normalizeFeedbackText(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function useFeedback() {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { showSuccess, showError } = useToast();
  const [myFeedbacks, setMyFeedbacks] = useState<UserFeedback[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const uid = currentUser?.uid;
    if (!uid) {
      setFetching(false);
      return;
    }

    const q = query(
      collection(db, 'user_feedback'),
      where('user_id', '==', uid),
      orderBy('created_at', 'desc'),
      // #1330: limita leitura realtime do feedback do usuário (evita ler todo o histórico)
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const feedbacks = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          created_at: data.created_at?.toDate?.(),
          updated_at: data.updated_at?.toDate?.(),
        };
      }) as UserFeedback[];
      setMyFeedbacks(feedbacks);
      setFetching(false);
    }, (err) => {
      logger.error('Error fetching feedbacks:', err);
      setError(t('feedback.feedback.loadError'));
      setFetching(false);
    });

    return () => unsubscribe();
    // #2262: showError removido das deps — não é usado no listener (usa setError),
    // mantê-lo causava re-subscribe desnecessário quando a identidade mudava.
  }, [currentUser?.uid, t]);

  const submitFeedback = async (input: SubmitFeedbackInput): Promise<string | null> => {
    if (!currentUser) {
      showError(t('feedback.feedback.loginRequired'));
      return null;
    }

    const cleanTitle = input.title.trim().replace(/\s+/g, ' ');
    const cleanDescription = input.description.trim().replace(/\s+/g, ' ');

    if (!cleanTitle || !cleanDescription) {
      showError(t('feedback.feedback.whitespaceError'));
      return null;
    }

    const now = Date.now();
    const normalizedSignature = [
      input.type,
      normalizeFeedbackText(cleanTitle),
      normalizeFeedbackText(cleanDescription),
    ].join('::');

    const latestFeedback = myFeedbacks[0];
    if (
      latestFeedback?.created_at &&
      now - latestFeedback.created_at.getTime() < FEEDBACK_RATE_LIMIT_WINDOW_MS
    ) {
      showError(t('feedback.feedback.rateLimitError'));
      return null;
    }

    const hasRecentDuplicate = myFeedbacks.some((feedback) => {
      if (!feedback.created_at) return false;
      if (now - feedback.created_at.getTime() > FEEDBACK_DUPLICATE_WINDOW_MS) return false;

      const existingSignature = [
        feedback.type,
        normalizeFeedbackText(feedback.title),
        normalizeFeedbackText(feedback.description),
      ].join('::');

      return existingSignature === normalizedSignature;
    });

    if (hasRecentDuplicate) {
      showError(t('feedback.feedback.duplicateError'));
      return null;
    }

    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, 'user_feedback'), {
        user_id: currentUser.uid,
        user_email: currentUser.email || '',
        ...input,
        title: cleanTitle,
        description: cleanDescription,
        status: 'open',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      showSuccess(t('feedback.feedback.sendSuccess'));
      return docRef.id;
    } catch (err) {
      logger.error('Error submitting feedback:', err);
      showError(t('feedback.feedback.sendError'));
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { submitFeedback, myFeedbacks, loading, fetching, error };
}
