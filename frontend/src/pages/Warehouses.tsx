import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Warehouse as WarehouseIcon, Pencil, Plus, Trash2, Star } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { formatAr, formatNumber } from '../lib/format';
import { usePermissions } from '../lib/permissions';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorMessage,
  Field,
  Input,
  Loading,
  Modal,
  PageHeader,
} from '../components/ui';

interface Warehouse {
  id: string;
  name: string;
  address: string | null;
  isMain: boolean;
  isActive: boolean;
  productCount: number;
  totalUnits: number;
  totalValueAr: number;
}

export default function Warehouses() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canManage = can('warehouse.manage');
  const canSeeValue = can('cost.view');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [isMain, setIsMain] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const res = await api.get('/warehouses');
      return res.data as Warehouse[];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['warehouses'] });
    queryClient.invalidateQueries({ queryKey: ['stock'] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { name: name.trim(), address: address.trim() || null, isMain };
      if (editing) {
        const res = await api.patch(`/warehouses/${editing.id}`, payload);
        return res.data;
      }
      const res = await api.post('/warehouses', payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success(editing ? 'Dépôt modifié' : 'Dépôt créé');
      closeModal();
      invalidate();
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const toggleMutation = useMutation({
    mutationFn: async (w: Warehouse) => {
      const res = await api.patch(`/warehouses/${w.id}`, { isActive: !w.isActive });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Dépôt mis à jour');
      invalidate();
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (w: Warehouse) => {
      await api.delete(`/warehouses/${w.id}`);
    },
    onSuccess: () => {
      toast.success('Dépôt supprimé');
      invalidate();
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const openCreate = () => {
    setEditing(null);
    setName('');
    setAddress('');
    setIsMain(false);
    setOpen(true);
  };

  const openEdit = (w: Warehouse) => {
    setEditing(w);
    setName(w.name);
    setAddress(w.address ?? '');
    setIsMain(w.isMain);
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setEditing(null);
  };

  return (
    <div>
      <PageHeader
        title="Dépôts"
        subtitle="Répartir vos stocks entre plusieurs entrepôts et transférer les produits"
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4" />
              Nouveau dépôt
            </Button>
          ) : undefined
        }
      />

      {error ? (
        <ErrorMessage message={(error as any).response?.data?.error ?? 'Erreur de chargement'} />
      ) : isLoading ? (
        <Loading />
      ) : !data || data.length === 0 ? (
        <Card>
          <EmptyState title="Aucun dépôt" description="Créez votre premier dépôt pour répartir vos stocks." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.map((w) => (
            <Card key={w.id} className={`p-4 ${w.isActive ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                    <WarehouseIcon className="w-5 h-5 text-green-600" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-dark-900 truncate">
                      {w.name}
                      {w.isMain && <Star className="w-3.5 h-3.5 inline ml-1 text-amber-500 fill-amber-500" />}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{w.address || 'Aucune adresse'}</p>
                  </div>
                </div>
                {!w.isActive && <Badge className="bg-slate-100 text-slate-500">Inactif</Badge>}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-slate-50 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Références</p>
                  <p className="font-semibold text-dark-900">{formatNumber(w.productCount)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Unités</p>
                  <p className="font-semibold text-dark-900">{formatNumber(w.totalUnits)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Valeur</p>
                  <p className="font-semibold text-dark-900">
                    {canSeeValue ? formatAr(w.totalValueAr) : '—'}
                  </p>
                </div>
              </div>

              {canManage && (
                <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
                  <Button variant="outline" size="sm" onClick={() => openEdit(w)}>
                    <Pencil className="w-3.5 h-3.5" /> Modifier
                  </Button>
                  {!w.isMain && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={toggleMutation.isPending}
                      onClick={() => toggleMutation.mutate(w)}
                    >
                      {w.isActive ? 'Désactiver' : 'Réactiver'}
                    </Button>
                  )}
                  {!w.isMain && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto text-red-600 hover:bg-red-50"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (confirm(`Supprimer le dépôt « ${w.name} » ?`)) deleteMutation.mutate(w);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={closeModal}
        title={editing ? 'Modifier le dépôt' : 'Nouveau dépôt'}
        description="Un dépôt principal ne peut être ni supprimé ni désactivé."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) {
              toast.error('Le nom est obligatoire');
              return;
            }
            saveMutation.mutate();
          }}
          className="space-y-4"
        >
          <Field label="Nom du dépôt" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Dépôt Antananarivo" required />
          </Field>
          <Field label="Adresse" hint="Utile pour les livreurs et les inventaires.">
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Ex : Lot II Andraharo" />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={isMain}
              onChange={(e) => setIsMain(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
            />
            Dépôt principal (par défaut des ventes)
          </label>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={closeModal}>Annuler</Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Enregistrement...' : editing ? 'Enregistrer' : 'Créer le dépôt'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
