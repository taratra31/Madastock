import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, Pencil, Plus, Tag, Trash2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { formatDate, formatNumber } from '../lib/format';
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
} from '../components/ui';

interface Brand {
  id: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: { products: number };
}

interface BrandStats {
  total: number;
  active: number;
  productsWithBrand: number;
  topBrands: { brandId: string; name: string; products: number }[];
}

interface BrandForm {
  name: string;
  logoUrl: string;
  description: string;
  isActive: boolean;
}

const emptyForm: BrandForm = { name: '', logoUrl: '', description: '', isActive: true };

export default function Brands() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [form, setForm] = useState<BrandForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Brand | null>(null);

  const { data: brands, isLoading, error } = useQuery({
    queryKey: ['brands', search],
    queryFn: async () => (await api.get('/brands', { params: { search: search || undefined } })).data as Brand[],
  });

  const { data: stats } = useQuery({
    queryKey: ['brands-stats'],
    queryFn: async () => (await api.get('/brands/stats')).data as BrandStats,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['brands'] });
    queryClient.invalidateQueries({ queryKey: ['brands-stats'] });
  };

  const createMutation = useMutation({
    mutationFn: async (data: Partial<BrandForm>) => (await api.post('/brands', data)).data,
    onSuccess: () => {
      toast.success('Marque ajoutée');
      invalidate();
      setModalOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<BrandForm> }) => (await api.put(`/brands/${id}`, data)).data,
    onSuccess: () => {
      toast.success('Marque mise à jour');
      invalidate();
      setModalOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/brands/${id}`),
    onSuccess: () => {
      toast.success('Marque supprimée');
      invalidate();
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? 'Erreur');
      setDeleteTarget(null);
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (b: Brand) => {
    setEditing(b);
    setForm({
      name: b.name,
      logoUrl: b.logoUrl ?? '',
      description: b.description ?? '',
      isActive: b.isActive,
    });
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      logoUrl: form.logoUrl || undefined,
      description: form.description || undefined,
      isActive: form.isActive,
    };
    if (editing) updateMutation.mutate({ id: editing.id, data: payload });
    else createMutation.mutate(payload);
  };

  const set = (key: keyof BrandForm, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }));
  const pending = createMutation.isPending || updateMutation.isPending;
  const maxTop = Math.max(...(stats?.topBrands ?? []).map((t) => t.products), 1);

  return (
    <div>
      <PageHeader
        title="Marques"
        subtitle={`${brands?.length ?? 0} marque(s)`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Nouvelle marque
          </Button>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 mb-5">
        <StatCard label="Marques" value={formatNumber(stats?.total ?? 0)} icon={Tag} sub={`${stats?.active ?? 0} active(s)`} />
        <StatCard label="Produits avec marque" value={formatNumber(stats?.productsWithBrand ?? 0)} icon={Package} gradient="from-indigo-500 to-violet-500" />
        <StatCard label="Marque principale" value={stats?.topBrands?.[0]?.name ?? '—'} icon={TrendingUp} gradient="from-amber-400 to-orange-500" sub={stats?.topBrands?.[0] ? `${stats.topBrands[0].products} produit(s)` : undefined} />
      </div>

      {stats && stats.topBrands.length > 0 && (
        <Card className="mb-4 p-4">
          <p className="text-sm font-semibold text-dark-900 mb-3">Marques les plus représentées</p>
          <div className="space-y-2.5">
            {stats.topBrands.map((t) => (
              <div key={t.brandId}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-600 truncate">{t.name}</span>
                  <span className="text-slate-500">{t.products} produit(s)</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                    style={{ width: `${Math.round((t.products / maxTop) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="mb-4 p-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Rechercher une marque..." />
      </Card>

      {error ? (
        <ErrorMessage message={(error as any).response?.data?.error ?? 'Erreur de chargement'} />
      ) : isLoading ? (
        <Loading />
      ) : !brands || brands.length === 0 ? (
        <Card>
          <EmptyState title="Aucune marque" description="Créez vos marques pour classer vos produits." />
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {brands.map((b) => (
            <Card key={b.id} className="p-4">
              <div className="flex items-start gap-3">
                {b.logoUrl ? (
                  <img src={b.logoUrl} alt={b.name} className="w-11 h-11 rounded-xl object-cover border border-slate-100" />
                ) : (
                  <span className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0 bg-gradient-to-br from-emerald-500 to-teal-500">
                    <Tag className="w-5 h-5" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-dark-900 truncate">{b.name}</p>
                  <p className="text-xs text-slate-400">
                    {b._count?.products ?? 0} produit(s) · {formatDate(b.createdAt)}
                  </p>
                </div>
                <div className="flex gap-0.5">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(b)} title="Modifier">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="hover:text-red-600" onClick={() => setDeleteTarget(b)} title="Supprimer">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              {b.description && <p className="mt-2 text-sm text-slate-500 line-clamp-2">{b.description}</p>}
              <div className="mt-3 flex items-center gap-2">
                {b.isActive ? (
                  <Badge className="bg-emerald-50 text-emerald-700">Active</Badge>
                ) : (
                  <Badge className="bg-slate-100 text-slate-500">Inactive</Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier la marque' : 'Nouvelle marque'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Nom de la marque" required>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="Ex : Ny Sakafo" />
          </Field>
          <Field label="Logo (URL)" hint="Lien vers l'image du logo">
            <Input value={form.logoUrl} onChange={(e) => set('logoUrl', e.target.value)} placeholder="https://..." />
          </Field>
          <Field label="Description">
            <Input value={form.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
          <div className="flex items-center gap-2">
            <input
              id="brandActive"
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => set('isActive', e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
            />
            <label htmlFor="brandActive" className="text-sm text-slate-700">Marque active</label>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={pending}>{editing ? 'Enregistrer' : 'Ajouter la marque'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Supprimer la marque"
        message={
          (deleteTarget?._count?.products ?? 0) > 0
            ? `${deleteTarget?._count?.products} produit(s) utilisent « ${deleteTarget?.name} ». Retirez la marque de ces produits ou désactivez-la.`
            : `Voulez-vous vraiment supprimer « ${deleteTarget?.name} » ?`
        }
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}
