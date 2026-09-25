import { useQuery } from '@tanstack/react-query';
import { Store as StoreIcon, Users, CreditCard, Wallet, Building2, TrendingUp, Receipt, ShieldCheck, CheckCircle2, XCircle } from 'lucide-react';
import api from '../lib/api';
import { formatAr, formatDate, formatNumber } from '../lib/format';
import { Card, EmptyState, Loading, PageHeader, StatCard } from '../components/ui';
import { subscriptionStatusBadge, subscriptionStatusLabels, paymentStatusLabels, paymentStatusBadge } from '../lib/labels';

interface OverviewData {
  stores: { total: number; active: number; inactive: number };
  users: { total: number; active: number; inactive: number };
  subscriptions: { active: number; byStatus: Record<string, number>; mrrAr: number };
  payments: { byStatus: Record<string, number>; totalRevenueAr: number };
  recent: {
    stores: {
      id: string;
      name: string;
      sector: string;
      city: string | null;
      active: boolean;
      createdAt: string;
      subscription: { status: string; plan: { name: string } } | null;
    }[];
    users: { id: string; email: string; fullName: string; isActive: boolean; isSuperAdmin: boolean; createdAt: string }[];
    payments: {
      id: string;
      merchantReference: string;
      amountAr: number;
      status: string;
      currency: string;
      createdAt: string;
      paidAt: string | null;
      store: { name: string };
      plan: { name: string };
    }[];
  };
}

export default function AdminOverview() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: async () => {
      const res = await api.get('/admin/overview');
      return res.data as OverviewData;
    },
  });

  if (error) {
    return <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">Impossible de charger la vue d’ensemble.</div>;
  }

  if (isLoading || !data) {
    return (
      <div>
        <PageHeader title="Administration" subtitle="Vue d’ensemble de la plateforme" />
        <Loading />
      </div>
    );
  }

  const pendingPayments = data.payments.byStatus.PENDING ?? 0;

  return (
    <div>
      <PageHeader title="Administration" subtitle="Vue d’ensemble de la plateforme" />

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 mb-5">
        <StatCard label="Boutiques" value={`${data.stores.active}/${data.stores.total}`} icon={StoreIcon} gradient="from-emerald-500 to-teal-500" sub={`${data.stores.inactive} inactive(s)`} />
        <StatCard label="Utilisateurs" value={formatNumber(data.users.total)} icon={Users} gradient="from-indigo-500 to-violet-500" sub={`${data.users.active} actif(s)`} />
        <StatCard label="Abonnements actifs" value={formatNumber(data.subscriptions.active)} icon={CreditCard} gradient="from-blue-500 to-cyan-500" sub={`${formatNumber(data.subscriptions.byStatus.TRIALING ?? 0)} en essai`} />
        <StatCard label="MRR (mensuel)" value={formatAr(data.subscriptions.mrrAr)} icon={TrendingUp} gradient="from-amber-400 to-orange-500" />
        <StatCard label="Revenus payés" value={formatAr(data.payments.totalRevenueAr)} icon={Wallet} gradient="from-rose-500 to-red-500" sub={`${formatNumber(pendingPayments)} paiement(s) en attente`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-slate-400" />
            <h3 className="font-semibold text-dark-900">Dernières boutiques</h3>
          </div>
          {data.recent.stores.length === 0 ? (
            <EmptyState title="Aucune boutique" />
          ) : (
            <div className="space-y-2.5">
              {data.recent.stores.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-50">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-dark-900 truncate flex items-center gap-1.5">
                      {s.active ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                      {s.name}
                    </p>
                    <p className="text-xs text-slate-400">{s.city ?? s.sector} · créée le {formatDate(s.createdAt)}</p>
                  </div>
                  {s.subscription ? (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${(subscriptionStatusBadge[s.subscription.status] ?? 'bg-slate-100 text-slate-600')}`}>
                      {s.subscription.plan.name} · {subscriptionStatusLabels[s.subscription.status] ?? s.subscription.status}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 shrink-0">Aucun abonnement</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-4 h-4 text-slate-400" />
            <h3 className="font-semibold text-dark-900">Derniers utilisateurs</h3>
          </div>
          {data.recent.users.length === 0 ? (
            <EmptyState title="Aucun utilisateur" />
          ) : (
            <div className="space-y-2.5">
              {data.recent.users.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-50">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-dark-900 truncate">{u.fullName}</p>
                    <p className="text-xs text-slate-400 truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {u.isSuperAdmin && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-600">Superadmin</span>}
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${u.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                      {u.isActive ? 'Actif' : 'Désactivé'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="px-5 pt-5 flex items-center gap-2">
          <Receipt className="w-4 h-4 text-slate-400" />
          <h3 className="font-semibold text-dark-900">Derniers paiements</h3>
        </div>
        {data.recent.payments.length === 0 ? (
          <div className="p-5">
            <EmptyState title="Aucun paiement" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100 bg-slate-50/60">
                  <th className="px-5 py-3 font-medium">Référence</th>
                  <th className="px-4 py-3 font-medium">Boutique</th>
                  <th className="px-4 py-3 font-medium">Offre</th>
                  <th className="px-4 py-3 font-medium text-right">Montant</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{p.merchantReference}</td>
                    <td className="px-4 py-3 font-medium text-dark-900 truncate max-w-[180px]">{p.store.name}</td>
                    <td className="px-4 py-3 text-slate-600">{p.plan.name}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatAr(p.amountAr)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${(paymentStatusBadge[p.status] ?? 'bg-slate-100 text-slate-600')}`}>
                        {paymentStatusLabels[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(p.paidAt ?? p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}