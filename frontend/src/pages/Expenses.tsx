import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, CalendarDays, CreditCard, Pencil, Plus, Receipt, Trash2, TrendingDown, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { formatAr, formatDate, toDateInput } from '../lib/format';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorMessage,
  Field,
  Input,
  Loading,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  StatCard,
} from '../components/ui';

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'RENT', label: 'Loyer' },
  { value: 'SALARY', label: 'Salaires' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'UTILITIES', label: 'Eau, électricité, internet' },
  { value: 'SUPPLIES', label: 'Fournitures' },
  { value: 'MAINTENANCE', label: 'Entretien / réparation' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'TAXES', label: 'Taxes et impôts' },
  { value: 'BANK_FEES', label: 'Frais bancaires' },
  { value: 'OTHER', label: 'Autre' },
];

const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: 'CASH', label: 'Espèces (caisse)' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'BANK_TRANSFER', label: 'Virement bancaire' },
  { value: 'CARD', label: 'Carte' },
  { value: 'OTHER', label: 'Autre' },
];

const categoryLabel = (value: string) => CATEGORIES.find((c) => c.value === value)?.label ?? value;
const methodLabel = (value: string) => PAYMENT_METHODS.find((m) => m.value === value)?.label ?? value;

interface Expense {
  id: string;
  category: string;
  description: string | null;
  amountAr: number;
  incurredAt: string;
  paymentMethod: string;
  receiptUrl: string | null;
  createdAt: string;
}

interface ExpenseStats {
  monthTotalAr: number;
  monthCount: number;
  prevMonthTotalAr: number;
  variationPct: number | null;
  todayTotalAr: number;
  byCategory: { category: string; amountAr: number; count: number; sharePct: number }[];
}

interface ExpenseForm {
  category: string;
  description: string;
  amountAr: string;
  incurredAt: string;
  paymentMethod: string;
  receiptUrl: string;
}

interface ExpensePayload {
  category: string;
  description?: string;
  amountAr: number;
  incurredAt?: string;
  paymentMethod: string;
  receiptUrl?: string;
}

const emptyForm: ExpenseForm = {
  category: 'RENT',
  description: '',
  amountAr: '',
  incurredAt: toDateInput(new Date()),
  paymentMethod: 'CASH',
  receiptUrl: '',
};

