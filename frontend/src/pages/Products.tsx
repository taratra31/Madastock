import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Package } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { formatAr, formatNumber } from '../lib/format';
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, Modal, PageHeader, SearchInput, Select, Loading, ErrorMessage } from '../components/ui';

interface Category {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  _count?: { products: number };
}

interface Product {
  id: string;
  name: string;
  sku: string | null;
  unit: string | null;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  costPriceAr: number;
  sellingPriceAr: number;
  wholesalePriceAr: number | null;
  taxRatePct: number;
  lowStockThreshold: number;
  trackStock: boolean;
  totalStock: number;
  imageUrl: string | null;
}

interface ProductForm {
  name: string;
  categoryId: string;
  sku: string;
  unit: string;
  costPriceAr: string;
  sellingPriceAr: string;
  wholesalePriceAr: string;
  taxRatePct: string;
  lowStockThreshold: string;
  trackStock: boolean;
}

type ProductPayload = {
  name: string;
  categoryId?: string;
  sku?: string;
  unit?: string;
  costPriceAr: number;
  sellingPriceAr: number;
  wholesalePriceAr?: number;
  taxRatePct: number;
  lowStockThreshold: number;
  trackStock: boolean;
};

const emptyForm: ProductForm = {
  name: '',
  categoryId: '',
  sku: '',
  unit: 'pièce',
  costPriceAr: '',
  sellingPriceAr: '',
  wholesalePriceAr: '',
  taxRatePct: '0',
  lowStockThreshold: '5',
  trackStock: true,
};

