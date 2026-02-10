import { useState, useEffect } from 'react';
import { AuthStatus } from '../../../shared/types/auth';

export const useAuth = () => {
  const [authStatus, setAuthStatus] = useState<AuthStatus>({
    loading: true,
    error: null,
    loggedIn: false,
    user: null,
    actionLoading: false,
    actionError: null
  });

  const refreshAuthStatus = async () => {
    setAuthStatus(prev => ({ ...prev, loading: true, error: null }));
    try {
      const status = await window.electronAPI.kiroAuthStatus();
      setAuthStatus(prev => ({
        ...prev,
        loading: false,
        loggedIn: status.loggedIn,
        user: status.user,
        error: null
      }));
    } catch {
      setAuthStatus(prev => ({
        ...prev,
        loading: false,
        loggedIn: false,
        user: null,
        error: 'Auth check failed'
      }));
    }
  };

  const login = async () => {
    setAuthStatus(prev => ({ ...prev, actionLoading: true, actionError: null }));
    const result = await window.electronAPI.kiroLogin();
    if (!result.success) {
      setAuthStatus(prev => ({ ...prev, actionError: result.message || 'Login failed' }));
    }
    await refreshAuthStatus();
    setAuthStatus(prev => ({ ...prev, actionLoading: false }));
  };

  const logout = async () => {
    setAuthStatus(prev => ({ ...prev, actionLoading: true, actionError: null }));
    const result = await window.electronAPI.kiroLogout();
    if (!result.success) {
      setAuthStatus(prev => ({ ...prev, actionError: result.message || 'Logout failed' }));
    }
    await refreshAuthStatus();
    setAuthStatus(prev => ({ ...prev, actionLoading: false }));
  };

  useEffect(() => {
    refreshAuthStatus();
  }, []);

  return { authStatus, login, logout, refreshAuthStatus };
};
