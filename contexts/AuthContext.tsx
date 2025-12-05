import React, { createContext, useContext, useEffect, useState } from 'react';
import { authService } from '../services/auth';
import { User, UserPreferences } from '../types';

interface AuthContextType {
  user: User | null;
  preferences: UserPreferences | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  register: (email: string, password: string, name: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<{ success: boolean; message: string }>;
  refreshPreferences: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
      if (currentUser) {
        const prefs = await authService.getUserPreferences(currentUser.id);
        setPreferences(prefs);
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const result = await authService.login(email, password);
    if (result.success && result.user) {
      // Fetch preferences BEFORE setting user to prevent race condition in _layout
      const prefs = await authService.getUserPreferences(result.user.id);
      setPreferences(prefs);
      setUser(result.user);
    }
    return { success: result.success, message: result.message };
  };

  const register = async (email: string, password: string, name: string) => {
    const result = await authService.register(email, password, name);
    if (result.success && result.user) {
      setUser(result.user);
      // New users won't have preferences yet
      setPreferences(null);
    }
    return { success: result.success, message: result.message };
  };

  const logout = async () => {
    console.log('[AuthContext] Logging out user');
    await authService.logout();
    setUser(null);
    setPreferences(null);
    console.log('[AuthContext] User logged out, state cleared');
  };

  const updateUser = async (userData: Partial<User>) => {
    const result = await authService.updateUser(userData);
    if (result.success) {
      const updatedUser = await authService.getCurrentUser();
      setUser(updatedUser);
    }
    return result;
  };

  const refreshPreferences = async () => {
    if (user) {
      console.log('[AuthContext] Refreshing preferences for user:', user.id);
      const prefs = await authService.getUserPreferences(user.id);
      console.log('[AuthContext] Fetched preferences:', {
        subscribedServices: prefs?.subscribed_services || [],
      });
      setPreferences(prefs);
      console.log('[AuthContext] Preferences state updated');
    }
  };

  const value: AuthContextType = {
    user,
    preferences,
    loading,
    login,
    register,
    logout,
    updateUser,
    refreshPreferences,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};