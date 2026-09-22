import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Eye, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { formatAr, formatDate, formatDateTime, toDateInput, toDateTimeInput } from '../lib/format';
import {
  Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, Loading, Modal, PageHeader, SearchInput, Select, Textarea, ErrorMessage,
} from '../components/ui';

type WorkOrderStatus = 'QUOTED' | 'IN_PROGRESS' | 'WAITING_PART' | 'PAUSED' | 'COMPLETED' | 'COLLECTED' | 'CANCELLED';

interface WorkOrderListItem {
  id: string;
  orderNumber: string;
  status: WorkOrderStatus;
  priority: string;
  complaint: string | null;
  receivedAt: string;
  estimatedDeliveryAt: string | null;
  laborCostAr: number;
  partsCostAr: number;
  totalAr: number;
  paymentStatus: string;
  itemsCount: number;
  customer: { id: string; fullName: string; phone: string | null } | null;
  vehicle: { id: string; plateNumber: string; label: string } | null;
  mechanic: { id: string; fullName: string; colorHex: string | null } | null;
}

interface WorkOrderItem {
  id: string;
  type: string;
  description: string;
  productId: string | null;
  product: { id: string; name: string; sku: string | null } | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  lineTotal: number;
}

interface WorkOrderDetail extends WorkOrderListItem {
  diagnosis: string | null;
  discountAr: number;
  taxAr: number;
  amountPaidAr: number;
  notes: string | null;
  items: WorkOrderItem[];
}

interface CustomerOpt {
  id: string;
  fullName: string;
}

interface VehicleOpt {
  id: string;
  plateNumber: string;
  label: string | null;
}

interface MechanicOpt {
  id: string;
  fullName: string;
  colorHex: string | null;
}

interface LineItemForm {
  description: string;
  type: string;
  quantity: string;
  unitPrice: string;
}

interface WorkOrdersForm {
  customerId: string;
  vehicleId: string;
  mechanicId: string;
  priority: string;
  complaint: string;
  diagnosis: string;
  receivedAt: string;
  estimatedDeliveryAt: string;
  discount: string;
  tax: string;
  notes: string;
}

const emptyForm: WorkOrdersForm = {
  customerId: '',
  vehicleId: '',
  mechanicId: '',
  priority: 'NORMAL',
  complaint: '',
  diagnosis: '',
  receivedAt: '',
  estimatedDeliveryAt: '',
  discount: '0',
  tax: '0',
  notes: '',
};

const newLine = (): LineItemForm => ({ description: '', type: 'PART', quantity: '1', unitPrice: '' });

const workOrderStatusLabels: Record<string, string> = {
  QUOTED: 'Devis',
  IN_PROGRESS: 'En cours',
  WAITING_PART: 'En attente de pièces',
  PAUSED: 'En pause',
  COMPLETED: 'Terminé',
  COLLECTED: 'Récupéré',
  CANCELLED: 'Annulé',
};

const workOrderStatusCls: Record<string, string> = {
  QUOTED: 'bg-slate-100 text-slate-600',
  IN_PROGRESS: 'bg-blue-50 text-blue-700',
  WAITING_PART: 'bg-amber-50 text-amber-700',
  PAUSED: 'bg-slate-100 text-slate-500',
  COMPLETED: 'bg-green-50 text-green-700',
  COLLECTED: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-red-50 text-red-600',
};

const priorityLabels: Record<string, string> = {
  LOW: 'Basse',
  NORMAL: 'Normale',
  HIGH: 'Haute',
  URGENT: 'Urgente',
};

const priorityCls: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-500',
  NORMAL: 'bg-slate-100 text-slate-600',
  HIGH: 'bg-orange-50 text-orange-600',
  URGENT: 'bg-red-50 text-red-600',
};

const lineTypeLabels: Record<string, string> = {
  LABOR: "Main d'œuvre",
  PART: 'Pièce',
  OTHER: 'Autre',
};

