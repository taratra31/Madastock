import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import {
  Wallet,
  TrendingUp,
  Boxes,
  AlertTriangle,
  Package,
  Users,
  ShoppingCart,
  BadgePercent,
  PackagePlus,
  PackageMinus,
  UserPlus,
  PackageSearch,
  History,
  ArrowUpDown,
  FileText,
  RotateCw,
  Sparkles,
  Building2,
  Store,
  Plus,
  AlertCircle,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ReferenceLine,
} from 'recharts';
import { useAuth } from '../lib/auth';
import { useStores } from '../lib/store';
import api from '../lib/api';
import { formatAr, formatNumber, formatDateTime } from '../lib/format';
import { paymentMethodLabels, movementLabels } from '../lib/labels';
import { Badge, Card, Loading, StatCard } from '../components/ui';

interface DashboardStats {
  counts: {
    products: number;
    categories: number;
    customers: number;
    warehouses: number;
    suppliers: number;
    lowStock: number;
  };
  totalStockUnits: number;
  totalReservedUnits: number;
  totalStockValueAr: number;
  avgSaleAr: number;
  totalProfitMonth: number;
  sales: {
    allTime: { revenueAr: number; discountAr: number; taxAr: number; count: number };
    month: { revenueAr: number; discountAr: number; count: number };
    today: { revenueAr: number; count: number };
    yesterday: { revenueAr: number; count: number };
    week: { revenueAr: number; count: number };
  };
  lowStockProducts: {
    productId: string;
    name: string;
    imageUrl: string | null;
    currentStock: number;
    threshold: number;
    sellingPriceAr: number;
  }[];
  weeklySalesByDay: { day: string; revenue: number; count: number }[];
  salesByPaymentMethod: { method: string; revenueAr: number; count: number }[];
  recentSales: {
    id: string;
    receiptNumber: string;
    totalAr: number;
    status: string;
    paymentMethod: string | null;
    createdAt: string;
    itemsCount: number;
  }[];
  topProducts: {
    productId: string;
    name: string;
    imageUrl: string | null;
    sellingPriceAr: number;
    costPriceAr: number;
    quantitySold: number;
    revenueAr: number;
    costAr: number;
    orderCount: number;
  }[];
  recentMovements: {
    id: string;
    type: string;
    quantity: number;
    productName: string | null;
    imageUrl: string | null;
    warehouseName: string;
    reason: string;
    createdAt: string;
  }[];
}

const PIE_COLORS = ['#10b981', '#14b8a6', '#0ea5e9', '#f59e0b', '#8b5cf6'];

