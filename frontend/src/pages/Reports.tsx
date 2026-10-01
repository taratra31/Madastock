import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Download, PackageSearch, Repeat, TrendingUp } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import api from '../lib/api';
import { formatAr, formatNumber, toDateInput } from '../lib/format';
import { usePermissions } from '../lib/permissions';
import { paymentMethodLabels } from '../lib/labels';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorMessage,
  Input,
  Loading,
  PageHeader,
} from '../components/ui';

type Tab = 'ventes' | 'rotation' | 'produits';

const PIE_COLORS = ['#16a34a', '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#ec4899'];

const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return toDateInput(date);
};

function Kpi({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'good' | 'bad';
}) {
  const toneClass =
    tone === 'good' ? 'text-green-600' : tone === 'bad' ? 'text-red-600' : 'text-dark-900';
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${toneClass}`}>{value}</p>
      {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
    </Card>
  );
}

export default function Reports() {
  const { can } = usePermissions();
  const canSeeCosts = can('cost.view');
  const [tab, setTab] = useState<Tab>('ventes');
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(toDateInput(new Date()));

  const salesQuery = useQuery({
    queryKey: ['report-sales', from, to],
    queryFn: async () => {
      const res = await api.get('/reports/sales', { params: { from, to } });
      return res.data as any;
    },
    enabled: tab === 'ventes',
  });

  const rotationQuery = useQuery({
    queryKey: ['report-rotation', from, to],
    queryFn: async () => {
      const res = await api.get('/reports/rotation', { params: { from, to } });
      return res.data as any;
    },
    enabled: tab !== 'ventes',
  });

  const productsQuery = useQuery({
    queryKey: ['report-products', from, to],
    queryFn: async () => {
      const res = await api.get('/reports/products', { params: { from, to } });
      return res.data as any;
    },
    enabled: tab === 'produits',
  });

  const exportCsv = async () => {
    const dataset = tab === 'ventes' ? 'sales' : 'stock';
    const res = await api.get(`/data/export/${dataset}`, {
      params: dataset === 'sales' ? { from, to } : undefined,
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data as Blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${dataset}-${from}_${to}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const tabs: { key: Tab; label: string; icon: typeof BarChart3 }[] = [
    { key: 'ventes', label: 'Chiffre d’affaires', icon: TrendingUp },
    { key: 'rotation', label: 'Rotation des stocks', icon: Repeat },
    { key: 'produits', label: 'Performance produits', icon: PackageSearch },
  ];

  return (
    <div>
      <PageHeader
        title="Rapports"
        subtitle="Analysez vos ventes, vos marges et la rotation de vos stocks"
        actions={
          can('data.export') ? (
            <Button variant="outline" onClick={exportCsv}>
              <Download className="w-4 h-4" />
              Exporter en CSV
            </Button>
          ) : undefined
        }
      />

      <Card className="mb-4 p-4 flex flex-col sm:flex-row items-start sm:items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Du</label>
          <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Au</label>
          <Input type="date" value={to} min={from} max={toDateInput(new Date())} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          {[
            { label: '7 jours', days: 6 },
            { label: '30 jours', days: 29 },
            { label: '90 jours', days: 89 },
            { label: '365 jours', days: 364 },
          ].map((preset) => (
            <Button
              key={preset.label}
              variant="outline"
              size="sm"
              onClick={() => {
                setFrom(daysAgo(preset.days));
                setTo(toDateInput(new Date()));
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </Card>

      <div className="flex items-center gap-1 mb-4 border-b border-slate-200">
        {tabs.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              tab === item.key
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'ventes' &&
        (salesQuery.isLoading ? (
          <Loading />
        ) : salesQuery.error ? (
          <ErrorMessage message={(salesQuery.error as any).response?.data?.error ?? 'Erreur'} />
        ) : salesQuery.data?.totals?.salesCount === 0 ? (
          <Card>
            <EmptyState title="Aucune vente sur la période" description="Changez de dates ou enregistrez une vente." />
          </Card>
        ) : (
          salesQuery.data && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Kpi
                  label="Chiffre d'affaires"
                  value={formatAr(salesQuery.data.totals.revenueExclTax)}
                  hint={
                    salesQuery.data.totals.growthPct !== null
                      ? `${salesQuery.data.totals.growthPct >= 0 ? '+' : ''}${formatNumber(salesQuery.data.totals.growthPct)} % vs avant`
                      : 'Première période'
                  }
                  tone={salesQuery.data.totals.growthPct === null ? 'default' : salesQuery.data.totals.growthPct >= 0 ? 'good' : 'bad'}
                />
                <Kpi label="Ventes" value={formatNumber(salesQuery.data.totals.salesCount)} hint={`Panier moyen ${formatAr(salesQuery.data.totals.averageBasket)}`} />
                {canSeeCosts ? (
                  <>
                    <Kpi label="Marge brute" value={formatAr(salesQuery.data.totals.grossProfit)} hint={`${formatNumber(salesQuery.data.totals.marginPct)} % du CA`} tone="good" />
                    <Kpi label="Résultat net" value={formatAr(salesQuery.data.totals.netProfit)} hint={`Charges ${formatAr(salesQuery.data.totals.expenses)}`} tone={salesQuery.data.totals.netProfit >= 0 ? 'good' : 'bad'} />
                  </>
                ) : (
                  <Kpi label="Charges" value={formatAr(salesQuery.data.totals.expenses)} hint="Vos coûts d'achat sont masqués" />
                )}
              </div>

              <Card className="p-4">
                <h2 className="font-semibold text-dark-900 mb-3">Ventes par jour</h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={salesQuery.data.series}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatNumber(v)} width={60} />
                      <Tooltip formatter={(v: number) => formatAr(v)} labelFormatter={(l) => String(l)} />
                      <Line type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="p-4">
                  <h2 className="font-semibold text-dark-900 mb-3">Meilleures ventes</h2>
                  <div className="space-y-2">
                    {salesQuery.data.topProducts.slice(0, 10).map((p: any) => (
                      <div key={p.productId} className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate text-slate-700">{p.name}</span>
                        <span className="text-slate-500 whitespace-nowrap">
                          {formatNumber(p.qty)} × {formatAr(p.revenue / (p.qty || 1))}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="p-4">
                  <h2 className="font-semibold text-dark-900 mb-3">Moyens de paiement</h2>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={salesQuery.data.byPaymentMethod}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="method" tickFormatter={(m: string) => paymentMethodLabels[m] ?? m} tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} width={70} />
                        <Tooltip formatter={(v: number) => formatAr(v)} />
                        <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                          {salesQuery.data.byPaymentMethod.map((_: unknown, index: number) => (
                            <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
            </div>
          )
        ))}

      {tab !== 'ventes' &&
        (rotationQuery.isLoading ? (
          <Loading />
        ) : rotationQuery.error ? (
          <ErrorMessage message={(rotationQuery.error as any).response?.data?.error ?? 'Erreur'} />
        ) : rotationQuery.data ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {canSeeCosts && rotationQuery.data.totals.rotationRatio !== null ? (
                <Kpi
                  label="Rotation globale"
                  value={`${formatNumber(rotationQuery.data.totals.rotationRatio)} ×`}
                  hint="Coût de revient vendu / valeur du stock (base mensuelle)"
                />
              ) : null}
              {canSeeCosts && <Kpi label="Valeur du stock" value={formatAr(rotationQuery.data.totals.stockValue)} />}
              <Kpi
                label="Produits dormants"
                value={formatNumber(rotationQuery.data.totals.deadStockCount)}
                hint={canSeeCosts ? `${formatAr(rotationQuery.data.totals.deadStockValue)} immobilisés` : 'Aucune vente sur la période'}
                tone={rotationQuery.data.totals.deadStockCount > 0 ? 'bad' : 'good'}
              />
              <Kpi label="Références suivies" value={formatNumber(rotationQuery.data.totals.productCount)} />
            </div>

            {tab === 'produits' && productsQuery.data && (
              <Card className="p-4">
                <h2 className="font-semibold text-dark-900 mb-1">Produits qui consomment le moins de trésorerie</h2>
                <p className="text-sm text-slate-500 mb-3">
                  Besoin en fonds moyen : {formatNumber(productsQuery.data.averageCapitalPct)} % du chiffre d’affaires de la période.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                        <th className="px-3 py-2 font-medium">Produit</th>
                        <th className="px-3 py-2 font-medium text-right">Stock</th>
                        <th className="px-3 py-2 font-medium text-right">Vendu</th>
                        <th className="px-3 py-2 font-medium text-right">CA</th>
                        {canSeeCosts && <th className="px-3 py-2 font-medium text-right">Fonds immobilisés</th>}
                        <th className="px-3 py-2 font-medium text-right">Couverture</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productsQuery.data.bestMargins.slice(0, 15).map((p: any) => (
                        <tr key={p.productId} className="border-b border-slate-50 last:border-0">
                          <td className="px-3 py-2 text-slate-700">{p.name}</td>
                          <td className="px-3 py-2 text-right">{formatNumber(p.quantity)}</td>
                          <td className="px-3 py-2 text-right">{formatNumber(p.soldQty)}</td>
                          <td className="px-3 py-2 text-right">{formatAr(p.revenue)}</td>
                          {canSeeCosts && (
                            <td className="px-3 py-2 text-right">
                              {formatAr(p.stockValue)}
                              {p.capitalPct !== null && (
                                <span className="text-xs text-slate-400"> ({formatNumber(p.capitalPct)} %)</span>
                              )}
                            </td>
                          )}
                          <td className="px-3 py-2 text-right">
                            {p.daysOfStock === null ? (
                              <Badge className="bg-red-50 text-red-600">Aucune vente</Badge>
                            ) : (
                              `${formatNumber(p.daysOfStock)} j`
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {rotationQuery.data.deadStock.length > 0 && (
              <Card className="p-4">
                <h2 className="font-semibold text-dark-900 mb-3">Stock dormant à écouler</h2>
                <div className="space-y-2">
                  {rotationQuery.data.deadStock.slice(0, 10).map((p: any) => (
                    <div key={p.productId} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-slate-700">{p.name}</span>
                      <span className="text-slate-500 whitespace-nowrap">
                        {formatNumber(p.quantity)} en stock
                        {canSeeCosts && ` · ${formatAr(p.stockValue)}`}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        ) : null)}
    </div>
  );
}
