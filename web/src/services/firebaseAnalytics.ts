import { getAnalytics, type Analytics } from 'firebase/analytics';
import { app } from './firebase';

export let analytics: Analytics | null = null;

if (typeof window !== 'undefined' && import.meta.env.PROD) {
  try {
    analytics = getAnalytics(app);
  } catch (err) {
    console.warn('Analytics initialization failed:', err);
  }
}
