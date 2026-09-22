import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './api';
import type { AxiosError } from 'axios';

interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  isSuperAdmin: boolean;
  emailVerified: boolean;
  createdAt: string;
  memberships: {
    id: string;
    storeId: string;
    role: string;
    isOwner: boolean;
    canManageAll: boolean;
    store: { id: string; name: string; country: string; currency: string; active: boolean };
  }[];
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; fullName: string; phone?: string }) => Promise<void>;
  logout: () => void;
  authError: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('madastock_token'));
  const [authError, setAuthError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: meData, isLoading: meLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await api.get('/auth/me');
      return res.data.user as User;
    },
    enabled: !!token,
    retry: false,
  });

  useEffect(() => {
    if (meData === null || (token && meData === undefined)) {
      if (meLoading) return;
    }
  }, [meData, meLoading, token]);

  const loginMutation = useMutation({
    mutationFn: async (vars: { email: string; password: string }) => {
      setAuthError(null);
      const res = await api.post('/auth/login', vars);
      return res.data as { token: string; user: User };
    },
    onSuccess: (data) => {
      localStorage.setItem('madastock_token', data.token);
      setToken(data.token);
      queryClient.setQueryData(['me'], data.user);
    },
    onError: (err: AxiosError<{ error: string }>) => {
      setAuthError(err.response?.data?.error ?? 'Erreur de connexion');
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (vars: { email: string; password: string; fullName: string; phone?: string }) => {
      setAuthError(null);
      const res = await api.post('/auth/register', vars);
      return res.data as { token: string; user: User };
    },
    onSuccess: (data) => {
      localStorage.setItem('madastock_token', data.token);
      setToken(data.token);
      queryClient.setQueryData(['me'], data.user);
    },
    onError: (err: AxiosError<{ error: string }>) => {
      setAuthError(err.response?.data?.error ?? "Erreur d'inscription");
    },
  });

  const logout = () => {
    localStorage.removeItem('madastock_token');
    setToken(null);
    queryClient.setQueryData(['me'], null);
    queryClient.clear();
  };

  return (
    <AuthContext.Provider
      value={{
        user: meData ?? null,
        token,
        isAuthenticated: !!token && !!meData,
        isLoading: !!token && meLoading,
        login: async (email, password) => { await loginMutation.mutateAsync({ email, password }); },
        register: async (data) => { await registerMutation.mutateAsync(data); },
        logout,
        authError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}