import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Crown,
  CheckCircle2,
  RefreshCw,
  Loader2,
  Clock,
  XCircle,
  ShieldCheck,
  Users,
  Package,
  Warehouse,
  UserCheck,
  BadgeCheck,
  CalendarDays,
  CircleDollarSign,
  ArrowUpRight,
  LifeBuoy,
  Smartphone,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { formatNumber, formatDate } from '../lib/format';
import { Badge, Button, Card, EmptyState, ErrorMessage, Loading, PageHeader, cn } from '../components/ui';

interface Plan {
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

interface Order {
  id: string;
  status: string;
  amountAr: string | number;
  provider: string | null;
  createdAt: string;
  paidAt: string | null;
  plan: Plan;
}

interface SubscriptionState {
  planName: string;
  status: string;
  isLive: boolean;
  isExpired: boolean;
  isTrial: boolean;
  currentPeriodEnd: string;
  daysRemaining: number;
  daysTotal: number;
  remainingPercent: number;
  durationDays: number;
  trialDaysRemaining: number;
}

interface BillingData {
  subscription: {
    id: string;
    status: string;
    trialEndsAt: string | null;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    priceAr: string | number;
    plan: Plan;
  } | null;
  subscriptionState: SubscriptionState | null;
  plans: Plan[];
  orders: Order[];
}

const statusConfig: Record<string, { label: string; badge: string; dot: string; icon: typeof Clock }> = {
  PENDING: {
    label: 'En attente',
    badge: 'bg-amber-50 text-amber-700 ring-amber-200',
    dot: 'bg-amber-500',
    icon: Clock,
  },
  SUCCESS: {
    label: 'Payé',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    dot: 'bg-emerald-500',
    icon: CheckCircle2,
  },
  FAILED: {
    label: 'Échec',
    badge: 'bg-red-50 text-red-700 ring-red-200',
    dot: 'bg-red-500',
    icon: XCircle,
  },
};

const providerConfig: Record<string, { label: string; short: string; cls: string }> = {
  ARIARI: { label: 'Mobile Money (Ariari)', short: 'Ariari', cls: 'bg-slate-100 text-slate-700' },
  MVOLA: { label: 'MVola', short: 'MVola', cls: 'bg-violet-50 text-violet-700' },
  ORANGE_MONEY: { label: 'Orange Money', short: 'Orange Money', cls: 'bg-orange-50 text-orange-700' },
  AIRTEL_MONEY: { label: 'Airtel Money', short: 'Airtel Money', cls: 'bg-red-50 text-red-600' },
};

const planLabel: Record<string, string> = {
  FREE: 'Gratuit',
  STARTER: 'Starter',
  BUSINESS: 'Business',
  PRO: 'Pro',
};

function planFeatures(plan: Plan): { icon: typeof Users; label: string }[] {
  return [
    { icon: Users, label: `${formatNumber(plan.maxUsers)} utilisateur${plan.maxUsers > 1 ? 's' : ''}` },
    { icon: Package, label: `${formatNumber(plan.maxProducts)} produits` },
    { icon: Warehouse, label: `${formatNumber(plan.maxWarehouses)} entrepôt${plan.maxWarehouses > 1 ? 's' : ''}` },
    { icon: UserCheck, label: `${formatNumber(plan.maxCustomers)} clients` },
    {
      icon: CalendarDays,
      label: plan.maxSalesPerMonth == null ? 'Ventes illimitées' : `${formatNumber(plan.maxSalesPerMonth)} ventes / mois`,
    },
  ];
}

export default function Billing() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [isConfirming, setIsConfirming] = useState(false);

  const { data, isLoading, error } = useQuery<BillingData>({
    queryKey: ['billing'],
    queryFn: async () => {
      const res = await api.get('/billing');
      return res.data;
    },
  });

  const currentPlanId = data?.subscription?.plan.id;

