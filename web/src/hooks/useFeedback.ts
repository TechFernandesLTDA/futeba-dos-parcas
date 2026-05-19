import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { createLogger } from '../utils/logger';

const logger = createLogger('useFeedback');

export interface UserFeedback {
  id: string;
  user_id: string;
  user_email: string;
  type: 'bug' | 'problem' | 'improvement' | 'suggestion';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'triaged' | 'issue_created' | 'resolved' | 'wontfix' | 'duplicate';
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

export function useFeedback() {
  const { currentUser } = useAuth();
  const { showSuccess, showError } = useToast();
  const [myFeedbacks, setMyFeedbacks] = useState<UserFeedback[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setFetching(false);
      return;
    }

    const q = query(
      collection(db, 'user_feedback'),
      where('user_id', '==', currentUser.uid),
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
      setError('Erro ao carregar feedbacks');
      setFetching(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const submitFeedback = async (input: SubmitFeedbackInput): Promise<string | null> => {
    if (!currentUser) {
      showError('Você precisa estar logado para enviar feedback');
      return null;
    }

    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, 'user_feedback'), {
        user_id: currentUser.uid,
        user_email: currentUser.email || '',
        ...input,
        status: 'open',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      showSuccess('Feedback enviado com sucesso!');
      return docRef.id;
    } catch (err) {
      logger.error('Error submitting feedback:', err);
      showError('Erro ao enviar feedback. Tente novamente.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { submitFeedback, myFeedbacks, loading, fetching, error };
}
