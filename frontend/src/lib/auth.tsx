import { createContext, useContext, useState, type ReactNode } from 'react';
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

type AuthResponse =
  | { requiresVerification: true; email: string }
  | { token: string; user: User };

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  pendingVerifyEmail: string | null;
  needsVerification: boolean;
  login: (email: string, password: string) => Promise<{ requiresVerification: boolean }>;
  register: (data: { email: string; password: string; fullName: string; phone?: string }) => Promise<{ requiresVerification: boolean }>;
  verifyEmail: (code: string) => Promise<void>;
  resendCode: () => Promise<void>;
  logout: () => void;
  authError: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('madastock_token'));
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState<string | null>(null);
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

  const applyAuth = (data: { token: string; user: User }) => {
    localStorage.setItem('madastock_token', data.token);
    setToken(data.token);
    setPendingVerifyEmail(null);
    queryClient.setQueryData(['me'], data.user);
  };

  const loginMutation = useMutation({
    mutationFn: async (vars: { email: string; password: string }) => {
      setAuthError(null);
      const res = await api.post('/auth/login', vars);
      return res.data as AuthResponse;
    },
    onSuccess: (data) => {
      setAuthError(null);
      if ('requiresVerification' in data) {
        setPendingVerifyEmail(data.email);
        return;
      }
      applyAuth(data);
    },
    onError: (err: AxiosError<{ error: string }>) => {
      setAuthError(err.response?.data?.error ?? 'Erreur de connexion');
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (vars: { email: string; password: string; fullName: string; phone?: string }) => {
      setAuthError(null);
      const res = await api.post('/auth/register', vars);
      return res.data as AuthResponse;
    },
    onSuccess: (data) => {
      setAuthError(null);
      if ('requiresVerification' in data) {
        setPendingVerifyEmail(data.email);
        return;
      }
      applyAuth(data);
    },
    onError: (err: AxiosError<{ error: string }>) => {
      setAuthError(err.response?.data?.error ?? "Erreur d'inscription");
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await api.post('/auth/verify-email', { email: pendingVerifyEmail, code });
      return res.data as { token: string; user: User };
    },
    onSuccess: (data) => {
      applyAuth(data);
    },
  });

  const resendMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/auth/resend-code', { email: pendingVerifyEmail });
      return res.data;
    },
  });

  const logout = () => {
    localStorage.removeItem('madastock_token');
    setToken(null);
    setPendingVerifyEmail(null);
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
        pendingVerifyEmail,
        needsVerification: !!pendingVerifyEmail,
        login: async (email, password) => {
          const data = await loginMutation.mutateAsync({ email, password });
          return { requiresVerification: 'requiresVerification' in data };
        },
        register: async (data) => {
          const res = await registerMutation.mutateAsync(data);
          return { requiresVerification: 'requiresVerification' in res };
        },
        verifyEmail: async (code) => {
          await verifyMutation.mutateAsync(code);
        },
        resendCode: async () => {
          await resendMutation.mutateAsync();
        },
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
