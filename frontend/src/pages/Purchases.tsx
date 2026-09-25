import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Eye, PackageCheck, Plus, ShoppingCart, Trash2, Truck, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { formatAr, formatDate, formatNumber, toDateInput } from '../lib/format';
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
  Select,
  StatCard,
} from '../components/ui';

interface PurchaseItem {
  id: string;
  productId: string;
  productName: string | null;
  productSku: string | null;
  productUnit: string | null;
  variantId: string | null;
  quantity: number;
  receivedQuantity: number;
  unitCostAr: number;
  discountAr: number;
  taxAr: number;
  lineTotalAr: number;
}

interface Purchase {
  id: string;
  referenceNo: string;
  status: string;
  supplierId: string | null;
  supplierName: string | null;
  warehouseId: string;
  warehouseName: string | null;
  subtotalAr: number;
  discountAr: number;
  taxAr: number;
  shippingAr: number;
  totalAr: number;
  amountPaidAr: number;
  dueAr: number;
  expectedAt: string | null;
  receivedAt: string | null;
  notes: string | null;
  itemsCount: number;
  totalQuantity: number;
  items: PurchaseItem[];
  createdAt: string;
}

interface PurchaseStats {
  purchasesCount: number;
  totalPurchasesAr: number;
  outstandingAr: number;
  monthPurchasesAr: number;
  monthPurchasesCount: number;
  pendingCount: number;
  topSuppliers: { supplierId: string; name: string; totalAr: number }[];
}

interface LineForm {
  productId: string;
  quantity: string;
  unitCostAr: string;
}

const emptyLine: LineForm = { productId: '', quantity: '1', unitCostAr: '0' };

const STATUS_LABELS: Record<string, string> = {
  ORDERED: 'Commandé',
  RECEIVED: 'Réceptionné',
  CANCELLED: 'Annulé',
};

const STATUS_STYLES: Record<string, string> = {
  ORDERED: 'bg-amber-50 text-amber-700',
  RECEIVED: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
};

