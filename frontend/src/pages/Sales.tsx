import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingBag, ScanLine, Plus, Minus, Trash2, Receipt, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { formatAr, formatNumber } from '../lib/format';
import { paymentMethodLabels } from '../lib/labels';
import { Badge, Button, Card, EmptyState, ErrorMessage, Field, Input, Loading, Modal, PageHeader, SearchInput, Select } from '../components/ui';

interface PosProduct {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  sellingPriceAr: number;
  wholesalePriceAr: number | null;
  totalStock: number;
  imageUrl: string | null;
}

interface ProductsResponse {
  data: PosProduct[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

interface CartLine {
  productId: string;
  name: string;
  sku: string | null;
  unitPrice: number;
  qty: number;
}

interface RecentSale {
  id: string;
  receiptNumber: string;
  totalAr: number;
  paymentMethod: string;
  createdAt: string;
  items: { id: string; product: { id: string; name: string; sku: string | null } | null; quantity: number }[];
}

export default function Sales() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [barcode, setBarcode] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payMethod, setPayMethod] = useState('CASH');
  const [amountPaid, setAmountPaid] = useState('');
  const [discount, setDiscount] = useState('');
  const [receipt, setReceipt] = useState<any>(null);

  const { data: products, isLoading, error } = useQuery({
    queryKey: ['pos-products', search],
    queryFn: async () => {
      const res = await api.get('/products', { params: { search: search || undefined, limit: 50 } });
      return res.data as ProductsResponse;
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (data: unknown) => {
      const res = await api.post('/sales', data);
      return res.data;
    },
    onSuccess: (sale) => {
      toast.success(`Vente enregistrée : ${sale.receiptNumber}`);
      setCart([]);
      setAmountPaid('');
      setDiscount('');
      queryClient.invalidateQueries({ queryKey: ['pos-products'] });
      queryClient.invalidateQueries({ queryKey: ['recent-sales'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setReceipt(sale);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur lors de la vente'),
  });

  const { data: recentSales } = useQuery({
    queryKey: ['recent-sales'],
    queryFn: async () => {
      const res = await api.get('/sales', { params: { limit: 6 } });
      return res.data.data as RecentSale[];
    },
  });

  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const discountAr = Math.max(0, Number(discount) || 0);
  const total = Math.max(0, subtotal - discountAr);
  const paid = amountPaid === '' ? total : Number(amountPaid) || 0;
  const change = Math.max(0, paid - total);

  const addToCart = (p: PosProduct, qty = 1) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === p.id);
      if (existing) {
        if (existing.qty + qty > Math.max(1, p.totalStock)) {
          toast.error('Quantité supérieure au stock disponible');
          return prev;
        }
        return prev.map((l) => (l.productId === p.id ? { ...l, qty: l.qty + qty } : l));
      }
      if (qty > Math.max(1, p.totalStock)) {
        toast.error('Quantité supérieure au stock disponible');
        return prev;
      }
      return [...prev, { productId: p.id, name: p.name, sku: p.sku, unitPrice: p.sellingPriceAr, qty }];
    });
  };

  const setLineQty = (productId: string, qty: number) => {
    setCart((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, qty: Math.max(0, qty) } : l)).filter((l) => l.qty > 0)
    );
  };

  const setLinePrice = (productId: string, unitPrice: number) => {
    setCart((prev) => prev.map((l) => (l.productId === productId ? { ...l, unitPrice: Math.max(0, unitPrice) } : l)));
  };

  const removeLine = (productId: string) => setCart((prev) => prev.filter((l) => l.productId !== productId));

  const handleBarcode = (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcode.trim();
    if (!code) return;
    const list = products?.data ?? [];
    const hit = list.find((p) => (p.barcode ?? '').toLowerCase() === code.toLowerCase());
    if (hit) {
      addToCart(hit);
      setBarcode('');
      return;
    }
    api.get('/products', { params: { search: code, limit: 5 } }).then((res) => {
      const found = (res.data.data as PosProduct[]).find(
        (p) => (p.barcode ?? '').toLowerCase() === code.toLowerCase() || (p.sku ?? '').toLowerCase() === code.toLowerCase()
      );
      if (found) {
        addToCart(found);
        setBarcode('');
      } else {
        toast.error('Aucun produit trouvé');
      }
    });
  };

  const handleCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      toast.error('Le panier est vide');
      return;
    }
    checkoutMutation.mutate({
      items: cart.map((l) => ({ productId: l.productId, quantity: l.qty, unitPrice: l.unitPrice })),
      subtotalAr: subtotal,
      discountAr: discountAr || undefined,
      totalAr: total,
      amountPaidAr: paid,
      paymentMethod: payMethod,
    });
  };

  return (
    <div>
      <PageHeader
        title="Ventes (POS)"
        subtitle="Encaissement rapide : scannez le code-barres ou ajoutez les produits au panier."
        actions={
          <Button variant="outline" onClick={() => { setCart([]); setAmountPaid(''); setDiscount(''); }}>
            <Receipt className="w-4 h-4" />
            Nouveau panier
          </Button>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Catalogue / produits */}
        <div className="xl:col-span-3 space-y-4">
          <Card className="p-4">
            <form onSubmit={handleBarcode} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <SearchInput value={search} onChange={setSearch} placeholder="Rechercher : nom, SKU..." />
              </div>
              <div className="flex-1 flex items-center gap-2">
                <ScanLine className="w-4 h-4 text-slate-400 shrink-0" />
                <Input
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Scanner le code-barres puis Entrée"
                  className="font-mono"
                />
              </div>
            </form>
          </Card>

          {error ? (
            <ErrorMessage message={(error as any).response?.data?.error ?? 'Erreur de chargement'} />
          ) : isLoading ? (
            <Loading />
          ) : !products || products.data.length === 0 ? (
            <Card>
              <EmptyState title="Aucun produit" description="Ajoutez des produits pour commencer à vendre." />
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {products.data.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addToCart(p)}
                  disabled={p.totalStock <= 0}
                  className="text-left bg-white rounded-xl border border-slate-200 shadow-sm p-3 hover:border-green-400 hover:shadow-md transition-all disabled:opacity-50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-dark-900 text-sm truncate">{p.name}</p>
                    <span className="w-6 h-6 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                      <Plus className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    {p.barcode ? `Code: ${p.barcode} · ` : ''}
                    {p.sku ? `SKU: ${p.sku}` : ''}
                  </p>
                  <div className="flex items-center justify-between mt-2.5">
                    <span className="text-green-700 font-bold">{formatAr(p.sellingPriceAr)}</span>
                    <Badge className={p.totalStock <= 0 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}>
                      {p.totalStock <= 0 ? 'Rupture' : `Stock: ${formatNumber(p.totalStock)}`}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Panier */}
        <div className="xl:col-span-2">
          <Card className="p-4 flex flex-col h-full max-h-[calc(100vh-180px)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-dark-900 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-green-600" />
                Panier ({cart.length})
              </h3>
              <span className="text-xs text-slate-400">{formatAr(subtotal)}</span>
            </div>

            <form onSubmit={handleCheckout} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 mb-3">
                {cart.length === 0 ? (
                  <div className="text-center py-10">
                    <EmptyState title="Panier vide" description="Ajoutez des produits ou scannez un code-barres." />
                  </div>
                ) : (
                  cart.map((l) => (
                    <div key={l.productId} className="flex items-center gap-2.5 border border-slate-100 rounded-lg p-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-dark-900 truncate">{l.name}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            value={l.unitPrice}
                            onChange={(e) => setLinePrice(l.productId, Number(e.target.value))}
                            className="w-28 h-7 text-xs"
                          />
                          <span className="text-xs text-green-600 font-semibold">= {formatAr(l.unitPrice * l.qty)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => setLineQty(l.productId, l.qty - 1)} className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50">
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-9 text-center text-sm font-semibold">{l.qty}</span>
                        <button type="button" onClick={() => setLineQty(l.productId, l.qty + 1)} className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button type="button" onClick={() => removeLine(l.productId)} className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-3 border-t border-slate-100 pt-3">
                <div className="flex justify-between text-sm text-slate-500">
                  <span>Sous-total</span>
                  <span className="font-medium text-dark-900">{formatAr(subtotal)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500 w-20">Remise</span>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="flex justify-between text-base">
                  <span className="font-semibold text-dark-900">Total</span>
                  <span className="font-bold text-green-700">{formatAr(total)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Paiement">
                    <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                      {Object.entries(paymentMethodLabels).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Reçu">
                    <Input type="number" min={0} step="any" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder="Montant reçu" />
                  </Field>
                </div>
                {change > 0 && (
                  <div className="flex justify-between text-sm text-green-700 font-semibold">
                    <span>Monnaie à rendre</span>
                    <span>{formatAr(change)}</span>
                  </div>
                )}
                <Button type="submit" disabled={checkoutMutation.isPending || cart.length === 0} className="w-full">
                  {checkoutMutation.isPending ? 'Enregistrement...' : `Encaisser ${formatAr(total)}`}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>

      {recentSales && recentSales.length > 0 && (
        <Card className="mt-6 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-green-600" />
            <h3 className="font-semibold text-dark-900">Dernières ventes</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100 bg-slate-50/60">
                  <th className="px-4 py-2.5 font-medium">Ticket</th>
                  <th className="px-4 py-2.5 font-medium">Articles</th>
                  <th className="px-4 py-2.5 font-medium">Paiement</th>
                  <th className="px-4 py-2.5 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map((s) => (
                  <tr key={s.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2.5 font-mono text-xs">{s.receiptNumber}</td>
                    <td className="px-4 py-2.5 text-slate-600 truncate max-w-[220px]">
                      {s.items.map((it) => it.product?.name ?? '—').filter(Boolean).join(', ')}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{paymentMethodLabels[s.paymentMethod] ?? s.paymentMethod}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-dark-900">{formatAr(s.totalAr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={!!receipt}
        onClose={() => setReceipt(null)}
        title="Vente enregistrée"
        description="La vente a été validée et le stock mis à jour."
        footer={
          <Button onClick={() => setReceipt(null)}>
            <CheckCircle2 className="w-4 h-4" />
            Fermer
          </Button>
        }
      >
        {receipt && (
          <div className="space-y-3">
            <div className="text-center">
              <Receipt className="w-10 h-10 text-green-600 mx-auto" />
              <p className="font-mono text-sm mt-2">Ticket n° {receipt.receiptNumber}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 space-y-2">
              <div className="flex justify-between text-sm text-slate-500">
                <span>Total</span>
                <span className="font-bold text-dark-900">{formatAr(receipt.totalAr)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-500">
                <span>Reçu</span>
                <span>{formatAr(receipt.amountPaidAr ?? receipt.totalAr)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-500">
                <span>Monnaie</span>
                <span className="text-green-700 font-semibold">{formatAr(receipt.changeAr ?? 0)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-500">
                <span>Paiement</span>
                <span>{paymentMethodLabels[receipt.paymentMethod] ?? receipt.paymentMethod}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}