import { useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Eye, Car, Phone } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { formatNumber } from '../lib/format';
import { Button, Card, ConfirmDialog, EmptyState, Field, Input, Loading, Modal, PageHeader, SearchInput, Select, Textarea, ErrorMessage } from '../components/ui';

interface Vehicle {
  id: string;
  plateNumber: string;
  make: string | null;
  model: string | null;
  label: string;
  year: number | null;
  vin: string | null;
  color: string | null;
  engineNo: string | null;
  mileageKm: number | null;
  fuelType: string;
  vehicleType: string;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  customer: { id: string; fullName: string; phone: string | null } | null;
  workOrdersCount: number;
}

interface CustomerOpt {
  id: string;
  fullName: string;
}

interface VehicleForm {
  customerId: string;
  plateNumber: string;
  make: string;
  model: string;
  year: string;
  color: string;
  vin: string;
  engineNo: string;
  mileageKm: string;
  vehicleType: string;
  fuelType: string;
  notes: string;
}

interface VehiclePayload {
  customerId: string;
  plateNumber: string;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  vin?: string;
  engineNo?: string;
  mileageKm?: number;
  vehicleType?: string;
  fuelType?: string;
  notes?: string;
}

const emptyForm: VehicleForm = {
  customerId: '',
  plateNumber: '',
  make: '',
  model: '',
  year: '',
  color: '',
  vin: '',
  engineNo: '',
  mileageKm: '',
  vehicleType: '',
  fuelType: '',
  notes: '',
};

const vehicleTypeLabels: Record<string, string> = {
  CAR: 'Voiture',
  MOTORCYCLE: 'Moto',
  TRUCK: 'Camion',
  VAN: 'Fourgon',
  TAXI: 'Taxi',
  BUS: 'Bus',
  OTHER: 'Autre',
};

const fuelTypeLabels: Record<string, string> = {
  PETROL: 'Essence',
  DIESEL: 'Diesel',
  ELECTRIC: 'Électrique',
  HYBRID: 'Hybride',
  LPG: 'GPL',
  OTHER: 'Autre',
};

function InfoItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-0.5 text-sm font-medium text-dark-900">{children}</div>
    </div>
  );
}

