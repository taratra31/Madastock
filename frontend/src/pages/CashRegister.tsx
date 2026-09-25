import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, ArrowDownCircle, ArrowUpCircle, History, Lock, LogIn, LogOut, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { formatAr, formatDateTime, formatNumber } from '../lib/format';
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
  Select,
  StatCard,
} from '../components/ui';

interface CashSession {
  id: string;
  status: string;
  openingBalanceAr: number;
  closingBalanceAr: number | null;
  expectedCloseAr: number | null;
  differenceAr: number | null;
  theoreticalAr: number;
  openedAt: string;
  closedAt: string | null;
  openedByName: string | null;
  notes: string | null;
  movementsCount: number;
  inflowAr: number;
  outflowAr: number;
  netAr: number;
}

interface CashTransaction {
  id: string;
  transactionType: string;
  amountAr: number;
  source: string;
  method: string;
  description: string | null;
  createdAt: string;
}

interface SessionDetail extends CashSession {
  transactions: CashTransaction[];
}

const TX_LABELS: Record<string, string> = {
  SALE: 'Vente',
  EXPENSE: 'Dépense',
  PURCHASE: 'Achat',
  DEPOSIT: 'Versement',
  WITHDRAWAL: 'Retrait',
  ADJUSTMENT: 'Ajustement',
};

