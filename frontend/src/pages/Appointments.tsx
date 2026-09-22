import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Check, X, Clock } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { formatDay, formatTime, toDateTimeInput } from '../lib/format';
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, Loading, Modal, PageHeader, Select, Textarea, ErrorMessage } from '../components/ui';

interface AppointmentListItem {
  id: string;
  type: 'REPAIR' | 'MAINTENANCE' | 'INSPECTION' | 'DIAGNOSIS' | 'PICKUP' | 'OTHER';
  status: 'SCHEDULED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  scheduledAt: string;
  durationMin: number;
  title: string | null;
  notes: string | null;
  customer: { id: string; fullName: string; phone: string | null } | null;
  vehicle: { id: string; plateNumber: string; label: string } | null;
  mechanic: { id: string; fullName: string; colorHex: string | null } | null;
  workOrder: { id: string; orderNumber: string; status: string } | null;
}

interface OptionItem {
  id: string;
  fullName: string;
}

interface VehicleOption {
  id: string;
  plateNumber: string;
  label: string;
}

interface MechanicOption {
  id: string;
  fullName: string;
}

type AppointmentStatus = AppointmentListItem['status'];

interface AppointmentForm {
  customerId: string;
  scheduledAt: string;
  vehicleId: string;
  mechanicId: string;
  type: AppointmentListItem['type'];
  status: AppointmentListItem['status'];
  durationMin: number;
  title: string;
  notes: string;
}

const emptyForm: AppointmentForm = {
  customerId: '',
  scheduledAt: '',
  vehicleId: '',
  mechanicId: '',
  type: 'REPAIR',
  status: 'SCHEDULED',
  durationMin: 60,
  title: '',
  notes: '',
};

const appointmentTypeLabels: Record<string, string> = { REPAIR: 'Réparation', MAINTENANCE: 'Entretien', INSPECTION: 'Contrôle', DIAGNOSIS: 'Diagnostic', PICKUP: 'Enlèvement', OTHER: 'Autre' };
const appointmentTypeCls: Record<string, string> = { REPAIR: 'bg-blue-50 text-blue-700', MAINTENANCE: 'bg-green-50 text-green-700', INSPECTION: 'bg-violet-50 text-violet-700', DIAGNOSIS: 'bg-amber-50 text-amber-700', PICKUP: 'bg-sky-50 text-sky-700', OTHER: 'bg-slate-100 text-slate-600' };
const appointmentStatusLabels: Record<string, string> = { SCHEDULED: 'Planifié', CONFIRMED: 'Confirmé', IN_PROGRESS: 'En cours', COMPLETED: 'Terminé', CANCELLED: 'Annulé', NO_SHOW: 'Absent' };
const appointmentStatusCls: Record<string, string> = { SCHEDULED: 'bg-slate-100 text-slate-600', CONFIRMED: 'bg-blue-50 text-blue-700', IN_PROGRESS: 'bg-amber-50 text-amber-700', COMPLETED: 'bg-green-50 text-green-700', CANCELLED: 'bg-red-50 text-red-600', NO_SHOW: 'bg-red-50 text-red-600' };

const statusOptions = ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const;

