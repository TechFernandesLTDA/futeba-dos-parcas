import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
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
    return (localStorage.getItem(STORAGE_KEY) as SupportedLanguage) || 'pt-BR';
  });

  const setLanguage = useCallback(async (lang: SupportedLanguage) => {
    setLanguageState(lang);
    await i18n.changeLanguage(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  }, [i18n]);

  useEffect(() => {
    i18n.on('languageChanged', (lng) => {
      setLanguageState(lng as SupportedLanguage);
    });
    return () => {
      i18n.off('languageChanged');
    };
  }, [i18n]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}

export async function syncLanguageToFirestore(uid: string, language: SupportedLanguage) {
  try {
    const prefRef = doc(db, 'users', uid, 'preferences', 'language');
    await updateDoc(prefRef, { language }).catch(async () => {
      const { setDoc } = await import('firebase/firestore');
      await setDoc(prefRef, { language });
    });
  } catch {
    // offline/error — silencioso, localStorage já persiste
  }
}

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
