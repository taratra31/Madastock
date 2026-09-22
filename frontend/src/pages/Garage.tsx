import { useQuery } from '@tanstack/react-query';
import {
  Wrench,
  PackagePlus,
  CheckCircle2,
  CalendarClock,
  Target,
  Bell,
  Wallet,
  TrendingUp,
  ShoppingCart,
} from 'lucide-react';
import api from '../lib/api';
import { formatAr, formatNumber, formatDateTime, formatDay, formatTime } from '../lib/format';
import { Badge, Card, Loading, PageHeader, ErrorMessage } from '../components/ui';

interface GarageStats {
  counts: {
    vehicles: number;
    customers: number;
    activeWorkOrders: number;
    todayWorkOrders: number;
    completedToday: number;
    todayAppointments: number;
    leads: number;
    openLeads: number;
    mechanics: number;
    pendingReminders: number;
  };
  finance: { outstandingInvoices: number; outstandingAr: number; totalRevenueAr: number; revenueTodayAr: number };
  statusBreakdown: Record<string, number>;
  recentWorkOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    priority: string;
    totalAr: number;
    receivedAt: string;
    customer: { id: string; fullName: string } | null;
    vehicle: { id: string; plateNumber: string; label: string } | null;
  }>;
  upcomingAppointments: Array<{
    id: string;
    type: string;
    status: string;
    scheduledAt: string;
    durationMin: number;
    title: string | null;
    customer: { id: string; fullName: string; phone: string | null } | null;
    vehicle: { id: string; plateNumber: string } | null;
    mechanic: { id: string; fullName: string; colorHex: string | null } | null;
  }>;
  reminders: Array<{
    id: string;
    type: string;
    remindAt: string;
    title: string;
    message: string | null;
    customer: { id: string; fullName: string; phone: string | null } | null;
    lead: { id: string; fullName: string } | null;
    vehicle: { id: string; plateNumber: string } | null;
  }>;
}

const statusLabels: Record<string, string> = {
  QUOTED: 'Devis',
  IN_PROGRESS: 'En cours',
  WAITING_PART: 'En attente pièces',
  PAUSED: 'En pause',
  COMPLETED: 'Terminé',
  COLLECTED: 'Récupéré',
  CANCELLED: 'Annulé',
};

const statusCls: Record<string, string> = {
  QUOTED: 'bg-slate-100 text-slate-600',
  IN_PROGRESS: 'bg-blue-50 text-blue-700',
  WAITING_PART: 'bg-amber-50 text-amber-700',
  PAUSED: 'bg-slate-100 text-slate-500',
  COMPLETED: 'bg-green-50 text-green-700',
  COLLECTED: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-red-50 text-red-600',
};

const apptTypeLabels: Record<string, string> = {
  REPAIR: 'Réparation',
  MAINTENANCE: 'Entretien',
  INSPECTION: 'Contrôle',
  DIAGNOSIS: 'Diagnostic',
  PICKUP: 'Enlèvement',
  OTHER: 'Autre',
};

const reminderTypeLabels: Record<string, string> = {
  SERVICE_DUE: 'Entretien préventif',
  FOLLOW_UP: 'Relance',
  PAYMENT: 'Paiement',
  APPOINTMENT: 'Rendez-vous',
  OTHER: 'Autre',
};