export default function Appointments() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AppointmentListItem | null>(null);
  const [form, setForm] = useState<AppointmentForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<AppointmentListItem | null>(null);

  const { data: appointments, isLoading, error } = useQuery({
    queryKey: ['appointments', statusFilter],
    queryFn: async () => {
      const res = await api.get('/appointments', {
        params: { status: statusFilter || undefined },
      });
      return res.data as { data: AppointmentListItem[] };
    },
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers-list'],
    queryFn: async () => {
      const res = await api.get('/customers', { params: { limit: 100 } });
      return res.data.data as OptionItem[];
    },
  });

  const { data: vehiclesData } = useQuery({
    queryKey: ['vehicles-list'],
    queryFn: async () => {
      const res = await api.get('/vehicles', { params: { limit: 100 } });
      return res.data.data as VehicleOption[];
    },
  });

  const { data: mechanicsData } = useQuery({
    queryKey: ['mechanics-list'],
    queryFn: async () => {
      const res = await api.get('/mechanics');
      return res.data.data as MechanicOption[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: AppointmentForm) => {
      const payload = {
        customerId: data.customerId,
        scheduledAt: new Date(data.scheduledAt).toISOString(),
        vehicleId: data.vehicleId || null,
        mechanicId: data.mechanicId || null,
        type: data.type,
        status: data.status,
        durationMin: data.durationMin,
        title: data.title || null,
        notes: data.notes || null,
      };
      const res = await api.post('/appointments', payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Rendez-vous créé');
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setModalOpen(false);
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: AppointmentForm }) => {
      const payload = {
        customerId: data.customerId,
        scheduledAt: new Date(data.scheduledAt).toISOString(),
        vehicleId: data.vehicleId || null,
        mechanicId: data.mechanicId || null,
        type: data.type,
        status: data.status,
        durationMin: data.durationMin,
        title: data.title || null,
        notes: data.notes || null,
      };
      const res = await api.put(`/appointments/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Rendez-vous mis à jour');
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setModalOpen(false);
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/appointments/${id}`),
    onSuccess: () => {
      toast.success('Rendez-vous supprimé');
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setDeleteTarget(null);
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur'),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AppointmentStatus }) =>
      api.patch(`/appointments/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur'),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (a: AppointmentListItem) => {
    setEditing(a);
    setForm({
      customerId: a.customer?.id ?? '',
      scheduledAt: toDateTimeInput(a.scheduledAt),
      vehicleId: a.vehicle?.id ?? '',
      mechanicId: a.mechanic?.id ?? '',
      type: a.type,
      status: a.status,
      durationMin: a.durationMin,
      title: a.title ?? '',
      notes: a.notes ?? '',
    });
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const set = (key: keyof AppointmentForm, value: string | number) => setForm((f) => ({ ...f, [key]: value }));

  const grouped = (() => {
    if (!appointments) return new Map<string, AppointmentListItem[]>();
    const map = new Map<string, AppointmentListItem[]>();
    for (const a of appointments.data) {
      const key = formatDay(a.scheduledAt);
      const list = map.get(key);
      if (list) {
        list.push(a);
      } else {
        map.set(key, [a]);
      }
    }
    return map;
  })();

  const count = appointments?.data.length ?? 0;

  return (
    <div>
      <PageHeader
        title="Rendez-vous"
        subtitle={`${count} rendez-vous`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Nouveau rendez-vous
          </Button>
        }
      />

      <Card className="mb-4 p-4 flex items-center gap-3">
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-48">
          <option value="">Tous les statuts</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>{appointmentStatusLabels[s]}</option>
          ))}
        </Select>
      </Card>

      {error ? (
        <ErrorMessage message={(error as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur de chargement'} />
      ) : isLoading ? (
        <Loading />
      ) : count === 0 ? (
        <Card>
          <EmptyState title="Aucun rendez-vous" description="Planifiez votre premier rendez-vous." />
        </Card>
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([dayLabel, items]) => (
            <Card key={dayLabel} className="overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-700">{dayLabel}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100 bg-slate-50/60">
                      <th className="px-4 py-3 font-medium">Heure</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Client</th>
                      <th className="px-4 py-3 font-medium">Véhicule</th>
                      <th className="px-4 py-3 font-medium">Mécanicien</th>
                      <th className="px-4 py-3 font-medium text-right">Durée</th>
                      <th className="px-4 py-3 font-medium">Statut</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((a) => (
                      <tr key={a.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5 text-slate-700 font-medium">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {formatTime(a.scheduledAt)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={appointmentTypeCls[a.type]}>{appointmentTypeLabels[a.type]}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          {a.customer ? (
                            <div>
                              <p className="font-medium text-slate-800">{a.customer.fullName}</p>
                              {a.customer.phone && <p className="text-xs text-slate-400">{a.customer.phone}</p>}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{a.vehicle?.plateNumber ?? '—'}</td>
                        <td className="px-4 py-3">
                          {a.mechanic ? (
                            <span className="flex items-center gap-1.5 text-slate-600">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: a.mechanic.colorHex ?? '#94a3b8' }} />
                              {a.mechanic.fullName}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-500">{a.durationMin} min</td>
                        <td className="px-4 py-3">
                          <Badge className={appointmentStatusCls[a.status]}>{appointmentStatusLabels[a.status]}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {a.status === 'SCHEDULED' && (
                              <Button variant="ghost" size="sm" onClick={() => statusMutation.mutate({ id: a.id, status: 'CONFIRMED' })} title="Confirmer">
                                <Check className="w-4 h-4" />
                              </Button>
                            )}
                            {(a.status === 'CONFIRMED' || a.status === 'IN_PROGRESS') && (
                              <Button variant="ghost" size="sm" onClick={() => statusMutation.mutate({ id: a.id, status: 'COMPLETED' })} title="Terminer">
                                <Check className="w-4 h-4" />
                              </Button>
                            )}
                            {(a.status === 'SCHEDULED' || a.status === 'CONFIRMED') && (
                              <Button variant="ghost" size="sm" onClick={() => statusMutation.mutate({ id: a.id, status: 'CANCELLED' })} title="Annuler">
                                <X className="w-4 h-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => openEdit(a)} title="Modifier">
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="hover:text-red-600" onClick={() => setDeleteTarget(a)} title="Supprimer">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Client" required>
              <Select value={form.customerId} onChange={(e) => set('customerId', e.target.value)} required>
                <option value="">Sélectionner un client</option>
                {customersData?.map((c) => (
                  <option key={c.id} value={c.id}>{c.fullName}</option>
                ))}
              </Select>
            </Field>
            <Field label="Date et heure" required>
              <Input type="datetime-local" value={form.scheduledAt} onChange={(e) => set('scheduledAt', e.target.value)} required />
            </Field>
            <Field label="Type">
              <Select value={form.type} onChange={(e) => set('type', e.target.value)}>
                {Object.entries(appointmentTypeLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </Field>
            {editing && (
              <Field label="Statut">
                <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>{appointmentStatusLabels[s]}</option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Durée (minutes)">
              <Input type="number" min={1} value={form.durationMin} onChange={(e) => set('durationMin', Number(e.target.value))} />
            </Field>
            <Field label="Titre">
              <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Optionnel" />
            </Field>
            <Field label="Véhicule">
              <Select value={form.vehicleId} onChange={(e) => set('vehicleId', e.target.value)}>
                <option value="">Aucun</option>
                {vehiclesData?.map((v) => (
                  <option key={v.id} value={v.id}>{v.plateNumber} — {v.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Mécanicien">
              <Select value={form.mechanicId} onChange={(e) => set('mechanicId', e.target.value)}>
                <option value="">Aucun</option>
                {mechanicsData?.map((m) => (
                  <option key={m.id} value={m.id}>{m.fullName}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Notes">
            <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Optionnel" />
          </Field>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {editing ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Supprimer le rendez-vous"
        message={`Voulez-vous vraiment supprimer ce rendez-vous du ${deleteTarget ? formatTime(deleteTarget.scheduledAt) : ''} ?`}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}
