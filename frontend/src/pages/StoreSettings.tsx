import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, Users, Crown, ShieldCheck, Briefcase, ShoppingCart, Boxes, Calculator,
  User, UserPlus, Trash2, Mail, MapPin, Globe, Coins, CalendarDays, Tag, CheckCircle2,
  Package, Clock, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { formatDate } from '../lib/format';
import { roleLabels, sectorLabels } from '../lib/labels';
import {
  Badge, Button, Card, ConfirmDialog, EmptyState, ErrorMessage, Field, Input, Loading,
  Modal, PageHeader, Select, Textarea,
} from '../components/ui';

interface StoreData {
  id: string;
  name: string;
  sector: string;
  description: string | null;
  logoUrl: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  fiscalNumber: string | null;
  statNumber: string | null;
  currency: string;
  timezone: string | null;
  active: boolean;
  createdAt: string;
  subscription: { id: string; status: string; trialEndsAt: string | null; currentPeriodEnd: string | null; plan: { name: string } } | null;
  _count: { members: number; products: number; sales: number };
  myRole: string;
  isOwner: boolean;
}

interface Member {
  id: string;
  role: string;
  isOwner: boolean;
  canManageAll: boolean;
  createdAt: string;
  user: { id: string; email: string; fullName: string; phone: string | null; avatarUrl: string | null };
}

const roleMeta: Record<string, { label: string; icon: typeof User; badgeCls: string; avatarCls: string }> = {
  OWNER: { label: 'Propriétaire', icon: Crown, badgeCls: 'bg-yellow-50 text-yellow-700', avatarCls: 'bg-yellow-100 text-yellow-700' },
  ADMIN: { label: 'Administrateur', icon: ShieldCheck, badgeCls: 'bg-blue-50 text-blue-700', avatarCls: 'bg-blue-100 text-blue-700' },
  MANAGER: { label: 'Manager', icon: Briefcase, badgeCls: 'bg-violet-50 text-violet-700', avatarCls: 'bg-violet-100 text-violet-700' },
  CASHIER: { label: 'Caissier', icon: ShoppingCart, badgeCls: 'bg-slate-100 text-slate-600', avatarCls: 'bg-slate-100 text-slate-600' },
  STOCK_MANAGER: { label: 'Gestionnaire de stock', icon: Boxes, badgeCls: 'bg-emerald-50 text-emerald-700', avatarCls: 'bg-emerald-100 text-emerald-700' },
  ACCOUNTANT: { label: 'Comptable', icon: Calculator, badgeCls: 'bg-orange-50 text-orange-700', avatarCls: 'bg-orange-100 text-orange-700' },
  STAFF: { label: 'Employé', icon: User, badgeCls: 'bg-slate-100 text-slate-600', avatarCls: 'bg-slate-100 text-slate-600' },
};

const subStatusLabel = (status?: string | null): string => {
  const map: Record<string, string> = {
    TRIALING: 'Essai gratuit',
    ACTIVE: 'Actif',
    PAST_DUE: 'Paiement en retard',
    CANCELLED: 'Annulé',
    EXPIRED: 'Expiré',
  };
  return map[status ?? ''] ?? (status ?? '—');
};

const subStatusCls = (status?: string | null): string => {
  const map: Record<string, string> = {
    TRIALING: 'bg-amber-50 text-amber-700',
    ACTIVE: 'bg-emerald-50 text-emerald-700',
    PAST_DUE: 'bg-red-50 text-red-700',
    CANCELLED: 'bg-red-50 text-red-700',
    EXPIRED: 'bg-red-50 text-red-700',
  };
  return map[status ?? ''] ?? 'bg-slate-100 text-slate-600';
};

export default function StoreSettings() {
  const { data: store, isLoading, error } = useQuery({
    queryKey: ['store-me'],
    queryFn: async () => {
      const res = await api.get('/stores/me');
      return res.data.store as StoreData;
    },
  });

  return (
    <div>
      <PageHeader
        title="Paramètres de la boutique"
        subtitle="Informations de votre boutique et gestion des membres de l'équipe"
      />
      {error ? (
        <ErrorMessage message={(error as any).response?.data?.error ?? 'Erreur de chargement'} />
      ) : isLoading || !store ? (
        <Loading />
      ) : (
        <SettingsBody store={store} />
      )}
    </div>
  );
}

