import React, { useState } from 'react';
import { useI18n } from '../app';

interface Props {
  onClose: () => void;
  authStatus: {
    loading: boolean;
    error: string | null;
    loggedIn: boolean;
    user: string | null;
    actionLoading: boolean;
    actionError: string | null;
  };
  onLogin: () => Promise<void>;
  onLogout: () => Promise<void>;
}

const Settings: React.FC<Props> = ({ onClose, authStatus, onLogin, onLogout }) => {
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
      <div className="px-5 py-3 border-b border-gray-700 bg-gray-800/50 backdrop-blur">
        <h3 className="text-base font-semibold">{t('settingsTitle')}</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-2xl space-y-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <h4 className="text-base font-semibold mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              {t('theme')}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleThemeChange('dark')}
                className={`p-3 rounded-md border-2 transition-all ${
                  theme === 'dark'
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gray-900 rounded-md border border-gray-700"></div>
                  <span className="text-sm font-medium">{t('dark')}</span>
                </div>
              </button>
              <button
                onClick={() => handleThemeChange('light')}
                className={`p-3 rounded-md border-2 transition-all ${
                  theme === 'light'
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-white rounded-md border border-gray-300"></div>
                  <span className="text-sm font-medium">{t('light')}</span>
                </div>
              </button>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-4">
            <h4 className="text-base font-semibold mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
              {t('language')}
            </h4>
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value as 'ko' | 'en')}
              className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="ko">{t('korean')}</option>
              <option value="en">{t('english')}</option>
            </select>
          </div>

          <div className="bg-gray-800 rounded-lg p-4">
            <h4 className="text-base font-semibold mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {t('account')}
            </h4>
            <div className="space-y-3">
              <div className="text-xs text-gray-400">
                {authStatus.loading && t('checkingAuth')}
                {!authStatus.loading && authStatus.error && t('authError')}
                {!authStatus.loading && !authStatus.error && authStatus.loggedIn && (
                  <span>{t('loggedInAs')}{authStatus.user ? `: ${authStatus.user}` : ''}</span>
                )}
                {!authStatus.loading && !authStatus.error && !authStatus.loggedIn && t('loginRequired')}
              </div>
              {authStatus.actionError && (
                <div className="text-xs text-red-400">{authStatus.actionError}</div>
              )}
              <div className="flex items-center gap-2">
                {!authStatus.loggedIn ? (
                  <button
                    onClick={onLogin}
                    disabled={authStatus.actionLoading}
                    className="px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    {t('login')}
                  </button>
                ) : (
                  <button
                    onClick={onLogout}
                    disabled={authStatus.actionLoading}
                    className="px-3 py-2 rounded-md bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    {t('logout')}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-4">
            <h4 className="text-base font-semibold mb-3">{t('about')}</h4>
            <div className="space-y-1.5 text-xs text-gray-400">
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