export default function WorkOrders() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WorkOrderListItem | null>(null);
  const [form, setForm] = useState<WorkOrdersForm>(emptyForm);
  const [lines, setLines] = useState<LineItemForm[]>([newLine()]);
  const [view, setView] = useState<WorkOrderDetail | null>(null);
  const [statusDraft, setStatusDraft] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<WorkOrderListItem | null>(null);

  const { data: workOrders, isLoading, error } = useQuery({
    queryKey: ['work-orders', statusFilter, search, page],
    queryFn: async () => {
      const res = await api.get('/work-orders', {
        params: {
          page,
          limit: 20,
          status: statusFilter === 'all' ? undefined : statusFilter,
          search: search || undefined,
        },
      });
      return res.data as { data: WorkOrderListItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
    },
  });

  const { data: customers } = useQuery({
    queryKey: ['customer-options'],
    queryFn: async () => {
      const res = await api.get('/customers', { params: { limit: 100 } });
      return (res.data.data as CustomerOpt[]).sort((a, b) => a.fullName.localeCompare(b.fullName));
    },
  });

  const { data: vehicles } = useQuery({
    queryKey: ['vehicle-options'],
    queryFn: async () => {
      const res = await api.get('/vehicles', { params: { limit: 100 } });
      return res.data.data as VehicleOpt[];
    },
  });

  const { data: mechanics } = useQuery({
    queryKey: ['mechanic-options'],
    queryFn: async () => {
      const res = await api.get('/mechanics');
      return res.data.data as MechanicOpt[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await api.post('/work-orders', data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Ordre de réparation créé');
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['garage-stats'] });
      setModalOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await api.put(`/work-orders/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Ordre de réparation mis à jour');
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['garage-stats'] });
      setModalOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/work-orders/${id}`),
    onSuccess: () => {
      toast.success('Ordre de réparation supprimé');
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['garage-stats'] });
      setDeleteTarget(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await api.patch(`/work-orders/${id}/status`, { status });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Statut mis à jour');
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['garage-stats'] });
      setView(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const set = (key: keyof WorkOrdersForm, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const updateLine = (idx: number, key: keyof LineItemForm, value: string) =>
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, [key]: value } : l)));

  const removeLine = (idx: number) => setLines((ls) => ls.filter((_, i) => i !== idx));

  const linesTotal = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
  const grandTotal = linesTotal - (Number(form.discount) || 0) + (Number(form.tax) || 0);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setLines([newLine()]);
    setModalOpen(true);
  };

  const openEdit = async (wo: WorkOrderListItem) => {
    try {
      const res = await api.get(`/work-orders/${wo.id}`);
      const d = res.data as WorkOrderDetail;
      setEditing(wo);
      setForm({
        customerId: d.customer?.id ?? '',
        vehicleId: d.vehicle?.id ?? '',
        mechanicId: d.mechanic?.id ?? '',
        priority: d.priority,
        complaint: d.complaint ?? '',
        diagnosis: d.diagnosis ?? '',
        receivedAt: toDateTimeInput(d.receivedAt),
        estimatedDeliveryAt: toDateInput(d.estimatedDeliveryAt),
        discount: String(d.discountAr),
        tax: String(d.taxAr),
        notes: d.notes ?? '',
      });
      setLines(
        d.items.length > 0
          ? d.items.map((it) => ({
              description: it.description,
              type: it.type,
              quantity: String(it.quantity),
              unitPrice: String(it.unitPrice),
            }))
          : [newLine()],
      );
      setModalOpen(true);
    } catch {
      toast.error('Impossible de charger l\'ordre de réparation');
    }
  };

  const openView = async (wo: WorkOrderListItem) => {
    try {
      const res = await api.get(`/work-orders/${wo.id}`);
      const d = res.data as WorkOrderDetail;
      setView(d);
      setStatusDraft(d.status);
    } catch {
      toast.error('Impossible de charger l\'ordre de réparation');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerId) {
      toast.error('Choisissez un client');
      return;
    }
    const items = lines
      .filter((l) => l.description.trim())
      .map((l) => ({
        type: l.type,
        description: l.description.trim(),
        quantity: Number(l.quantity) || 1,
        unitPrice: Number(l.unitPrice) || 0,
      }));
    if (items.length === 0) {
      toast.error('Ajoutez au moins une ligne à l\'ordre');
      return;
    }
    const payload = {
      customerId: form.customerId,
      vehicleId: form.vehicleId || undefined,
      mechanicId: form.mechanicId || undefined,
      priority: form.priority,
      complaint: form.complaint || undefined,
      diagnosis: form.diagnosis || undefined,
      receivedAt: form.receivedAt ? new Date(form.receivedAt).toISOString() : undefined,
      estimatedDeliveryAt: form.estimatedDeliveryAt ? new Date(form.estimatedDeliveryAt).toISOString() : undefined,
      discount: Number(form.discount) || 0,
      tax: Number(form.tax) || 0,
      notes: form.notes || undefined,
      items,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleStatusApply = () => {
    if (!view || !statusDraft || statusDraft === view.status) return;
    statusMutation.mutate({ id: view.id, status: statusDraft });
  };

  return (
    <div>
      <PageHeader
        title="Ordres de réparation"
        subtitle="Les interventions en cours et passées"
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Nouvel ordre
          </Button>
        }
      />

      <Card className="mb-4 p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setPage(1); }}
            placeholder="Rechercher (n°, plainte, client, plaque)..."
          />
        </div>
        <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="sm:w-56">
          <option value="all">Tous les statuts</option>
          {Object.entries(workOrderStatusLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </Select>
      </Card>

      {error ? (
        <ErrorMessage message={(error as any).response?.data?.error ?? 'Erreur de chargement'} />
      ) : isLoading ? (
        <Loading />
      ) : !workOrders || workOrders.data.length === 0 ? (
        <Card>
          <EmptyState title="Aucun ordre de réparation" description="Créez votre premier ordre de réparation." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100 bg-slate-50/60">
                  <th className="px-4 py-3 font-medium">N°</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Véhicule</th>
                  <th className="px-4 py-3 font-medium">Mécanicien</th>
                  <th className="px-4 py-3 font-medium">Priorité</th>
                  <th className="px-4 py-3 font-medium">Reçu le</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {workOrders.data.map((wo) => (
                  <tr key={wo.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-dark-900">{wo.orderNumber}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-dark-900">{wo.customer?.fullName ?? '—'}</p>
                      {wo.customer?.phone && <p className="text-xs text-slate-400">{wo.customer.phone}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{wo.vehicle?.plateNumber ?? '—'}</td>
                    <td className="px-4 py-3">
                      {wo.mechanic ? (
                        <span className="flex items-center gap-2 text-slate-600">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: wo.mechanic.colorHex ?? '#64748b' }} />
                          {wo.mechanic.fullName}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={priorityCls[wo.priority] ?? 'bg-slate-100 text-slate-600'}>
                        {priorityLabels[wo.priority] ?? wo.priority}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(wo.receivedAt)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-dark-900">{formatAr(wo.totalAr)}</td>
                    <td className="px-4 py-3">
                      <Badge className={workOrderStatusCls[wo.status] ?? 'bg-slate-100 text-slate-600'}>
                        {workOrderStatusLabels[wo.status] ?? wo.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openView(wo)} title="Voir le détail">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(wo)} title="Modifier">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="hover:text-red-600" onClick={() => setDeleteTarget(wo)} title="Supprimer">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {workOrders.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm">
              <span className="text-slate-500">
                Page {workOrders.pagination.page} sur {workOrders.pagination.totalPages}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédent</Button>
                <Button variant="outline" size="sm" disabled={page >= workOrders.pagination.totalPages} onClick={() => setPage(page + 1)}>Suivant</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Modifier ${editing.orderNumber}` : 'Nouvel ordre de réparation'}
        size="xl"
        description="Enregistrez une intervention pour un client."
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Client" required>
              <Select value={form.customerId} onChange={(e) => set('customerId', e.target.value)} required>
                <option value="">Choisir un client...</option>
                {(customers ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.fullName}</option>
                ))}
              </Select>
            </Field>
            <Field label="Véhicule">
              <Select value={form.vehicleId} onChange={(e) => set('vehicleId', e.target.value)}>
                <option value="">Aucun</option>
                {(vehicles ?? []).map((v) => (
                  <option key={v.id} value={v.id}>{v.label ? `${v.plateNumber} — ${v.label}` : v.plateNumber}</option>
                ))}
              </Select>
            </Field>
            <Field label="Mécanicien">
              <Select value={form.mechanicId} onChange={(e) => set('mechanicId', e.target.value)}>
                <option value="">Non assigné</option>
                {(mechanics ?? []).map((m) => (
                  <option key={m.id} value={m.id}>{m.fullName}</option>
                ))}
              </Select>
            </Field>
            <Field label="Priorité">
              <Select value={form.priority} onChange={(e) => set('priority', e.target.value)}>
                {Object.entries(priorityLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </Field>
            <Field label="Plainte">
              <Input value={form.complaint} onChange={(e) => set('complaint', e.target.value)} placeholder="Problème signalé par le client" />
            </Field>
            <Field label="Diagnostic">
              <Input value={form.diagnosis} onChange={(e) => set('diagnosis', e.target.value)} placeholder="Optionnel" />
            </Field>
            <Field label="Reçu le">
              <Input type="datetime-local" value={form.receivedAt} onChange={(e) => set('receivedAt', e.target.value)} />
            </Field>
            <Field label="Échéance estimée">
              <Input type="date" value={form.estimatedDeliveryAt} onChange={(e) => set('estimatedDeliveryAt', e.target.value)} />
            </Field>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-700">Lignes de l'ordre</p>
              <Button type="button" variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, newLine()])}>
                <Plus className="w-3.5 h-3.5" />
                Ajouter une ligne
              </Button>
            </div>
            <div className="space-y-2">
              {lines.map((l, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <Select value={l.type} onChange={(e) => updateLine(idx, 'type', e.target.value)} className="col-span-3">
                    {Object.entries(lineTypeLabels).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </Select>
                  <Input
                    value={l.description}
                    onChange={(e) => updateLine(idx, 'description', e.target.value)}
                    placeholder="Description"
                    className="col-span-4"
                  />
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={l.quantity}
                    onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                    placeholder="Qté"
                    className="col-span-2"
                  />
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={l.unitPrice}
                    onChange={(e) => updateLine(idx, 'unitPrice', e.target.value)}
                    placeholder="Prix (Ar)"
                    className="col-span-2"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="col-span-1 hover:text-red-600"
                    onClick={() => removeLine(idx)}
                    title="Supprimer la ligne"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Remise (Ar)">
              <Input type="number" min={0} value={form.discount} onChange={(e) => set('discount', e.target.value)} />
            </Field>
            <Field label="TVA (Ar)">
              <Input type="number" min={0} value={form.tax} onChange={(e) => set('tax', e.target.value)} />
            </Field>
            <div className="flex flex-col justify-end">
              <div className="rounded-lg bg-slate-50 px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-slate-500">Total estimé</span>
                <span className="text-lg font-bold text-dark-900">{formatAr(grandTotal)}</span>
              </div>
            </div>
          </div>

          <Field label="Notes">
            <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Optionnel" />
          </Field>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {editing ? 'Enregistrer' : "Créer l'ordre"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!view}
        onClose={() => setView(null)}
        size="xl"
        title={view ? `${view.orderNumber} · ${view.customer?.fullName ?? '—'}` : 'Ordre de réparation'}
        footer={<Button variant="outline" onClick={() => setView(null)}>Fermer</Button>}
      >
        {view && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Badge className={workOrderStatusCls[view.status] ?? 'bg-slate-100 text-slate-600'}>
                {workOrderStatusLabels[view.status] ?? view.status}
              </Badge>
              <Badge className={priorityCls[view.priority] ?? 'bg-slate-100 text-slate-600'}>
                {priorityLabels[view.priority] ?? view.priority}
              </Badge>
              <Badge className="bg-slate-100 text-slate-600">Paiement : {view.paymentStatus}</Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-400">Reçu le</p>
                <p className="font-medium">{formatDateTime(view.receivedAt)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Échéance</p>
                <p className="font-medium">{view.estimatedDeliveryAt ? formatDate(view.estimatedDeliveryAt) : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Mécanicien</p>
                <p className="font-medium">
                  {view.mechanic ? (
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: view.mechanic.colorHex ?? '#64748b' }} />
                      {view.mechanic.fullName}
                    </span>
                  ) : (
                    '—'
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Véhicule</p>
                <p className="font-medium">{view.vehicle ? `${view.vehicle.plateNumber} — ${view.vehicle.label}` : '—'}</p>
              </div>
            </div>

            <div className="grid gap-3">
              {view.complaint && (
                <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-4 py-3">
                  <span className="font-medium">Plainte : </span>
                  {view.complaint}
                </p>
              )}
              {view.diagnosis && (
                <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-4 py-3">
                  <span className="font-medium">Diagnostic : </span>
                  {view.diagnosis}
                </p>
              )}
            </div>

            <div className="border border-slate-100 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs uppercase text-slate-500">
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2 text-right">Qté</th>
                    <th className="px-3 py-2 text-right">PU</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {view.items.map((it) => (
                    <tr key={it.id} className="border-t border-slate-50">
                      <td className="px-3 py-2">
                        {it.description}
                        {it.product && <span className="text-xs text-slate-400 ml-1">({it.product.name})</span>}
                      </td>
                      <td className="px-3 py-2 text-slate-500">{lineTypeLabels[it.type] ?? it.type}</td>
                      <td className="px-3 py-2 text-right">{it.quantity}</td>
                      <td className="px-3 py-2 text-right">{formatAr(it.unitPrice)}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatAr(it.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-1 text-sm ml-auto w-full sm:w-72">
              <div className="flex justify-between text-slate-500">
                <span>Sous-total main d'œuvre</span>
                <span>{formatAr(view.laborCostAr)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Sous-total pièces</span>
                <span>{formatAr(view.partsCostAr)}</span>
              </div>
              {view.discountAr > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Remise</span>
                  <span>-{formatAr(view.discountAr)}</span>
                </div>
              )}
              {view.taxAr > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>TVA</span>
                  <span>{formatAr(view.taxAr)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-dark-900 border-t border-slate-100 pt-1">
                <span>Total</span>
                <span>{formatAr(view.totalAr)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Payé</span>
                <span>{formatAr(view.amountPaidAr)}</span>
              </div>
              <div className="flex justify-between font-semibold text-green-600">
                <span>Reste à payer</span>
                <span>{formatAr(Math.max(0, view.totalAr - view.amountPaidAr))}</span>
              </div>
            </div>

            {view.notes && (
              <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-4 py-3">
                <span className="font-medium">Notes : </span>
                {view.notes}
              </p>
            )}

            <div className="border-t border-slate-100 pt-4">
              <p className="text-sm font-medium text-slate-700 mb-2">Changer le statut</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={statusDraft} onChange={(e) => setStatusDraft(e.target.value)} className="sm:flex-1">
                  {Object.entries(workOrderStatusLabels).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </Select>
                <Button onClick={handleStatusApply} disabled={statusMutation.isPending || !statusDraft || statusDraft === view.status}>
                  {statusMutation.isPending ? 'Application...' : 'Appliquer'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Supprimer l'ordre de réparation"
        message={`Voulez-vous vraiment supprimer « ${deleteTarget?.orderNumber} » ? Cette action est irréversible.`}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}