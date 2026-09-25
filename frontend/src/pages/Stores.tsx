import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useStores, type Membership } from '../lib/store';
import { Store, Plus, ChevronRight, CheckCircle2, Building2, MapPin, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, Loading, Modal, PageHeader, Select, Textarea } from '../components/ui';
import { roleLabels } from '../lib/labels';
import { sectorLabels } from '../lib/labels';

const roleBadgeCls: Record<string, string> = {
  OWNER: 'bg-yellow-50 text-yellow-700',
  ADMIN: 'bg-blue-50 text-blue-700',
  MANAGER: 'bg-violet-50 text-violet-700',
  CASHIER: 'bg-slate-100 text-slate-600',
  STOCK_MANAGER: 'bg-teal-50 text-teal-700',
  ACCOUNTANT: 'bg-cyan-50 text-cyan-700',
};

const sectorBadgeCls: Record<string, string> = {
  BOUTIQUE: 'bg-green-50 text-green-700',
  PHARMACIE: 'bg-rose-50 text-rose-700',
  GARAGE: 'bg-slate-100 text-slate-700',
};

export default function Stores() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { currentStore, setCurrentStore, selectFirstStore } = useStores();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSector, setNewSector] = useState('BOUTIQUE');
  const [newCity, setNewCity] = useState('');
  const [newCountry, setNewCountry] = useState('MG');
  const [newCurrency, setNewCurrency] = useState('MGA');

  // Modification d'une boutique existante
  const [editTarget, setEditTarget] = useState<Membership | null>(null);
  const [editName, setEditName] = useState('');
  const [editSector, setEditSector] = useState('BOUTIQUE');
  const [editCity, setEditCity] = useState('');
  const [editCountry, setEditCountry] = useState('MG');
  const [editCurrency, setEditCurrency] = useState('MGA');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Membership | null>(null);

  // Arrive depuis le tableau de bord sans boutique : on ouvre le formulaire.
  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setCreateOpen(true);
      searchParams.delete('create');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { data: memberships, isLoading: loadingMemberships } = useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const res = await api.get('/stores');
      const list = res.data.memberships as Membership[];
      selectFirstStore(list);
      return list;
    },
    enabled: isAuthenticated,
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; sector?: string; city?: string; country?: string; currency?: string }) => {
      const res = await api.post('/stores', data);
      return res.data.store as { id: string };
    },
    onSuccess: (store) => {
      toast.success('Boutique créée');
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      setCreateOpen(false);
      setNewName('');
      setNewSector('BOUTIQUE');
      setNewCity('');
      setCurrentStore(store.id);
      navigate('/dashboard', { replace: true });
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur lors de la création'),
  });

  const openEdit = (m: Membership) => {
    setEditTarget(m);
    setEditName(m.store.name);
    setEditSector(m.store.sector);
    setEditCity(m.store.city ?? '');
    setEditCountry(m.store.country ?? 'MG');
    setEditCurrency(m.store.currency ?? 'MGA');
    setEditPhone((m.store as unknown as { phone?: string | null }).phone ?? '');
    setEditAddress((m.store as unknown as { address?: string | null }).address ?? '');
    setEditDescription((m.store as unknown as { description?: string | null }).description ?? '');
  };

  const updateMutation = useMutation({
    mutationFn: async (data: {
      storeId: string;
      payload: Record<string, string | undefined>;
    }) => {
      const res = await api.put('/stores/me', data.payload, {
        headers: { 'X-Store-Id': data.storeId },
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Boutique modifiée');
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      queryClient.invalidateQueries({ queryKey: ['store-me'] });
      setEditTarget(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur lors de la modification'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (storeId: string) => {
      await api.delete('/stores/me', { headers: { 'X-Store-Id': storeId } });
    },
    onSuccess: () => {
      toast.success('Boutique supprimée');
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      setDeleteTarget(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur lors de la suppression'),
  });

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    if (!editName.trim()) {
      toast.error('Saisissez le nom de la boutique');
      return;
    }
    updateMutation.mutate({
      storeId: editTarget.store.id,
      payload: {
        name: editName.trim(),
        sector: editSector,
        city: editCity.trim() || undefined,
        country: editCountry || undefined,
        currency: editCurrency,
        phone: editPhone.trim() || undefined,
        address: editAddress.trim() || undefined,
        description: editDescription.trim() || undefined,
      },
    });
  };

  if (isLoading || loadingMemberships) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loading />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const handleSelect = (id: string) => {
    setCurrentStore(id);
    navigate('/dashboard', { replace: true });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error('Saisissez le nom de la boutique');
      return;
    }
    createMutation.mutate({ name: newName.trim(), sector: newSector, city: newCity.trim() || undefined, country: newCountry, currency: newCurrency });
  };

  const list = memberships ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center">
            <Store className="w-5 h-5 text-white" />
          </span>
          <h1 className="text-lg font-bold tracking-tight text-dark-900">
            Mada<span className="text-green-600">Stock</span>
          </h1>
        </div>
        <span className="text-sm text-slate-500 hidden sm:block">{user?.email}</span>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <PageHeader
          title="Mes boutiques"
          subtitle="Sélectionnez une boutique pour gérer votre activité."
          actions={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4" />
              Nouvelle boutique
            </Button>
          }
        />

        {!list || list.length === 0 ? (
          <Card className="p-10 text-center">
            <EmptyState
              title="Aucune boutique"
              description="Créez votre première boutique pour commencer à vendre."
            />
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {list.map((m) => {
              const isCurrent = currentStore?.id === m.store.id;
              return (
                <Card
                  key={m.store.id}
                  className={`p-5 cursor-pointer transition-all hover:border-green-300 hover:shadow-md ${
                    isCurrent ? 'ring-2 ring-green-500 border-green-500' : ''
                  }`}
                >
                  <button type="button" onClick={() => handleSelect(m.store.id)} className="w-full text-left">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-11 h-11 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                          <Store className="w-5 h-5 text-green-600" />
                        </span>
                        <div className="min-w-0">
                          <h4 className="font-semibold text-dark-900 truncate flex items-center gap-1.5">
                            {m.store.name}
                            {isCurrent && <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />}
                          </h4>
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" />
                            {m.store.city ? `${m.store.city}, ` : ''}
                            {new Intl.DisplayNames(['fr'], { type: 'region' }).of(m.store.country) ?? m.store.country}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-4">
                      <Badge className={sectorBadgeCls[m.store.sector] ?? 'bg-slate-100 text-slate-600'}>
                        {sectorLabels[m.store.sector] ?? m.store.sector}
                      </Badge>
                      <Badge className={roleBadgeCls[m.role] ?? 'bg-slate-100 text-slate-600'}>
                        {roleLabels[m.role] ?? m.role}
                      </Badge>
                      {m.store.subscription && (
                        <Badge className="bg-slate-100 text-slate-600">{m.store.subscription.plan.name}</Badge>
                      )}
                      {m.store.subscription && (
                        <Badge
                          className={
                            m.store.subscription.status === 'TRIALING' || m.store.subscription.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'bg-amber-50 text-amber-700'
                          }
                        >
                          {m.store.subscription.status === 'TRIALING'
                            ? 'Essai'
                            : m.store.subscription.status === 'ACTIVE'
                              ? 'Active'
                              : m.store.subscription.status}
                        </Badge>
                      )}
                      {!m.store.active && <Badge className="bg-red-50 text-red-600">Inactive</Badge>}
                      <span className="ml-auto text-xs text-slate-400">{m.store.currency}</span>
                    </div>

                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(m)}
                        className="flex-1"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Modifier
                      </Button>
                      {m.isOwner && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteTarget(m)}
                          className="hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Supprimer
                        </Button>
                      )}
                    </div>
                  </button>
                </Card>
              );
            })}
          </div>
        )}

        <p className="text-center text-xs text-slate-400 mt-8">
          <Building2 className="w-3.5 h-3.5 inline mr-1 align-[-2px]" />
          Chaque boutique garde ses produits, son stock et ses ventes séparés.
        </p>
      </main>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Créer une boutique"
        description="Votre boutique sera prête immédiatement avec un essai gratuit."
        size="sm"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Field label="Nom de la boutique" required>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex : Boutique Tanjona" required />
          </Field>
          <Field label="Secteur d\u2019activité" required>
            <Select value={newSector} onChange={(e) => setNewSector(e.target.value)}>
              <option value="BOUTIQUE">Boutique (vente produits)</option>
              <option value="PHARMACIE">Pharmacie (médicaments, péremption)</option>
              <option value="GARAGE">Garage (atelier, véhicules)</option>
            </Select>
          </Field>
          <Field label="Ville">
            <Input value={newCity} onChange={(e) => setNewCity(e.target.value)} placeholder="Antananarivo" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Pays">
              <Select value={newCountry} onChange={(e) => setNewCountry(e.target.value)}>
                <option value="MG">Madagascar</option>
                <option value="FR">France</option>
                <option value="CM">Cameroun</option>
                <option value="CI">Côte d'Ivoire</option>
                <option value="SN">Sénégal</option>
                <option value="MU">Maurice</option>
                <option value="US">États-Unis</option>
              </Select>
            </Field>
            <Field label="Devise">
              <Select value={newCurrency} onChange={(e) => setNewCurrency(e.target.value)}>
                <option value="MGA">Ariary (MGA)</option>
                <option value="EUR">Euro (EUR)</option>
                <option value="USD">Dollar (USD)</option>
              </Select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Création...' : 'Créer la boutique'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Modifier la boutique"
        description={editTarget ? `Boutique « ${editTarget.store.name} »` : ''}
        size="sm"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <Field label="Nom de la boutique" required>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} required />
          </Field>
          <Field label="Secteur d’activité" hint="Adapte les modules affichés dans le menu.">
            <Select value={editSector} onChange={(e) => setEditSector(e.target.value)}>
              <option value="BOUTIQUE">Boutique (vente produits)</option>
              <option value="PHARMACIE">Pharmacie (médicaments, péremption)</option>
              <option value="GARAGE">Garage (atelier, véhicules)</option>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Ville">
              <Input value={editCity} onChange={(e) => setEditCity(e.target.value)} placeholder="Antananarivo" />
            </Field>
            <Field label="Téléphone">
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="+261 34 00 000 00" />
            </Field>
          </div>
          <Field label="Adresse">
            <Input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} placeholder="Lot, rue, quartier..." />
          </Field>
          <Field label="Description">
            <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Pays">
              <Select value={editCountry} onChange={(e) => setEditCountry(e.target.value)}>
                <option value="MG">Madagascar</option>
                <option value="FR">France</option>
                <option value="CM">Cameroun</option>
                <option value="CI">Côte d'Ivoire</option>
                <option value="SN">Sénégal</option>
                <option value="MU">Maurice</option>
                <option value="US">États-Unis</option>
              </Select>
            </Field>
            <Field label="Devise">
              <Select value={editCurrency} onChange={(e) => setEditCurrency(e.target.value)}>
                <option value="MGA">Ariary (MGA)</option>
                <option value="EUR">Euro (EUR)</option>
                <option value="USD">Dollar (USD)</option>
              </Select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>Annuler</Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Supprimer la boutique"
        message={`Supprimer « ${deleteTarget?.store.name} » ? La boutique sera désactivée et retirée de votre liste. Ses données restent archivées.`}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.store.id)}
      />
    </div>
  );
}