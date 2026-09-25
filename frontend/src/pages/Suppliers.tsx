import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Phone, Mail, MapPin, Pencil, Plus, Trash2, Truck, Users, Wallet, FileText } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { formatAr, formatDate, formatNumber } from '../lib/format';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorMessage,
  Field,
  Input,
  Loading,
  Modal,
  PageHeader,
  SearchInput,
  StatCard,
  Textarea,
} from '../components/ui';

interface Supplier {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  purchasesCount: number;
  purchasesTotalAr: number;
  outstandingAr: number;
  lastPurchaseAt: string | null;
  createdAt: string;
}

interface SupplierForm {
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  isActive: boolean;
}

interface SupplierStats {
  total: number;
  active: number;
  purchasesCount: number;
  totalPurchasesAr: number;
  outstandingAr: number;
  monthPurchasesAr: number;
  monthPurchasesCount: number;
  topSuppliers: { supplierId: string; name: string; totalAr: number }[];
}

const emptyForm: SupplierForm = {
  name: '',
  contactName: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
  isActive: true,
};

export default function Suppliers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);

  const { data: suppliers, isLoading, error } = useQuery({
    queryKey: ['suppliers', search, activeOnly, page],
    queryFn: async () => {
      const res = await api.get('/suppliers', {
        params: { search: search || undefined, activeOnly: activeOnly || undefined, page, limit: 15 },
      });
      return res.data as {
        data: Supplier[];
        pagination: { page: number; limit: number; total: number; pages: number };
      };
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['suppliers-stats'],
    queryFn: async () => (await api.get('/suppliers/stats')).data as SupplierStats,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    queryClient.invalidateQueries({ queryKey: ['suppliers-stats'] });
  };

  const createMutation = useMutation({
    mutationFn: async (data: Partial<SupplierForm>) => (await api.post('/suppliers', data)).data,
    onSuccess: () => {
      toast.success('Fournisseur ajouté');
      invalidate();
      setModalOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SupplierForm> }) =>
      (await api.put(`/suppliers/${id}`, data)).data,
    onSuccess: () => {
      toast.success('Fournisseur mis à jour');
      invalidate();
      setModalOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/suppliers/${id}`),
    onSuccess: () => {
      toast.success('Fournisseur supprimé');
      invalidate();
      setDeleteTarget(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({
      name: s.name,
      contactName: s.contactName ?? '',
      phone: s.phone ?? '',
      email: s.email ?? '',
      address: s.address ?? '',
      notes: s.notes ?? '',
      isActive: s.isActive,
    });
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      contactName: form.contactName || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      address: form.address || undefined,
      notes: form.notes || undefined,
    };
    if (editing) updateMutation.mutate({ id: editing.id, data: payload });
    else createMutation.mutate(payload);
  };

  const set = (key: keyof SupplierForm, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }));
  const pending = createMutation.isPending || updateMutation.isPending;
  const maxTop = Math.max(...(stats?.topSuppliers ?? []).map((t) => t.totalAr), 1);

  return (
    <div>
      <PageHeader
        title="Fournisseurs"
        subtitle={`${suppliers?.pagination.total ?? 0} fournisseur(s)`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Nouveau fournisseur
          </Button>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <StatCard label="Fournisseurs" value={formatNumber(stats?.total ?? 0)} icon={Users} sub={`${stats?.active ?? 0} actif(s)`} />
        <StatCard label="Total achats" value={formatAr(stats?.totalPurchasesAr ?? 0)} icon={Truck} gradient="from-indigo-500 to-violet-500" sub={`${stats?.purchasesCount ?? 0} achat(s)`} />
        <StatCard label="Reste à payer" value={formatAr(stats?.outstandingAr ?? 0)} icon={Wallet} gradient="from-rose-500 to-red-500" />
        <StatCard label="Achats du mois" value={formatAr(stats?.monthPurchasesAr ?? 0)} icon={FileText} gradient="from-amber-400 to-orange-500" sub={`${stats?.monthPurchasesCount ?? 0} achat(s)`} />
      </div>

      {stats && stats.topSuppliers.length > 0 && (
        <Card className="mb-4 p-4">
          <p className="text-sm font-semibold text-dark-900 mb-3">Meilleurs fournisseurs</p>
          <div className="space-y-2.5">
            {stats.topSuppliers.map((t) => (
              <div key={t.supplierId}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-600 truncate">{t.name}</span>
                  <span className="font-medium text-dark-900">{formatAr(t.totalAr)}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                    style={{ width: `${Math.round((t.totalAr / maxTop) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="mb-4 p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Rechercher un fournisseur (nom, téléphone)..." />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 whitespace-nowrap">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => { setActiveOnly(e.target.checked); setPage(1); }}
            className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
          />
          Actifs uniquement
        </label>
      </Card>

      {error ? (
        <ErrorMessage message={(error as any).response?.data?.error ?? 'Erreur de chargement'} />
      ) : isLoading ? (
        <Loading />
      ) : !suppliers || suppliers.data.length === 0 ? (
        <Card>
          <EmptyState title="Aucun fournisseur" description="Ajoutez vos fournisseurs pour suivre vos achats et vos dettes." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100 bg-slate-50/60">
                  <th className="px-4 py-3 font-medium">Fournisseur</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Adresse</th>
                  <th className="px-4 py-3 font-medium text-right">Achats</th>
                  <th className="px-4 py-3 font-medium text-right">Reste dû</th>
                  <th className="px-4 py-3 font-medium">État</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.data.map((s) => (
                  <tr key={s.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 bg-gradient-to-br from-emerald-500 to-teal-500">
                          <Building2 className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-dark-900 truncate">{s.name}</p>
                          <p className="text-xs text-slate-400">
                            {s.lastPurchaseAt ? `Dernier achat ${formatDate(s.lastPurchaseAt)}` : `Ajouté ${formatDate(s.createdAt)}`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {s.contactName && <p className="text-slate-700">{s.contactName}</p>}
                        {s.phone && <p className="flex items-center gap-1.5 text-slate-600"><Phone className="w-3.5 h-3.5 text-slate-400" />{s.phone}</p>}
                        {s.email && <p className="flex items-center gap-1.5 text-slate-600 truncate max-w-[200px]"><Mail className="w-3.5 h-3.5 text-slate-400" />{s.email}</p>}
                        {!s.contactName && !s.phone && !s.email && <span className="text-slate-400">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {s.address ? (
                        <span className="flex items-center gap-1.5 text-slate-600"><MapPin className="w-3.5 h-3.5 text-slate-400" />{s.address}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="text-slate-700">{formatAr(s.purchasesTotalAr)}</p>
                      <p className="text-xs text-slate-400">{s.purchasesCount} achat(s)</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {s.outstandingAr > 0 ? (
                        <span className="font-semibold text-red-600">{formatAr(s.outstandingAr)}</span>
                      ) : (
                        <span className="text-slate-400">0 Ar</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {s.isActive ? (
                        <Badge className="bg-emerald-50 text-emerald-700">Actif</Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-500">Inactif</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(s)} title="Modifier">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="hover:text-red-600" onClick={() => setDeleteTarget(s)} title="Supprimer">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {suppliers.pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm">
              <span className="text-slate-500">Page {suppliers.pagination.page} sur {suppliers.pagination.pages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédent</Button>
                <Button variant="outline" size="sm" disabled={page >= suppliers.pagination.pages} onClick={() => setPage(page + 1)}>Suivant</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier le fournisseur' : 'Nouveau fournisseur'} size="lg">
        <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Field label="Nom du fournisseur" required>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="Ex : Grossiste Mada SARL" />
            </Field>
          </div>
          <Field label="Personne à contacter">
            <Input value={form.contactName} onChange={(e) => set('contactName', e.target.value)} />
          </Field>
          <Field label="Téléphone">
            <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+261..." />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field label="Adresse">
            <Input value={form.address} onChange={(e) => set('address', e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Délai de paiement, conditions..." />
            </Field>
          </div>
          <div className="sm:col-span-2 flex items-center gap-2">
            <input
              id="supplierActive"
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => set('isActive', e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
            />
            <label htmlFor="supplierActive" className="text-sm text-slate-700">Fournisseur actif</label>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={pending}>{editing ? 'Enregistrer' : 'Ajouter le fournisseur'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Supprimer le fournisseur"
        message={deleteTarget?.purchasesCount
          ? `« ${deleteTarget.name} » a ${deleteTarget.purchasesCount} achat(s) enregistré(s). La suppression sera refusée : désactivez-le plutôt.`
          : `Voulez-vous vraiment supprimer « ${deleteTarget?.name} » ?`}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}
