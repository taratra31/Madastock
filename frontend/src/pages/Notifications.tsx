import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { formatDateTime } from '../lib/format';
import { Button, Card, EmptyState, ErrorMessage, Loading, PageHeader } from '../components/ui';
import {
  notificationIcon,
  useDeleteNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  type AppNotification,
} from '../components/NotificationBell';

const FILTERS = [
  { key: 'all', label: 'Toutes' },
  { key: 'unread', label: 'Non lues' },
] as const;

export default function Notifications() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const [page, setPage] = useState(1);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const remove = useDeleteNotification();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['notifications', 'page', filter, page],
    queryFn: async () => {
      const { data: res } = await api.get<{
        data: AppNotification[];
        unreadCount: number;
        pagination: { page: number; limit: number; total: number; pages: number };
      }>('/notifications', { params: { page, limit: 15, unread: filter === 'unread' } });
      return res;
    },
  });

  const items = data?.data ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Notifications"
        subtitle={
          data
            ? `${data.pagination.total} notification(s)${data.unreadCount > 0 ? ` — ${data.unreadCount} non lue(s)` : ''}`
            : 'Abonnement, paiements, stock et rappels'
        }
        actions={
          data && data.unreadCount > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                markAll.mutate(undefined, { onSuccess: () => toast.success('Toutes les notifications sont lues.') });
              }}
            >
              <CheckCheck className="w-4 h-4 mr-1.5" /> Tout marquer lu
            </Button>
          ) : undefined
        }
      />

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => {
              setFilter(f.key);
              setPage(1);
            }}
            className={
              filter === f.key
                ? 'px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white'
                : 'px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50'
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && <Loading />}
      {!isLoading && error && <ErrorMessage message="Impossible de charger les notifications." />}

      {!isLoading && !error && items.length === 0 && (
        <Card>
          <EmptyState
            title={filter === 'unread' ? 'Aucune notification non lue' : 'Aucune notification'}
            description="Les activations d'abonnement, les paiements, le stock bas et les rappels du jour apparaîtront ici."
          />
        </Card>
      )}

      {items.length > 0 && (
        <Card className="divide-y divide-slate-100 overflow-hidden">
          {items.map((n) => {
            const { icon: Icon, className } = notificationIcon(n.type);
            return (
              <div key={n.id} className={n.isRead ? 'flex gap-3 p-4' : 'flex gap-3 p-4 bg-green-50/40'}>
                <span className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${className}`}>
                  <Icon className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm ${n.isRead ? 'text-slate-700' : 'font-semibold text-dark-900'}`}>{n.title}</p>
                    {typeof n.data?.daysLeft === 'number' && (
                      <span className="px-1.5 py-0.5 rounded bg-white text-[10px] font-bold text-amber-700 ring-1 ring-amber-200">
                        J-{n.data.daysLeft}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 mt-0.5">{n.message}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {formatDateTime(n.createdAt)}
                    {n.isRead && n.readAt ? ` · lu le ${formatDateTime(n.readAt)}` : ''}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-1.5 items-start">
                  {n.data?.to && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (!n.isRead) markRead.mutate(n.id);
                        navigate(n.data!.to!);
                      }}
                    >
                      Ouvrir
                    </Button>
                  )}
                  {!n.isRead && (
                    <Button variant="outline" size="sm" onClick={() => markRead.mutate(n.id)}>
                      Lu
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove.mutate(n.id)}
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4 text-slate-400" />
                  </Button>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {data && data.pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">
            Page {data.pagination.page} sur {data.pagination.pages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.pagination.pages}
              onClick={() => setPage(page + 1)}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
