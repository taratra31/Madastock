import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Boxes,
  AlertTriangle,
  History,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { formatAr, formatNumber, formatDate, formatDateTime } from '../lib/format';
import { usePermissions } from '../lib/permissions';
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

interface Movement {
  id: string;
  productId: string | null;
  productName: string;
  productSku: string | null;
  unit: string;
  variantName: string | null;
  warehouseId: string;
  warehouseName: string;
  movementType: string;
  quantity: number;
  unitCostAr: number | null;
  reason: string | null;
  referenceType: string | null;
  createdByName: string;
  createdAt: string;
}

const MOVEMENT_LABELS: Record<string, string> = {
  SALE: 'Vente',
  PURCHASE: 'Réception achat',
  STOCK_IN: 'Entrée',
  STOCK_OUT: 'Sortie',
  TRANSFER_OUT: 'Transfert envoyé',
  TRANSFER_IN: 'Transfert reçu',
  ADJUSTMENT: 'Ajustement',
  LOSS: 'Perte / casse',
};

const OUT_MOVEMENTS = ['SALE', 'STOCK_OUT', 'TRANSFER_OUT', 'LOSS'];

function MovementHistory({ warehouses }: { warehouses: Warehouse[] }) {
  const [search, setSearch] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const { can } = usePermissions();
  const showCost = can('product.write') || can('purchase.read');

  const { data, isLoading, error } = useQuery({
    queryKey: ['stock-movements', search, warehouseId, type, from, to, page],
    queryFn: async () => {
      const res = await api.get('/stock/movements', {
        params: {
          search: search || undefined,
          warehouseId: warehouseId || undefined,
          type: type || undefined,
          from: from || undefined,
          to: to || undefined,
          page,
          pageSize: 25,
        },
      });
      return res.data as { items: Movement[]; total: number; page: number; pageCount: number };
    },
  });

  return (
    <>
      <Card className="mb-4 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-2">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Rechercher un produit..." />
        </div>
        <Select value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setPage(1); }}>
          <option value="">Tous les entrepôts</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.name}{w.isMain ? ' (principal)' : ''}</option>
          ))}
        </Select>
        <Select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
          <option value="">Tous les types</option>
          {Object.entries(MOVEMENT_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </Select>
        <div className="flex items-center gap-2">
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} aria-label="Du" />
          <span className="text-slate-400">→</span>
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} aria-label="Au" />
        </div>
      </Card>

      {error ? (
        <ErrorMessage message={(error as any).response?.data?.error ?? 'Erreur de chargement'} />
      ) : isLoading ? (
        <Loading />
      ) : !data || data.items.length === 0 ? (
        <Card>
          <EmptyState title="Aucun mouvement" description="Les entrées, sorties, ventes et transferts apparaîtront ici." />
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100 bg-slate-50/60">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Produit</th>
                    <th className="px-4 py-3 font-medium">Entrepôt</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium text-right">Quantité</th>
                    {showCost && <th className="px-4 py-3 font-medium text-right">Coût unitaire</th>}
                    <th className="px-4 py-3 font-medium">Auteur</th>
                    <th className="px-4 py-3 font-medium">Motif</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((m) => {
                    const isOut = OUT_MOVEMENTS.includes(m.movementType);
                    return (
                      <tr key={m.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDateTime(m.createdAt)}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-dark-900">{m.productName}</p>
                          <p className="text-xs text-slate-400">
                            {m.variantName ? `${m.variantName} · ` : ''}{m.productSku ?? '—'}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{m.warehouseName}</td>
                        <td className="px-4 py-3">
                          <Badge className={isOut ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}>
                            {MOVEMENT_LABELS[m.movementType] ?? m.movementType}
                          </Badge>
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold ${isOut ? 'text-red-600' : 'text-green-600'}`}>
                          {isOut ? '−' : '+'}{formatNumber(m.quantity)} <span className="text-xs font-normal text-slate-400">{m.unit}</span>
                        </td>
                        {showCost && (
                          <td className="px-4 py-3 text-right text-slate-600">
                            {m.unitCostAr === null ? '—' : formatAr(m.unitCostAr)}
                          </td>
                        )}
                        <td className="px-4 py-3 text-slate-600">{m.createdByName}</td>
                        <td className="px-4 py-3 text-slate-500">{m.reason ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="mt-3 flex items-center justify-between">
            <p className="text-sm text-slate-500">{formatNumber(data.total)} mouvement(s)</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="w-4 h-4" /> Précédent
              </Button>
              <span className="text-sm text-slate-600">{data.page} / {data.pageCount}</span>
              <Button variant="outline" size="sm" disabled={page >= data.pageCount} onClick={() => setPage((p) => p + 1)}>
                Suivant <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default function Stock() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { can } = usePermissions();
  const canWrite = can('stock.write');
  const [tab, setTab] = useState<'etat' | 'historique'>('etat');
  const [search, setSearch] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [expiry, setExpiry] = useState(searchParams.get('expiry') ?? '');
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferProductId, setTransferProductId] = useState('');
  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferQty, setTransferQty] = useState('');
  const [transferReason, setTransferReason] = useState('');
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

  const activeWarehouses = (warehouses ?? []).filter((w) => w.isActive);

  const transferMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/warehouses/transfers', {
        productId: transferProductId,
        fromWarehouseId: transferFrom,
        toWarehouseId: transferTo,
        quantity: Number(transferQty),
        reason: transferReason.trim() || undefined,
      });
      return res.data;
    },
    onSuccess: (data: any) => {
      toast.success(`Transfert effectué : ${data?.quantity} unité(s) vers ${data?.to?.name ?? ''}`);
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setTransferOpen(false);
      setTransferQty('');
      setTransferReason('');
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const openTransfer = (preProductId?: string) => {
    setTransferProductId(preProductId ?? '');
    setTransferFrom(warehouseId || (activeWarehouses[0]?.id ?? ''));
    setTransferTo(activeWarehouses.find((w) => w.id !== warehouseId)?.id ?? '');
    setTransferQty('');
    setTransferReason('');
    setTransferOpen(true);
  };

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferProductId || !transferFrom || !transferTo || Number(transferQty) <= 0) {
      toast.error('Complétez le produit, les deux dépôts et la quantité');
      return;
    }
    transferMutation.mutate();
  };

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
          canWrite ? (
            <>
              {activeWarehouses.length > 1 && (
                <Button variant="outline" onClick={() => openTransfer()}>
                  <ArrowLeftRight className="w-4 h-4" />
                  Transférer
                </Button>
              )}
              <Button variant="outline" onClick={() => openAdjust('OUT')}>
                <ArrowUpFromLine className="w-4 h-4" />
                Sortie
              </Button>
              <Button onClick={() => openAdjust('IN')}>
                <ArrowDownToLine className="w-4 h-4" />
                Entrée / Ajustement
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="flex items-center gap-1 mb-4 border-b border-slate-200">
        <button
          onClick={() => setTab('etat')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
            tab === 'etat' ? 'border-green-600 text-green-700' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Boxes className="w-4 h-4" />
          État du stock
        </button>
        <button
          onClick={() => setTab('historique')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
            tab === 'historique' ? 'border-green-600 text-green-700' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <History className="w-4 h-4" />
          Historique des mouvements
        </button>
      </div>

      {tab === 'historique' ? (
        <MovementHistory warehouses={warehouses ?? []} />
      ) : (
      <>
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
                      {canWrite && (
                        <div className="flex items-center justify-end gap-1">
                          {activeWarehouses.length > 1 && (
                            <Button
                              variant="outline"
                              size="sm"
                              title="Transférer vers un autre dépôt"
                              onClick={() => openTransfer(r.productId ?? undefined)}
                            >
                              <ArrowLeftRight className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => openAdjust('IN', r.productId ?? undefined)}>+</Button>
                          <Button variant="outline" size="sm" onClick={() => openAdjust('OUT', r.productId ?? undefined)}>−</Button>
                        </div>
                      )}
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
      </>
      )}
      <Modal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        title="Transférer entre dépôts"
        description="La quantité quitte un dépôt et arrive dans l'autre. L'opération est enregistrée dans l'historique des deux dépôts."
      >
        <form onSubmit={handleTransfer} className="space-y-4">
          <Field label="Produit" required>
            <Select value={transferProductId} onChange={(e) => setTransferProductId(e.target.value)} required>
              <option value="">Choisir un produit...</option>
              {(products ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Depuis" required>
              <Select value={transferFrom} onChange={(e) => setTransferFrom(e.target.value)} required>
                <option value="">Dépôt de départ...</option>
                {activeWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Vers" required>
              <Select value={transferTo} onChange={(e) => setTransferTo(e.target.value)} required>
                <option value="">Dépôt d'arrivée...</option>
                {activeWarehouses.filter((w) => w.id !== transferFrom).map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Quantité" required>
            <Input type="number" min={0} step="any" value={transferQty} onChange={(e) => setTransferQty(e.target.value)} placeholder="0" required />
          </Field>
          <Field label="Motif">
            <Input value={transferReason} onChange={(e) => setTransferReason(e.target.value)} placeholder="Ex : réassort du point de vente" />
          </Field>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setTransferOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={transferMutation.isPending}>
              {transferMutation.isPending ? 'Transfert...' : 'Transférer'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}