import { useEffect, useState, type ElementType } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { formatNumber } from '../lib/format';
import api from '../lib/api';
import {
  Menu,
  X,
  ShoppingCart,
  Boxes,
  Store as StoreIcon,
  BarChart3,
  Users,
  Truck,
  CreditCard,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Star,
  ChevronDown,
  ArrowRight,
  Wallet,
  Smartphone,
  BellRing,
  Mail,
  MapPin,
  Phone,
  Clock,
} from 'lucide-react';

interface Feature {
  icon: ElementType;
  title: string;
  description: string;
}

interface Testimonial {
  name: string;
  role: string;
  text: string;
  initials: string;
}

interface Faq {
  question: string;
  answer: string;
}

const features: Feature[] = [
  {
    icon: ShoppingCart,
    title: 'Ventes & caisse',
    description: 'Encaissiez en quelques secondes, générez des reçus et suivez votre chiffre d\u2019affaires au quotidien.',
  },
  {
    icon: Boxes,
    title: 'Stock en temps réel',
    description: 'Suivi des quantités, alertes de stock bas, mouvements et ajustements pour ne jamais être en rupture.',
  },
  {
    icon: StoreIcon,
    title: 'Multi-boutiques',
    description: 'Gérez plusieurs boutiques depuis un seul compte, avec des données totalement séparées.',
  },
  {
    icon: BarChart3,
    title: 'Rapports & statistiques',
    description: 'Chiffre d\u2019affaires, bénéfices, top produits et tendances pour piloter votre activité.',
  },
  {
    icon: Users,
    title: 'Clients & fidélité',
    description: 'Historique d\u2019achats, crédits et dettes clientes pour mieux servir votre clientèle.',
  },
  {
    icon: Truck,
    title: 'Fournisseurs & achats',
    description: 'Gérez vos achats, vos fournisseurs et vos approvisionnements en un seul endroit.',
  },
  {
    icon: CreditCard,
    title: 'Paiements multiples',
    description: 'Espèces, MVola, Orange Money, Airtel Money, virement bancaire\u2026 adapté à Madagascar.',
  },
  {
    icon: ShieldCheck,
    title: 'Sécurité & rôles',
    description: 'Permissions par rôle (propriétaire, caissier, comptable\u2026) pour contrôler les accès.',
  },
];

const testimonials: Testimonial[] = [
  {
    name: 'Hery R.',
    role: 'Propriétaire d\u2019épicerie, Antananarivo',
    text: 'MadaStock a changé ma manière de gérer. Je connais mon stock et ma caisse en temps réel, même depuis chez moi.',
    initials: 'HR',
  },
  {
    name: 'Miora A.',
    role: 'Gérante de boutique de vêtements, Toamasina',
    text: 'Simple, rapide et adapté à nous. Le suivi des ventes et des bénéfices est enfin clair pour mon commerce.',
    initials: 'MA',
  },
  {
    name: 'Faly T.',
    role: 'Commerçant multi-boutiques, Antsirabe',
    text: 'Je gère mes trois boutiques avec un seul compte. Les rapports sont précis et le support répond vite.',
    initials: 'FT',
  },
];

const faqs: Faq[] = [
  {
    question: 'C\u2019est quoi MadaStock ?',
    answer:
      'MadaStock est une solution SaaS 100% web de gestion de boutique, pensée pour les commerçants malgaches : ventes, stock, clients, fournisseurs, caisse et rapports.',
  },
  {
    question: 'Dois-je installer un logiciel ?',
    answer:
      'Non. MadaStock fonctionne sur navigateur depuis un ordinateur, un téléphone ou une tablette connectés à Internet.',
  },
  {
    question: 'Puis-je utiliser MadaStock sur mobile ?',
    answer:
      'Oui, l\u2019interface est responsive et optimisée pour les écrans tactiles, parfait pour les caissiers et les tournées.',
  },
  {
    question: 'Mes données sont-elles sécurisées ?',
    answer:
      'Oui. Authentification sécurisée, accès par rôles, et chaque boutique est isolée : vos données ne sont visibles que par vous et vos collaborateurs autorisés.',
  },
  {
    question: 'Et si j\u2019ai plusieurs boutiques ?',
    answer:
      'Avec le plan Pro, vous pouvez gérer des boutiques illimitées depuis un seul compte. Chaque boutique garde ses produits, son stock et ses ventes séparés.',
  },
  {
    question: 'Comment être accompagné ?',
    answer:
      'Notre équipe locale vous accompagne par WhatsApp, e-mail et téléphone. Une formation est incluse dans les plans Pro et Entreprise.',
  },
];