export default function CashRegister() {
  const queryClient = useQueryClient();
  const [openModal, setOpenModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [moveModal, setMoveModal] = useState(false);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [openingBalanceAr, setOpeningBalanceAr] = useState('0');
  const [closingBalanceAr, setClosingBalanceAr] = useState('0');
  const [notes, setNotes] = useState('');
  const [txType, setTxType] = useState('DEPOSIT');
  const [txAmount, setTxAmount] = useState('');
  const [txNotes, setTxNotes] = useState('');

  const { data: current, isLoading, error } = useQuery({
    queryKey: ['cash-current'],
    queryFn: async () => (await api.get('/cash/current')).data as { open: boolean; session: CashSession | null },
  });

  const { data: sessions } = useQuery({
    queryKey: ['cash-sessions'],
    queryFn: async () => {
      const res = await api.get('/cash/sessions', { params: { limit: 10 } });
      return res.data as { data: CashSession[]; pagination: { total: number } };
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['cash'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const openMutation = useMutation({
    mutationFn: async (payload: { openingBalanceAr: number; notes?: string }) => (await api.post('/cash/open', payload)).data,
    onSuccess: () => {
      toast.success('Caisse ouverte');
      invalidate();
      setOpenModal(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const closeMutation = useMutation({
    mutationFn: async (payload: { closingBalanceAr: number; notes?: string }) => (await api.post('/cash/close', payload)).data as CashSession,
    onSuccess: (session) => {
      const diff = session.differenceAr ?? 0;
      toast.success(
        diff === 0
          ? 'Caisse clôturée : tout est juste'
          : `Caisse clôturée : écart de ${formatAr(Math.abs(diff))}`,
      );
      invalidate();
      setCloseModal(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const txMutation = useMutation({
    mutationFn: async (payload: { transactionType: string; amountAr: number; description?: string }) =>
      (await api.post('/cash/transactions', payload)).data,
    onSuccess: () => {
      toast.success('Mouvement enregistré');
      invalidate();
      setMoveModal(false);
      setTxAmount('');
      setTxNotes('');
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const session = current?.session;
  const theoretical = session ? session.theoreticalAr : 0;
  const pendingClose = session ? session.openingBalanceAr + session.netAr : 0;

  return (
    <div>
      <PageHeader
        title="Caisse"
        subtitle={
          current?.open
            ? `Session ouverte ${session ? formatDateTime(session.openedAt) : ''}`
            : 'Aucune session ouverte'
        }
        actions={
          current?.open ? (
            <>
              <Button variant="outline" onClick={() => { setClosingBalanceAr(String(theoretical)); setCloseModal(true); }}>
                <Lock className="w-4 h-4" />
                Clôturer
              </Button>
              <Button onClick={() => setMoveModal(true)}>
                <Banknote className="w-4 h-4" />
                Mouvement
              </Button>
            </>
          ) : (
            <Button onClick={() => { setOpeningBalanceAr('0'); setOpenModal(true); }}>
              <LogIn className="w-4 h-4" />
              Ouvrir la caisse
            </Button>
          )
        }
      />

      {error ? (
        <ErrorMessage message={(error as any).response?.data?.error ?? 'Erreur de chargement'} />
      ) : isLoading ? (
        <Loading />
      ) : !current?.open ? (
        <Card>
          <EmptyState title="La caisse est fermée" description="Ouvrez une session pour enregistrer les ventes et les dépenses en espèces." />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
            <StatCard label="Fonds de départ" value={formatAr(session?.openingBalanceAr ?? 0)} icon={LogIn} sub={`par ${session?.openedByName ?? 'inconnu'}`} />
            <StatCard label="Entrées" value={formatAr(session?.inflowAr ?? 0)} icon={ArrowDownCircle} gradient="from-emerald-500 to-teal-500" sub={`${session?.movementsCount ?? 0} mouvement(s)`} />
            <StatCard label="Sorties" value={formatAr(session?.outflowAr ?? 0)} icon={ArrowUpCircle} gradient="from-rose-500 to-red-500" />
            <StatCard label="Caisse théorique" value={formatAr(theoretical)} icon={Wallet} gradient="from-indigo-500 to-violet-500" />
          </div>

          <Card className="p-4 mb-5 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <p className="text-sm text-slate-600">
                Comptez les espèces dans le tiroir puis saisissez le total pour clôturer : l'écart avec {formatAr(pendingClose)} sera calculé automatiquement.
              </p>
            </div>
            <Button variant="dark" onClick={() => { setClosingBalanceAr(String(pendingClose)); setCloseModal(true); }}>
              <LogOut className="w-4 h-4" />
              Clôturer la session
            </Button>
          </Card>
        </>
      )}

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <History className="w-4 h-4 text-slate-400" />
          <p className="text-sm font-semibold text-dark-900">Sessions précédentes</p>
          <span className="text-xs text-slate-400">({sessions?.pagination.total ?? 0})</span>
        </div>
        {!sessions || sessions.data.length === 0 ? (
          <EmptyState title="Aucune session enregistrée" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 bg-slate-50/60">
                  <th className="px-4 py-3 font-medium">Ouverture</th>
                  <th className="px-4 py-3 font-medium">Par</th>
                  <th className="px-4 py-3 font-medium text-right">Départ</th>
                  <th className="px-4 py-3 font-medium text-right">Théorique</th>
                  <th className="px-4 py-3 font-medium text-right">Compté</th>
                  <th className="px-4 py-3 font-medium text-right">Écart</th>
                  <th className="px-4 py-3 font-medium">État</th>
                </tr>
              </thead>
              <tbody>
                {sessions.data.map((s) => (
                  <tr
                    key={s.id}
                    className="border-t border-slate-50 hover:bg-slate-50/50 cursor-pointer"
                    onClick={async () => {
                      try {
                        setDetail((await api.get(`/cash/sessions/${s.id}`)).data as SessionDetail);
                      } catch {
                        toast.error('Impossible de charger la session');
                      }
                    }}
                  >
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDateTime(s.openedAt)}</td>
                    <td className="px-4 py-3 text-slate-600">{s.openedByName ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatAr(s.openingBalanceAr)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatAr(s.theoreticalAr)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {s.closingBalanceAr === null ? '—' : formatAr(s.closingBalanceAr)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {s.differenceAr === null ? (
                        <span className="text-slate-400">—</span>
                      ) : s.differenceAr === 0 ? (
                        <span className="text-emerald-600 font-medium">juste</span>
                      ) : (
                        <span className={s.differenceAr < 0 ? 'text-red-600 font-semibold' : 'text-amber-600 font-semibold'}>
                          {s.differenceAr > 0 ? '+' : ''}{formatAr(s.differenceAr)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {s.status === 'OPEN' ? (
                        <Badge className="bg-emerald-50 text-emerald-700">Ouverte</Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-600">Clôturée</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={openModal} onClose={() => setOpenModal(false)} title="Ouvrir la caisse" description="Saisissez le montant des espèces déjà présentes dans le tiroir." size="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            openMutation.mutate({ openingBalanceAr: Number(openingBalanceAr || 0), notes: notes || undefined });
          }}
          className="space-y-4"
        >
          <Field label="Fonds de départ (Ar)" required>
            <Input type="number" min="0" step="any" value={openingBalanceAr} onChange={(e) => setOpeningBalanceAr(e.target.value)} required />
          </Field>
          <Field label="Note">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optionnel" />
          </Field>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setOpenModal(false)}>Annuler</Button>
            <Button type="submit" disabled={openMutation.isPending}>Ouvrir</Button>
          </div>
        </form>
      </Modal>

      <Modal open={closeModal} onClose={() => setCloseModal(false)} title="Clôturer la caisse" description="Comptage des espèces" size="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            closeMutation.mutate({ closingBalanceAr: Number(closingBalanceAr || 0), notes: notes || undefined });
          }}
          className="space-y-4"
        >
          <div className="rounded-lg bg-slate-50 p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">Fonds de départ</span><span>{formatAr(session?.openingBalanceAr ?? 0)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Entrées − Sorties</span><span className={session && session.netAr < 0 ? 'text-red-600' : 'text-emerald-600'}>{formatAr(session?.netAr ?? 0)}</span></div>
            <div className="flex justify-between font-semibold border-t border-slate-200 pt-1"><span>Attendu en caisse</span><span>{formatAr(pendingClose)}</span></div>
          </div>
          <Field label="Montant compté (Ar)" required>
            <Input type="number" min="0" step="any" value={closingBalanceAr} onChange={(e) => setClosingBalanceAr(e.target.value)} required />
          </Field>
          <Field label="Note">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optionnel" />
          </Field>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setCloseModal(false)}>Annuler</Button>
            <Button type="submit" disabled={closeMutation.isPending}>Clôturer</Button>
          </div>
        </form>
      </Modal>

      <Modal open={moveModal} onClose={() => setMoveModal(false)} title="Mouvement de caisse" size="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (Number(txAmount) <= 0) {
              toast.error('Le montant doit être supérieur à 0');
              return;
            }
            txMutation.mutate({
              transactionType: txType,
              amountAr: Number(txAmount),
              description: txNotes || undefined,
            });
          }}
          className="space-y-4"
        >
          <Field label="Type" required>
            <Select value={txType} onChange={(e) => setTxType(e.target.value)}>
              <option value="DEPOSIT">Versement (entrée)</option>
              <option value="WITHDRAWAL">Retrait (sortie)</option>
              <option value="ADJUSTMENT">Ajustement</option>
            </Select>
          </Field>
          <Field label="Montant (Ar)" required>
            <Input type="number" min="0" step="any" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} required />
          </Field>
          <Field label="Motif">
            <Input value={txNotes} onChange={(e) => setTxNotes(e.target.value)} placeholder="Optionnel" />
          </Field>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setMoveModal(false)}>Annuler</Button>
            <Button type="submit" disabled={txMutation.isPending}>Enregistrer</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `Session du ${formatDateTime(detail.openedAt)}` : ''} size="lg">
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-400">Départ</p>
                <p className="font-medium text-dark-900">{formatAr(detail.openingBalanceAr)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Entrées</p>
                <p className="font-medium text-emerald-600">{formatAr(detail.inflowAr)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Sorties</p>
                <p className="font-medium text-red-600">{formatAr(detail.outflowAr)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Mouvements</p>
                <p className="font-medium text-dark-900">{formatNumber(detail.movementsCount)}</p>
              </div>
            </div>

            {detail.transactions.length === 0 ? (
              <EmptyState title="Aucun mouvement" />
            ) : (
              <div className="border border-slate-100 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0">
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500 bg-slate-50">
                      <th className="px-3 py-2 font-medium">Heure</th>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Détail</th>
                      <th className="px-3 py-2 font-medium text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.transactions.map((t) => (
                      <tr key={t.id} className="border-t border-slate-50">
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{formatDateTime(t.createdAt)}</td>
                        <td className="px-3 py-2">
                          <Badge className={t.amountAr >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}>
                            {TX_LABELS[t.transactionType] ?? t.transactionType}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-slate-600">{t.description ?? '—'}</td>
                        <td className={`px-3 py-2 text-right font-medium ${t.amountAr >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {t.amountAr >= 0 ? '+' : ''}{formatAr(t.amountAr)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setDetail(null)}>Fermer</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
