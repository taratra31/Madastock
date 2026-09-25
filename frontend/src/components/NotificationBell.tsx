import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, PackageX, AlertTriangle, CreditCard, CalendarClock, Ban, RefreshCw, PartyPopper } from 'lucide-react';
import api from '../lib/api';
import { formatDateTime } from '../lib/format';
import { cn } from './ui';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: { to?: string; daysLeft?: number; [key: string]: unknown } | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

const ICONS: Record<string, { icon: typeof Bell; className: string }> = {
  SUBSCRIPTION_ACTIVATED: { icon: PartyPopper, className: 'bg-green-100 text-green-700' },
  SUBSCRIPTION_RENEWED: { icon: RefreshCw, className: 'bg-green-100 text-green-700' },
  SUBSCRIPTION_EXPIRING: { icon: CalendarClock, className: 'bg-amber-100 text-amber-700' },
  SUBSCRIPTION_EXPIRED: { icon: Ban, className: 'bg-red-100 text-red-700' },
  PAYMENT_FAILED: { icon: CreditCard, className: 'bg-red-100 text-red-700' },
  LOW_STOCK: { icon: PackageX, className: 'bg-orange-100 text-orange-700' },
  REMINDER_DUE: { icon: AlertTriangle, className: 'bg-blue-100 text-blue-700' },
};

export function notificationIcon(type: string) {
  return ICONS[type] ?? { icon: Bell, className: 'bg-slate-100 text-slate-600' };
}

export function useNotifications(limit = 15) {
  return useQuery({
    queryKey: ['notifications', limit],
    queryFn: async () => {
      const { data } = await api.get<{ data: AppNotification[]; unreadCount: number }>('/notifications', {
        params: { limit },
      });
      return data;
    },
    refetchInterval: 60_000,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: async () => {
      const { data } = await api.get<{ unreadCount: number }>('/notifications/unread');
      return data.unreadCount;
    },
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

function NotificationRow({ n, onOpen }: { n: AppNotification; onOpen: () => void }) {
  const { icon: Icon, className } = notificationIcon(n.type);
  return (
    <Link
      to={n.data?.to ?? '/notifications'}
      onClick={onOpen}
      className={cn(
        'flex gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0',
        !n.isRead && 'bg-green-50/40',
      )}
    >
      <span className={cn('shrink-0 w-8 h-8 rounded-lg flex items-center justify-center', className)}>
        <Icon className="w-4 h-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={cn('text-sm truncate', n.isRead ? 'text-slate-700' : 'font-semibold text-dark-900')}>{n.title}</span>
          {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />}
        </span>
        <span className="block text-xs text-slate-500 line-clamp-2 mt-0.5">{n.message}</span>
        <span className="block text-[11px] text-slate-400 mt-0.5">{formatDateTime(n.createdAt)}</span>
      </span>
    </Link>
  );
}

/** Cloche du header : badge non lus + dernier mois glissant. */
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const { data, isLoading } = useNotifications(10);
  const { data: unreadCount = 0 } = useUnreadCount();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const openItem = (n: AppNotification) => {
    if (!n.isRead) markRead.mutate(n.id);
    setOpen(false);
  };

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[340px] sm:w-[400px] bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
            <p className="text-sm font-semibold text-dark-900">Notifications</p>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAll.mutate()}
                  className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" /> Tout lire
                </button>
              )}
              <Link
                to="/notifications"
                onClick={() => setOpen(false)}
                className="text-xs text-slate-500 hover:text-green-600"
              >
                Tout voir
              </Link>
            </div>
          </div>

          <div className="max-h-[380px] overflow-y-auto">
            {isLoading && <p className="px-4 py-6 text-sm text-slate-400 text-center">Chargement…</p>}
            {!isLoading && (data?.data.length ?? 0) === 0 && (
              <p className="px-4 py-8 text-sm text-slate-400 text-center">Aucune notification pour le moment.</p>
            )}
            {(data?.data ?? []).map((n) => (
              <NotificationRow key={n.id} n={n} onOpen={() => openItem(n)} />
            ))}
          </div>

          {unreadCount > 0 && (
            <button
              onClick={() => {
                setOpen(false);
                navigate('/billing');
              }}
              className="w-full px-4 py-2.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border-t border-slate-100"
            >
              {unreadCount} non lue(s) — voir mon abonnement
            </button>
          )}
        </div>
      )}
    </div>
  );
}
