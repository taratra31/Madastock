import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Check, X, Send } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { formatDateTime, toDateTimeInput } from '../lib/format';
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, Loading, Modal, PageHeader, Select, Textarea, ErrorMessage } from '../components/ui';

interface ReminderListItem {
  id: string;
  type: 'SERVICE_DUE' | 'FOLLOW_UP' | 'PAYMENT' | 'APPOINTMENT' | 'OTHER';
  status: 'PENDING' | 'SENT' | 'DONE' | 'CANCELLED';
  remindAt: string;
  title: string;
  message: string | null;
  completedAt: string | null;
  createdAt: string;
  customer: { id: string; fullName: string; phone: string | null } | null;
  lead: { id: string; fullName: string; phone: string | null } | null;
  vehicle: { id: string; plateNumber: string } | null;
  workOrder: { id: string; orderNumber: string } | null;
  invoice: { id: string; number: string } | null;
  assignedTo: { id: string; fullName: string } | null;
}

interface OptionItem {
  id: string;
  fullName: string;
}

type ReminderStatus = ReminderListItem['status'];

interface ReminderForm {
  type: ReminderListItem['type'];
  remindAt: string;
  title: string;
  message: string;
  customerId: string;
}

const emptyForm: ReminderForm = {
  type: 'FOLLOW_UP',
  remindAt: '',
  title: '',
  message: '',
  customerId: '',
};

const reminderTypeLabels: Record<string, string> = { SERVICE_DUE: 'Entretien préventif', FOLLOW_UP: 'Relance client', PAYMENT: 'Paiement', APPOINTMENT: 'Rendez-vous', OTHER: 'Autre' };
const reminderTypeCls: Record<string, string> = { SERVICE_DUE: 'bg-green-50 text-green-700', FOLLOW_UP: 'bg-blue-50 text-blue-700', PAYMENT: 'bg-amber-50 text-amber-700', APPOINTMENT: 'bg-violet-50 text-violet-700', OTHER: 'bg-slate-100 text-slate-600' };
const reminderStatusLabels: Record<string, string> = { PENDING: 'En attente', SENT: 'Envoyé', DONE: 'Fait', CANCELLED: 'Annulé' };
const reminderStatusCls: Record<string, string> = { PENDING: 'bg-amber-50 text-amber-700', SENT: 'bg-blue-50 text-blue-700', DONE: 'bg-green-50 text-green-700', CANCELLED: 'bg-slate-100 text-slate-500' };

const typeOptions = ['SERVICE_DUE', 'FOLLOW_UP', 'PAYMENT', 'APPOINTMENT', 'OTHER'] as const;
const statusOptions = ['PENDING', 'SENT', 'DONE', 'CANCELLED'] as const;