export default function Vehicles() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<VehicleForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null);
  const [detail, setDetail] = useState<Vehicle | null>(null);

  const { data: vehicles, isLoading, error } = useQuery({
    queryKey: ['vehicles', search, customerFilter, page],
    queryFn: async () => {
      const res = await api.get('/vehicles', {
        params: { search: search || undefined, customerId: customerFilter !== 'all' ? customerFilter : undefined, page, limit: 15 },
      });
      return res.data as { data: Vehicle[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
    },
  });

  const { data: customers } = useQuery({
    queryKey: ['customers', 'options'],
    queryFn: async () => {
      const res = await api.get('/customers', { params: { limit: 100 } });
      return res.data.data as CustomerOpt[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: VehiclePayload) => {
      const res = await api.post('/vehicles', data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Véhicule ajouté');
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setModalOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: VehiclePayload }) => {
      const res = await api.put(`/vehicles/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Véhicule mis à jour');
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setModalOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/vehicles/${id}`),
    onSuccess: () => {
      toast.success('Véhicule supprimé');
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setDeleteTarget(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (v: Vehicle) => {
    setEditing(v);
    setForm({
      customerId: v.customer?.id ?? '',
      plateNumber: v.plateNumber,
      make: v.make ?? '',
      model: v.model ?? '',
      year: v.year != null ? String(v.year) : '',
      color: v.color ?? '',
      vin: v.vin ?? '',
      engineNo: v.engineNo ?? '',
      mileageKm: v.mileageKm != null ? String(v.mileageKm) : '',
      vehicleType: v.vehicleType ?? '',
      fuelType: v.fuelType ?? '',
      notes: v.notes ?? '',
    });
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: VehiclePayload = {
      customerId: form.customerId,
      plateNumber: form.plateNumber,
      make: form.make || undefined,
      model: form.model || undefined,
      year: form.year ? Number(form.year) : undefined,
      color: form.color || undefined,
      vin: form.vin || undefined,
      engineNo: form.engineNo || undefined,
      mileageKm: form.mileageKm ? Number(form.mileageKm) : undefined,
      vehicleType: form.vehicleType || undefined,
      fuelType: form.fuelType || undefined,
      notes: form.notes || undefined,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const set = (key: keyof VehicleForm, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div>
      <PageHeader
        title="Véhicules"
        subtitle={`${vehicles?.pagination.total ?? 0} véhicule(s)`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Nouveau véhicule
          </Button>
        }
      />

      <Card className="mb-4 p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Rechercher un véhicule (plaque, marque, client, téléphone)..." />
        </div>
        <Select value={customerFilter} onChange={(e) => { setCustomerFilter(e.target.value); setPage(1); }} className="sm:w-56">
          <option value="all">Tous les clients</option>
          {(customers ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.fullName}</option>
          ))}
        </Select>
      </Card>

      {error ? (
        <ErrorMessage message={(error as any).response?.data?.error ?? 'Erreur de chargement'} />
      ) : isLoading ? (
        <Loading />
      ) : !vehicles || vehicles.data.length === 0 ? (
        <Card>
          <EmptyState title="Aucun véhicule" description="Ajoutez le premier véhicule de votre parc." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100 bg-slate-50/60">
                  <th className="px-4 py-3 font-medium">Immatriculation</th>
                  <th className="px-4 py-3 font-medium">Véhicule</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Carburant</th>
                  <th className="px-4 py-3 font-medium">Année</th>
                  <th className="px-4 py-3 font-medium text-right">Kilométrage</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.data.map((v) => (
                  <tr key={v.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <span className="font-semibold text-dark-900 uppercase tracking-wide">{v.plateNumber}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-dark-900 truncate">{v.label}</p>
                      {v.color && <p className="text-xs text-slate-400">{v.color}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{v.customer?.fullName ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{vehicleTypeLabels[v.vehicleType] ?? v.vehicleType}</td>
                    <td className="px-4 py-3 text-slate-600">{fuelTypeLabels[v.fuelType] ?? v.fuelType}</td>
                    <td className="px-4 py-3 text-slate-600">{v.year ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{v.mileageKm != null ? formatNumber(v.mileageKm) : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setDetail(v)} title="Voir">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(v)} title="Modifier">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="hover:text-red-600" onClick={() => setDeleteTarget(v)} title="Supprimer">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {vehicles.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm">
              <span className="text-slate-500">Page {vehicles.pagination.page} sur {vehicles.pagination.totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédent</Button>
                <Button variant="outline" size="sm" disabled={page >= vehicles.pagination.totalPages} onClick={() => setPage(page + 1)}>Suivant</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Modifier le véhicule' : 'Nouveau véhicule'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
          <Field label="Client" required>
            <Select value={form.customerId} onChange={(e) => set('customerId', e.target.value)} required>
              <option value="">Sélectionner un client</option>
              {(customers ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.fullName}</option>
              ))}
            </Select>
          </Field>
          <Field label="Immatriculation" required>
            <Input value={form.plateNumber} onChange={(e) => set('plateNumber', e.target.value)} required placeholder="Ex : 1234 TAB" />
          </Field>
          <Field label="Marque">
            <Input value={form.make} onChange={(e) => set('make', e.target.value)} placeholder="Ex : Toyota" />
          </Field>
          <Field label="Modèle">
            <Input value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="Ex : Corolla" />
          </Field>
          <Field label="Type de véhicule">
            <Select value={form.vehicleType} onChange={(e) => set('vehicleType', e.target.value)}>
              <option value="">Sélectionner</option>
              {Object.entries(vehicleTypeLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Carburant">
            <Select value={form.fuelType} onChange={(e) => set('fuelType', e.target.value)}>
              <option value="">Sélectionner</option>
              {Object.entries(fuelTypeLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Année">
            <Input type="number" min={1950} max={2100} value={form.year} onChange={(e) => set('year', e.target.value)} placeholder="Ex : 2020" />
          </Field>
          <Field label="Couleur">
            <Input value={form.color} onChange={(e) => set('color', e.target.value)} placeholder="Ex : Gris argent" />
          </Field>
          <Field label="VIN">
            <Input value={form.vin} onChange={(e) => set('vin', e.target.value)} placeholder="Numéro de châssis" />
          </Field>
          <Field label="N° moteur">
            <Input value={form.engineNo} onChange={(e) => set('engineNo', e.target.value)} placeholder="Optionnel" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Kilométrage (km)">
              <Input type="number" min={0} value={form.mileageKm} onChange={(e) => set('mileageKm', e.target.value)} placeholder="Ex : 45000" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Optionnel" />
            </Field>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {editing ? 'Enregistrer' : 'Ajouter le véhicule'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.label ?? 'Véhicule'} size="lg">
        {detail && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
              <span className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                <Car className="w-6 h-6 text-green-600" />
              </span>
              <div className="min-w-0">
                <p className="text-lg font-bold text-dark-900">{detail.label}</p>
                <p className="text-sm text-slate-500 uppercase tracking-wide">{detail.plateNumber}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <InfoItem label="Client">
                <span>{detail.customer?.fullName ?? '—'}</span>
                {detail.customer?.phone && (
                  <span className="flex items-center gap-1 mt-0.5 text-xs font-normal text-slate-400">
                    <Phone className="w-3 h-3" />
                    {detail.customer.phone}
                  </span>
                )}
              </InfoItem>
              <InfoItem label="Type">{vehicleTypeLabels[detail.vehicleType] ?? detail.vehicleType}</InfoItem>
              <InfoItem label="Carburant">{fuelTypeLabels[detail.fuelType] ?? detail.fuelType}</InfoItem>
              <InfoItem label="Année">{detail.year ?? '—'}</InfoItem>
              <InfoItem label="VIN">{detail.vin ?? '—'}</InfoItem>
              <InfoItem label="N° moteur">{detail.engineNo ?? '—'}</InfoItem>
              <InfoItem label="Kilométrage">{detail.mileageKm != null ? formatNumber(detail.mileageKm) : '—'}</InfoItem>
              <InfoItem label="Couleur">{detail.color ?? '—'}</InfoItem>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Notes</p>
              <p className="mt-0.5 text-sm text-slate-600">{detail.notes ?? '—'}</p>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <span className="text-sm text-slate-500">Commandes de travail</span>
              <span className="text-sm font-semibold text-dark-900">{detail.workOrdersCount}</span>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Supprimer le véhicule"
        message={`Voulez-vous vraiment supprimer « ${deleteTarget?.label} » (${deleteTarget?.plateNumber}) ?`}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}