function StatCard({
  label,
  value,
  icon: Icon,
  iconClass,
  sub,
}: {
  label: string;
  value: string;
  icon: typeof Wrench;
  iconClass: string;
  sub?: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconClass}`}>
          <Icon className="w-5 h-5" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold text-dark-900 truncate">{value}</p>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </Card>
  );
}

export default function Garage() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['garage-stats'],
    queryFn: async () => {
      const res = await api.get('/garage/stats');
      return res.data as GarageStats;
    },
  });

  const totalBreakdown = (Object.values(stats?.statusBreakdown ?? {})).reduce((s, c) => s + c, 0);

  return (
    <div>
      <PageHeader title="Garage" subtitle="Vue d'ensemble de l'atelier" />

      {error ? (
        <ErrorMessage message={(error as any).response?.data?.error ?? 'Erreur de chargement'} />
      ) : isLoading ? (
        <Loading />
      ) : !stats ? null : (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <StatCard
              label="Interventions actives"
              value={formatNumber(stats.counts.activeWorkOrders)}
              icon={Wrench}
              iconClass="bg-blue-50 text-blue-600"
            />
            <StatCard
              label="Reçues aujourd'hui"
              value={formatNumber(stats.counts.todayWorkOrders)}
              icon={PackagePlus}
              iconClass="bg-blue-50 text-blue-600"
            />
            <StatCard
              label="Terminées aujourd'hui"
              value={formatNumber(stats.counts.completedToday)}
              icon={CheckCircle2}
              iconClass="bg-green-50 text-green-600"
            />
            <StatCard
              label="Rendez-vous aujourd'hui"
              value={formatNumber(stats.counts.todayAppointments)}
              icon={CalendarClock}
              iconClass="bg-violet-50 text-violet-600"
            />
            <StatCard
              label="Prospects ouverts"
              value={formatNumber(stats.counts.openLeads)}
              icon={Target}
              iconClass="bg-orange-50 text-orange-600"
              sub={<span>{formatNumber(stats.counts.leads)} prospects</span>}
            />
            <StatCard
              label="Rappels en attente"
              value={formatNumber(stats.counts.pendingReminders)}
              icon={Bell}
              iconClass="bg-amber-50 text-amber-600"
            />
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <StatCard
              label="Encaissé total"
              value={formatAr(stats.finance.totalRevenueAr)}
              icon={Wallet}
              iconClass="bg-green-50 text-green-600"
            />
            <StatCard
              label="Encaissé aujourd'hui"
              value={formatAr(stats.finance.revenueTodayAr)}
              icon={TrendingUp}
              iconClass="bg-blue-50 text-blue-600"
            />
            <StatCard
              label="Reste à encaisser"
              value={formatAr(stats.finance.outstandingAr)}
              icon={ShoppingCart}
              iconClass="bg-amber-50 text-amber-600"
              sub={<span>{formatNumber(stats.finance.outstandingInvoices)} facture(s)</span>}
            />
          </div>

          <Card className="p-5">
            <h3 className="flex items-center gap-2 font-semibold text-dark-900 mb-4">
              <Wrench className="w-4 h-4 text-green-600" />
              Répartition des interventions
            </h3>
            {totalBreakdown === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Aucune donnée</p>
            ) : (
              <div className="space-y-3">
                {Object.keys(statusLabels).map((s) => {
                  const count = stats.statusBreakdown[s] ?? 0;
                  const pct = totalBreakdown > 0 ? Math.round((count / totalBreakdown) * 100) : 0;
                  return (
                    <div key={s}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-slate-600">{statusLabels[s]}</span>
                        <span className="text-slate-500">{formatNumber(count)} · {pct}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <h3 className="flex items-center gap-2 font-semibold text-dark-900 mb-4">
                <Wrench className="w-4 h-4 text-green-600" />
                Ordres récents
              </h3>
              {stats.recentWorkOrders.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">Aucun ordre</p>
              ) : (
                <div className="divide-y divide-slate-50">
                  {stats.recentWorkOrders.slice(0, 8).map((wo) => (
                    <div key={wo.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-dark-900">{wo.orderNumber}</p>
                        <p className="text-xs text-slate-500">
                          {wo.customer?.fullName ?? '—'}
                          {wo.vehicle ? ` · ${wo.vehicle.plateNumber}` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge className={statusCls[wo.status] ?? 'bg-slate-100 text-slate-600'}>
                          {statusLabels[wo.status] ?? wo.status}
                        </Badge>
                        <p className="text-sm font-semibold text-dark-900 mt-1">{formatAr(wo.totalAr)}</p>
                        <p className="text-xs text-slate-400">{formatDateTime(wo.receivedAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <h3 className="flex items-center gap-2 font-semibold text-dark-900 mb-4">
                <CalendarClock className="w-4 h-4 text-violet-600" />
                Prochains rendez-vous
              </h3>
              {stats.upcomingAppointments.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">Aucun rendez-vous</p>
              ) : (
                <div className="divide-y divide-slate-50">
                  {stats.upcomingAppointments.slice(0, 8).map((a) => (
                    <div key={a.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-dark-900">{a.title ?? apptTypeLabels[a.type] ?? a.type}</p>
                        <p className="text-xs text-slate-500">
                          {a.customer?.fullName ?? '—'}
                          {a.mechanic ? ` · ${a.mechanic.fullName}` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium text-dark-900">{formatDay(a.scheduledAt)}</p>
                        <p className="text-xs text-slate-400">{formatTime(a.scheduledAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card className="p-5">
            <h3 className="flex items-center gap-2 font-semibold text-dark-900 mb-4">
              <Bell className="w-4 h-4 text-amber-600" />
              Rappels à venir
            </h3>
            {stats.reminders.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Aucun rappel</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {stats.reminders.slice(0, 8).map((r) => (
                  <div key={r.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-slate-100 text-slate-600">{reminderTypeLabels[r.type] ?? r.type}</Badge>
                        <p className="text-sm font-medium text-dark-900">{r.title}</p>
                      </div>
                      <p className="text-xs text-slate-500">
                        {r.customer?.fullName ?? r.lead?.fullName ?? r.vehicle?.plateNumber ?? '—'}
                      </p>
                    </div>
                    <p className="text-xs text-slate-400 shrink-0">{formatDateTime(r.remindAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}