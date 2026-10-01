import { useEffect, useMemo, useState } from 'react';
import { NavLink, Navigate, Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Package,
  Tags,
  Boxes,
  Warehouse,
  ArrowLeftRight,
  BarChart3,
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
  Search,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useStores, type Membership } from '../lib/store';
import { useSubscription } from '../lib/subscription';
import { NAV_PERMISSION, usePermissions } from '../lib/permissions';
import api from '../lib/api';
import { roleLabels, sectorLabels } from '../lib/labels';
import { cn } from '../components/ui';
import NotificationBell from '../components/NotificationBell';
import PremiumModal from '../components/PremiumModal';
import SubscriptionLock from '../components/SubscriptionLock';
import AiAssistant from '../components/AiAssistant';
import { Button } from '../components/ui';

interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
}

type NavSection = { title: string; items: NavItem[] };

const HOME_SECTION: NavSection = {
  title: 'Accueil',
  items: [
    { label: 'Tableau de bord', to: '/dashboard', icon: LayoutDashboard },
    { label: 'Rapports', to: '/reports', icon: BarChart3 },
  ],
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
    { label: 'Import / Export', to: '/data-transfer', icon: ArrowLeftRight },
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
          { label: 'Dépôts', to: '/warehouses', icon: Warehouse },
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
          { label: 'Dépôts', to: '/warehouses', icon: Warehouse },
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
          { label: 'Dépôts', to: '/warehouses', icon: Warehouse },
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
  const { isLocked, planName } = useSubscription();
  const { can, permissions } = usePermissions();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Pages utiles même une fois l'abonnement expiré : choisir une offre,
  // payer, régler les paramètres ou consulter les notifications.
  const ALLOWED_WHEN_LOCKED = ['/billing', '/notifications', '/settings', '/stores', '/admin'];
  const isAllowedWhenLocked =
    isLocked &&
    ALLOWED_WHEN_LOCKED.some(
      (p) => location.pathname === p || location.pathname.startsWith(`${p}/`),
    );

  // La modale « passez à une offre » s'ouvre automatiquement dès que le compte est verrouillé.
  useEffect(() => {
    if (isLocked) setUpgradeModalOpen(true);
  }, [isLocked]);

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
        items: section.items.filter((item) => {
          // Masqué si le rôle n'a pas la permission requise (le serveur
          // refuse de toute façon : c'est juste pour ne pas proposed
          // un écran que l'utilisateur ne peut pas ouvrir).
          const path = item.to.split('?')[0];
          const need = NAV_PERMISSION[path];
          if (need && !can(need)) return false;
          return !((item.to === '/settings' || item.to === '/billing') && !canManage);
        }),
      }))
      .filter((section) => section.items.length > 0);
    return user?.isSuperAdmin ? [...sections, ADMIN_SECTION] : sections;
  }, [currentStore?.sector, canManage, user?.isSuperAdmin, permissions]);

  useEffect(() => setUserMenuOpen(false), [location.pathname]);

  // --- Sidebar : recherche de page + sections repliables -------------------
  const [navQuery, setNavQuery] = useState('');
  const [collapsed, setCollapsed] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('madastock.nav.collapsed');
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  const toggleSection = (title: string) =>
    setCollapsed((prev) => {
      const next = prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title];
      try {
        localStorage.setItem('madastock.nav.collapsed', JSON.stringify(next));
      } catch {
        // stockage indisponible (navigation privée) : l'état reste en mémoire
      }
      return next;
    });

  const filteredSections = useMemo(() => {
    const query = navQuery.trim().toLowerCase();
    if (!query) return navSections;
    return navSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => item.label.toLowerCase().includes(query)),
      }))
      .filter((section) => section.items.length > 0);
  }, [navSections, navQuery]);

  // Une section contenant la page courante reste dépliée même si on la replie.
  const isSectionOpen = (section: NavSection) => {
    if (navQuery.trim()) return true;
    if (section.items.some((i) => location.pathname === i.to || location.pathname.startsWith(`${i.to}/`))) {
      return true;
    }
    return !collapsed.includes(section.title);
  };

  const totalNavItems = navSections.reduce((sum, s) => sum + s.items.length, 0);

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
    // Tout le cache react-query dépend de la boutique (X-Store-Id) : sans cela
    // la cloche, les listes et les tableaux de bord afficheraient encore
    // les données de la boutique précédente.
    queryClient.invalidateQueries();
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

      {/* Recherche de page : au-dessus de la zone qui défile. */}
      <div className="shrink-0 px-3 pt-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={navQuery}
            onChange={(e) => setNavQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setNavQuery('');
            }}
            placeholder="Rechercher une page…"
            aria-label="Rechercher une page dans le menu"
            className="w-full rounded-lg border border-white/5 bg-white/[0.04] py-1.5 pl-8 pr-7 text-[12.5px] text-white placeholder:text-slate-500 outline-none transition focus:border-emerald-500/40 focus:bg-white/[0.07]"
          />
          {navQuery ? (
            <button
              onClick={() => setNavQuery('')}
              title="Effacer"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 transition hover:bg-white/10 hover:text-slate-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-white/10 px-1 text-[10px] font-medium text-slate-500">
              {totalNavItems}
            </span>
          )}
        </div>
      </div>

      {/* Zone de navigation : elle seule défile, l'en-tête et le compte restent fixes. */}
      <nav
        aria-label="Navigation principale"
        className="scrollbar-slim flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-3"
        style={{ scrollbarGutter: 'stable' }}
      >
        {filteredSections.length === 0 ? (
          <p className="px-3 py-6 text-center text-[12.5px] text-slate-500">
            Aucun résultat pour « {navQuery} ».
          </p>
        ) : (
          <div className="space-y-1 pb-2">
            {filteredSections.map((section) => {
              const open = isSectionOpen(section);
              return (
                <div key={section.title}>
                  <button
                    type="button"
                    onClick={() => toggleSection(section.title)}
                    aria-expanded={open}
                    className="group mb-1 flex w-full items-center gap-2 px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 transition hover:text-slate-300"
                  >
                    <ChevronDown
                      className={cn(
                        'h-3 w-3 shrink-0 transition-transform duration-200',
                        open ? 'rotate-0' : '-rotate-90',
                      )}
                    />
                    <span className="flex-1 truncate">{section.title}</span>
                    <span className="text-[10px] font-normal normal-case tracking-normal text-slate-600 group-hover:text-slate-500">
                      {section.items.length}
                    </span>
                  </button>
                  {open && (
                    <div className="space-y-0.5">
                      {section.items.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          end={item.to === '/dashboard'}
                          onClick={() => {
                            setSidebarOpen(false);
                            setNavQuery('');
                          }}
                          className={({ isActive }) =>
                            cn(
                              'group relative flex items-center gap-3 rounded-lg py-2 pl-3 pr-3 text-[13px] font-medium transition-all duration-150',
                              isActive
                                ? 'bg-gradient-to-r from-emerald-500/25 via-emerald-500/10 to-transparent text-white shadow-[inset_0_0_0_1px_rgba(16,185,129,0.25)]'
                                : 'text-slate-400 hover:bg-white/[0.04] hover:text-white',
                            )
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <span
                                className={cn(
                                  'absolute left-0 top-1/2 w-[3px] -translate-y-1/2 rounded-r-full bg-emerald-400 transition-all duration-200',
                                  isActive ? 'h-5 opacity-100' : 'h-0 opacity-0',
                                )}
                              />
                              <item.icon
                                className={cn(
                                  'h-[18px] w-[18px] shrink-0 transition-colors duration-150',
                                  isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-200',
                                )}
                              />
                              <span className="truncate">{item.label}</span>
                            </>
                          )}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </nav>

      <div className="shrink-0 border-t border-dark-800/80 bg-dark-900/80 backdrop-blur p-3">
        <div className="group flex items-center gap-2.5 rounded-xl bg-white/[0.03] p-2.5 ring-1 ring-white/5 transition hover:bg-white/[0.06] hover:ring-white/10">
          <span className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center text-sm font-bold shadow-md shadow-emerald-500/20">
            {(user?.fullName ?? 'U').slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-white truncate">{user?.fullName}</p>
            <p className="text-[10.5px] text-slate-400 truncate">
              {currentRole ? roleLabels[currentRole] ?? currentRole : user?.email}
            </p>
          </div>
          <button
            onClick={handleLogout}
            title="Déconnexion"
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
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
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 z-40 border-r border-white/5 bg-gradient-to-b from-dark-900 to-[#0a1016]">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed inset-y-0 left-0 w-72 z-50 shadow-2xl border-r border-white/5 bg-gradient-to-b from-dark-900 to-[#0a1016]">
            {sidebarContent}
          </aside>
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
          {isLocked && !isAllowedWhenLocked ? (
            <SubscriptionLock planName={planName} />
          ) : (
            <>
              {isLocked && (
                <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-sm text-amber-800 font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Votre abonnement a expiré. Vos données sont conservées.
                  </p>
                  <Button size="sm" onClick={() => navigate('/billing')}>
                    <CreditCard className="w-3.5 h-3.5" /> S'abonner
                  </Button>
                </div>
              )}
              <Outlet />
            </>
          )}
        </main>
      </div>

      <PremiumModal open={upgradeModalOpen} onClose={() => setUpgradeModalOpen(false)} planName={planName} />

      <AiAssistant open={assistantOpen} onOpen={() => setAssistantOpen(true)} onClose={() => setAssistantOpen(false)} />
    </div>
  );
}