export default function Expenses() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<ExpenseForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  const { data: expenses, isLoading, error } = useQuery({
    queryKey: ['expenses', search, category, page],
    queryFn: async () => {
      const res = await api.get('/expenses', {
        params: { search: search || undefined, category: category || undefined, page, limit: 15 },
      });
      return res.data as { data: Expense[]; pagination: { page: number; limit: number; total: number; pages: number } };
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['expenses-stats'],
    queryFn: async () => (await api.get('/expenses/stats')).data as ExpenseStats,
  });

  const { data: cash } = useQuery({
    queryKey: ['cash-current'],
    queryFn: async () => (await api.get('/cash/current')).data as { open: boolean },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    queryClient.invalidateQueries({ queryKey: ['expenses-stats'] });
    queryClient.invalidateQueries({ queryKey: ['cash'] });
  };

  const createMutation = useMutation({
    mutationFn: async (data: ExpensePayload) => (await api.post('/expenses', data)).data,
    onSuccess: () => {
      toast.success('Dépense enregistrée');
      invalidate();
      setModalOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ExpensePayload }) => (await api.put(`/expenses/${id}`, data)).data,
    onSuccess: () => {
      toast.success('Dépense mise à jour');
      invalidate();
      setModalOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: () => {
      toast.success('Dépense supprimée');
      invalidate();
      setDeleteTarget(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (e: Expense) => {
    setEditing(e);
    setForm({
      category: e.category,
      description: e.description ?? '',
      amountAr: String(e.amountAr),
      incurredAt: toDateInput(e.incurredAt),
      paymentMethod: e.paymentMethod,
      receiptUrl: e.receiptUrl ?? '',
    });
    setModalOpen(true);
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const payload = {
      category: form.category,
      description: form.description || undefined,
      amountAr: Number(form.amountAr),
      incurredAt: form.incurredAt || undefined,
      paymentMethod: form.paymentMethod,
      receiptUrl: form.receiptUrl || undefined,
    };
    if (editing) updateMutation.mutate({ id: editing.id, data: payload });
    else createMutation.mutate(payload);
  };

  const set = (key: keyof ExpenseForm, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const pending = createMutation.isPending || updateMutation.isPending;
  const maxCategory = Math.max(...(stats?.byCategory ?? []).map((c) => c.amountAr), 1);

  return (
    <div>
      <PageHeader
        title="Dépenses"
        subtitle="Charges de la boutique hors achats"
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Nouvelle dépense
          </Button>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <StatCard
          label="Dépenses du mois"
          value={formatAr(stats?.monthTotalAr ?? 0)}
          icon={Wallet}
          gradient="from-rose-500 to-red-500"
          sub={`${stats?.monthCount ?? 0} dépense(s)`}
        />
        <StatCard
          label="Aujourd'hui"
          value={formatAr(stats?.todayTotalAr ?? 0)}
          icon={CalendarDays}
          gradient="from-amber-400 to-orange-500"
        />
        <StatCard
          label="Mois précédent"
          value={formatAr(stats?.prevMonthTotalAr ?? 0)}
          icon={TrendingDown}
          gradient="from-slate-500 to-slate-600"
        />
        <StatCard
          label="Évolution"
          value={stats?.variationPct === null || stats?.variationPct === undefined ? '—' : `${stats.variationPct > 0 ? '+' : ''}${stats.variationPct} %`}
          icon={Receipt}
          gradient={stats && stats.variationPct && stats.variationPct > 0 ? 'from-red-500 to-rose-600' : 'from-emerald-500 to-teal-500'}
          sub="vs mois précédent"
        />
      </div>

      {stats && stats.byCategory.length > 0 && (
        <Card className="mb-4 p-4">
          <p className="text-sm font-semibold text-dark-900 mb-3">Répartition du mois</p>
          <div className="space-y-2.5">
            {stats.byCategory.map((c) => (
              <div key={c.category}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-600">{categoryLabel(c.category)} <span className="text-xs text-slate-400">({c.sharePct} %)</span></span>
                  <span className="font-medium text-dark-900">{formatAr(c.amountAr)}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-rose-500 to-red-500"
                    style={{ width: `${Math.round((c.amountAr / maxCategory) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="mb-4 p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Rechercher une dépense..." />
        </div>
        <Select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          className="sm:w-52"
          aria-label="Filtrer par catégorie"
        >
          <option value="">Toutes les catégories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </Select>
      </Card>

      {error ? (
        <ErrorMessage message={(error as any).response?.data?.error ?? 'Erreur de chargement'} />
      ) : isLoading ? (
        <Loading />
      ) : !expenses || expenses.data.length === 0 ? (
        <Card>
          <EmptyState title="Aucune dépense" description="Enregistrez vos charges pour suivre le résultat de la boutique." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100 bg-slate-50/60">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Catégorie</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Paiement</th>
                  <th className="px-4 py-3 font-medium text-right">Montant</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.data.map((e) => (
                  <tr key={e.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(e.incurredAt)}</td>
                    <td className="px-4 py-3">
                      <Badge className="bg-slate-100 text-slate-600">{categoryLabel(e.category)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{e.description ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <span className="flex items-center gap-1.5">
                        {e.paymentMethod === 'CASH' ? <Banknote className="w-3.5 h-3.5 text-slate-400" /> : <CreditCard className="w-3.5 h-3.5 text-slate-400" />}
                        {methodLabel(e.paymentMethod)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-dark-900">{formatAr(e.amountAr)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(e)} title="Modifier">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="hover:text-red-600" onClick={() => setDeleteTarget(e)} title="Supprimer">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {expenses.pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm">
              <span className="text-slate-500">Page {expenses.pagination.page} sur {expenses.pagination.pages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédent</Button>
                <Button variant="outline" size="sm" disabled={page >= expenses.pagination.pages} onClick={() => setPage(page + 1)}>Suivant</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier la dépense' : 'Nouvelle dépense'} size="lg">
        <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
          <Field label="Catégorie" required>
            <Select value={form.category} onChange={(e) => set('category', e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Montant (Ar)" required>
            <Input type="number" min="0" step="any" value={form.amountAr} onChange={(e) => set('amountAr', e.target.value)} required />
          </Field>
          <Field label="Date">
            <Input type="date" value={form.incurredAt} onChange={(e) => set('incurredAt', e.target.value)} />
          </Field>
          <Field label="Moyen de paiement">
            <Select value={form.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description">
              <Input value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Ex : Loyer du mois de mars" />
            </Field>
          </div>
          {form.paymentMethod === 'CASH' && (
            <div className="sm:col-span-2">
              <p className="text-xs text-slate-500">
                {cash?.open
                  ? 'Cette sortie sera enregistrée dans la session de caisse ouverte.'
                  : "Aucune caisse n'est ouverte : la dépense sera enregistrée mais pas dans la caisse."}
              </p>
            </div>
          )}
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={pending}>{editing ? 'Enregistrer' : 'Ajouter la dépense'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Supprimer la dépense"
        message={`Voulez-vous vraiment supprimer « ${deleteTarget?.description ?? categoryLabel(deleteTarget?.category ?? '')} » (${formatAr(deleteTarget?.amountAr ?? 0)}) ?`}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}
