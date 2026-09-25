import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Save } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { formatAr, formatDate } from '../lib/format';
import { subscriptionStatusBadge, subscriptionStatusLabels } from '../lib/labels';
import { apiError, type Paginated } from '../lib/admin';
import { Badge, Button, Card, EmptyState, ErrorMessage, Field, Loading, Modal, PageHeader, Select } from '../components/ui';
import type { PublicPlan } from '../lib/plans';

const ALL_STATUSES = ['', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED'];

interface SubscriptionRow {
  id: string;
  status: string;
  priceAr: number;
  billingCycle: string;
  autoRenew: boolean;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt: string | null;
  createdAt: string;
  store: { id: string; name: string; active: boolean };
  plan: { id: string; name: string; priceAr: number };
}

export default function AdminSubscriptions() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<SubscriptionRow | null>(null);
  const [form, setForm] = useState({ status: '', planId: '', autoRenew: true });

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'subscriptions', status, page],
    queryFn: async () => {
      const res = await api.get('/admin/subscriptions', {
        params: { page, pageSize: 15, status: status || undefined },
      });
      return res.data as Paginated<SubscriptionRow>;
    },
  });

  const { data: plans } = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: async () => {
      const res = await api.get('/public/plans');
      return res.data as PublicPlan[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; status?: string; planId?: string; autoRenew?: boolean }) => {
      const res = await api.patch(`/admin/subscriptions/${payload.id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Abonnement mis à jour');
      queryClient.invalidateQueries({ queryKey: ['admin', 'subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] });
      setEditing(null);
    },
    onError: (err: unknown) => toast.error(apiError(err)),
  });

  const openEdit = (s: SubscriptionRow) => {
    setEditing(s);
    setForm({ status: s.status, planId: s.plan.id, autoRenew: s.autoRenew });
  };

  const save = () => {
    if (!editing) return;
    const payload: { id: string; status?: string; planId?: string; autoRenew?: boolean } = { id: editing.id };
    if (form.status !== editing.status) payload.status = form.status;
    if (form.planId !== editing.plan.id) payload.planId = form.planId;
    if (form.autoRenew !== editing.autoRenew) payload.autoRenew = form.autoRenew;
    if (Object.keys(payload).length === 1) {
      setEditing(null);
      return;
    }
    updateMutation.mutate(payload);
  };

  return (
    <div>
      <PageHeader title="Abonnements" subtitle={`${data?.total ?? 0} abonnement(s)`} />

      <Card className="mb-4 p-4">
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="sm:w-56">
          <option value="">Tous les statuts</option>
          {ALL_STATUSES.slice(1).map((s) => (
            <option key={s} value={s}>{subscriptionStatusLabels[s] ?? s}</option>
          ))}
        </Select>
      </Card>

      {error ? (
        <ErrorMessage message={apiError(error, 'Erreur de chargement')} />
      ) : isLoading ? (
        <Loading />
      ) : !data || data.items.length === 0 ? (
        <Card>
          <EmptyState title="Aucun abonnement" description="Aucun abonnement ne correspond à ce filtre." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100 bg-slate-50/60">
                  <th className="px-4 py-3 font-medium">Boutique</th>
                  <th className="px-4 py-3 font-medium">Offre</th>
                  <th className="px-4 py-3 font-medium text-right">Prix</th>
                  <th className="px-4 py-3 font-medium">Période</th>
                  <th className="px-4 py-3 font-medium">Renouvellement</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((s) => (
                  <tr key={s.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-dark-900 truncate max-w-[180px]">{s.store.name}</p>
                      <p className="text-xs text-slate-400">depuis le {formatDate(s.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{s.plan.name}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatAr(s.priceAr)}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {formatDate(s.currentPeriodStart)} → {formatDate(s.currentPeriodEnd)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{s.autoRenew ? 'Automatique' : 'Manuel'}</td>
                    <td className="px-4 py-3">
                      <Badge className={(subscriptionStatusBadge[s.status] ?? 'bg-slate-100 text-slate-600')}>
                        {subscriptionStatusLabels[s.status] ?? s.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => openEdit(s)}>
                        <CreditCard className="w-3.5 h-3.5" />
                        Gérer
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm">
              <span className="text-slate-500">Page {data.page} sur {data.totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédent</Button>
                <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>Suivant</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Gérer l'abonnement"
        description={editing ? `${editing.store.name} · ${editing.plan.name}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
            <Button onClick={save} disabled={updateMutation.isPending}>
              <Save className="w-4 h-4" />
              Enregistrer
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Statut">
            <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              {ALL_STATUSES.slice(1).map((s) => (
                <option key={s} value={s}>{subscriptionStatusLabels[s] ?? s}</option>
              ))}
            </Select>
          </Field>
          <Field label="Offre">
            <Select value={form.planId} onChange={(e) => setForm((f) => ({ ...f, planId: e.target.value }))}>
              {(plans ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {formatAr(p.priceAr)}</option>
              ))}
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.autoRenew}
              onChange={(e) => setForm((f) => ({ ...f, autoRenew: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
            />
            Renouvellement automatique
          </label>
        </div>
      </Modal>
    </div>
  );
}