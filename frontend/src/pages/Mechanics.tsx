import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { formatAr, formatNumber } from '../lib/format';
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, Loading, Modal, PageHeader, ErrorMessage } from '../components/ui';

interface Mechanic {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  specialty: string | null;
  hourlyRateAr: number | null;
  commissionPct: number | null;
  colorHex: string | null;
  isActive: boolean;
  workOrdersCount: number;
  appointmentsCount: number;
  activeJobs: Array<{ id: string; orderNumber: string; status: string; completedAt: string | null }>;
  createdAt: string;
}

interface MechanicForm {
  fullName: string;
  phone: string;
  email: string;
  specialty: string;
  hourlyRateAr: string;
  commissionPct: string;
  colorHex: string;
  isActive: boolean;
}

interface MechanicPayload {
  fullName: string;
  phone?: string;
  email?: string;
  specialty?: string;
  hourlyRateAr?: number;
  commissionPct?: number;
  colorHex?: string;
  isActive?: boolean;
}

const emptyForm: MechanicForm = {
  fullName: '',
  phone: '',
  email: '',
  specialty: '',
  hourlyRateAr: '',
  commissionPct: '',
  colorHex: '#3b82f6',
  isActive: true,
};

export default function Mechanics() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Mechanic | null>(null);
  const [form, setForm] = useState<MechanicForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Mechanic | null>(null);

  const { data: mechanics, isLoading, error } = useQuery({
    queryKey: ['mechanics'],
    queryFn: async () => {
      const res = await api.get('/mechanics');
      return res.data as { data: Mechanic[] };
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: MechanicPayload) => {
      const res = await api.post('/mechanics', data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Mécanicien ajouté');
      queryClient.invalidateQueries({ queryKey: ['mechanics'] });
      setModalOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: MechanicPayload }) => {
      const res = await api.put(`/mechanics/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Mécanicien mis à jour');
      queryClient.invalidateQueries({ queryKey: ['mechanics'] });
      setModalOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/mechanics/${id}`),
    onSuccess: () => {
      toast.success('Mécanicien supprimé');
      queryClient.invalidateQueries({ queryKey: ['mechanics'] });
      setDeleteTarget(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (m: Mechanic) => {
    setEditing(m);
    setForm({
      fullName: m.fullName,
      phone: m.phone ?? '',
      email: m.email ?? '',
      specialty: m.specialty ?? '',
      hourlyRateAr: m.hourlyRateAr != null ? String(m.hourlyRateAr) : '',
      commissionPct: m.commissionPct != null ? String(m.commissionPct) : '',
      colorHex: m.colorHex ?? '#3b82f6',
      isActive: m.isActive,
    });
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: MechanicPayload = {
      fullName: form.fullName,
      phone: form.phone || undefined,
      email: form.email || undefined,
      specialty: form.specialty || undefined,
      hourlyRateAr: form.hourlyRateAr ? Number(form.hourlyRateAr) : undefined,
      commissionPct: form.commissionPct ? Number(form.commissionPct) : undefined,
      colorHex: form.colorHex || undefined,
      isActive: editing ? form.isActive : undefined,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const set = (key: keyof MechanicForm, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }));

  const initials = (name: string) =>
    name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'M';

  return (
    <div>
      <PageHeader
        title="Mécaniciens"
        subtitle={`${mechanics?.data.length ?? 0} mécanicien(s) dans l'équipe`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Nouveau mécanicien
          </Button>
        }
      />

      {error ? (
        <ErrorMessage message={(error as any).response?.data?.error ?? 'Erreur de chargement'} />
      ) : isLoading ? (
        <Loading />
      ) : !mechanics || mechanics.data.length === 0 ? (
        <Card>
          <EmptyState title="Aucun mécanicien" description="Ajoutez le premier membre de votre équipe technique." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100 bg-slate-50/60">
                  <th className="px-4 py-3 font-medium">Membre</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium text-right">Taux horaire</th>
                  <th className="px-4 py-3 font-medium text-right">Commission</th>
                  <th className="px-4 py-3 font-medium text-right">Jobs en cours</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mechanics.data.map((m) => (
                  <tr key={m.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ backgroundColor: m.colorHex ?? '#94a3b8' }}
                        >
                          {initials(m.fullName)}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-dark-900 truncate">{m.fullName}</p>
                          {m.specialty && <p className="text-xs text-slate-400">{m.specialty}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{m.phone ?? m.email ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatAr(m.hourlyRateAr)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {m.commissionPct != null ? `${formatNumber(m.commissionPct)} %` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Badge className={m.activeJobs.length > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}>
                        {m.activeJobs.length}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {m.isActive ? (
                        <Badge className="bg-green-50 text-green-700">Actif</Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-500">Inactif</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(m)} title="Modifier">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="hover:text-red-600" onClick={() => setDeleteTarget(m)} title="Supprimer">
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Modifier le mécanicien' : 'Nouveau mécanicien'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Field label="Nom complet" required>
              <Input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} required placeholder="Ex : Jean Rakoto" />
            </Field>
          </div>
          <Field label="Téléphone">
            <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+261..." />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field label="Spécialité">
            <Input value={form.specialty} onChange={(e) => set('specialty', e.target.value)} placeholder="Ex : Mécanique, Carrosserie, Électricité auto, Diagnostic" />
          </Field>
          <Field label="Couleur d'identification">
            <Input type="color" value={form.colorHex} onChange={(e) => set('colorHex', e.target.value)} className="h-10 w-20 p-1 cursor-pointer" />
          </Field>
          <Field label="Taux horaire (Ar)">
            <Input type="number" min={0} value={form.hourlyRateAr} onChange={(e) => set('hourlyRateAr', e.target.value)} placeholder="Ex : 15000" />
          </Field>
          <Field label="Commission (%)">
            <Input type="number" min={0} max={100} value={form.commissionPct} onChange={(e) => set('commissionPct', e.target.value)} placeholder="Ex : 10" />
          </Field>
          {editing && (
            <div className="sm:col-span-2 flex items-center gap-2">
              <input
                id="isActive"
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => set('isActive', e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
              />
              <label htmlFor="isActive" className="text-sm text-slate-700">Mécanicien actif</label>
            </div>
          )}
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {editing ? 'Enregistrer' : 'Ajouter le mécanicien'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Supprimer le mécanicien"
        message={`Voulez-vous vraiment supprimer « ${deleteTarget?.fullName} » ?`}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}