export default function Purchases() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [detail, setDetail] = useState<Purchase | null>(null);
  const [lines, setLines] = useState<LineForm[]>([emptyLine]);
  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [discountAr, setDiscountAr] = useState('0');
  const [taxAr, setTaxAr] = useState('0');
  const [shippingAr, setShippingAr] = useState('0');
  const [amountPaidAr, setAmountPaidAr] = useState('0');
  const [expectedAt, setExpectedAt] = useState('');
  const [notes, setNotes] = useState('');
  const [receiveNow, setReceiveNow] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Purchase | null>(null);

  const { data: purchases, isLoading, error } = useQuery({
    queryKey: ['purchases', search, status, page],
    queryFn: async () => {
      const res = await api.get('/purchases', {
        params: { search: search || undefined, status: status || undefined, page, limit: 15 },
      });
      return res.data as { data: Purchase[]; pagination: { page: number; limit: number; total: number; pages: number } };
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['purchases-stats'],
    queryFn: async () => (await api.get('/purchases/stats')).data as PurchaseStats,
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-options'],
    queryFn: async () => {
      const res = await api.get('/suppliers', { params: { activeOnly: true, limit: 100 } });
      return (res.data as { data: { id: string; name: string }[] }).data;
    },
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-options'],
    queryFn: async () => {
      const res = await api.get('/stock/warehouses');
      return res.data as { id: string; name: string; isMain?: boolean }[];
    },
  });

  const { data: products } = useQuery({
    queryKey: ['products-options'],
    queryFn: async () => {
      const res = await api.get('/products', { params: { limit: 100 } });
      return (res.data as { data: { id: string; name: string; sku: string | null; costPriceAr?: number }[] }).data;
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['purchases'] });
    queryClient.invalidateQueries({ queryKey: ['purchases-stats'] });
    queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    queryClient.invalidateQueries({ queryKey: ['stock'] });
  };

  const createMutation = useMutation({
    mutationFn: async (payload: unknown) => (await api.post('/purchases', payload)).data as Purchase,
    onSuccess: (purchase) => {
      toast.success(`Achat ${purchase.referenceNo} enregistré`);
      invalidate();
      setModalOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status: next }: { id: string; status: string }) =>
      (await api.patch(`/purchases/${id}/status`, { status: next })).data as Purchase,
    onSuccess: (purchase) => {
      toast.success(
        purchase.status === 'RECEIVED' ? 'Stock mis à jour' : purchase.status === 'CANCELLED' ? 'Achat annulé' : 'Achat mis à jour',
      );
      invalidate();
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? 'Erreur');
      setDeleteTarget(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/purchases/${id}`),
    onSuccess: () => {
      toast.success('Achat supprimé');
      invalidate();
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? 'Erreur');
      setDeleteTarget(null);
    },
  });

  const openCreate = () => {
    const main = warehouses?.find((w) => w.isMain) ?? warehouses?.[0];
    setLines([emptyLine]);
    setSupplierId('');
    setWarehouseId(main?.id ?? '');
    setDiscountAr('0');
    setTaxAr('0');
    setShippingAr('0');
    setAmountPaidAr('0');
    setExpectedAt('');
    setNotes('');
    setReceiveNow(true);
    setModalOpen(true);
  };

  const setLine = (index: number, key: keyof LineForm, value: string) =>
    setLines((ls) => ls.map((l, i) => (i === index ? { ...l, [key]: value } : l)));

  const pickProduct = (index: number, productId: string) => {
    const product = products?.find((p) => p.id === productId);
    setLines((ls) =>
      ls.map((l, i) =>
        i === index
          ? { ...l, productId, unitCostAr: product?.costPriceAr ? String(Math.round(product.costPriceAr)) : l.unitCostAr }
          : l,
      ),
    );
  };

  const subtotal = lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unitCostAr || 0), 0);
  const total = Math.max(0, subtotal - Number(discountAr || 0) + Number(taxAr || 0) + Number(shippingAr || 0));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseId) {
      toast.error('Choisissez un entrepôt');
      return;
    }
    if (lines.some((l) => !l.productId || Number(l.quantity) <= 0)) {
      toast.error('Chaque ligne a besoin d\'un produit et d\'une quantité');
      return;
    }
    createMutation.mutate({
      supplierId: supplierId || undefined,
      warehouseId,
      status: receiveNow ? 'RECEIVED' : 'ORDERED',
      discountAr: Number(discountAr || 0),
      taxAr: Number(taxAr || 0),
      shippingAr: Number(shippingAr || 0),
      amountPaidAr: Number(amountPaidAr || 0),
      expectedAt: expectedAt || undefined,
      notes: notes || undefined,
      items: lines.map((l) => ({
        productId: l.productId,
        quantity: Number(l.quantity || 0),
        unitCostAr: Number(l.unitCostAr || 0),
      })),
    });
  };

  const maxTop = Math.max(...(stats?.topSuppliers ?? []).map((t) => t.totalAr), 1);

  return (
    <div>
      <PageHeader
        title="Achats"
        subtitle="Approvisionnements, réception et dettes fournisseurs"
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Nouvel achat
          </Button>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <StatCard label="Achats du mois" value={formatAr(stats?.monthPurchasesAr ?? 0)} icon={ShoppingCart} sub={`${stats?.monthPurchasesCount ?? 0} achat(s)`} />
        <StatCard label="Total achats" value={formatAr(stats?.totalPurchasesAr ?? 0)} icon={Truck} gradient="from-indigo-500 to-violet-500" sub={`${stats?.purchasesCount ?? 0} achat(s)`} />
        <StatCard label="Reste à payer" value={formatAr(stats?.outstandingAr ?? 0)} icon={Wallet} gradient="from-rose-500 to-red-500" />
        <StatCard label="En attente" value={formatNumber(stats?.pendingCount ?? 0)} icon={AlertTriangle} gradient="from-amber-400 to-orange-500" sub="non encore reçus" />
      </div>

      {stats && stats.topSuppliers.length > 0 && (
        <Card className="mb-4 p-4">
          <p className="text-sm font-semibold text-dark-900 mb-3">Fournisseurs principaux</p>
          <div className="space-y-2.5">
            {stats.topSuppliers.map((t) => (
              <div key={t.supplierId}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-600 truncate">{t.name}</span>
                  <span className="font-medium text-dark-900">{formatAr(t.totalAr)}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
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
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Rechercher (référence, fournisseur, note)..." />
        </div>
        <Select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="sm:w-48"
          aria-label="Filtrer par statut"
        >
          <option value="">Tous les statuts</option>
          <option value="ORDERED">Commandés</option>
          <option value="RECEIVED">Réceptionnés</option>
          <option value="CANCELLED">Annulés</option>
        </Select>
      </Card>

      {error ? (
        <ErrorMessage message={(error as any).response?.data?.error ?? 'Erreur de chargement'} />
      ) : isLoading ? (
        <Loading />
      ) : !purchases || purchases.data.length === 0 ? (
        <Card>
          <EmptyState title="Aucun achat" description="Enregistrez un approvisionnement pour augmenter votre stock." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100 bg-slate-50/60">
                  <th className="px-4 py-3 font-medium">Référence</th>
                  <th className="px-4 py-3 font-medium">Fournisseur</th>
                  <th className="px-4 py-3 font-medium text-right">Articles</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  <th className="px-4 py-3 font-medium text-right">Payé</th>
                  <th className="px-4 py-3 font-medium text-right">Reste</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {purchases.data.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setDetail(p)}
                        className="font-medium text-dark-900 hover:text-emerald-600 truncate block text-left"
                        title="Voir le détail"
                      >
                        {p.referenceNo}
                      </button>
                      <p className="text-xs text-slate-400">{formatDate(p.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.supplierName ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {formatNumber(p.totalQuantity)} ({p.itemsCount})
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-dark-900">{formatAr(p.totalAr)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatAr(p.amountPaidAr)}</td>
                    <td className="px-4 py-3 text-right">
                      {p.dueAr > 0 ? <span className="font-semibold text-red-600">{formatAr(p.dueAr)}</span> : <span className="text-slate-400">0 Ar</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={STATUS_STYLES[p.status] ?? 'bg-slate-100 text-slate-600'}>{STATUS_LABELS[p.status] ?? p.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setDetail(p)} title="Détail">
                          <Eye className="w-4 h-4" />
                        </Button>
                        {p.status === 'ORDERED' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="hover:text-emerald-600"
                            onClick={() => statusMutation.mutate({ id: p.id, status: 'RECEIVED' })}
                            title="Réceptionner (met le stock à jour)"
                          >
                            <PackageCheck className="w-4 h-4" />
                          </Button>
                        )}
                        {p.status !== 'CANCELLED' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="hover:text-amber-600"
                            onClick={() => statusMutation.mutate({ id: p.id, status: 'CANCELLED' })}
                            title="Annuler"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {purchases.pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm">
              <span className="text-slate-500">Page {purchases.pagination.page} sur {purchases.pagination.pages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédent</Button>
                <Button variant="outline" size="sm" disabled={page >= purchases.pagination.pages} onClick={() => setPage(page + 1)}>Suivant</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouvel achat" description="Le stock est mis à jour automatiquement à la réception." size="xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Fournisseur">
              <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">— Aucun (achat direct) —</option>
                {(suppliers ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Entrepôt" required>
              <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
                <option value="">— Choisir —</option>
                {(warehouses ?? []).map((w) => (
                  <option key={w.id} value={w.id}>{w.name}{w.isMain ? ' (principal)' : ''}</option>
                ))}
              </Select>
            </Field>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-700">Articles <span className="text-red-500">*</span></p>
              <Button type="button" variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, { ...emptyLine }])}>
                <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
              </Button>
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-12 sm:col-span-6">
                    <Select value={line.productId} onChange={(e) => pickProduct(i, e.target.value)} aria-label={`Produit ligne ${i + 1}`}>
                      <option value="">— Produit —</option>
                      {(products ?? []).map((p) => (
                        <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="col-span-6 sm:col-span-2">
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={line.quantity}
                      onChange={(e) => setLine(i, 'quantity', e.target.value)}
                      aria-label={`Quantité ligne ${i + 1}`}
                      placeholder="Qté"
                    />
                  </div>
                  <div className="col-span-5 sm:col-span-3">
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={line.unitCostAr}
                      onChange={(e) => setLine(i, 'unitCostAr', e.target.value)}
                      aria-label={`Prix d'achat ligne ${i + 1}`}
                      placeholder="Prix d'achat"
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="hover:text-red-600"
                      disabled={lines.length === 1}
                      onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                      title="Retirer la ligne"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-4 gap-4">
            <Field label="Remise (Ar)">
              <Input type="number" min="0" step="any" value={discountAr} onChange={(e) => setDiscountAr(e.target.value)} />
            </Field>
            <Field label="TVA (Ar)">
              <Input type="number" min="0" step="any" value={taxAr} onChange={(e) => setTaxAr(e.target.value)} />
            </Field>
            <Field label="Transport (Ar)">
              <Input type="number" min="0" step="any" value={shippingAr} onChange={(e) => setShippingAr(e.target.value)} />
            </Field>
            <Field label="Payé d'avance (Ar)">
              <Input type="number" min="0" step="any" value={amountPaidAr} onChange={(e) => setAmountPaidAr(e.target.value)} />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Livraison prévue">
              <Input type="date" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} />
            </Field>
            <Field label="Note">
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="N° bon de livraison..." />
            </Field>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="receiveNow"
              type="checkbox"
              checked={receiveNow}
              onChange={(e) => setReceiveNow(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
            />
            <label htmlFor="receiveNow" className="text-sm text-slate-700">
              Réceptionner maintenant (le stock augmente et le prix d'achat des produits est mis à jour)
            </label>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <div className="text-sm">
              <span className="text-slate-500">Total : </span>
              <span className="text-lg font-bold text-dark-900">{formatAr(total)}</span>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                Enregistrer l'achat
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `Achat ${detail.referenceNo}` : ''} size="lg">
        {detail && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-400">Fournisseur</p>
                <p className="font-medium text-dark-900">{detail.supplierName ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Entrepôt</p>
                <p className="font-medium text-dark-900">{detail.warehouseName ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Date</p>
                <p className="font-medium text-dark-900">{formatDate(detail.createdAt)}</p>
              </div>
            </div>

            <div className="border border-slate-100 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500 bg-slate-50/60">
                    <th className="px-3 py-2 font-medium">Produit</th>
                    <th className="px-3 py-2 font-medium text-right">Qté</th>
                    <th className="px-3 py-2 font-medium text-right">P.A.</th>
                    <th className="px-3 py-2 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((it) => (
                    <tr key={it.id} className="border-t border-slate-50">
                      <td className="px-3 py-2 text-slate-700">
                        {it.productName ?? '—'}
                        {it.productSku && <span className="text-xs text-slate-400"> · {it.productSku}</span>}
                        {detail.status === 'RECEIVED' && (
                          <span className="ml-2 inline-flex items-center gap-1 text-xs text-emerald-600">
                            <CheckCircle2 className="w-3 h-3" /> reçu
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600">
                        {formatNumber(it.quantity)}{it.productUnit ? ` ${it.productUnit}` : ''}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600">{formatAr(it.unitCostAr)}</td>
                      <td className="px-3 py-2 text-right font-medium text-dark-900">{formatAr(it.lineTotalAr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-1 text-sm ml-auto max-w-xs">
              <div className="flex justify-between"><span className="text-slate-500">Sous-total</span><span className="text-dark-900">{formatAr(detail.subtotalAr)}</span></div>
              {detail.discountAr > 0 && <div className="flex justify-between"><span className="text-slate-500">Remise</span><span className="text-dark-900">- {formatAr(detail.discountAr)}</span></div>}
              {detail.taxAr > 0 && <div className="flex justify-between"><span className="text-slate-500">TVA</span><span className="text-dark-900">{formatAr(detail.taxAr)}</span></div>}
              {detail.shippingAr > 0 && <div className="flex justify-between"><span className="text-slate-500">Transport</span><span className="text-dark-900">{formatAr(detail.shippingAr)}</span></div>}
              <div className="flex justify-between border-t border-slate-100 pt-1 text-base font-bold"><span>Total</span><span>{formatAr(detail.totalAr)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Payé</span><span className="text-emerald-600">{formatAr(detail.amountPaidAr)}</span></div>
              {detail.dueAr > 0 && <div className="flex justify-between"><span className="text-slate-500">Reste dû</span><span className="text-red-600 font-medium">{formatAr(detail.dueAr)}</span></div>}
            </div>

            {detail.notes && <p className="text-sm text-slate-500"><span className="font-medium text-slate-600">Note : </span>{detail.notes}</p>}
            {detail.expectedAt && (
              <p className="text-sm text-slate-500">Livraison prévue : {toDateInput(detail.expectedAt)}</p>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              {detail.status === 'ORDERED' && (
                <Button onClick={() => { statusMutation.mutate({ id: detail.id, status: 'RECEIVED' }); setDetail(null); }}>
                  <PackageCheck className="w-4 h-4" /> Réceptionner
                </Button>
              )}
              <Button variant="outline" onClick={() => setDetail(null)}>Fermer</Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={deleteTarget?.status === 'ORDERED' ? 'Supprimer cet achat ?' : 'Achat réceptionné'}
        message={
          deleteTarget?.status === 'ORDERED'
            ? `L'achat ${deleteTarget?.referenceNo} n'a jamais été réceptionné : il peut être supprimé.`
            : `L'achat ${deleteTarget?.referenceNo} a déjà été réceptionné : le stock a été mouvementé, il ne peut pas être supprimé. Utilisez l'annulation.`
        }
        confirmLabel={deleteTarget?.status === 'ORDERED' ? 'Supprimer' : 'Annuler l\'achat'}
        loading={deleteMutation.isPending || statusMutation.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.status === 'ORDERED') deleteMutation.mutate(deleteTarget.id);
          else statusMutation.mutate({ id: deleteTarget.id, status: 'CANCELLED' });
        }}
      />
    </div>
  );
}
