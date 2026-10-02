import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStores } from './store';
import { useAuth } from './auth';
import api from './api';

export interface PlanSummary {
  id: string;
  name: string;
  description: string;
  priceAr: string | number;
  billingCycle: string;
  maxUsers: number;
  maxProducts: number;
  maxWarehouses: number;
  maxCustomers: number;
  maxSalesPerMonth: number | null;
  featuresJson: string;
}

export interface SubscriptionState {
  id: string;
  storeId: string;
  planId: string;
  planName: string;
  status: string;
  billingExempt?: boolean;
  /** Offre gratuite (0 Ar) : accès permanent, aucun compte à rebours. */
  isFreePlan?: boolean;
  isExpired: boolean;
  isLive: boolean;
  isTrial: boolean;
  currentPeriodEnd: string;
  daysRemaining: number;
  daysTotal: number;
  remainingPercent: number;
  trialDaysRemaining: number;
  durationDays: number;
  /** Fonctionnalités incluses dans la formule actuelle. */
  features: Record<string, boolean>;
}

export interface OrderSummary {
  id: string;
  status: string;
  amountAr: string | number;
  provider: string | null;
  createdAt: string;
  paidAt: string | null;
  /** true si le paiement est PENDING depuis plus de 20 min (aucune relance auto). */
  isStale?: boolean;
  plan: PlanSummary;
}

export interface BillingData {
  billingExempt?: boolean;
  /** Montant minimum accepté par le prestataire de paiement. */
  minPaymentAr?: number;
  subscription: {
    id: string;
    status: string;
    trialEndsAt: string | null;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    priceAr: string | number;
    plan: PlanSummary;
  } | null;
  subscriptionState: SubscriptionState | null;
  plans: PlanSummary[];
  orders: OrderSummary[];
}

type SubscriptionContextValue = {
  isLoading: boolean;
  error: unknown;
  billingExempt: boolean;
  /** Super administrateur MadaStock : jamais soumis à l'abonnement. */
  platformAdmin: boolean;
  /** Boutique expirée (ou annulée) et non exemptée : fonctionnalités verrouillées. */
  isLocked: boolean;
  isExpired: boolean;
  state: SubscriptionState | null;
  data: BillingData | undefined;
  planName: string | null;
  /** true si la fonctionnalité est incluse dans la formule (ou boutique interne). */
  can: (feature: string) => boolean;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { currentStore } = useStores();
  const { isAuthenticated, user } = useAuth();

  const { data, isLoading, error } = useQuery<BillingData>({
    // Même clé que la page Abonnement : un seul fetch par boutique.
    queryKey: ['billing', currentStore?.id],
    queryFn: async () => (await api.get('/billing')).data,
    // Ne pas appeler /billing hors connexion : sinon 401 sur les pages
    // publiques pour un visiteur ayant un store id résiduel.
    enabled: isAuthenticated && !!currentStore?.id,
    staleTime: 60_000,
    retry: 1,
  });

  const state = data?.subscriptionState ?? null;
  const billingExempt = data?.billingExempt ?? state?.billingExempt ?? false;
  const platformAdmin = !!user?.isSuperAdmin;
  const isExpired = !!state?.isExpired && !billingExempt && !platformAdmin;
  // Pas d'abonnement (state null) : on ne verrouille jamais, pour ne pas
  // piéger une boutique en sortie d'erreur de configuration.
  const isLocked = !billingExempt && !platformAdmin && !!state && !state.isLive;

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      isLoading,
      error,
      billingExempt,
      platformAdmin,
      isLocked,
      isExpired,
      state,
      data,
      planName: state?.planName ?? null,
      can: (feature: string) => billingExempt || platformAdmin || !!state?.features?.[feature],
    }),
    [isLoading, error, billingExempt, platformAdmin, isLocked, isExpired, state, data],
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
}