function SettingsBody({ store }: { store: StoreData }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'store' | 'members'>('store');
  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);

  const [formName, setFormName] = useState(store.name);
  const [formSector, setFormSector] = useState(store.sector);
  const [formEmail, setFormEmail] = useState(store.email ?? '');
  const [formPhone, setFormPhone] = useState(store.phone ?? '');
  const [formCity, setFormCity] = useState(store.city ?? '');
  const [formCountry, setFormCountry] = useState(store.country ?? '');
  const [formAddress, setFormAddress] = useState(store.address ?? '');
  const [formDescription, setFormDescription] = useState(store.description ?? '');

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('STAFF');

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['store-members'],
    queryFn: async () => {
      const res = await api.get('/stores/members');
      return res.data.members as Member[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await api.put('/stores/me', data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Boutique mise à jour');
      queryClient.invalidateQueries({ queryKey: ['store-me'] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      queryClient.invalidateQueries({ queryKey: ['store-members'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const addMutation = useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      const res = await api.post('/stores/members', data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Membre ajouté');
      queryClient.invalidateQueries({ queryKey: ['store-members'] });
      queryClient.invalidateQueries({ queryKey: ['store-me'] });
      setAddOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const removeMutation = useMutation({
    mutationFn: async (memberId: string) => api.delete(`/stores/members/${memberId}`),
    onSuccess: () => {
      toast.success('Membre retiré');
      queryClient.invalidateQueries({ queryKey: ['store-members'] });
      queryClient.invalidateQueries({ queryKey: ['store-me'] });
      setRemoveTarget(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const roleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      const res = await api.put(`/stores/members/${memberId}`, { role });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Rôle mis à jour');
      queryClient.invalidateQueries({ queryKey: ['store-members'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      name: formName,
      sector: formSector,
      email: formEmail || undefined,
      phone: formPhone || undefined,
      city: formCity || undefined,
      country: formCountry || undefined,
      address: formAddress || undefined,
      description: formDescription || undefined,
    });
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      toast.error("Saisissez l'email du membre");
      return;
    }
    addMutation.mutate({ email: inviteEmail.trim(), role: inviteRole });
  };

  const sub = store.subscription;
  const planName = sub?.plan.name ?? 'Essai gratuit';
  const stats = [
    { icon: Users, value: store._count.members, label: 'Membres' },
    { icon: Package, value: store._count.products, label: 'Produits' },
    { icon: ShoppingCart, value: store._count.sales, label: 'Ventes' },
  ];

  return (
    <>
      {/* Bannière boutique */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-600 via-green-700 to-emerald-900 text-white shadow-lg shadow-green-700/20 mb-4">
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-24 -left-10 w-72 h-72 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <span className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20 flex items-center justify-center text-xl font-bold shrink-0">
              {(store.name || 'B').slice(0, 2).toUpperCase()}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-bold truncate">{store.name}</h3>
                {store.active && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-white/15 rounded-full px-2.5 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
                    Active
                  </span>
                )}
              </div>
              {store.description && <p className="text-sm text-green-100/90 mt-0.5 truncate">{store.description}</p>}
              <div className="flex flex-wrap items-center gap-2 mt-2.5 text-xs">
                <span className="inline-flex items-center gap-1.5 bg-white/10 rounded-full px-2.5 py-1 font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  {planName}
                </span>
                <span className="inline-flex items-center gap-1.5 bg-white/10 rounded-full px-2.5 py-1 font-medium">
                  <Tag className="w-3.5 h-3.5 text-emerald-300" />
                  {sectorLabels[store.sector] ?? store.sector}
                </span>
                <span className="inline-flex items-center gap-1.5 bg-white/10 rounded-full px-2.5 py-1">
                  <Crown className="w-3.5 h-3.5 text-yellow-300" />
                  {roleLabels[store.myRole] ?? store.myRole}
                </span>
                {store.city && (
                  <span className="inline-flex items-center gap-1.5 bg-white/10 rounded-full px-2.5 py-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {store.city}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-4 border-t border-white/15">
            {stats.map((s) => (
              <div key={s.label} className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2.5 flex items-center gap-3">
                <s.icon className="w-4 h-4 text-green-200 shrink-0" />
                <div>
                  <p className="text-lg font-bold leading-none">{s.value}</p>
                  <p className="text-[11px] text-green-100/80 mt-1">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Onglets */}
      <Card className="mb-4 p-1.5 flex gap-1 w-fit rounded-xl bg-slate-100 border-slate-200">
        {([
          { key: 'store', label: 'Boutique', icon: Building2 },
          { key: 'members', label: 'Membres', icon: Users },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key ? 'bg-white text-dark-900 shadow-sm' : 'text-slate-500 hover:text-dark-900'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </Card>

      {tab === 'store' ? (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 overflow-hidden">
            <div className="px-5 pt-5 pb-4 border-b border-slate-100">
              <h3 className="font-semibold text-dark-900 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </span>
                Informations générales
              </h3>
              <p className="text-sm text-slate-500 mt-1.5 ml-10">Ces informations apparaissent sur vos documents.</p>
            </div>
            <form onSubmit={handleUpdate} className="p-5 space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Identité</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <Field label="Nom de la boutique" required>
                      <Input value={formName} onChange={(e) => setFormName(e.target.value)} required />
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <Field label="Secteur d\u2019activité" hint="Adapte les modules affichés dans le menu.">
                      <Select value={formSector} onChange={(e) => setFormSector(e.target.value)}>
                        <option value="BOUTIQUE">Boutique (vente produits)</option>
                        <option value="PHARMACIE">Pharmacie (médicaments, péremption)</option>
                        <option value="GARAGE">Garage (atelier, véhicules)</option>
                      </Select>
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <Field label="Description" hint="Une courte présentation de votre boutique.">
                      <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
                    </Field>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Coordonnées</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Email de contact" hint="Apparaît sur les factures et devis.">
                    <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="contact@boutique.com" />
                  </Field>
                  <Field label="Téléphone">
                    <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="+261 34 00 000 00" />
                  </Field>
                  <Field label="Ville">
                    <Input value={formCity} onChange={(e) => setFormCity(e.target.value)} placeholder="Antananarivo" />
                  </Field>
                  <Field label="Pays">
                    <Input value={formCountry} onChange={(e) => setFormCountry(e.target.value)} placeholder="Madagascar" />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Adresse">
                      <Input value={formAddress} onChange={(e) => setFormAddress(e.target.value)} placeholder="Lot, rue, quartier..." />
                    </Field>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Enregistrement en cours...' : 'Enregistrer les modifications'}
                </Button>
              </div>
            </form>
          </Card>

          <div className="space-y-4">
            <Card className="p-5">
              <h4 className="font-semibold text-dark-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-primary-50 text-green-600 flex items-center justify-center">
                  <Tag className="w-4 h-4" />
                </span>
                Abonnement
              </h4>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <dt className="text-slate-500">Plan</dt>
                  <dd className="font-medium">{planName}</dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-slate-500">Statut</dt>
                  <dd>
                    <Badge className={subStatusCls(sub?.status)}>
                      {sub?.status === 'ACTIVE' && <CheckCircle2 className="w-3 h-3" />}
                      {subStatusLabel(sub?.status)}
                    </Badge>
                  </dd>
                </div>
                {sub?.trialEndsAt && sub.status === 'TRIALING' && (
                  <div className="flex justify-between items-center">
                    <dt className="text-slate-500">Fin de l'essai</dt>
                    <dd className="font-medium">{formatDate(sub.trialEndsAt)}</dd>
                  </div>
                )}
              </dl>
            </Card>

            <Card className="p-5">
              <h4 className="font-semibold text-dark-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </span>
                Boutique
              </h4>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <dt className="text-slate-500 flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5" /> Devise
                  </dt>
                  <dd className="font-medium">{store.currency}</dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-slate-500 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" /> Pays
                  </dt>
                  <dd className="font-medium">{store.country ?? '—'}</dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-slate-500 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Fuseau
                  </dt>
                  <dd className="font-medium">{store.timezone ?? '—'}</dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-slate-500 flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5" /> Membre depuis
                  </dt>
                  <dd className="font-medium">{formatDate(store.createdAt)}</dd>
                </div>
              </dl>
            </Card>
          </div>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-semibold text-dark-900 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </span>
                Membres de l'équipe
              </h3>
              <p className="text-sm text-slate-500 mt-1.5 ml-10">
                {members?.length ?? 0} membre{members?.length !== 1 ? 's' : ''} · Invitez vos employés à rejoindre la boutique.
              </p>
            </div>
            <Button onClick={() => setAddOpen(true)} className="sm:ml-10">
              <UserPlus className="w-4 h-4" />
              Inviter un membre
            </Button>
          </div>

          {membersLoading ? (
            <Loading />
          ) : !members || members.length === 0 ? (
            <EmptyState title="Aucun membre" description="Invitez votre premier membre de l'équipe." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100 bg-slate-50/60">
                    <th className="px-5 py-3 font-medium">Membre</th>
                    <th className="px-5 py-3 font-medium">Contact</th>
                    <th className="px-5 py-3 font-medium">Rôle</th>
                    <th className="px-5 py-3 font-medium">Ajouté le</th>
                    <th className="px-5 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => {
                    const meta = roleMeta[m.isOwner ? 'OWNER' : m.role] ?? roleMeta.STAFF;
                    return (
                      <tr key={m.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${meta.avatarCls} ${m.isOwner ? 'ring-2 ring-yellow-200' : ''}`}>
                              <meta.icon className="w-4 h-4" />
                            </span>
                            <div className="min-w-0">
                              <p className="font-medium text-dark-900 truncate">{m.user.fullName || m.user.email}</p>
                              <p className="text-xs text-slate-400">
                                {m.canManageAll ? 'Accès complet' : m.user.phone ?? m.user.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-slate-500">
                          <span className="inline-flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-slate-300" />
                            {m.user.email}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          {store.isOwner && !m.isOwner ? (
                            <Select
                              value={m.role}
                              disabled={roleMutation.isPending}
                              onChange={(e) =>
                                roleMutation.mutate({ memberId: m.id, role: e.target.value })
                              }
                              className="w-auto py-1.5 text-xs"
                            >
                              <option value="ADMIN">Administrateur</option>
                              <option value="MANAGER">Manager</option>
                              <option value="CASHIER">Caissier</option>
                              <option value="STOCK_MANAGER">Gestionnaire de stock</option>
                              <option value="ACCOUNTANT">Comptable</option>
                              <option value="STAFF">Employé</option>
                            </Select>
                          ) : (
                            <Badge className={meta.badgeCls}>
                              <meta.icon className="w-3 h-3" />
                              {meta.label}
                            </Badge>
                          )}
                        </td>
                        <td className="px-5 py-3 text-slate-500">
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="w-3.5 h-3.5 text-slate-300" />
                            {formatDate(m.createdAt)}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          {!m.isOwner && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Retirer ce membre"
                              className="hover:text-red-600 hover:bg-red-50"
                              onClick={() => setRemoveTarget(m)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Inviter un membre" size="sm"
        description="Le membre doit déjà avoir un compte MadaStock.">
        <form onSubmit={handleAdd} className="space-y-4">
          <Field label="Email du membre" required>
            <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="nom@exemple.com" required />
          </Field>
          <Field label="Rôle">
            <Select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
              <option value="STAFF">Employé — gestion du stock et des ventes</option>
              <option value="MANAGER">Manager — gestion + catégories et facturation</option>
              <option value="ADMIN">Administrateur — accès complet</option>
            </Select>
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={addMutation.isPending}>
              {addMutation.isPending ? 'Ajout...' : 'Inviter'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title="Retirer un membre"
        message={`Retirer ${removeTarget?.user.fullName || removeTarget?.user.email} de la boutique ?`}
        loading={removeMutation.isPending}
        onConfirm={() => removeTarget && removeMutation.mutate(removeTarget.id)}
      />
    </>
  );
}