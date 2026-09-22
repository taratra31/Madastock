import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, CheckCircle2, Users, Target, TrendingUp, Star } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { formatAr, formatNumber, formatDate, toDateTimeInput } from '../lib/format';
import {
  Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, Loading, Modal, PageHeader, SearchInput, Select, Textarea, StatCard, ErrorMessage,
} from '../components/ui';

interface LeadSerialized {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  source: 'REFERRAL' | 'WALK_IN' | 'ONLINE' | 'PHONE' | 'SOCIAL_MEDIA' | 'OTHER';
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'FOLLOW_UP' | 'WON' | 'LOST';
  valueAr: number | null;
  notes: string | null;
  nextFollowUpAt: string | null;
  firstContactAt: string | null;
  lastContactAt: string | null;
  createdAt: string;
  assignedTo: { id: string; fullName: string } | null;
  convertedCustomer: { id: string; firstName: string; lastName: string } | null;
}

interface LeadForm {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  source: string;
  status: string;
  valueAr: string;
  nextFollowUpAt: string;
  notes: string;
}

const emptyForm: LeadForm = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  source: 'WALK_IN',
  status: 'NEW',
  valueAr: '',
  nextFollowUpAt: '',
  notes: '',
};

const leadStatusLabels: Record<string, string> = {
  NEW: 'Nouveau',
  CONTACTED: 'Contacté',
  QUALIFIED: 'Qualifié',
  FOLLOW_UP: 'À relancer',
  WON: 'Gagné',
  LOST: 'Perdu',
};

const leadStatusCls: Record<string, string> = {
  NEW: 'bg-blue-50 text-blue-700',
  CONTACTED: 'bg-amber-50 text-amber-700',
  QUALIFIED: 'bg-violet-50 text-violet-700',
  FOLLOW_UP: 'bg-sky-50 text-sky-700',
  WON: 'bg-green-50 text-green-700',
  LOST: 'bg-red-50 text-red-600',
};

const leadSourceLabels: Record<string, string> = {
  REFERRAL: 'Parrainage',
  WALK_IN: 'Passage en boutique',
  ONLINE: 'En ligne',
  PHONE: 'Téléphone',
  SOCIAL_MEDIA: 'Réseaux sociaux',
  OTHER: 'Autre',
};

const statusOrder: string[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'FOLLOW_UP', 'WON', 'LOST'];