export default function Reminders() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ReminderListItem | null>(null);
  const [form, setForm] = useState<ReminderForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<ReminderListItem | null>(null);

  const { data: reminders, isLoading, error } = useQuery({
    queryKey: ['reminders', typeFilter, statusFilter, upcomingOnly],
    queryFn: async () => {
      const res = await api.get('/reminders', {
        params: {
          type: typeFilter || undefined,
          status: statusFilter || undefined,
          upcoming: upcomingOnly ? 'true' : undefined,
        },
      });
      return res.data as { data: ReminderListItem[] };
    },
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers-list'],
    queryFn: async () => {
      const res = await api.get('/customers', { params: { limit: 100 } });
      return res.data.data as OptionItem[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ReminderForm) => {
      const payload = {
        type: data.type,
        remindAt: new Date(data.remindAt).toISOString(),
        title: data.title,
        message: data.message || null,
        customerId: data.customerId || null,
      };
      const res = await api.post('/reminders', payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Rappel créé');
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      setModalOpen(false);
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ReminderForm }) => {
      const payload = {
        type: data.type,
        remindAt: new Date(data.remindAt).toISOString(),
        title: data.title,
        message: data.message || null,
        customerId: data.customerId || null,
      };
      const res = await api.put(`/reminders/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Rappel mis à jour');
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      setModalOpen(false);
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/reminders/${id}`),
    onSuccess: () => {
      toast.success('Rappel supprimé');
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      setDeleteTarget(null);
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur'),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ReminderStatus }) =>
      api.patch(`/reminders/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur'),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (r: ReminderListItem) => {
    setEditing(r);
    setForm({
      type: r.type,
      remindAt: toDateTimeInput(r.remindAt),
      title: r.title,
      message: r.message ?? '',
      customerId: r.customer?.id ?? '',
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

  const set = (key: keyof ReminderForm, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const targetLabel = (r: ReminderListItem) =>
    r.customer?.fullName ?? r.lead?.fullName ?? r.workOrder?.orderNumber ?? r.invoice?.number ?? r.vehicle?.plateNumber ?? '—';

  const isOverdue = (r: ReminderListItem) => {
    if (r.status === 'DONE' || r.status === 'CANCELLED') return false;
    return new Date(r.remindAt) < new Date();
  };

  const count = reminders?.data.length ?? 0;

  return (
    <div>
      <PageHeader
        title="Rappels"
        subtitle="Suivi automatique : entretien, relances clients, paiements"
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Nouveau rappel
          </Button>
        }
      />

      <Card className="mb-4 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-48">
          <option value="">Tous les types</option>
          {typeOptions.map((t) => (
            <option key={t} value={t}>{reminderTypeLabels[t]}</option>
          ))}
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-48">
          <option value="">Tous les statuts</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>{reminderStatusLabels[s]}</option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-sm text-slate-600 whitespace-nowrap">
          <input
            type="checkbox"
            checked={upcomingOnly}
            onChange={(e) => setUpcomingOnly(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
          />
          À venir uniquement
        </label>
      </Card>

      {error ? (
        <ErrorMessage message={(error as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur de chargement'} />
      ) : isLoading ? (
        <Loading />
      ) : count === 0 ? (
        <Card>
          <EmptyState title="Aucun rappel" description="Créez votre premier rappel." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100 bg-slate-50/60">
                  <th className="px-4 py-3 font-medium">Rappel</th>
                  <th className="px-4 py-3 font-medium">Cible</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reminders!.data.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-800">{r.title}</p>
                        <p className={`text-xs mt-0.5 ${isOverdue(r) ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                          {formatDateTime(r.remindAt)}
                        </p>
                        {r.message && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[280px]">{r.message}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{targetLabel(r)}</td>
                    <td className="px-4 py-3">
                      <Badge className={reminderTypeCls[r.type]}>{reminderTypeLabels[r.type]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={reminderStatusCls[r.status]}>{reminderStatusLabels[r.status]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {r.status === 'PENDING' && (
                          <Button variant="ghost" size="sm" onClick={() => statusMutation.mutate({ id: r.id, status: 'SENT' })} title="Envoyer">
                            <Send className="w-4 h-4" />
                          </Button>
                        )}
                        {(r.status === 'PENDING' || r.status === 'SENT') && (
                          <Button variant="ghost" size="sm" onClick={() => statusMutation.mutate({ id: r.id, status: 'DONE' })} title="Marquer fait">
                            <Check className="w-4 h-4" />
                          </Button>
                        )}
                        {(r.status === 'PENDING' || r.status === 'SENT') && (
                          <Button variant="ghost" size="sm" onClick={() => statusMutation.mutate({ id: r.id, status: 'CANCELLED' })} title="Annuler">
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => openEdit(r)} title="Modifier">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="hover:text-red-600" onClick={() => setDeleteTarget(r)} title="Supprimer">
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
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier le rappel' : 'Nouveau rappel'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Type" required>
              <Select value={form.type} onChange={(e) => set('type', e.target.value)} required>
                {typeOptions.map((t) => (
                  <option key={t} value={t}>{reminderTypeLabels[t]}</option>
                ))}
              </Select>
            </Field>
            <Field label="Date et heure" required>
              <Input type="datetime-local" value={form.remindAt} onChange={(e) => set('remindAt', e.target.value)} required />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Titre" required>
                <Input value={form.title} onChange={(e) => set('title', e.target.value)} required />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Message">
                <Textarea value={form.message} onChange={(e) => set('message', e.target.value)} placeholder="Optionnel" />
              </Field>
            </div>
            <Field label="Client">
              <Select value={form.customerId} onChange={(e) => set('customerId', e.target.value)}>
                <option value="">Aucun</option>
                {customersData?.map((c) => (
                  <option key={c.id} value={c.id}>{c.fullName}</option>
                ))}
              </Select>
            </Field>
          </div>
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
        title="Supprimer le rappel"
        message={`Voulez-vous vraiment supprimer le rappel « ${deleteTarget?.title} » ?`}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}