const RANK_CLS = [
  'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm',
  'bg-gradient-to-br from-slate-400 to-slate-500 text-white shadow-sm',
  'bg-gradient-to-br from-yellow-500 to-amber-400 text-white shadow-sm',
];

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #e2e8f0',
  boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.08)',
  fontSize: 12,
  padding: '8px 12px',
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function WeekTooltip({ active, payload, label }: { active?: boolean; payload?: { payload: { revenue: number; count: number } }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-xl shadow-slate-900/10">
      <p className="text-xs font-semibold text-slate-700">{label}</p>
      <p className="mt-1 text-sm font-bold text-emerald-600">{formatAr(d.revenue)}</p>
      <p className="text-xs text-slate-400">{formatNumber(d.count)} vente(s)</p>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  iconClass,
  extra,
}: {
  icon: typeof Package;
  title: string;
  iconClass: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="flex items-center gap-2.5 font-semibold text-dark-900">
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconClass}`}>
          <Icon className="w-4 h-4" />
        </span>
        {title}
      </h3>
      {extra}
    </div>
  );
}

export default function Dashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { memberships, currentStore, setCurrentStore } = useStores();
  const navigate = useNavigate();

  const { data: stats, isFetching, refetch } = useQuery({
    queryKey: ['dashboard-stats', currentStore?.id],
    queryFn: async () => {
      const res = await api.get('/dashboard/stats');
      return res.data as DashboardStats;
    },
    enabled: isAuthenticated && !!currentStore,
  });

  useEffect(() => {
    if (!isLoading && isAuthenticated && !currentStore && memberships.length > 0) {
      setCurrentStore(memberships[0].store.id);
    }
  }, [isLoading, isAuthenticated, currentStore, memberships, setCurrentStore]);

  const greeting = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const greetingLabel = greeting.charAt(0).toUpperCase() + greeting.slice(1);

  if (isLoading) return <Loading />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Aucun commerce = on ne redirige pas vers une page vide : on accueille
  // l'utilisateur et on lui propose de créer sa boutique.
  if (!currentStore) {
    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 shadow-xl shadow-emerald-500/10">
          <div className="absolute -top-16 -right-10 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
          <div className="relative px-6 sm:px-8 py-8">
            <p className="flex items-center gap-1.5 text-emerald-100 text-[13px] font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              {greetingLabel}
            </p>
            <h1 className="mt-1.5 text-2xl sm:text-3xl font-bold text-white">
              Bonjour, {user?.fullName ?? 'et bienvenue sur MadaStock'}
            </h1>
            <p className="mt-2 text-emerald-50/90 text-sm max-w-xl">
              Vous n'avez pas encore de boutique. Créez la vôtre en 1 minute : stock, ventes,
              factures et clients seront à votre portée.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={() => navigate('/stores?create=1')}
                className="inline-flex items-center gap-2 bg-white text-emerald-700 text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md transition-all hover:bg-emerald-50"
              >
                <Plus className="w-4 h-4" />
                Créer ma boutique
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: Store, title: 'Créez votre boutique', text: 'Un nom suffit pour démarrer.' },
            { icon: PackagePlus, title: 'Ajoutez vos produits', text: 'Stock, prix et fournisseur.' },
            { icon: Wallet, title: 'Encaissez vos ventes', text: 'Reçu, facture et rapport.' },
          ].map((c) => (
            <div key={c.title} className="bg-white rounded-2xl border border-slate-200 p-4 flex gap-3">
              <span className="w-10 h-10 shrink-0 rounded-xl bg-emerald-50 flex items-center justify-center">
                <c.icon className="w-5 h-5 text-emerald-600" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-dark-900">{c.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{c.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const todayRevenue = stats?.sales.today.revenueAr ?? 0;
  const yesterdayRevenue = stats?.sales.yesterday.revenueAr ?? 0;
  const delta =
    yesterdayRevenue > 0
      ? (((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100).toFixed(1)
      : todayRevenue > 0
        ? '100'
        : '0';

  const quickActions = [
    { icon: ShoppingCart, label: 'Vente POS', to: '/sales', grad: 'from-emerald-500 to-teal-500' },
    { icon: PackagePlus, label: 'Ajouter un produit', to: '/products', grad: 'from-indigo-500 to-violet-500' },
    { icon: PackageMinus, label: 'Voir le stock', to: '/stock', grad: 'from-sky-500 to-blue-500' },
    { icon: UserPlus, label: 'Nouveau client', to: '/customers', grad: 'from-amber-400 to-orange-500' },
    { icon: FileText, label: 'Devis & factures', to: '/invoices', grad: 'from-rose-500 to-red-500' },
  ];

  const totalPie = pieValue(stats?.salesByPaymentMethod);

  // Phrase d'accueil : dépend de l'état réel de la boutique.
  const todaySales = stats?.sales.today.count ?? 0;
  const monthSales = stats?.sales.month.count ?? 0;
  const productCount = stats?.counts.products ?? 0;
  const activityLine = !stats
    ? 'Chargement de votre activité...'
    : todaySales > 0
      ? `${todaySales} vente${todaySales > 1 ? 's' : ''} aujourd'hui · ${formatAr(todayRevenue)} encaissés`
      : monthSales > 0
        ? `Pas de vente aujourd'hui · ${monthSales} vente${monthSales > 1 ? 's' : ''} ce mois-ci`
        : productCount > 0
          ? `${formatNumber(productCount)} produit${productCount > 1 ? 's' : ''} en stock · à vous la première vente`
          : 'Boutique créée · ajoutez votre premier produit pour commencer';

  const subscription = currentStore.subscription;
  const subscriptionExpired =
    !!subscription && !['ACTIVE', 'TRIALING'].includes(subscription.status);

  const weekData = stats?.weeklySalesByDay ?? [];
  const weekTotal = weekData.reduce((s, d) => s + d.revenue, 0);
  const weekAvg = weekData.length ? weekTotal / weekData.length : 0;
  const bestDay = weekData.reduce(
    (a, b) => (b.revenue > a.revenue ? b : a),
    { day: '—', revenue: 0 } as { day: string; revenue: number; count: number },
  );

  return (
    <div className="space-y-6">
      {/* Bannière d'accueil */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 shadow-xl shadow-emerald-500/10">
        <div className="absolute -top-16 -right-10 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-20 right-40 w-40 h-40 rounded-full bg-teal-300/20 blur-2xl" />
        <div className="absolute top-8 left-1/3 w-24 h-24 rounded-full bg-white/5 blur-xl" />
        <div className="relative px-6 sm:px-8 py-7 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-emerald-100 text-[13px] font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              {greetingLabel}
            </p>
            <h1 className="mt-1.5 text-2xl sm:text-3xl font-bold text-white truncate">
              Bonjour, {user?.fullName ?? 'cher commerçant'}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {memberships.length > 1 ? (
                <span className="relative inline-flex items-center">
                  <Building2 className="w-4 h-4 text-emerald-100 absolute left-2.5 pointer-events-none" />
                  <select
                    value={currentStore.id}
                    onChange={(e) => setCurrentStore(e.target.value)}
                    className="bg-white/95 text-emerald-800 text-sm font-semibold pl-8 pr-8 py-1.5 rounded-xl border-0 focus:outline-none focus:ring-2 focus:ring-white/70 max-w-[260px]"
                    aria-label="Changer de boutique"
                  >
                    {memberships.map((m) => (
                      <option key={m.store.id} value={m.store.id}>
                        {m.store.name}
                      </option>
                    ))}
                  </select>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 bg-white/15 text-white text-sm font-semibold px-2.5 py-1.5 rounded-xl">
                  <Building2 className="w-4 h-4" />
                  {currentStore.name}
                </span>
              )}

              {currentStore.city && (
                <span className="text-emerald-50/80 text-xs">{currentStore.city}</span>
              )}

              {subscription && (
                <span
                  className={`text-[11px] font-semibold px-2 py-1 rounded-lg ${
                    subscriptionExpired
                      ? 'bg-red-500 text-white'
                      : 'bg-white/20 text-white'
                  }`}
                >
                  {subscription.plan.name}
                  {subscriptionExpired ? ' · à renouveler' : ''}
                </span>
              )}

              {!currentStore.active && (
                <span className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-red-500 text-white">
                  Boutique inactive
                </span>
              )}
            </div>

            <p className="mt-2 text-emerald-50/90 text-sm">{activityLine}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navigate('/products')}
              className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all"
            >
              <PackagePlus className="w-4 h-4" />
              Produit
            </button>
            <button
              onClick={() => navigate('/sales')}
              className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all"
            >
              <ShoppingCart className="w-4 h-4" />
              Vendre
            </button>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 bg-white/95 hover:bg-white text-emerald-700 text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-emerald-900/10 transition-all"
            >
              <RotateCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
          </div>
        </div>
      </div>

      {subscriptionExpired && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="min-w-0">
            Votre abonnement <strong>{subscription?.plan.name}</strong> n'est plus actif.{' '}
            <button onClick={() => navigate('/billing')} className="underline font-semibold">
              Renouveler maintenant
            </button>
          </span>
        </div>
      )}

      {stats?.counts.lowStock ? (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 text-sm px-4 py-3">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            <strong>{stats.counts.lowStock}</strong> produit{stats.counts.lowStock > 1 ? 's' : ''} sous le
            seuil d'alerte.{' '}
            <button onClick={() => navigate('/stock')} className="underline font-semibold">
              Voir le stock
            </button>
          </span>
        </div>
      ) : null}

      {!stats && isFetching ? (
        <Loading />
      ) : (
        <>
          {/* Actions rapides */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {quickActions.map((a) => (
              <button
                key={a.label}
                onClick={() => navigate(a.to)}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <span
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${a.grad} text-white shadow-md shadow-black/5 transition-transform group-hover:scale-110`}
                >
                  <a.icon className="h-5 w-5" />
                </span>
                <p className="mt-3 text-[13px] font-medium text-dark-900 leading-tight">{a.label}</p>
              </button>
            ))}
          </div>

          {/* Statistiques principales */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <StatCard
              label="CA aujourd'hui"
              value={formatAr(todayRevenue)}
              icon={Wallet}
              gradient="from-emerald-500 to-teal-500"
              sub={
                <span className={Number(delta) >= 0 ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>
                  {Number(delta) >= 0 ? '+' : ''}{delta}% vs hier
                </span>
              }
            />
            <StatCard
              label="CA du mois"
              value={formatAr(stats?.sales.month.revenueAr ?? 0)}
              icon={TrendingUp}
              gradient="from-sky-500 to-blue-600"
              sub={<span>{formatNumber(stats?.sales.month.count ?? 0)} ventes</span>}
            />
            <StatCard
              label="Valeur du stock"
              value={formatAr(stats?.totalStockValueAr ?? 0)}
              icon={Boxes}
              gradient="from-violet-500 to-purple-600"
              sub={<span>{formatNumber(stats?.totalStockUnits ?? 0)} unités</span>}
            />
            <StatCard
              label="Alertes stock"
              value={formatNumber(stats?.counts.lowStock ?? 0)}
              icon={AlertTriangle}
              gradient={stats && stats.counts.lowStock > 0 ? 'from-rose-500 to-red-600' : 'from-slate-400 to-slate-500'}
              sub={<span>produits sous le seuil</span>}
            />
          </div>

          {/* Statistiques secondaires */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <StatCard
              label="Produits"
              value={formatNumber(stats?.counts.products ?? 0)}
              icon={Package}
              gradient="from-slate-500 to-slate-600"
              sub={<span>{formatNumber(stats?.counts.categories ?? 0)} catégories</span>}
            />
            <StatCard
              label="Clients"
              value={formatNumber(stats?.counts.customers ?? 0)}
              icon={Users}
              gradient="from-amber-400 to-orange-500"
              sub={<span>{formatNumber(stats?.counts.suppliers ?? 0)} fournisseurs</span>}
            />
            <StatCard
              label="CA total"
              value={formatAr(stats?.sales.allTime.revenueAr ?? 0)}
              icon={ShoppingCart}
              gradient="from-emerald-500 to-green-600"
              sub={<span>{formatNumber(stats?.sales.allTime.count ?? 0)} ventes</span>}
            />
            <StatCard
              label="Panier moyen"
              value={formatAr(stats?.avgSaleAr ?? 0)}
              icon={BadgePercent}
              gradient="from-rose-500 to-pink-600"
              sub={<span>Bénéfice mois : {formatAr(stats?.totalProfitMonth ?? 0)}</span>}
            />
          </div>

          {/* Graphiques */}
          <div className="grid lg:grid-cols-5 gap-4">
            <Card className="lg:col-span-3 p-5">
              <SectionTitle
                icon={TrendingUp}
                title="Ventes de la semaine"
                iconClass="bg-gradient-to-br from-emerald-500 to-teal-500 text-white"
                extra={
                  stats && weekData.length > 0 && bestDay.revenue > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-amber-50 text-amber-600">
                        Meilleur jour : {cap(bestDay.day)} · {formatAr(bestDay.revenue)}
                      </Badge>
                      <Badge className="bg-emerald-50 text-emerald-600">CA : {formatAr(weekTotal)}</Badge>
                    </div>
                  )
                }
              />
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weekData} margin={{ top: 10, right: 5, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#14b8a6" />
                      </linearGradient>
                      <linearGradient id="fillGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      tickFormatter={(d) => cap(d)}
                      axisLine={false}
                      tickLine={false}
                      dy={6}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                      width={42}
                    />
                    <Tooltip content={<WeekTooltip />} cursor={{ stroke: '#16a34a', strokeWidth: 1, strokeDasharray: '4 4' }} />
                    {weekAvg > 0 && (
                      <ReferenceLine
                        y={weekAvg}
                        stroke="#94a3b8"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        label={{ value: 'Moyenne', position: 'insideTopRight', fill: '#94a3b8', fontSize: 10 }}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      name="CA"
                      stroke="url(#lineGradient)"
                      strokeWidth={2.5}
                      fill="url(#fillGradient)"
                      activeDot={{ r: 5, strokeWidth: 2, stroke: '#ffffff', fill: '#10b981' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="lg:col-span-2 p-5">
              <SectionTitle
                icon={Wallet}
                title="Ventes par paiement"
                iconClass="bg-gradient-to-br from-sky-500 to-blue-600 text-white"
              />
              {pieData(stats?.salesByPaymentMethod).length === 0 ? (
                <div className="h-64 flex items-center justify-center text-sm text-slate-400">Aucune donnée</div>
              ) : (
                <>
                  <div className="relative h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData(stats?.salesByPaymentMethod)}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={50}
                          outerRadius={78}
                          paddingAngle={3}
                          stroke="#ffffff"
                          strokeWidth={2}
                        >
                          {pieData(stats?.salesByPaymentMethod).map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatAr(Number(v))} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[11px] uppercase tracking-wide text-slate-400">Total</span>
                      <span className="text-lg font-bold text-dark-900">{formatAr(totalPie)}</span>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {pieData(stats?.salesByPaymentMethod).map((p, i) => (
                      <div key={p.name} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-slate-600">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          {p.name}
                        </span>
                        <span className="font-medium text-dark-900">{formatAr(p.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </div>

          {/* Top produits + stock bas */}
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <SectionTitle
                icon={PackageSearch}
                title="Top produits"
                iconClass="bg-gradient-to-br from-emerald-500 to-teal-500 text-white"
              />
              {!stats?.topProducts || stats.topProducts.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">Aucune vente enregistrée</p>
              ) : (
                <div className="space-y-4">
                  {stats.topProducts.slice(0, 5).map((p, i) => (
                    <div key={p.productId} className="flex items-center gap-3 group">
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${RANK_CLS[i] ?? 'bg-slate-100 text-slate-500'}`}
                      >
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-dark-900 truncate">{p.name}</p>
                        <div className="flex items-center gap-3">
                          <p className="text-xs text-slate-500">{formatNumber(p.quantitySold)} vendus</p>
                          <div className="h-1 flex-1 bg-slate-100 rounded-full overflow-hidden max-w-[140px]">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                              style={{ width: `${Math.min(100, (p.quantitySold / (stats.topProducts[0]?.quantitySold || 1)) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-dark-900">{formatAr(p.revenueAr)}</p>
                        <p className="text-xs text-slate-500">{formatNumber(p.orderCount)} commandes</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <SectionTitle
                icon={AlertTriangle}
                title="Stock bas"
                iconClass="bg-gradient-to-br from-rose-500 to-red-500 text-white"
                extra={
                  stats && stats.counts.lowStock > 0 && (
                    <Badge className="bg-red-50 text-red-600">{stats.counts.lowStock} alerte(s)</Badge>
                  )
                }
              />
              {!stats?.lowStockProducts || stats.lowStockProducts.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8 flex items-center justify-center gap-2">
                  <Boxes className="w-4 h-4" />
                  Aucun stock bas
                </p>
              ) : (
                <div className="space-y-4">
                  {stats.lowStockProducts.slice(0, 5).map((p) => (
                    <div key={p.productId} className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-dark-900 truncate">{p.name}</p>
                        <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${p.currentStock === 0 ? 'bg-gradient-to-r from-red-500 to-rose-500' : 'bg-gradient-to-r from-amber-400 to-red-500'}`}
                            style={{ width: `${Math.min(100, (p.currentStock / p.threshold) * 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-red-600">{formatNumber(p.currentStock)} u.</p>
                        <p className="text-xs text-slate-400">seuil {formatNumber(p.threshold)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Ventes récentes + mouvements */}
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <SectionTitle
                icon={History}
                title="Ventes récentes"
                iconClass="bg-gradient-to-br from-emerald-500 to-teal-500 text-white"
              />
              {!stats?.recentSales || stats.recentSales.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">Aucune vente enregistrée</p>
              ) : (
                <div className="space-y-2">
                  {stats.recentSales.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-lg px-2 -mx-2 py-1.5 transition-colors hover:bg-slate-50">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-dark-900">{s.receiptNumber}</p>
                        <p className="text-xs text-slate-500">
                          {formatDateTime(s.createdAt)} · {formatNumber(s.itemsCount)} article(s)
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-dark-900">{formatAr(s.totalAr)}</p>
                        <p className="text-xs text-slate-500">{s.paymentMethod ? paymentMethodLabels[s.paymentMethod] ?? s.paymentMethod : '—'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <SectionTitle
                icon={ArrowUpDown}
                title="Mouvements de stock"
                iconClass="bg-gradient-to-br from-sky-500 to-blue-600 text-white"
              />
              {!stats?.recentMovements || stats.recentMovements.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">Aucun mouvement</p>
              ) : (
                <div className="space-y-2">
                  {stats.recentMovements.slice(0, 6).map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded-lg px-2 -mx-2 py-1.5 transition-colors hover:bg-slate-50">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-dark-900 truncate">{m.productName ?? m.reason ?? 'Produit'}</p>
                        <p className="text-xs text-slate-500">
                          {movementLabels[m.type] ?? m.type} · {m.warehouseName} · {formatDateTime(m.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`text-sm font-bold shrink-0 ${
                          m.type.startsWith('STOCK_IN') || m.type === 'TRANSFER_IN' || m.type === 'RETURN' ? 'text-emerald-600' : 'text-slate-600'
                        }`}
                      >
                        {m.type.startsWith('STOCK_IN') || m.type === 'TRANSFER_IN' || m.type === 'RETURN' ? '+' : ''}
                        {formatNumber(m.quantity)} u.
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function pieData(data?: { method: string; revenueAr: number; count: number }[]) {
  return (data ?? []).map((p) => ({
    name: paymentMethodLabels[p.method] ?? p.method,
    value: p.revenueAr,
  }));
}

function pieValue(data?: { method: string; revenueAr: number; count: number }[]) {
  return (data ?? []).reduce((s, p) => s + p.revenueAr, 0);
}