import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Star, Phone, Mail, MapPin, Users, Wallet, FileText } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { formatAr, formatNumber, formatDate } from '../lib/format';
import { Button, Card, ConfirmDialog, EmptyState, Field, Input, Loading, Modal, PageHeader, SearchInput, StatCard, ErrorMessage } from '../components/ui';

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  gender: string | null;
  isVip: boolean;
  loyaltyPoints: number;
  debtAr: number;
  notes: string | null;
  vehiclesCount: number;
  workOrdersCount: number;
  invoicesCount: number;
  createdAt: string;
}

interface CustomerForm {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  gender: string;
  isVip: boolean;
  notes: string;
}

const emptyForm: CustomerForm = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  gender: '',
  isVip: false,
  notes: '',
};

export default function Customers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [vipOnly, setVipOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  const { data: customers, isLoading, error } = useQuery({
    queryKey: ['customers', search, vipOnly, page],
    queryFn: async () => {
      const res = await api.get('/customers', {
        params: { search: search || undefined, vipOnly: vipOnly || undefined, page, limit: 15 },
      });
      return res.data as { data: Customer[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['customers-stats'],
    queryFn: async () => {
      const res = await api.get('/customers/stats');
      return res.data as { total: number; vip: number; outstandingAr: number; documents: number };
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CustomerForm) => {
      const res = await api.post('/customers', data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Client ajouté');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setModalOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CustomerForm }) => {
      const res = await api.put(`/customers/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Client mis à jour');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setModalOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/customers/${id}`),
    onSuccess: () => {
      toast.success('Client supprimé');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setDeleteTarget(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phone ?? '',
      email: c.email ?? '',
      address: c.address ?? '',
      city: c.city ?? '',
      gender: c.gender ?? '',
      isVip: c.isVip,
      notes: c.notes ?? '',
    });
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      phone: form.phone || undefined,
      email: form.email || undefined,
      address: form.address || undefined,
      city: form.city || undefined,
      gender: form.gender || undefined,
      notes: form.notes || undefined,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload as CustomerForm });
    } else {
      createMutation.mutate(payload as CustomerForm);
    }
  };

  const set = (key: keyof CustomerForm, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }));

  const initials = (name: string) =>
    name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'C';

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle={`${customers?.pagination.total ?? 0} client(s)`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Nouveau client
          </Button>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <StatCard label="Clients actifs" value={formatNumber(stats?.total ?? 0)} icon={Users} gradient="from-emerald-500 to-teal-500" />
        <StatCard label="Clients VIP" value={formatNumber(stats?.vip ?? 0)} icon={Star} gradient="from-amber-400 to-orange-500" />
        <StatCard label="Créances clients" value={formatAr(stats?.outstandingAr ?? 0)} icon={Wallet} gradient="from-rose-500 to-red-500" />
        <StatCard label="Documents" value={formatNumber(stats?.documents ?? 0)} icon={FileText} gradient="from-indigo-500 to-violet-500" sub="devis, factures et O.T." />
      </div>

      <Card className="mb-4 p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Rechercher un client (nom, téléphone, email)..." />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 whitespace-nowrap">
          <input
            type="checkbox"
            checked={vipOnly}
            onChange={(e) => { setVipOnly(e.target.checked); setPage(1); }}
            className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
          />
          VIP uniquement
        </label>
      </Card>

      {error ? (
        <ErrorMessage message={(error as any).response?.data?.error ?? 'Erreur de chargement'} />
      ) : isLoading ? (
        <Loading />
      ) : !customers || customers.data.length === 0 ? (
        <Card>
          <EmptyState title="Aucun client" description="Ajoutez votre premier client." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100 bg-slate-50/60">
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Ville</th>
                  <th className="px-4 py-3 font-medium text-right">Dette (Ar)</th>
                  <th className="px-4 py-3 font-medium text-right">Documents</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.data.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0 ${c.isVip ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-gradient-to-br from-emerald-500 to-teal-500'}`}>
                          {initials(c.fullName)}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-dark-900 truncate flex items-center gap-1">
                            <button
                              className="hover:text-emerald-600 transition-colors cursor-pointer truncate"
                              onClick={() => openEdit(c)}
                              title="Voir le détail"
                            >
                              {c.fullName}
                            </button>
                            {c.isVip && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                          </p>
                          <p className="text-xs text-slate-400">{formatDate(c.createdAt)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {c.phone && <p className="flex items-center gap-1.5 text-slate-600"><Phone className="w-3.5 h-3.5 text-slate-400" />{c.phone}</p>}
                        {c.email && <p className="flex items-center gap-1.5 text-slate-600 truncate max-w-[220px]"><Mail className="w-3.5 h-3.5 text-slate-400" />{c.email}</p>}
                        {!c.phone && !c.email && <span className="text-slate-400">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {c.city ? (
                        <span className="flex items-center gap-1.5 text-slate-600"><MapPin className="w-3.5 h-3.5 text-slate-400" />{c.city}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.debtAr > 0 ? (
                        <span className="font-semibold text-red-600">{formatAr(c.debtAr)}</span>
                      ) : (
                        <span className="text-slate-400">0 Ar</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">
                      {c.invoicesCount} facture(s)
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(c)} title="Modifier">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="hover:text-red-600" onClick={() => setDeleteTarget(c)} title="Supprimer">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {customers.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm">
              <span className="text-slate-500">Page {customers.pagination.page} sur {customers.pagination.totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédent</Button>
                <Button variant="outline" size="sm" disabled={page >= customers.pagination.totalPages} onClick={() => setPage(page + 1)}>Suivant</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier le client' : 'Nouveau client'} size="lg">
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
          <Field label="Ville">
            <Input value={form.city} onChange={(e) => set('city', e.target.value)} />
          </Field>
          <Field label="Adresse">
            <Input value={form.address} onChange={(e) => set('address', e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <Input value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Optionnel" />
            </Field>
          </div>
          <div className="sm:col-span-2 flex items-center gap-2">
            <input
              id="isVip"
              type="checkbox"
              checked={form.isVip}
              onChange={(e) => set('isVip', e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
            />
            <label htmlFor="isVip" className="text-sm text-slate-700">Client VIP</label>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {editing ? 'Enregistrer' : 'Ajouter le client'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Supprimer le client"
        message={`Voulez-vous vraiment supprimer « ${deleteTarget?.fullName} » ?`}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}