import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Crown, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { formatNumber, formatDate } from '../lib/format';
import { Badge, Button, Card, EmptyState, ErrorMessage, Loading, PageHeader } from '../components/ui';

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
  plans: Plan[];
  orders: {
    id: string;
    status: string;
    amountAr: string | number;
    createdAt: string;
    paidAt: string | null;
    plan: Plan;
  }[];
}

const badge: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700',
  INCOMPLETE: 'bg-blue-50 text-blue-700',
  PAID: 'bg-emerald-50 text-emerald-700',
  FAILED: 'bg-red-50 text-red-700',
};

const statusLabel: Record<string, string> = {
  PENDING: 'En attente',
  INCOMPLETE: 'Paiement partiel',
  PAID: 'Payé',
  FAILED: 'Échec',
};

export default function Billing() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const { data, isLoading, error } = useQuery<BillingData>({
    queryKey: ['billing'],
    queryFn: async () => {
      const res = await api.get('/billing');
      return res.data;
    },
  });

  const currentPlanId = data?.subscription?.plan.id;

  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'success') toast.success('Paiement effectué, votre offre est activée !');
    if (status === 'failed') toast.error('Paiement annulé ou échoué. Vous pouvez réessayer.');
  }, [searchParams]);

  const checkoutMutation = useMutation({
    mutationFn: async (planId: string) => {
      const res = await api.post('/billing/checkout', { planId });
      return res.data as { orderId: string; url: string | null };
    },
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, '_blank', 'noopener');
        toast.info('Page de paiement ouverte dans un nouvel onglet.');
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
      if (data.order.status === 'PENDING' || data.order.status === 'INCOMPLETE') {
        if (data.order.url) {
          window.open(data.order.url, '_blank', 'noopener');
          toast.info('Page de paiement (lien à jour) ouverte. Si elle ne se charge pas, réessayez.');
        }
      } else if (data.order.status === 'PAID') {
        toast.success('Paiement confirmé, votre offre est activée !');
      }
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
    onError: () => toast.error('Vérification impossible. Réessayez.'),
  });

  const isMutating = checkoutMutation.isPending || refreshMutation.isPending;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader title="Abonnement" subtitle="Gérez votre offre et votre paiement" />

      {isLoading && <Loading />}
      {!isLoading && error && <ErrorMessage message="Impossible de charger l'abonnement." />}
      {!isLoading && !error && data && (
        <>
          {data.subscription && (
            <Card>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center">
                    <Crown className="w-5 h-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-dark-900">Offre {data.subscription.plan.name}</p>
                    <p className="text-sm text-slate-500">
                      {formatNumber(data.subscription.priceAr)} Ar / mois
                    </p>
                  </div>
                </div>
                <Badge
                  className={
                    data.subscription.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-700'
                      : data.subscription.status === 'TRIALING'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-red-50 text-red-700'
                  }
                >
                  {data.subscription.status === 'ACTIVE'
                    ? 'Actif'
                    : data.subscription.status === 'TRIALING'
                      ? 'Essai gratuit'
                      : data.subscription.status}
                </Badge>
                <div className="ml-auto text-sm text-slate-500">
                  <p>
                    Cycle : {formatDate(data.subscription.currentPeriodStart)} →{' '}
                    {formatDate(data.subscription.currentPeriodEnd)}
                  </p>
                  {data.subscription.trialEndsAt && (
                    <p>Fin de l'essai : {formatDate(data.subscription.trialEndsAt)}</p>
                  )}
                </div>
              </div>
            </Card>
          )}

          <section>
            <h2 className="text-base font-bold text-dark-900 mb-3">Choisir une offre</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.plans.map((plan) => {
                const isCurrent = plan.id === currentPlanId;
                const free = Number(plan.priceAr) <= 0;
                return (
                  <Card key={plan.id}>
                    <p className="font-semibold text-dark-900">{plan.name}</p>
                    <p className="text-sm text-slate-500 mt-0.5 min-h-[40px]">{plan.description}</p>
                    <p className="mt-3 text-2xl font-bold text-dark-900">
                      {formatNumber(plan.priceAr)} <span className="text-sm font-medium text-slate-500">Ar / mois</span>
                    </p>
                    <div className="mt-4">
                      <Button
                        disabled={isCurrent || free || isMutating}
                        onClick={() => checkoutMutation.mutate(plan.id)}
                      >
                        {isCurrent
                          ? 'Offre actuelle'
                          : free
                            ? 'Gratuit'
                            : `S'abonner à ${plan.name}`}
                      </Button>
                    </div>
                    {isCurrent && (
                      <p className="mt-2 text-xs text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Vous êtes ici
                      </p>
                    )}
                  </Card>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Paiement sécurisé via ariary.mg (MVola, Orange Money, Airtel Money). Après paiement, votre boutique
              sera mise à jour automatiquement.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-dark-900 mb-3">Historique des paiements</h2>
            {data.orders.length === 0 ? (
              <EmptyState
                title="Aucun paiement"
                description="Vos commandes d'abonnement apparaîtront ici."
              />
            ) : (
              <Card>
                <div className="divide-y divide-slate-100">
                  {data.orders.map((order) => (
                    <div key={order.id} className="py-3 flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-dark-900 truncate">
                          {order.plan.name} — {formatNumber(order.amountAr)} Ar
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDate(order.createdAt)}
                          {order.paidAt && ` · Payé le ${formatDate(order.paidAt)}`}
                        </p>
                      </div>
                      <Badge className={badge[order.status] ?? 'bg-slate-100 text-slate-600'}>
                        {statusLabel[order.status] ?? order.status}
                      </Badge>
                      {(order.status === 'PENDING' || order.status === 'INCOMPLETE') && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refreshMutation.mutate(order.id)}
                            disabled={isMutating}
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> Vérifier
                          </Button>
                          <p className="text-[11px] text-slate-400">
                            Le lien expire : « Vérifier » en génère un à jour.
                          </p>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </section>
        </>
      )}
    </div>
  );
}