export default function Leads() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LeadSerialized | null>(null);
  const [form, setForm] = useState<LeadForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<LeadSerialized | null>(null);

  const { data: funnel } = useQuery({
    queryKey: ['leads-funnel'],
    queryFn: async () => {
      const res = await api.get('/leads/funnel');
      return res.data as { total: number; stats: Record<string, number> };
    },
  });

  const { data: leads, isLoading, error } = useQuery({
    queryKey: ['leads', search, statusFilter, page],
    queryFn: async () => {
      const res = await api.get('/leads', {
        params: {
          page,
          limit: 20,
          status: statusFilter || undefined,
          search: search || undefined,
        },
      });
      return res.data as { data: LeadSerialized[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: LeadForm) => {
      const res = await api.post('/leads', {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone || undefined,
        email: data.email || undefined,
        source: data.source,
        status: data.status,
        valueAr: data.valueAr ? Number(data.valueAr) : undefined,
        nextFollowUpAt: data.nextFollowUpAt ? new Date(data.nextFollowUpAt).toISOString() : undefined,
        notes: data.notes || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Prospect ajouté');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads-funnel'] });
      setModalOpen(false);
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: LeadForm }) => {
      const res = await api.put(`/leads/${id}`, {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone || undefined,
        email: data.email || undefined,
        source: data.source,
        status: data.status,
        valueAr: data.valueAr ? Number(data.valueAr) : undefined,
        nextFollowUpAt: data.nextFollowUpAt ? new Date(data.nextFollowUpAt).toISOString() : undefined,
        notes: data.notes || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Prospect mis à jour');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads-funnel'] });
      setModalOpen(false);
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/leads/${id}`),
    onSuccess: () => {
      toast.success('Prospect supprimé');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads-funnel'] });
      setDeleteTarget(null);
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur'),
  });

  const convertMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/leads/${id}/convert`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Prospect converti en client');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads-funnel'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur'),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (lead: LeadSerialized) => {
    setEditing(lead);
    setForm({
      firstName: lead.firstName,
      lastName: lead.lastName,
      phone: lead.phone ?? '',
      email: lead.email ?? '',
      source: lead.source,
      status: lead.status,
      valueAr: lead.valueAr != null ? String(lead.valueAr) : '',
      nextFollowUpAt: toDateTimeInput(lead.nextFollowUpAt),
      notes: lead.notes ?? '',
    });
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const set = (key: keyof LeadForm, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const openLeads = [...statusOrder.slice(0, 4)];
  const openCount = openLeads.reduce((s, k) => s + (funnel?.stats[k] ?? 0), 0);
  const wonCount = funnel?.stats.WON ?? 0;
  const conversionRate =
    funnel?.total && funnel.total > 0 ? Math.round((wonCount / funnel.total) * 100) : 0;

  return (
    <div>
      <PageHeader
        title="Prospects"
        subtitle="Pipeline commercial : nouveaux clients potentiels"
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Nouveau prospect
          </Button>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <StatCard label="Prospects" value={formatNumber(funnel?.total ?? 0)} icon={Users} gradient="from-emerald-500 to-teal-500" />
        <StatCard label="En cours" value={formatNumber(openCount)} icon={Target} gradient="from-sky-500 to-blue-500" sub="nouveau à à relancer" />
        <StatCard label="Gagnés" value={formatNumber(wonCount)} icon={TrendingUp} gradient="from-green-500 to-emerald-600" />
        <StatCard label="Conversion" value={`${conversionRate} %`} icon={Star} gradient="from-violet-500 to-purple-500" />
      </div>

      {funnel && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          <button
            onClick={() => { setStatusFilter(''); setPage(1); }}
            className={`rounded-2xl border px-4 py-3 text-left transition-all relative overflow-hidden ${
              statusFilter === ''
                ? 'border-transparent ring-2 ring-emerald-500 bg-gradient-to-br from-emerald-50 to-teal-50'
                : 'border-slate-200 bg-white hover:bg-slate-50 hover:shadow-sm'
            }`}
          >
            <p className="text-xs text-slate-500">Tous</p>
            <p className="text-xl font-bold text-dark-900">{funnel.total}</p>
          </button>
          {statusOrder.map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s === statusFilter ? '' : s); setPage(1); }}
              className={`rounded-2xl border px-4 py-3 text-left transition-all relative overflow-hidden ${
                statusFilter === s
                  ? 'border-transparent ring-2 ring-emerald-500 bg-gradient-to-br from-emerald-50 to-teal-50'
                  : 'border-slate-200 bg-white hover:bg-slate-50 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`inline-block w-2 h-2 rounded-full ${leadStatusCls[s]?.split(' ')[0] ?? 'bg-slate-300'}`} />
                <p className="text-xs text-slate-500 truncate">{leadStatusLabels[s]}</p>
              </div>
              <p className="text-xl font-bold text-dark-900">{funnel.stats[s] ?? 0}</p>
            </button>
          ))}
        </div>
      )}

      <Card className="mb-4 p-4">
        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setPage(1); }}
            placeholder="Rechercher un prospect (nom, téléphone, email)..."
          />
        </div>
      </Card>

      {error ? (
        <ErrorMessage message={(error as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur de chargement'} />
      ) : isLoading ? (
        <Loading />
      ) : !leads || leads.data.length === 0 ? (
        <Card>
          <EmptyState title="Aucun prospect" description="Ajoutez votre premier prospect." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100 bg-slate-50/60">
                  <th className="px-4 py-3 font-medium">Prospect</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium text-right">Valeur</th>
                  <th className="px-4 py-3 font-medium">Prochaine action</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.data.map((lead) => (
                  <tr key={lead.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-dark-900">{lead.fullName}</p>
                      <p className="text-xs text-slate-400">{lead.phone ?? lead.email ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className="bg-slate-100 text-slate-600">{leadSourceLabels[lead.source] ?? lead.source}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-dark-900">
                      {lead.valueAr != null ? formatAr(lead.valueAr) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(lead.nextFollowUpAt)}</td>
                    <td className="px-4 py-3">
                      <Badge className={leadStatusCls[lead.status] ?? 'bg-slate-100 text-slate-600'}>
                        {leadStatusLabels[lead.status] ?? lead.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {lead.status !== 'WON' && lead.status !== 'LOST' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Convertir en client"
                            disabled={convertMutation.isPending}
                            onClick={() => convertMutation.mutate(lead.id)}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => openEdit(lead)} title="Modifier">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="hover:text-red-600" onClick={() => setDeleteTarget(lead)} title="Supprimer">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {leads.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm">
              <span className="text-slate-500">
                Page {leads.pagination.page} sur {leads.pagination.totalPages}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Précédent
                </Button>
                <Button variant="outline" size="sm" disabled={page >= leads.pagination.totalPages} onClick={() => setPage(page + 1)}>
                  Suivant
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Modifier le prospect' : 'Nouveau prospect'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
          <Field label="Prénom" required>
            <Input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} required />
          </Field>
          <Field label="Nom" required>
            <Input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} required />
          </Field>
          <Field label="Téléphone">
            <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+261..." />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field label="Source">
            <Select value={form.source} onChange={(e) => set('source', e.target.value)}>
              {Object.entries(leadSourceLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </Field>
          <Field label="Statut">
            <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
              {Object.entries(leadStatusLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </Field>
          <Field label="Valeur estimée (Ar)">
            <Input type="number" min={0} value={form.valueAr} onChange={(e) => set('valueAr', e.target.value)} />
          </Field>
          <Field label="Prochaine relance">
            <Input type="datetime-local" value={form.nextFollowUpAt} onChange={(e) => set('nextFollowUpAt', e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Optionnel" />
            </Field>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {editing ? 'Enregistrer' : 'Ajouter le prospect'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Supprimer le prospect"
        message={`Voulez-vous vraiment supprimer « ${deleteTarget?.fullName} » ?`}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}
