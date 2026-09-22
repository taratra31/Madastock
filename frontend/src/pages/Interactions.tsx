import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Trash2,
  Phone,
  Mail,
  MessageSquare,
  Users,
  CalendarClock,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { formatDateTime } from '../lib/format';
import {
  Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, Loading, Modal, PageHeader, SearchInput, Select, Textarea, ErrorMessage,
} from '../components/ui';

interface InteractionListItem {
  id: string;
  type: 'CALL' | 'EMAIL' | 'WHATSAPP' | 'SMS' | 'VISIT' | 'MEETING' | 'NOTE';
  subject: string | null;
  body: string | null;
  createdAt: string;
  performedBy: { id: string; fullName: string } | null;
  customer: { id: string; fullName: string } | null;
  lead: { id: string; fullName: string } | null;
  workOrder: { id: string; orderNumber: string } | null;
}

const interactionTypeLabels: Record<string, string> = {
  CALL: 'Appel',
  EMAIL: 'Email',
  WHATSAPP: 'WhatsApp',
  SMS: 'SMS',
  VISIT: 'Visite',
  MEETING: 'Réunion',
  NOTE: 'Note',
};

const interactionTypeCls: Record<string, string> = {
  CALL: 'bg-blue-50 text-blue-700',
  EMAIL: 'bg-violet-50 text-violet-700',
  WHATSAPP: 'bg-green-50 text-green-700',
  SMS: 'bg-sky-50 text-sky-700',
  VISIT: 'bg-amber-50 text-amber-700',
  MEETING: 'bg-slate-100 text-slate-600',
  NOTE: 'bg-slate-100 text-slate-600',
};

const typeIcon: Record<string, typeof Phone> = {
  CALL: Phone,
  EMAIL: Mail,
  WHATSAPP: MessageSquare,
  SMS: MessageSquare,
  VISIT: Users,
  MEETING: CalendarClock,
  NOTE: FileText,
};

