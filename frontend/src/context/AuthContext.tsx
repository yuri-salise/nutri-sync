import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  role: UserRole;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  quickLoginAthlete: () => Promise<void>;
  quickLoginAdmin: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('nutrisync_token'));
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = async () => {
    try {
      const profile = await api.getCurrentUser();
      setUser(profile);
    } catch (err) {
      console.warn('Session expired or unauthenticated, logging out.');
      localStorage.removeItem('nutrisync_token');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await api.login({ email, password });
      localStorage.setItem('nutrisync_token', res.access_token);
      setToken(res.access_token);
      const profile = await api.getCurrentUser();
      setUser(profile);
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: any) => {
    setLoading(true);
    try {
      await api.register(data);
      await login(data.email, data.password);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('nutrisync_token');
    setToken(null);
    setUser(null);
  };

  const quickLoginAthlete = async () => {
    await login('athlete@nutrisync.com', 'Password123!');
  };

  const quickLoginAdmin = async () => {
    await login('admin@nutrisync.com', 'Password123!');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: (user?.role as UserRole) || 'athlete',
        token,
        loading,
        login,
        register,
        logout,
        quickLoginAthlete,
        quickLoginAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
