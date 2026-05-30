import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import '../i18n';

export type SupportedLanguage = 'pt-BR' | 'en' | 'es';

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'i18nextLng';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY) as SupportedLanguage) || 'pt-BR';
    } catch (error) {
      console.warn('Failed to read language from localStorage:', error);
      return 'pt-BR';
    }
  });

  const setLanguage = useCallback(async (lang: SupportedLanguage) => {
    setLanguageState(lang);
    await i18n.changeLanguage(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (error) {
      console.warn('Failed to save language to localStorage:', error);
    }
  }, [i18n]);

  useEffect(() => {
    const handler = (lng: string) => setLanguageState(lng as SupportedLanguage);
    i18n.on('languageChanged', handler);
    return () => {
      i18n.off('languageChanged', handler);
    };
  }, [i18n]);

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}

// eslint-disable-next-line react-refresh/only-export-components
export async function syncLanguageToFirestore(uid: string, language: SupportedLanguage) {
  try {
    const prefRef = doc(db, 'users', uid, 'preferences', 'language');
    await updateDoc(prefRef, { language }).catch(async () => {
      await setDoc(prefRef, { language });
    });
  } catch {
    // offline/error — silencioso, localStorage já persiste
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export async function loadLanguageFromFirestore(uid: string): Promise<SupportedLanguage | null> {
  try {
    const prefRef = doc(db, 'users', uid, 'preferences', 'language');
    const snap = await getDoc(prefRef);
    if (snap.exists()) {
      return snap.data().language as SupportedLanguage;
    }
  } catch {
    // offline/error — fallback to localStorage
  }
  return null;
}