export default function Interactions() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InteractionListItem | null>(null);

  const [formType, setFormType] = useState('CALL');
  const [formSubject, setFormSubject] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formCustomer, setFormCustomer] = useState('');
  const [formLead, setFormLead] = useState('');
  const [formWorkOrder, setFormWorkOrder] = useState('');

  const { data: interactions, isLoading, error } = useQuery({
    queryKey: ['interactions'],
    queryFn: async () => {
      const res = await api.get('/interactions');
      return res.data as { data: InteractionListItem[] };
    },
  });

  const { data: customers } = useQuery({
    queryKey: ['customer-options'],
    queryFn: async () => {
      const res = await api.get('/customers', { params: { limit: 100 } });
      return (res.data.data as { id: string; fullName: string }[]).sort((a, b) => a.fullName.localeCompare(b.fullName)).map((c) => ({ id: c.id, label: c.fullName }));
    },
  });

  const { data: leads } = useQuery({
    queryKey: ['lead-options'],
    queryFn: async () => {
      const res = await api.get('/leads', { params: { limit: 100 } });
      return ((res.data as { data: { id: string; fullName: string }[] }).data as { id: string; fullName: string }[]).sort((a, b) => a.fullName.localeCompare(b.fullName)).map((l) => ({ id: l.id, label: l.fullName }));
    },
  });

  const { data: workOrders } = useQuery({
    queryKey: ['work-order-options'],
    queryFn: async () => {
      const res = await api.get('/work-orders', { params: { limit: 50 } });
      return ((res.data as { data: { id: string; orderNumber: string }[] }).data as { id: string; orderNumber: string }[]).sort((a, b) => a.orderNumber.localeCompare(b.orderNumber)).map((w) => ({ id: w.id, label: w.orderNumber }));
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await api.post('/interactions', data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Interaction enregistrée');
      queryClient.invalidateQueries({ queryKey: ['interactions'] });
      setModalOpen(false);
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/interactions/${id}`),
    onSuccess: () => {
      toast.success('Interaction supprimée');
      queryClient.invalidateQueries({ queryKey: ['interactions'] });
      setDeleteTarget(null);
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur'),
  });

  const filtered = useMemo(() => {
    const all = [...(interactions?.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((it) =>
      (it.subject?.toLowerCase().includes(q) ?? false) ||
      (it.body?.toLowerCase().includes(q) ?? false) ||
      (it.customer?.fullName.toLowerCase().includes(q) ?? false) ||
      (it.lead?.fullName.toLowerCase().includes(q) ?? false),
    );
  }, [interactions, search]);

  const resetForm = () => {
    setFormType('CALL');
    setFormSubject('');
    setFormBody('');
    setFormCustomer('');
    setFormLead('');
    setFormWorkOrder('');
  };

  const openCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomer && !formLead && !formWorkOrder) {
      toast.error('Choisissez une cible (client, prospect ou ordre de réparation)');
      return;
    }
    createMutation.mutate({
      type: formType,
      subject: formSubject || undefined,
      body: formBody || undefined,
      customerId: formCustomer || undefined,
      leadId: formLead || undefined,
      workOrderId: formWorkOrder || undefined,
    });
  };

  const targetText = (it: InteractionListItem): string | null => {
    if (it.customer) return `Client · ${it.customer.fullName}`;
    if (it.lead) return `Prospect · ${it.lead.fullName}`;
    if (it.workOrder) return `Ordre · ${it.workOrder.orderNumber}`;
    return null;
  };

  return (
    <div>
      <PageHeader
        title="Interactions"
        subtitle="Historique de toutes les actions (appels, messages, visites...)"
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Nouvelle interaction
          </Button>
        }
      />

      <Card className="mb-4 p-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Rechercher une interaction (sujet, contenu, client, prospect)..." />
      </Card>

      {error ? (
        <ErrorMessage message={(error as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur de chargement'} />
      ) : isLoading ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState title="Aucune interaction enregistrée" description="Créez votre première interaction." />
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((it) => {
            const Icon = typeIcon[it.type] ?? FileText;
            return (
              <Card key={it.id} className="p-4 flex items-start gap-3">
                <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${interactionTypeCls[it.type] ?? 'bg-slate-100 text-slate-600'}`}>
                  <Icon className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={interactionTypeCls[it.type] ?? 'bg-slate-100 text-slate-600'}>
                      {interactionTypeLabels[it.type] ?? it.type}
                    </Badge>
                    {it.subject && <p className="font-medium text-dark-900">{it.subject}</p>}
                  </div>
                  {!it.subject && it.body && <p className="text-sm text-slate-600">{it.body}</p>}
                  {it.subject && it.body && <p className="text-sm text-slate-600 mt-0.5">{it.body}</p>}
                  <div className="flex items-center gap-2 flex-wrap mt-1 text-xs">
                    {targetText(it) && <span className="text-blue-600 font-medium">{targetText(it)}</span>}
                    <span className="text-slate-400">
                      par {it.performedBy?.fullName ?? '—'} · {formatDateTime(it.createdAt)}
                    </span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="hover:text-red-600 shrink-0" onClick={() => setDeleteTarget(it)} title="Supprimer">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouvelle interaction" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <Field label="Type" required>
            <Select value={formType} onChange={(e) => setFormType(e.target.value)}>
              {Object.entries(interactionTypeLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </Field>
          <Field label="Sujet">
            <Input value={formSubject} onChange={(e) => setFormSubject(e.target.value)} placeholder="Optionnel" />
          </Field>
          <Field label="Contenu">
            <Textarea value={formBody} onChange={(e) => setFormBody(e.target.value)} placeholder="Optionnel" />
          </Field>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Client">
              <Select value={formCustomer} onChange={(e) => setFormCustomer(e.target.value)}>
                <option value="">Aucun</option>
                {(customers ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Prospect">
              <Select value={formLead} onChange={(e) => setFormLead(e.target.value)}>
                <option value="">Aucun</option>
                {(leads ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Ordre de réparation">
              <Select value={formWorkOrder} onChange={(e) => setFormWorkOrder(e.target.value)}>
                <option value="">Aucun</option>
                {(workOrders ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </Select>
            </Field>
          </div>
          <p className="text-xs text-slate-400 -mt-2">Au moins une cible (client, prospect ou ordre de réparation) est requise.</p>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Supprimer l'interaction"
        message={`Voulez-vous vraiment supprimer cette interaction ?`}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}