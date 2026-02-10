import { translations } from './translations';

export type Language = 'ko' | 'en';

export const useTranslation = (language: Language) => {
  return (key: keyof typeof translations.ko) => translations[language][key];
};