  // Confirmation automatique au retour de la page de paiement (redirectSuccess / redirectFailure).
  useEffect(() => {
    const status = searchParams.get('status');
    const ref = searchParams.get('ref');
    if (!ref) return;

    const finalStatus = status === 'success' ? 'SUCCESS' : status === 'failed' ? 'FAILED' : null;

    const poll = async () => {
      setIsConfirming(true);
      if (finalStatus === 'FAILED') {
        toast.error('Paiement annulé ou échoué. Vous pouvez réessayer.');
        setIsConfirming(false);
        return;
      }
      let attempts = 0;
      const timer = setInterval(async () => {
        attempts += 1;
        try {
          const res = await api.get(`/billing/reference/${encodeURIComponent(ref)}/status`);
          const st = res.data.paymentStatus as string;
          if (st === 'SUCCESS') {
            clearInterval(timer);
            setIsConfirming(false);
            toast.success('Paiement confirmé. Votre abonnement est maintenant actif.');
            queryClient.invalidateQueries({ queryKey: ['billing'] });
          } else if (st === 'FAILED') {
            clearInterval(timer);
            setIsConfirming(false);
            toast.error('Paiement échoué. Vous pouvez réessayer.');
          }
        } catch {
          // erreur passagère : on continue à interroger
        }
        if (attempts >= 30) {
          clearInterval(timer);
          setIsConfirming(false);
          toast.info('La confirmation peut prendre quelques instants. Utilisez « Vérifier » pour actualiser.');
        }
      }, 2000);
    };
    void poll();
  }, [searchParams, queryClient]);

