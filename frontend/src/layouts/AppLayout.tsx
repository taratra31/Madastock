import { useEffect, useMemo, useState } from 'react';
import { NavLink, Navigate, Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Package,
  Tags,
  Boxes,
  Users,
  FileText,
  Settings,
  Menu,
  X,
  LogOut,
  ChevronDown,
  Building2,
  Wrench,
  Car,
  ClipboardList,
  CalendarClock,
  Gauge,
  Target,
  MessageSquare,
  Bell,
  CreditCard,
  ShoppingBag,
  AlertTriangle,
  ShieldCheck,
  Wallet,
  MessageCircle,
  Truck,
  ShoppingCart,
  Receipt,
  Tag,
  Banknote,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useStores, type Membership } from '../lib/store';
import api from '../lib/api';
import { roleLabels, sectorLabels } from '../lib/labels';
import NotificationBell from '../components/NotificationBell';

interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
}

type NavSection = { title: string; items: NavItem[] };

const HOME_SECTION: NavSection = {
  title: 'Accueil',
  items: [{ label: 'Tableau de bord', to: '/dashboard', icon: LayoutDashboard }],
};

const FINANCE_SECTION: NavSection = {
  title: 'Finances',
  items: [
    { label: 'Devis & Factures', to: '/invoices', icon: FileText },
    { label: 'Dépenses', to: '/expenses', icon: Receipt },
    { label: 'Caisse', to: '/cash', icon: Banknote },
    { label: 'Abonnement', to: '/billing', icon: CreditCard },
  ],
};

const SUPPLY_SECTION: NavSection = {
  title: 'Approvisionnement',
  items: [
    { label: 'Fournisseurs', to: '/suppliers', icon: Truck },
    { label: 'Achats', to: '/purchases', icon: ShoppingCart },
  ],
};

const SETTINGS_SECTION: NavSection = {
  title: 'Paramètres',
  items: [
    { label: 'Notifications', to: '/notifications', icon: Bell },
    { label: 'Boutique', to: '/settings', icon: Settings },
  ],
};

const VENTE_ITEM: NavItem = { label: 'Ventes (POS)', to: '/sales', icon: ShoppingBag };

const ADMIN_SECTION: NavSection = {
  title: 'SuperAdmin',
  items: [
    { label: 'Back-office', to: '/admin', icon: ShieldCheck },
    { label: 'Boutiques', to: '/admin/stores', icon: Building2 },
    { label: 'Utilisateurs', to: '/admin/users', icon: Users },
    { label: 'Abonnements', to: '/admin/subscriptions', icon: CreditCard },
    { label: 'Paiements', to: '/admin/payments', icon: Wallet },
    { label: 'WhatsApp', to: '/admin/whatsapp', icon: MessageCircle },
  ],
};

function navForSector(sector?: string): NavSection[] {
  if (sector === 'GARAGE') {
    return [
      HOME_SECTION,
      {
        title: 'Gestion commerciale',
        items: [
          { label: 'Produits', to: '/products', icon: Package },
          { label: 'Catégories', to: '/categories', icon: Tags },
          { label: 'Marques', to: '/brands', icon: Tag },
          { label: 'Stock', to: '/stock', icon: Boxes },
          { label: 'Clients', to: '/customers', icon: Users },
          { label: 'Véhicules', to: '/vehicles', icon: Car },
          { label: 'Mécaniciens', to: '/mechanics', icon: Wrench },
        ],
      },
      {
        title: 'Atelier',
        items: [
          { label: 'Ordres de réparation', to: '/work-orders', icon: ClipboardList },
          { label: 'Rendez-vous', to: '/appointments', icon: CalendarClock },
          { label: 'Garage', to: '/garage', icon: Gauge },
        ],
      },
      {
        title: 'CRM',
        items: [
          { label: 'Prospects', to: '/leads', icon: Target },
          { label: 'Interactions', to: '/interactions', icon: MessageSquare },
          { label: 'Rappels', to: '/reminders', icon: Bell },
        ],
      },
      SUPPLY_SECTION,
      FINANCE_SECTION,
      SETTINGS_SECTION,
    ];
  }

  if (sector === 'PHARMACIE') {    return [
      HOME_SECTION,
      {
        title: 'Vente',
        items: [
          VENTE_ITEM,
          { label: 'Clients', to: '/customers', icon: Users },
        ],
      },
      {
        title: 'Gestion du stock',
        items: [
          { label: 'Produits', to: '/products', icon: Package },
          { label: 'Catégories', to: '/categories', icon: Tags },
          { label: 'Marques', to: '/brands', icon: Tag },
          { label: 'Stock', to: '/stock', icon: Boxes },
          { label: 'Alertes péremption', to: '/stock?expiry=soon', icon: AlertTriangle },
        ],
      },
      SUPPLY_SECTION,
      FINANCE_SECTION,
      SETTINGS_SECTION,
    ];
  }

  // BOUTIQUE (défaut)
  return [
    HOME_SECTION,
    {
      title: 'Gestion commerciale',
      items: [
        VENTE_ITEM,
        { label: 'Produits', to: '/products', icon: Package },
        { label: 'Catégories', to: '/categories', icon: Tags },
        { label: 'Marques', to: '/brands', icon: Tag },
        { label: 'Stock', to: '/stock', icon: Boxes },
        { label: 'Clients', to: '/customers', icon: Users },
      ],
    },
    SUPPLY_SECTION,
    FINANCE_SECTION,
    SETTINGS_SECTION,
  ];
}

