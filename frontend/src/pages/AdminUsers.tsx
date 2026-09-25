import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Power } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { formatDate } from '../lib/format';
import { useAuth } from '../lib/auth';
import { apiError, initialsOf, type Paginated } from '../lib/admin';
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorMessage, Loading, PageHeader, SearchInput } from '../components/ui';

interface UserRow {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  isActive: boolean;
  isSuperAdmin: boolean;
  emailVerified: boolean;
  createdAt: string;
  memberships: { role: string; isOwner: boolean; store: { id: string; name: string; active: boolean } }[];
}

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const { user: me } = useAuth();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [toggleTarget, setToggleTarget] = useState<UserRow | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'users', search, page],
    queryFn: async () => {
      const res = await api.get('/admin/users', {
        params: { page, pageSize: 15, q: search || undefined },
      });
      return res.data as Paginated<UserRow>;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (row: UserRow) => {
      const res = await api.patch(`/admin/users/${row.id}`, { isActive: !row.isActive });
      return res.data;
    },
    onSuccess: (_data, row) => {
      toast.success(row.isActive ? 'Compte désactivé' : 'Compte activé');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] });
      setToggleTarget(null);
    },
    onError: (err: unknown) => toast.error(apiError(err)),
  });

  return (
    <div>
      <PageHeader title="Utilisateurs" subtitle={`${data?.total ?? 0} compte(s)`} />

      <Card className="mb-4 p-4">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Rechercher par nom ou e-mail..." />
      </Card>

      {error ? (
        <ErrorMessage message={apiError(error, 'Erreur de chargement')} />
      ) : isLoading ? (
        <Loading />
      ) : !data || data.items.length === 0 ? (
        <Card>
          <EmptyState title="Aucun utilisateur" />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100 bg-slate-50/60">
                  <th className="px-4 py-3 font-medium">Utilisateur</th>
                  <th className="px-4 py-3 font-medium">Boutiques</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">Inscrit le</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => {
                  const isSelf = me?.id === u.id;
                  const isProtected = u.isSuperAdmin || isSelf;
                  return (
                    <tr key={u.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0 ${u.isSuperAdmin ? 'bg-gradient-to-br from-violet-500 to-purple-600' : 'bg-gradient-to-br from-emerald-500 to-teal-500'}`}>
                            {initialsOf(u.fullName)}
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium text-dark-900 truncate flex items-center gap-1.5">
                              {u.fullName}
                              {u.isSuperAdmin && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-violet-50 text-violet-600">
                                  <ShieldCheck className="w-3 h-3" />
                                  Superadmin
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-slate-400 truncate max-w-[220px]">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {u.memberships.length === 0 ? (
                          <span className="text-slate-400">Aucune boutique</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {u.memberships.map((m) => (
                              <Badge key={m.store.id} className="bg-slate-100 text-slate-600">
                                {m.store.name}
                                {!m.store.active && ' (inactive)'}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={u.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}>
                          {u.isActive ? 'Actif' : 'Désactivé'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(u.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant={u.isActive ? 'danger' : 'primary'}
                          size="sm"
                          disabled={isProtected || toggleMutation.isPending}
                          title={isProtected ? 'Compte protégé' : undefined}
                          onClick={() => setToggleTarget(u)}
                        >
                          <Power className="w-3.5 h-3.5" />
                          {u.isActive ? 'Désactiver' : 'Activer'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {data.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm">
              <span className="text-slate-500">Page {data.page} sur {data.totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédent</Button>
                <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>Suivant</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <ConfirmDialog
        open={!!toggleTarget && !toggleTarget?.isSuperAdmin}
        onClose={() => setToggleTarget(null)}
        title={toggleTarget?.isActive ? 'Désactiver le compte' : 'Activer le compte'}
        message={
          toggleTarget?.isActive
            ? `Le compte « ${toggleTarget?.fullName} » (${toggleTarget?.email}) ne pourra plus se connecter.`
            : `Le compte « ${toggleTarget?.fullName} » (${toggleTarget?.email}) pourra de nouveau se connecter.`
        }
        confirmLabel={toggleTarget?.isActive ? 'Désactiver' : 'Activer'}
        loading={toggleMutation.isPending}
        onConfirm={() => toggleTarget && toggleMutation.mutate(toggleTarget)}
      />
    </div>
  );
}