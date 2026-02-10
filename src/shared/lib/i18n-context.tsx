import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Language, useTranslation } from '../lib/i18n';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: any) => string;
}

const I18nContext = createContext<I18nContextType>({
  language: 'ko',
  setLanguage: () => {},
  t: (key) => key
});

export const useI18n = () => useContext(I18nContext);

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('ko');
  const t = useTranslation(language);

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};