export default function AppLayout() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { memberships, currentStore, setCurrentStore, selectFirstStore } = useStores();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const { data: storesData } = useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const res = await api.get('/stores');
      const list = res.data.memberships as Membership[];
      if (list.length > 0) selectFirstStore(list);
      return list;
    },
    enabled: isAuthenticated,
  });

  const storeList = (storesData ?? memberships) as Membership[];

  const currentRole = useMemo(() => {
    const m = storeList.find((x) => x.store.id === currentStore?.id);
    return m?.role ?? '';
  }, [storeList, currentStore]);

  const currentMembership = useMemo(
    () => storeList.find((x) => x.store.id === currentStore?.id),
    [storeList, currentStore],
  );

  const canManage = currentRole === 'OWNER' || currentRole === 'ADMIN' || currentMembership?.canManageAll === true;

  const navSections = useMemo(() => {
    const sections = navForSector(currentStore?.sector)
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) => !(item.to === '/settings' || item.to === '/billing') || canManage,
        ),
      }))
      .filter((section) => section.items.length > 0);
    return user?.isSuperAdmin ? [...sections, ADMIN_SECTION] : sections;
  }, [currentStore?.sector, canManage, user?.isSuperAdmin]);

  useEffect(() => setUserMenuOpen(false), [location.pathname]);

  const currentLabel = useMemo(() => {
    const all = navSections
      .flatMap((s) => s.items)
      .sort((a, b) => b.to.length - a.to.length);
    return (
      all.find((i) => location.pathname === i.to || location.pathname.startsWith(`${i.to}/`))?.label ?? ''
    );
  }, [location.pathname, navSections]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500 text-sm">Chargement...</div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const switchStore = (id: string) => {
    setCurrentStore(id);
    setSidebarOpen(false);
    if (location.pathname !== '/dashboard') navigate('/dashboard');
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 h-14 border-b border-dark-800/80 shrink-0">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-white flex items-center justify-center overflow-hidden ring-1 ring-dark-800">
            <img src="/logo-madastock.png" alt="MadaStock" className="w-full h-full object-contain" />
          </span>
          <span className="leading-tight">
            <span className="block text-[17px] font-bold tracking-tight text-white">
              Mada<span className="text-emerald-400">Stock</span>
            </span>
            <p className="block text-[10px] text-slate-500 tracking-wide">
              {currentStore?.sector ? sectorLabels[currentStore.sector] ?? currentStore.sector : 'Gestion de boutique'}
            </p>
          </span>
        </Link>
        <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-dark-800">
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 min-h-0 overflow-hidden px-3 py-2.5 space-y-2.5">
        {navSections.map((section) => (
          <div key={section.title}>
            <p className="px-2.5 mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              <span className="w-1 h-1 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400" />
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/dashboard'}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `group flex items-center gap-2.5 px-2.5 py-[6px] rounded-lg text-[12.5px] font-medium transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-emerald-500/20 to-emerald-500/5 text-white ring-1 ring-emerald-500/25'
                        : 'text-slate-400 hover:text-white hover:bg-dark-800/70'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon className={`w-[18px] h-[18px] shrink-0 transition-colors ${isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                      <span className="truncate">{item.label}</span>
                      {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-2.5 border-t border-dark-800/80 shrink-0">
        <div className="bg-dark-800/60 rounded-xl p-2.5 flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-md shadow-emerald-500/20">
            {(user?.fullName ?? 'U').slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-white truncate">{user?.fullName}</p>
            <p className="text-[10.5px] text-slate-400 truncate">{currentRole ? roleLabels[currentRole] ?? currentRole : user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Déconnexion"
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-400 hover:bg-dark-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 bg-dark-900 z-40">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="fixed inset-0 bg-dark-900/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed inset-y-0 left-0 w-72 bg-dark-900 z-50 shadow-2xl">{sidebarContent}</aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
          <div className="flex items-center gap-3 px-4 sm:px-6 h-16">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-dark-900 truncate">
                {currentLabel || currentStore?.name || 'MadaStock'}
              </h1>
              <p className="text-xs text-slate-500 truncate hidden sm:block">
                {currentLabel && currentStore ? currentStore.name : ''}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {currentStore && (
                <div className="hidden md:flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <select
                    value={currentStore.id}
                    onChange={(e) => switchStore(e.target.value)}
                    className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 max-w-[220px]"
                  >
                    {storeList.map((m) => (
                      <option key={m.store.id} value={m.store.id}>
                        {m.store.name}
                      </option>
                    ))}
                  </select>
                  <Link
                    to="/stores"
                    className="ml-1 text-xs text-slate-500 hover:text-green-600 whitespace-nowrap"
                    title="Gérer les boutiques"
                  >
                    Gérer
                  </Link>
                </div>
              )}

              <NotificationBell />

              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100"
                >
                  <span className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-bold">
                    {(user?.fullName ?? 'U').slice(0, 1).toUpperCase()}
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-slate-200 shadow-xl z-50 py-1.5">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-sm font-semibold text-dark-900 truncate">{user?.fullName}</p>
                      <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                    </div>
                    {canManage && (
                      <Link
                        to="/settings"
                        onClick={() => setUserMenuOpen(false)}
                        className="block px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                      >
                        Paramètres boutique
                      </Link>
                    )}
                    <Link
                      to="/stores"
                      onClick={() => setUserMenuOpen(false)}
                      className="block px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                    >
                      Mes boutiques
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      Déconnexion
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="px-4 sm:px-6 py-6 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}