interface PublicPlan {
  id: string;
  name: string;
  description: string;
  priceAr: string | number;
  billingCycle: string;
  durationMonths: number;
  maxUsers: number;
  maxProducts: number;
  maxWarehouses: number;
  maxCustomers: number;
  maxSalesPerMonth: number | null;
  features: Record<string, boolean>;
}

interface LiveStats {
  store: { name: string; slug: string; city: string; country: string };
  today: { revenueAr: number; count: number; deltaPct: number };
  counts: { sales: number; products: number; customers: number };
  week: { day: string; revenueAr: number; count: number }[];
  recentSales: { receipt: string; productName: string | null; amountAr: number; at: string }[];
}

interface PriceCard {
  key: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  highlighted: boolean;
  cta: string;
  ctaHref: string;
}

const featureLabels: { key: string; label: string }[] = [
  { key: 'pos', label: 'Caisse & ventes' },
  { key: 'stock', label: 'Gestion de stock' },
  { key: 'reports', label: 'Rapports & statistiques' },
  { key: 'loyalty', label: 'Clients & fidélité' },
  { key: 'suppliers', label: 'Fournisseurs & achats' },
  { key: 'multiWarehouse', label: 'Multi-entrepôts' },
  { key: 'cashier', label: 'Comptes caissiers' },
  { key: 'accounting', label: 'Comptabilité avancée' },
  { key: 'api', label: 'API & intégrations' },
];

const planDisplayName: Record<string, string> = {
  FREE: 'Gratuit',
  STARTER: 'Starter',
  BUSINESS: 'Business',
  PRO: 'Pro',
};

function planToCard(plan: PublicPlan, popular: boolean): PriceCard {
  const features: string[] = [];
  for (const { key, label } of featureLabels) {
    if (plan.features[key]) features.push(label);
  }
  const users = plan.maxUsers > 1 ? `Jusqu\u2019à ${plan.maxUsers} utilisateurs` : '1 utilisateur';
  const products = `Jusqu\u2019à ${plan.maxProducts} produits`;
  const warehouses = plan.maxWarehouses > 1 ? `Jusqu\u2019à ${plan.maxWarehouses} entrepôts` : '1 entrepôt';
  const customers = plan.maxCustomers > 1 ? `Jusqu\u2019à ${plan.maxCustomers} clients` : 'Clients';
  features.push(users);
  features.push(products);
  features.push(warehouses);
  features.push(customers);
  if (plan.maxSalesPerMonth) features.push(`Jusqu\u2019à ${plan.maxSalesPerMonth} ventes / mois`);

  const free = Number(plan.priceAr) <= 0;
  return {
    key: plan.id,
    name: planDisplayName[plan.name] ?? plan.name,
    price: free ? '0 Ar' : `${formatNumber(plan.priceAr)} Ar`,
    period: free ? 'pour toujours' : '/ mois',
    description: plan.description,
    features,
    highlighted: popular,
    cta: free ? 'Commencer gratuitement' : `Choisir ${planDisplayName[plan.name] ?? plan.name}`,
    ctaHref: '/register',
  };
}

const enterpriseCard: PriceCard = {
  key: 'enterprise',
  name: 'Entreprise',
  price: 'Sur devis',
  period: 'contactez-nous',
  description: 'Pour les réseaux et les besoins sur mesure.',
  features: ['Tout le plan Pro', 'API & intégrations', 'Formation dédiée', 'Superviseur / gestionnaire dédié', 'Contrat personnalisé'],
  highlighted: false,
  cta: 'Nous contacter',
  ctaHref: 'mailto:madaorganisation@gmail.com',
};

