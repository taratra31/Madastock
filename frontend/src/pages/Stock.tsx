import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ArrowDownToLine, ArrowUpFromLine, Boxes, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { formatAr, formatNumber, formatDate } from '../lib/format';
import { Badge, Button, Card, EmptyState, Field, Input, Loading, Modal, PageHeader, SearchInput, Select, ErrorMessage } from '../components/ui';

interface Warehouse {
  id: string;
  name: string;
  isMain: boolean;
  isActive: boolean;
}

interface StockRow {
  id: string;
  productId: string | null;
  productName: string | null;
  variantName: string | null;
  imageUrl: string | null;
  warehouseId: string;
  warehouseName: string;
  isMainWarehouse: boolean;
  quantity: number;
  reserved: number;
  available: number;
  minStock: number;
  location: string | null;
  batchNumber: string | null;
  expiryDate: string | null;
  isExpired: boolean;
  isExpiringSoon: boolean;
  isLow: boolean;
}

interface StockResponse {
  data: StockRow[];
  totals: { totalUnits: number; totalReserved: number; totalStockValueAr: number };
}

interface ProductOption {
  id: string;
  name: string;
  sku: string | null;
}

export default function Stock() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [expiry, setExpiry] = useState(searchParams.get('expiry') ?? '');
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustType, setAdjustType] = useState<'IN' | 'OUT'>('IN');
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const { data: stock, isLoading, error } = useQuery({
    queryKey: ['stock', search, warehouseId, lowStockOnly, expiry],
    queryFn: async () => {
      const res = await api.get('/stock', {
        params: {
          search: search || undefined,
          warehouseId: warehouseId || undefined,
          lowStock: lowStockOnly || undefined,
          expiry: expiry || undefined,
        },
      });
      return res.data as StockResponse;
    },
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const res = await api.get('/stock/warehouses');
      return res.data as Warehouse[];
    },
  });

  const { data: products } = useQuery({
    queryKey: ['stock-product-options'],
    queryFn: async () => {
      const res = await api.get('/products', { params: { limit: 100, search: '' } });
      return (res.data.data as ProductOption[]);
    },
  });

  const adjustMutation = useMutation({
    mutationFn: async (data: { productId: string; warehouseId: string; quantity: number; type: 'IN' | 'OUT'; reason?: string; batchNumber?: string; expiryDate?: string }) => {
      const res = await api.post('/stock/adjust', data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Stock ajusté');
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setProductId('');
      setQty('');
      setReason('');
      setBatchNumber('');
      setExpiryDate('');
      setAdjustOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const openAdjust = (type: 'IN' | 'OUT', preProductId?: string) => {
    setAdjustType(type);
    setProductId(preProductId ?? '');
    setQty('');
    setReason('');
    setBatchNumber('');
    setExpiryDate('');
    setAdjustOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const quantity = Number(qty);
    if (!productId || !warehouseId || quantity <= 0) {
      toast.error('Complétez le produit, l\u2019entrepôt et la quantité');
      return;
    }
    adjustMutation.mutate({
      productId,
      warehouseId,
      quantity,
      type: adjustType,
      reason: reason || undefined,
      batchNumber: adjustType === 'IN' && batchNumber.trim() ? batchNumber.trim() : undefined,
      expiryDate: adjustType === 'IN' && expiryDate ? expiryDate : undefined,
    });
  };

  return (
    <div>
      <PageHeader
        title="Stock"
        subtitle="Suivez vos quantités en temps réel dans tous vos entrepôts"
        actions={
          <>
            <Button variant="outline" onClick={() => openAdjust('OUT')}>
              <ArrowUpFromLine className="w-4 h-4" />
              Sortie
            </Button>
            <Button onClick={() => openAdjust('IN')}>
              <ArrowDownToLine className="w-4 h-4" />
              Entrée / Ajustement
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Unités en stock</p>
          <p className="mt-1 text-xl font-bold text-dark-900">{formatNumber(stock?.totals.totalUnits ?? 0)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Réservées</p>
          <p className="mt-1 text-xl font-bold text-dark-900">{formatNumber(stock?.totals.totalReserved ?? 0)}</p>
        </Card>
        <Card className="p-4 col-span-2 lg:col-span-1">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Valeur du stock</p>
          <p className="mt-1 text-xl font-bold text-dark-900">{formatAr(stock?.totals.totalStockValueAr ?? 0)}</p>
        </Card>
      </div>

      <Card className="mb-4 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex-1 w-full">
          <SearchInput value={search} onChange={setSearch} placeholder="Rechercher un produit..." />
        </div>
        <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="sm:w-56">
          <option value="">Tous les entrepôts</option>
          {(warehouses ?? []).filter((w) => w.isActive).map((w) => (
            <option key={w.id} value={w.id}>{w.name}{w.isMain ? ' (principal)' : ''}</option>
          ))}
        </Select>
        <Select value={expiry} onChange={(e) => {
          const v = e.target.value;
          setExpiry(v);
          setSearchParams(v ? { expiry: v } : {}, { replace: true });
        }} className="sm:w-52">
          <option value="">Toutes les péremptions</option>
          <option value="soon">Proches (30 jours)</option>
          <option value="expired">Périmés</option>
        </Select>
        <label className="flex items-center gap-2 text-sm text-slate-600 whitespace-nowrap">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
          />
          Stock bas uniquement
        </label>
      </Card>

      {(() => {
        const expired = (stock?.data ?? []).filter((r) => r.isExpired).length;
        const soon = (stock?.data ?? []).filter((r) => r.isExpiringSoon).length;
        if (expired === 0 && soon === 0) return null;
        return (
          <Card className={`mb-4 p-4 flex flex-wrap items-center gap-3 ${expired > 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
            <AlertTriangle className={`w-5 h-5 shrink-0 ${expired > 0 ? 'text-red-600' : 'text-amber-600'}`} />
            <p className={`text-sm font-medium ${expired > 0 ? 'text-red-700' : 'text-amber-700'}`}>
              {expired > 0 ? `${expired} produit(s) périmé(s) — vente bloquée tant que le stock n'est pas ajusté ou jeté.` : ''}
              {soon > 0 ? `${soon > 0 && expired > 0 ? ' ' : ''}${soon} produit(s) à date de péremption proche (30 jours).` : ''}
            </p>
            <button
              onClick={() => { setExpiry('soon'); setSearchParams({ expiry: 'soon' }, { replace: true }); }}
              className="ml-auto text-xs font-semibold text-green-700 hover:underline"
            >
              Voir les alertes
            </button>
          </Card>
        );
      })()}

      {error ? (
        <ErrorMessage message={(error as any).response?.data?.error ?? 'Erreur de chargement'} />
      ) : isLoading ? (
        <Loading />
      ) : !stock || stock.data.length === 0 ? (
        <Card>
          <EmptyState title="Aucun stock" description="Ajustez le stock pour commencer le suivi." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100 bg-slate-50/60">
                  <th className="px-4 py-3 font-medium">Produit</th>
                  <th className="px-4 py-3 font-medium">Entrepôt</th>
                  <th className="px-4 py-3 font-medium">Lot / Péremption</th>
                  <th className="px-4 py-3 font-medium text-right">Quantité</th>
                  <th className="px-4 py-3 font-medium text-right">Réservé</th>
                  <th className="px-4 py-3 font-medium text-right">Disponible</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {stock.data.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                          <Boxes className="w-4 h-4 text-slate-500" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-dark-900 truncate">{r.productName}</p>
                          {r.variantName && <p className="text-xs text-slate-400">{r.variantName}</p>}
                          {r.location && <p className="text-xs text-slate-400">{r.location}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.warehouseName}
                      {r.isMainWarehouse && <span className="ml-1 text-xs text-green-600">★</span>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-500">{r.batchNumber ? `Lot ${r.batchNumber}` : '—'}</p>
                      {r.expiryDate ? (
                        <p className={`text-xs ${r.isExpired ? 'text-red-600 font-semibold' : r.isExpiringSoon ? 'text-amber-600 font-medium' : 'text-slate-400'}`}>
                          {formatDate(r.expiryDate)}
                          {r.isExpired ? ' · périmé' : r.isExpiringSoon ? ' · bientôt' : ''}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-300">—</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-dark-900">{formatNumber(r.quantity)}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{formatNumber(r.reserved)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700">{formatNumber(r.available)}</td>
                    <td className="px-4 py-3">
                      {r.isExpired ? (
                        <Badge className="bg-red-50 text-red-600">Périmé</Badge>
                      ) : r.isLow ? (
                        <Badge className="bg-red-50 text-red-600">Stock bas</Badge>
                      ) : (
                        r.quantity <= 0 ? (
                          <Badge className="bg-slate-100 text-slate-500">Rupture</Badge>
                        ) : (
                          r.isExpiringSoon ? (
                            <Badge className="bg-amber-50 text-amber-700">Péremption proche</Badge>
                          ) : (
                            <Badge className="bg-green-50 text-green-600">OK</Badge>
                          )
                        )
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => openAdjust('IN', r.productId ?? undefined)}>+</Button>
                        <Button variant="outline" size="sm" onClick={() => openAdjust('OUT', r.productId ?? undefined)}>−</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        title={adjustType === 'IN' ? 'Entrée de stock' : 'Sortie de stock'}
        description="Ajustez la quantité d'un produit dans un entrepôt."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Produit" required>
            <Select value={productId} onChange={(e) => setProductId(e.target.value)} required>
              <option value="">Choisir un produit...</option>
              {(products ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>
              ))}
            </Select>
          </Field>
          <Field label="Entrepôt" required>
            <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
              <option value="">Choisir un entrepôt...</option>
              {(warehouses ?? []).filter((w) => w.isActive).map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </Select>
          </Field>
          <Field label={`Quantité (${adjustType === 'IN' ? 'entrée' : 'sortie'})`} required>
            <Input type="number" min={0} step="any" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" required />
          </Field>
          {adjustType === 'IN' && (
            <>
              <Field label="N° de lot" hint="Recommandé pour la pharmacie (date de péremption).">
                <Input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} placeholder="Ex : LOT-2026-01" />
              </Field>
              <Field label="Date de péremption">
                <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
              </Field>
            </>
          )}
          <Field label="Motif">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex : Livraison fournisseur, casse..." />
          </Field>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setAdjustOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={adjustMutation.isPending}>
              {adjustMutation.isPending ? 'Enregistrement...' : adjustType === 'IN' ? 'Enregistrer l\u2019entrée' : 'Enregistrer la sortie'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}