export default function Products() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const { data: products, isLoading, error } = useQuery({
    queryKey: ['products', search, categoryFilter, page],
    queryFn: async () => {
      const res = await api.get('/products', {
        params: { search: search || undefined, categoryId: categoryFilter || undefined, page, limit: 15 },
      });
      return res.data as { data: Product[]; pagination: { page: number; limit: number; total: number; pages: number } };
    },
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/categories', { params: { activeOnly: 'true' } });
      return res.data as Category[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ProductPayload) => {
      const res = await api.post('/products', data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Produit créé');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setModalOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ProductPayload }) => {
      const res = await api.put(`/products/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Produit mis à jour');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setModalOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => {
      toast.success('Produit supprimé');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setDeleteTarget(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      categoryId: p.categoryId ?? '',
      sku: p.sku ?? '',
      unit: p.unit ?? 'pièce',
      costPriceAr: String(p.costPriceAr),
      sellingPriceAr: String(p.sellingPriceAr),
      wholesalePriceAr: p.wholesalePriceAr != null ? String(p.wholesalePriceAr) : '',
      taxRatePct: String(p.taxRatePct ?? 0),
      lowStockThreshold: String(p.lowStockThreshold ?? 5),
      trackStock: p.trackStock,
    });
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      categoryId: form.categoryId || undefined,
      sku: form.sku || undefined,
      unit: form.unit || undefined,
      costPriceAr: Number(form.costPriceAr) || 0,
      sellingPriceAr: Number(form.sellingPriceAr) || 0,
      wholesalePriceAr: form.wholesalePriceAr ? Number(form.wholesalePriceAr) : undefined,
      taxRatePct: Number(form.taxRatePct) || 0,
      lowStockThreshold: Number(form.lowStockThreshold) || 0,
      trackStock: form.trackStock,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const set = (key: keyof ProductForm, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div>
      <PageHeader
        title="Produits"
        subtitle={`${products?.pagination.total ?? 0} produit(s) au catalogue`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Nouveau produit
          </Button>
        }
      />

      <Card className="mb-4 p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Rechercher un produit (nom, référence)..." />
        </div>
        <Select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} className="sm:w-56">
          <option value="">Toutes les catégories</option>
          {(categories ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </Card>

      {error ? (
        <ErrorMessage message={(error as any).response?.data?.error ?? 'Erreur de chargement'} />
      ) : isLoading ? (
        <Loading />
      ) : !products || products.data.length === 0 ? (
        <Card>
          <EmptyState title="Aucun produit" description="Ajoutez votre premier produit pour commencer." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100 bg-slate-50/60">
                  <th className="px-4 py-3 font-medium">Produit</th>
                  <th className="px-4 py-3 font-medium">Catégorie</th>
                  <th className="px-4 py-3 font-medium text-right">Stock</th>
                  <th className="px-4 py-3 font-medium text-right">Prix achat</th>
                  <th className="px-4 py-3 font-medium text-right">Prix vente</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.data.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} className="w-10 h-10 rounded-lg object-cover bg-slate-100 shrink-0" loading="lazy" />
                        ) : (
                          <span className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                            <Package className="w-4 h-4 text-slate-500" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-dark-900 truncate">{p.name}</p>
                          {p.sku && <p className="text-xs text-slate-400">{p.sku}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.category?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {p.trackStock === false ? (
                        <Badge className="bg-slate-100 text-slate-500">Non suivi</Badge>
                      ) : p.totalStock <= (p.lowStockThreshold ?? 5) ? (
                        <Badge className="bg-red-50 text-red-600">{formatNumber(p.totalStock)} u</Badge>
                      ) : (
                        <span className="font-medium text-slate-700">{formatNumber(p.totalStock)} u</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatAr(p.costPriceAr)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-dark-900">{formatAr(p.sellingPriceAr)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(p)} title="Modifier">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="hover:text-red-600" onClick={() => setDeleteTarget(p)} title="Supprimer">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {products.pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm">
              <span className="text-slate-500">
                Page {products.pagination.page} sur {products.pagination.pages}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédent</Button>
                <Button variant="outline" size="sm" disabled={page >= products.pagination.pages} onClick={() => setPage(page + 1)}>Suivant</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Modifier le produit' : 'Nouveau produit'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Field label="Nom du produit" required>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="Ex : Riz parfumé 25 kg" />
            </Field>
          </div>
          <Field label="Catégorie">
            <Select value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
              <option value="">Aucune</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Référence (SKU)">
            <Input value={form.sku} onChange={(e) => set('sku', e.target.value)} placeholder="Optionnel" />
          </Field>
          <Field label="Unité">
            <Input value={form.unit} onChange={(e) => set('unit', e.target.value)} />
          </Field>
          <Field label="Seuil de stock bas">
            <Input type="number" min={0} value={form.lowStockThreshold} onChange={(e) => set('lowStockThreshold', e.target.value)} />
          </Field>
          <Field label="Prix d'achat (Ar)">
            <Input type="number" min={0} value={form.costPriceAr} onChange={(e) => set('costPriceAr', e.target.value)} placeholder="0" />
          </Field>
          <Field label="Prix de vente (Ar)">
            <Input type="number" min={0} value={form.sellingPriceAr} onChange={(e) => set('sellingPriceAr', e.target.value)} placeholder="0" />
          </Field>
          <Field label="Prix de gros (Ar)">
            <Input type="number" min={0} value={form.wholesalePriceAr} onChange={(e) => set('wholesalePriceAr', e.target.value)} placeholder="Optionnel" />
          </Field>
          <Field label="TVA (%)">
            <Input type="number" min={0} max={100} value={form.taxRatePct} onChange={(e) => set('taxRatePct', e.target.value)} />
          </Field>
          <div className="sm:col-span-2 flex items-center gap-2">
            <input
              id="trackStock"
              type="checkbox"
              checked={form.trackStock}
              onChange={(e) => set('trackStock', e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
            />
            <label htmlFor="trackStock" className="text-sm text-slate-700">Suivre le stock de ce produit</label>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {editing ? 'Enregistrer' : 'Créer le produit'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Supprimer le produit"
        message={`Voulez-vous vraiment supprimer « ${deleteTarget?.name} » ? Cette action est irréversible.`}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}