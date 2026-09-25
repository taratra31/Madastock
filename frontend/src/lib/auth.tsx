import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
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
  | { token?: string; user: User };

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  pendingVerifyEmail: string | null;
  needsVerification: boolean;
  login: (identifier: string, password: string) => Promise<{ requiresVerification: boolean }>;
  register: (data: { email: string; password: string; fullName: string; phone?: string }) => Promise<{ requiresVerification: boolean }>;
  verifyEmail: (code: string) => Promise<void>;
  resendCode: () => Promise<void>;
  logout: () => void;
  authError: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  // Passe à false quand la session est morte : empêche la requête `me` de
  // repartir en boucle sur une session invalide.
  const [sessionActive, setSessionActive] = useState(true);
  const queryClient = useQueryClient();

  const { data: meData, isLoading: meLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await api.get('/auth/me');
      return res.data.user as User;
    },
    retry: false,
    enabled: sessionActive,
  });

  useEffect(() => {
    const onExpired = () => {
      setSessionActive(false);
      setPendingVerifyEmail(null);
      setAuthError(null);
      queryClient.clear();
      queryClient.setQueryData(['me'], null);
    };
    window.addEventListener('madastock:session-expired', onExpired);
    return () => window.removeEventListener('madastock:session-expired', onExpired);
  }, [queryClient]);

  const applyAuth = useCallback(
    (user: User) => {
      setSessionActive(true);
      setPendingVerifyEmail(null);
      queryClient.setQueryData(['me'], user);
    },
    [queryClient],
  );

  const loginMutation = useMutation({
    mutationFn: async (vars: { identifier: string; password: string }) => {
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
      applyAuth(data.user);
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
      applyAuth(data.user);
    },
    onError: (err: AxiosError<{ error: string }>) => {
      setAuthError(err.response?.data?.error ?? "Erreur d'inscription");
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await api.post('/auth/verify-email', { email: pendingVerifyEmail, code });
      return res.data as { user: User };
    },
    onSuccess: (data) => {
      applyAuth(data.user);
    },
  });

  const resendMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/auth/resend-code', { email: pendingVerifyEmail });
      return res.data;
    },
  });

  const logout = () => {
    api.post('/auth/logout').catch(() => undefined);
    setPendingVerifyEmail(null);
    setSessionActive(false);
    queryClient.clear();
    queryClient.setQueryData(['me'], null);
    localStorage.removeItem('madastock_token');
    localStorage.removeItem('madastock_store_id');
  };

  return (
    <AuthContext.Provider
      value={{
        user: meData ?? null,
        isAuthenticated: !!meData,
        isLoading: meLoading,
        pendingVerifyEmail,
        needsVerification: !!pendingVerifyEmail,
        login: async (identifier, password) => {
          const data = await loginMutation.mutateAsync({ identifier, password });
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