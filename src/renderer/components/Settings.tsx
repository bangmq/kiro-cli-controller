import React, { useState } from 'react';
import { useI18n } from '../app';

interface Props {
  onClose: () => void;
}

const Settings: React.FC<Props> = ({ onClose }) => {
  const { language, setLanguage, t } = useI18n();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const handleThemeChange = (newTheme: 'dark' | 'light') => {
    setTheme(newTheme);
    document.documentElement.classList.toggle('light', newTheme === 'light');
  };

  const handleLanguageChange = (newLang: 'ko' | 'en') => {
    setLanguage(newLang);
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 py-4 border-b border-gray-700 bg-gray-800/50 backdrop-blur">
        <h3 className="text-lg font-semibold">{t('settingsTitle')}</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-6">
          <div className="bg-gray-800 rounded-xl p-6">
            <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              {t('theme')}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleThemeChange('dark')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  theme === 'dark'
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-900 rounded-lg border border-gray-700"></div>
                  <span className="font-medium">{t('dark')}</span>
                </div>
              </button>
              <button
                onClick={() => handleThemeChange('light')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  theme === 'light'
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-lg border border-gray-300"></div>
                  <span className="font-medium">{t('light')}</span>
                </div>
              </button>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-6">
            <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
              {t('language')}
            </h4>
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value as 'ko' | 'en')}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="ko">{t('korean')}</option>
              <option value="en">{t('english')}</option>
            </select>
          </div>

          <div className="bg-gray-800 rounded-xl p-6">
            <h4 className="text-lg font-semibold mb-4">{t('about')}</h4>
            <div className="space-y-2 text-sm text-gray-400">
              <p><span className="text-gray-300 font-medium">{t('version')}:</span> 1.0.0</p>
              <p><span className="text-gray-300 font-medium">{t('platform')}:</span> Electron + React</p>
              <p><span className="text-gray-300 font-medium">{t('description')}:</span> {t('appDescription')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