const mockSales = [
  { receipt: 'V-2026-0841', name: 'Riz 25 kg', amount: '82 000 Ar' },
  { receipt: 'V-2026-0840', name: 'Huile 1L', amount: '28 500 Ar' },
  { receipt: 'V-2026-0839', name: 'Sucre 5 kg', amount: '46 000 Ar' },
  { receipt: 'V-2026-0838', name: 'Savon & lessive', amount: '35 200 Ar' },
];

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [priceCards, setPriceCards] = useState<PriceCard[]>([]);
  const [live, setLive] = useState<LiveStats | null>(null);

  useEffect(() => {
    api
      .get<PublicPlan[]>('/public/plans')
      .then((res) => {
        const plans = res.data;
        const firstPaid = plans.find((p) => Number(p.priceAr) > 0);
        setPriceCards([...plans.map((p) => planToCard(p, p.id === firstPaid?.id)), enterpriseCard]);
      })
      .catch(() => {
        setPriceCards([enterpriseCard]);
      });

    api
      .get<LiveStats>('/public/live/mounaya')
      .then((res) => setLive(res.data))
      .catch(() => {
        setLive(null);
      });
  }, []);

  if (isAuthenticated && !isLoading) return <Navigate to="/dashboard" replace />;

  const navLink = 'text-slate-600 hover:text-slate-900 font-medium text-sm transition-colors';
  const sectionTitle = 'text-3xl md:text-4xl font-bold tracking-tight text-dark-900';
  const sectionSubtitle = 'mt-3 text-slate-500 max-w-2xl mx-auto';

  return (
    <div className="bg-white font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <a href="#" className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shadow-sm">
                <img src="/logo-madastock.png" alt="MadaStock" className="w-full h-full object-contain" />
              </span>
              <span className="text-xl font-bold tracking-tight text-dark-900">
                Mada<span className="text-green-600">Stock</span>
              </span>
            </a>

            <nav className="hidden lg:flex items-center gap-8">
              <a href="#fonctionnalites" className={navLink}>Fonctionnalités</a>
              <a href="#comment" className={navLink}>Comment ça marche</a>
              <a href="#tarifs" className={navLink}>Tarifs</a>
              <a href="#temoignages" className={navLink}>Témoignages</a>
              <a href="#faq" className={navLink}>FAQ</a>
            </nav>

            <div className="hidden lg:flex items-center gap-3">
              <Link to="/login" className="text-sm font-medium text-slate-700 hover:text-dark-900 px-4 py-2 rounded-lg transition-colors">
                Se connecter
              </Link>
              <Link
                to="/register"
                className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg shadow-sm shadow-green-500/30 transition-colors"
              >
                Créer un compte
              </Link>
            </div>

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Menu"
            >
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="lg:hidden border-t border-slate-100 bg-white px-4 py-4 space-y-1">
            {[
              ['Fonctionnalités', '#fonctionnalites'],
              ['Comment ça marche', '#comment'],
              ['Tarifs', '#tarifs'],
              ['Témoignages', '#temoignages'],
              ['FAQ', '#faq'],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                {label}
              </a>
            ))}
            <div className="pt-2 flex flex-col gap-2">
              <Link
                to="/login"
                className="text-center text-sm font-medium text-slate-700 border border-slate-200 px-4 py-2.5 rounded-lg"
              >
                Se connecter
              </Link>
              <Link
                to="/register"
                className="text-center bg-green-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg"
              >
                Créer un compte
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-white">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(600px circle at 20% 20%, rgba(34,197,94,0.08), transparent 60%), radial-gradient(500px circle at 85% 10%, rgba(34,197,94,0.06), transparent 60%)',
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 lg:pt-24 lg:pb-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                <Zap className="w-3.5 h-3.5" />
                Le SaaS N°1 pour les commerces à Madagascar
              </span>
              <h1 className="mt-6 text-4xl md:text-5xl xl:text-6xl font-bold tracking-tight text-dark-900 leading-[1.08]">
                Gérez votre boutique{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-500">
                  simplement
                </span>{' '}
                et en toute confiance.
              </h1>
              <p className="mt-6 text-lg text-slate-600 max-w-xl leading-relaxed">
                Ventes, stock, clients, fournisseurs, caisse et rapports : MadaStock réunit tout en un seul
                endroit. Sans installation, accessible depuis votre téléphone.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold px-7 py-3.5 rounded-xl shadow-lg shadow-green-500/30 transition-colors"
                >
                  Démarrer gratuitement
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <a
                  href="#fonctionnalites"
                  className="inline-flex items-center justify-center gap-2 border border-slate-200 hover:border-slate-300 bg-white text-dark-900 font-semibold px-7 py-3.5 rounded-xl transition-colors"
                >
                  Voir les fonctionnalités
                </a>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
                {[
                  { icon: CheckCircle2, label: 'Essai gratuit, sans carte bancaire' },
                  { icon: Wallet, label: 'Pensé pour l\u2019ariary malgache' },
                  { icon: Smartphone, label: 'Compatible téléphone & tablette' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 text-sm text-slate-600">
                    <Icon className="w-4 h-4 text-green-600" />
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Mockup */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-tr from-green-100 via-transparent to-emerald-100 rounded-3xl blur-2xl opacity-60" />
              <div className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl shadow-slate-200/70 p-5">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Chiffre d’affaires aujourd’hui</p>
                    <p className="text-2xl font-bold text-dark-900 mt-0.5">
                      {live ? `${formatNumber(live.today.revenueAr)} Ar` : '1 284 500 Ar'}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                      (live?.today.deltaPct ?? 0) >= 0 ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
                    }`}
                  >
                    <span>{(live?.today.deltaPct ?? 0) >= 0 ? '▲' : '▼'}</span>
                    {live ? `${live.today.deltaPct >= 0 ? '+' : ''}${live.today.deltaPct}%` : '+12,4%'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-4">
                  {[
                    { label: 'Ventes', value: live ? formatNumber(live.counts.sales) : '48' },
                    { label: 'Produits', value: live ? formatNumber(live.counts.products) : '342' },
                    { label: 'Clients', value: live ? formatNumber(live.counts.customers) : '86' },
                  ].map((s) => (
                    <div key={s.label} className="bg-slate-50 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-dark-900">{s.value}</p>
                      <p className="text-xs text-slate-500">{s.label}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-end gap-2 h-20 px-1">
                  {(live?.week ?? []).length > 0
                    ? (() => {
                        const max = Math.max(...live!.week.map((d) => d.revenueAr), 1);
                        return live!.week.map((d, i) => (
                          <div key={i} className="flex-1 flex flex-col justify-end">
                            <div
                              className={`rounded-t-md ${i === 6 ? 'bg-green-600' : 'bg-green-100'}`}
                              style={{ height: `${Math.max(8, Math.round((d.revenueAr / max) * 100))}%` }}
                            />
                          </div>
                        ));
                      })()
                    : [38, 55, 42, 70, 58, 82, 64].map((h, i) => (
                        <div key={i} className="flex-1 flex flex-col justify-end">
                          <div
                            className={`rounded-t-md ${i === 5 ? 'bg-green-600' : 'bg-green-100'}`}
                            style={{ height: `${h}%` }}
                          />
                        </div>
                      ))}
                </div>
                <div className="mt-1.5 flex justify-between px-1 text-[10px] text-slate-400">
                  {(live?.week ?? []).map((d, i) => (
                    <span key={i} className="flex-1 text-center">{d.day}</span>
                  ))}
                </div>

                <div className="mt-4 space-y-2">
                  {(live?.recentSales.length
                    ? live.recentSales.map((s) => ({
                        key: s.receipt,
                        name: s.productName ?? 'Vente',
                        receipt: s.receipt,
                        amount: `${formatNumber(s.amountAr)} Ar`,
                      }))
                    : mockSales
                  ).map((s) => (
                    <div key={s.receipt} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        <div>
                          <p className="text-sm font-medium text-dark-900">{s.name}</p>
                          <p className="text-[11px] text-slate-400">{s.receipt}</p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-dark-900">{s.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats band */}
      <section className="border-y border-slate-100 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { value: '100%', label: 'En ligne, sans installation' },
            { value: '24/7', label: 'Accès depuis partout' },
            { value: '+500', label: 'Commerçants accompagnés' },
            { value: '80%', label: 'Gain de temps en gestion' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-extrabold text-green-600">{s.value}</p>
              <p className="mt-1 text-sm text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="fonctionnalites" className="py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <span className="text-green-600 font-semibold text-sm uppercase tracking-wider">Fonctionnalités</span>
            <h2 className={sectionTitle}>Tout ce qu’il faut pour gérer votre commerce</h2>
            <p className={sectionSubtitle}>
              MadaStock couvre l’ensemble de vos besoins quotidiens, de l’encaissement à l’analyse de vos performances.
            </p>
          </div>
          <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="group bg-white border border-slate-200 rounded-2xl p-6 hover:border-green-300 hover:shadow-lg hover:shadow-green-500/5 transition-all"
              >
                <span className="inline-flex w-11 h-11 rounded-xl bg-green-50 group-hover:bg-green-600 items-center justify-center transition-colors">
                  <f.icon className="w-5 h-5 text-green-600 group-hover:text-white transition-colors" />
                </span>
                <h3 className="mt-4 font-semibold text-dark-900">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="comment" className="py-20 lg:py-24 bg-dark-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <span className="text-green-400 font-semibold text-sm uppercase tracking-wider">Comment ça marche</span>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">Prêt en 10 minutes</h2>
            <p className="mt-3 text-slate-400 max-w-2xl mx-auto">
              Pas besoin d’être expert en informatique. Suivez juste ces trois étapes.
            </p>
          </div>
          <div className="mt-14 grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Créez votre compte',
                text: 'Inscrivez-vous gratuitement en moins de deux minutes, puis créez votre boutique.',
              },
              {
                step: '02',
                title: 'Ajoutez vos produits',
                text: 'Renseignez vos articles, prix et quantités. Importez facilement votre catalogue.',
              },
              {
                step: '03',
                title: 'Vendez & suivez tout',
                text: 'Encaissiez vos ventes et suivez stock, clients et chiffre d\u2019affaires en temps réel.',
              },
            ].map((s) => (
              <div key={s.step} className="relative bg-dark-800 rounded-2xl border border-dark-700 p-7">
                <span className="text-4xl font-extrabold text-green-500/30">{s.step}</span>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-400 text-dark-900 font-semibold px-7 py-3.5 rounded-xl transition-colors"
            >
              Commencer maintenant
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="temoignages" className="py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <span className="text-green-600 font-semibold text-sm uppercase tracking-wider">Témoignages</span>
            <h2 className={sectionTitle}>Ils gèrent leur boutique avec MadaStock</h2>
            <p className={sectionSubtitle}>Des commerçants de toute l’île nous font confiance au quotidien.</p>
          </div>
          <div className="mt-14 grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-white border border-slate-200 rounded-2xl p-7">
                <div className="flex gap-1 text-amber-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" />
                  ))}
                </div>
                <p className="mt-4 text-slate-700 leading-relaxed">« {t.text} »</p>
                <div className="mt-6 flex items-center gap-3">
                  <span className="w-11 h-11 rounded-full bg-green-600 text-white flex items-center justify-center font-semibold text-sm">
                    {t.initials}
                  </span>
                  <div>
                    <p className="font-semibold text-dark-900 text-sm">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="tarifs" className="py-20 lg:py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <span className="text-green-600 font-semibold text-sm uppercase tracking-wider">Tarifs</span>
            <h2 className={sectionTitle}>Des prix simples et transparents</h2>
            <p className={sectionSubtitle}>
              Commencez gratuitement, puis choisissez le plan adapté à la taille de votre activité.
            </p>
          </div>
          <div className="mt-14 grid sm:grid-cols-2 xl:grid-cols-5 gap-6 items-start">
            {(priceCards.length > 0 ? priceCards : Array.from({ length: 5 }, () => null)).map((p, i) =>
              !p ? (
                <div key={`skeleton-${i}`} className="rounded-2xl bg-white border border-slate-200 p-7 animate-pulse">
                  <div className="h-4 w-20 bg-slate-200 rounded" />
                  <div className="mt-4 h-8 w-28 bg-slate-200 rounded" />
                  <div className="mt-4 space-y-3">
                    <div className="h-3 bg-slate-200 rounded" />
                    <div className="h-3 bg-slate-200 rounded" />
                    <div className="h-3 bg-slate-200 rounded" />
                  </div>
                </div>
              ) : (
                <div
                  key={p.key}
                  className={`relative rounded-2xl p-7 ${
                    p.highlighted
                      ? 'bg-dark-900 text-white shadow-2xl shadow-dark-900/30 md:-mt-4 md:mb-4'
                      : 'bg-white border border-slate-200'
                  }`}
                >
                  {p.highlighted && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-dark-900 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                      LE PLUS POPULAIRE
                    </span>
                  )}
                  <h3 className={`font-semibold ${p.highlighted ? 'text-green-400' : 'text-dark-900'}`}>{p.name}</h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold">{p.price}</span>
                    <span className={`text-sm ${p.highlighted ? 'text-slate-400' : 'text-slate-500'}`}>{p.period}</span>
                  </div>
                  <p className={`mt-2 text-sm ${p.highlighted ? 'text-slate-400' : 'text-slate-500'}`}>{p.description}</p>
                  <ul className="mt-6 space-y-3">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${p.highlighted ? 'text-green-400' : 'text-green-600'}`} />
                        <span className={p.highlighted ? 'text-slate-200' : 'text-slate-600'}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {(p.ctaHref.startsWith('mailto:') ? (
                    <a
                      href={p.ctaHref}
                      className={`mt-8 flex items-center justify-center gap-2 font-semibold text-sm px-5 py-3 rounded-xl transition-colors ${
                        p.highlighted
                          ? 'bg-green-500 hover:bg-green-400 text-dark-900'
                          : 'border border-slate-300 hover:border-green-500 hover:text-green-600 text-dark-900'
                      }`}
                    >
                      {p.cta}
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  ) : (
                    <Link
                      to={p.ctaHref}
                      className={`mt-8 flex items-center justify-center gap-2 font-semibold text-sm px-5 py-3 rounded-xl transition-colors ${
                        p.highlighted
                          ? 'bg-green-500 hover:bg-green-400 text-dark-900'
                          : 'border border-slate-300 hover:border-green-500 hover:text-green-600 text-dark-900'
                      }`}
                    >
                      {p.cta}
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 lg:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="text-green-600 font-semibold text-sm uppercase tracking-wider">FAQ</span>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight text-dark-900">Questions fréquentes</h2>
          </div>
          <div className="mt-10 space-y-3">
            {faqs.map((f, i) => (
              <div key={f.question} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="font-medium text-dark-900 text-sm md:text-base">{f.question}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-400 transition-transform shrink-0 ${openFaq === i ? 'rotate-180' : ''}`}
                  />
                </button>
                {openFaq === i && (
                  <p className="px-5 pb-5 text-sm text-slate-600 leading-relaxed">{f.answer}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-20 lg:pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden bg-gradient-to-br from-green-600 to-emerald-700 rounded-3xl px-8 py-14 text-center shadow-2xl shadow-green-600/30">
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'radial-gradient(400px circle at 10% 0%, rgba(255,255,255,0.15), transparent 60%), radial-gradient(400px circle at 90% 100%, rgba(255,255,255,0.12), transparent 60%)',
              }}
            />
            <h2 className="relative text-3xl md:text-4xl font-bold tracking-tight text-white">
              Prêt à gérer votre boutique comme un pro ?
            </h2>
            <p className="relative mt-3 text-green-100 max-w-xl mx-auto">
              Créez votre compte gratuit en 2 minutes et découvrez votre boutique sous un nouveau jour.
            </p>
            <div className="relative mt-8 flex flex-col sm:flex-row justify-center gap-3">
              <Link
                to="/register"
                className="bg-white hover:bg-slate-50 text-green-700 font-semibold px-7 py-3.5 rounded-xl transition-colors"
              >
                Démarrer gratuitement
              </Link>
              <Link
                to="/login"
                className="border border-white/40 hover:bg-white/10 text-white font-semibold px-7 py-3.5 rounded-xl transition-colors"
              >
                J’ai déjà un compte
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-dark-900 text-slate-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid gap-10 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden">
                <img src="/logo-madastock.png" alt="MadaStock" className="w-full h-full object-contain" />
              </span>
              <span className="text-xl font-bold tracking-tight text-white">
                Mada<span className="text-green-500">Stock</span>
              </span>
            </div>
            <p className="mt-4 text-sm text-slate-400 leading-relaxed">
              La solution de gestion de boutique 100% malgache, pensée pour les commerçants de l’île.
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm">Produit</h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><a href="#fonctionnalites" className="hover:text-white transition-colors">Fonctionnalités</a></li>
              <li><a href="#tarifs" className="hover:text-white transition-colors">Tarifs</a></li>
              <li><a href="#comment" className="hover:text-white transition-colors">Comment ça marche</a></li>
              <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm">Entreprise</h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">À propos</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Conditions d’utilisation</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Confidentialité</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm">Contact</h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-green-500" />
                +261 32 63 21 784
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-green-500" />
                madaorganisation@gmail.com
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-green-500" />
                Antananarivo, Madagascar
              </li>
              <li className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-green-500" />
                Lun – Sam : 8h – 18h
              </li>
              <li className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-green-500" />
                WhatsApp & e-mail
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-dark-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-500">
            <p>© {new Date().getFullYear()} MadaStock. Tous droits réservés.</p>
            <p>Fait avec passion à Madagascar · v1.0</p>
          </div>
        </div>
      </footer>
    </div>
  );
}