  const checkoutMutation = useMutation({
    mutationFn: async (planId: string) => {
      const res = await api.post('/billing/checkout', { planId });
      return res.data as { reference: string; orderId: string; paymentLink: string | null };
    },
    onSuccess: (data) => {
      if (data.paymentLink) {
        toast.info('Redirection vers la page de paiement…');
        window.location.href = data.paymentLink;
      }
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
    onError: () => toast.error('Impossible de créer le paiement. Réessayez plus tard.'),
  });

  const refreshMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await api.post(`/billing/${orderId}/refresh`);
      return res.data as {
        order: { id: string; status: string; url: string | null };
      };
    },
    onSuccess: (data) => {
      if (data.order.status === 'PENDING') {
        if (data.order.url) {
          window.open(data.order.url, '_blank', 'noopener');
          toast.info('Réouverture du lien de paiement.');
        }
      } else if (data.order.status === 'SUCCESS') {
        toast.success('Paiement confirmé, votre offre est activée !');
      } else if (data.order.status === 'FAILED') {
        toast.error('Ce paiement a échoué. Vous pouvez créer une nouvelle commande.');
      }
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
    onError: () => toast.error('Vérification impossible. Réessayez.'),
  });

  const isMutating = checkoutMutation.isPending || refreshMutation.isPending;

  const sub = data?.subscription;
  const state = data?.subscriptionState ?? null;
  const cycleStart = sub ? new Date(sub.currentPeriodStart).getTime() : 0;
  const cycleEnd = sub ? new Date(sub.currentPeriodEnd).getTime() : 0;
  // Le décompte vient du serveur (une seule vérité) : « J-12 ».
  const daysLeft = state?.daysRemaining ?? 0;
  const cyclePct =
    state?.remainingPercent != null
      ? 100 - state.remainingPercent
      : sub && cycleStart < cycleEnd
        ? Math.min(100, Math.max(0, ((Date.now() - cycleStart) / (cycleEnd - cycleStart)) * 100))
        : 0;
  const countdownTone =
    daysLeft <= 1
      ? 'bg-red-50 text-red-700 ring-red-200'
      : daysLeft <= 3
        ? 'bg-amber-50 text-amber-700 ring-amber-200'
        : 'bg-emerald-50 text-emerald-700 ring-emerald-200';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader title="Abonnement" subtitle="Gérez votre offre et vos paiements d'abonnement" />

      {isLoading && <Loading />}
      {!isLoading && error && <ErrorMessage message="Impossible de charger l'abonnement." />}
      {!isLoading && !error && data && (
        <>
          {isConfirming && (
            <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              <Loader2 className="w-4 h-4 animate-spin" />
              Confirmation de votre paiement en cours…
            </div>
          )}

          {/* Offre actuelle */}
          {sub && (
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />
              <div className="p-6 sm:p-7">
                <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                  <div className="flex items-start gap-4">
                    <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                      <Crown className="w-7 h-7" />
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-bold text-dark-900">
                          Offre {planLabel[sub.plan.name] ?? sub.plan.name}
                        </h3>
                        <Badge
                          className={cn(
                            'ring-1',
                            sub.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                              : sub.status === 'TRIALING'
                                ? 'bg-amber-50 text-amber-700 ring-amber-200'
                                : 'bg-red-50 text-red-700 ring-red-200',
                          )}
                        >
                          <span
                            className={cn(
                              'w-1.5 h-1.5 rounded-full',
                              sub.status === 'ACTIVE'
                                ? 'bg-emerald-500'
                                : sub.status === 'TRIALING'
                                  ? 'bg-amber-500'
                                  : 'bg-red-500',
                            )}
                          />
                          {sub.status === 'ACTIVE'
                            ? 'Abonnement actif'
                            : sub.status === 'TRIALING'
                              ? 'Essai gratuit'
                              : sub.status}
                        </Badge>
                      </div>
                      <p className="text-3xl font-extrabold text-dark-900 mt-3">
                        {formatNumber(sub.priceAr)}
                        <span className="text-base font-medium text-slate-500 ml-1.5">Ar / mois</span>
                      </p>
                    </div>
                  </div>

                  <div className="lg:ml-auto flex-1 max-w-sm">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5" />
                        Cycle : {formatDate(sub.currentPeriodStart)} → {formatDate(sub.currentPeriodEnd)}
                      </span>
                      <Badge className={cn('ring-1 font-semibold', countdownTone)}>
                        {daysLeft > 0 ? `J-${daysLeft}` : 'Terminé'}
                      </Badge>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all"
                        style={{ width: `${cyclePct}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5">
                      {sub.status === 'TRIALING'
                        ? sub.trialEndsAt
                          ? `Essai gratuit : encore ${daysLeft} jour(s), fin le ${formatDate(sub.trialEndsAt)}`
                          : 'Période d\'essai en cours'
                        : state?.isExpired
                          ? `Abonnement arrivé à terme le ${formatDate(sub.currentPeriodEnd)}. Vos données sont conservées.`
                          : `${daysLeft} jour(s) restant(s)${state?.daysTotal ? ` sur ${state.daysTotal}` : ''} — chaque paiement ajoute sa durée`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Choix des offres */}
          <section>
            <div className="flex items-end justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-dark-900">Choisir une offre</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Comparez les formules et activez votre abonnement en quelques secondes.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {data.plans.map((plan) => {
                const isCurrent = plan.id === currentPlanId;
                const free = Number(plan.priceAr) <= 0;
                return (
                  <div
                    key={plan.id}
                    className={cn(
                      'relative flex flex-col rounded-2xl border bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg',
                      isCurrent
                        ? 'border-green-500 ring-2 ring-green-500/30 shadow-lg shadow-green-500/10'
                        : 'border-slate-200 shadow-sm',
                    )}
                  >
                    {isCurrent && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-green-600 text-white text-[11px] font-semibold px-3 py-1 shadow">
                        <BadgeCheck className="w-3.5 h-3.5" /> Offre actuelle
                      </span>
                    )}
                    {!isCurrent && free && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-slate-700 text-white text-[11px] font-semibold px-3 py-1 shadow">
                        <Crown className="w-3.5 h-3.5" /> Découverte
                      </span>
                    )}
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-dark-900 text-base">{planLabel[plan.name] ?? plan.name}</h3>
                    </div>
                    <p className="text-sm text-slate-500 mt-2 min-h-[52px] leading-relaxed">{plan.description}</p>
                    <p className="mt-4 text-2xl font-extrabold text-dark-900">
                      {formatNumber(plan.priceAr)}
                      <span className="text-sm font-medium text-slate-500"> Ar / mois</span>
                    </p>

                    <ul className="mt-4 space-y-2 text-[13px] text-slate-600">
                      {planFeatures(plan).map((f, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                            <f.icon className="w-3 h-3" />
                          </span>
                          {f.label}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-5 pt-4 border-t border-slate-100 w-full">
                      <Button
                        className="w-full"
                        variant={isCurrent ? 'outline' : 'primary'}
                        disabled={isCurrent || free || isMutating || isConfirming}
                        onClick={() => checkoutMutation.mutate(plan.id)}
                      >
                        {isCurrent ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" /> Offre actuelle
                          </>
                        ) : free ? (
                          'Découvrir'
                        ) : sub && Number(plan.priceAr) > Number(sub.priceAr) ? (
                          <>
                            Passer à {planLabel[plan.name] ?? plan.name} <ArrowUpRight className="w-4 h-4" />
                          </>
                        ) : (
                          <>
                            S'abonner à {planLabel[plan.name] ?? plan.name}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Paiement */}
          <section>
            <Card className="p-5 sm:p-6 bg-gradient-to-br from-slate-50 to-white">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </span>
                <div className="flex-1">
                  <h3 className="font-semibold text-dark-900">Paiement sécurisé</h3>
                  <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">
                    Vous serez redirigé vers la page de paiement sécurisée. Dès que le paiement est validé, votre
                    abonnement est activé automatiquement.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { label: 'MVola', cls: 'bg-violet-100 text-violet-700' },
                    { label: 'Orange Money', cls: 'bg-orange-100 text-orange-700' },
                    { label: 'Airtel Money', cls: 'bg-red-100 text-red-600' },
                  ].map((m) => (
                    <span
                      key={m.label}
                      className={cn(
                        'inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-1.5',
                        m.cls,
                      )}
                    >
                      <Smartphone className="w-3.5 h-3.5" /> {m.label}
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          </section>

          {/* Historique des paiements */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-dark-900">Historique des paiements</h2>
              {data.orders.length > 0 && (
                <Badge className="bg-slate-100 text-slate-600">{data.orders.length} transaction{data.orders.length > 1 ? 's' : ''}</Badge>
              )}
            </div>
            {data.orders.length === 0 ? (
              <Card>
                <EmptyState
                  title="Aucun paiement"
                  description="Vos commandes d'abonnement apparaîtront ici."
                />
              </Card>
            ) : (
              <Card className="divide-y divide-slate-100">
                {data.orders.map((order) => {
                  const cfg = statusConfig[order.status] ?? {
                    label: order.status,
                    badge: 'bg-slate-100 text-slate-600 ring-slate-200',
                    dot: 'bg-slate-400',
                    icon: CircleDollarSign,
                  };
                  const Icon = cfg.icon;
                  const prov = order.provider ? providerConfig[order.provider] : null;
                  return (
                    <div key={order.id} className="px-5 py-4 flex flex-wrap items-center gap-3">
                      <span className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                        <Icon className="w-5 h-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-dark-900 truncate">
                          Abonnement {planLabel[order.plan.name] ?? order.plan.name}
                          <span className="text-slate-400 font-medium ml-2">{formatNumber(order.amountAr)} Ar</span>
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                          {formatDate(order.createdAt)}
                          {order.paidAt && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span className="inline-flex items-center gap-1 text-emerald-600">
                                <CheckCircle2 className="w-3 h-3" /> Payé le {formatDate(order.paidAt)}
                              </span>
                            </>
                          )}
                          {prov && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium', prov.cls)}>
                                {prov.label}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                      {order.status === 'PENDING' ? (
                        <div className="flex items-center gap-2">
                          <Badge className={cn('ring-1', cfg.badge)}>
                            <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
                            {cfg.label}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refreshMutation.mutate(order.id)}
                            disabled={isMutating}
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> Vérifier
                          </Button>
                        </div>
                      ) : (
                        <Badge className={cn('ring-1', cfg.badge)}>
                          <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
                          {cfg.label}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </Card>
            )}
            {data.orders.some((o) => o.status === 'PENDING') && (
              <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Paiement pas encore reçu ? Vérifiez votre téléphone puis cliquez sur « Vérifier ».
              </p>
            )}
          </section>

          {/* Aide */}
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-5 py-4">
              <LifeBuoy className="w-5 h-5 text-slate-400 shrink-0" />
              <p className="text-sm text-slate-600 leading-relaxed">
                Une question sur votre abonnement ou un paiement ? Notre équipe vous répond sous 24 h.
              </p>
              <a
                href="mailto:madaorganisation@gmail.com?subject=Question%20sur%20mon%20abonnement"
                className="sm:ml-auto text-sm font-semibold text-green-700 hover:text-green-800 inline-flex items-center gap-1"
              >
                Nous contacter <ArrowUpRight className="w-4 h-4" />
              </a>
            </div>
          </section>
        </>
      )}
    </div>
  );
}