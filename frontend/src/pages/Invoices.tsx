import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Eye, Trash2, FileText, BadgeCheck, Wallet, Download } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { formatAr, formatDate } from '../lib/format';
import { invoiceDocTypeLabels, invoiceStatusLabels, invoiceStatusBadge, paymentMethodLabels } from '../lib/labels';
import { downloadInvoicePdf } from '../lib/invoicePdf';
import { useStores } from '../lib/store';
import {
  Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, Loading, Modal, PageHeader, SearchInput, Select, Textarea, ErrorMessage,
} from '../components/ui';

interface InvoiceListItem {
  id: string;
  number: string;
  docType: string;
  status: string;
  issueDate: string;
  dueDate: string | null;
  subtotalAr: number;
  discountAr: number;
  taxAr: number;
  totalAr: number;
  amountPaidAr: number;
  paymentStatus: string;
  paymentMethod: string | null;
  itemsCount: number;
  customer: { id: string; fullName: string; phone: string | null } | null;
  vehicle: { id: string; plateNumber: string } | null;
  workOrder: { id: string; orderNumber: string } | null;
}

interface InvoiceDetail extends InvoiceListItem {
  notes: string | null;
  createdAt: string;
  items: {
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
  }[];
}

interface CustomerOpt {
  id: string;
  fullName: string;
}

interface LineItemForm {
  description: string;
  type: string;
  quantity: string;
  unitPrice: string;
}

const newLine = (): LineItemForm => ({ description: '', type: 'PART', quantity: '1', unitPrice: '' });

export default function Invoices() {
  const queryClient = useQueryClient();
  const [docType, setDocType] = useState('INVOICE');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [view, setView] = useState<InvoiceDetail | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InvoiceListItem | null>(null);

  const [formDocType, setFormDocType] = useState('INVOICE');
  const [formCustomer, setFormCustomer] = useState('');
  const [formIssueDate, setFormIssueDate] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formDiscount, setFormDiscount] = useState('0');
  const [formTax, setFormTax] = useState('0');
  const [formNotes, setFormNotes] = useState('');
  const [lines, setLines] = useState<LineItemForm[]>([newLine()]);

  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');

  const { currentStore } = useStores();

  const { data: invoices, isLoading, error } = useQuery({
    queryKey: ['invoices', docType, search],
    queryFn: async () => {
      const res = await api.get('/invoices', { params: { docType, search: search || undefined } });
      return res.data as { data: InvoiceListItem[]; pagination: { page: number; total: number } };
    },
  });

  const { data: customers } = useQuery({
    queryKey: ['customer-options'],
    queryFn: async () => {
      const res = await api.get('/customers', { params: { limit: 100 } });
      return (res.data.data as CustomerOpt[]).sort((a, b) => a.fullName.localeCompare(b.fullName));
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await api.post('/invoices', data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Document créé');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setCreateOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const payMutation = useMutation({
    mutationFn: async ({ id, amount, method }: { id: string; amount: number; method: string }) => {
      const res = await api.post(`/invoices/${id}/pay`, { amount, method });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Paiement enregistré');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setPayOpen(false);
      setView(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const acceptMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/invoices/${id}/accept`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Devis transformé en facture');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setView(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/invoices/${id}`),
    onSuccess: () => {
      toast.success('Document supprimé');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setDeleteTarget(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const updateLine = (idx: number, key: keyof LineItemForm, value: string) =>
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, [key]: value } : l)));

  const linesTotal = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
  const grandTotal = linesTotal - (Number(formDiscount) || 0) + (Number(formTax) || 0);

  const openCreate = () => {
    setFormDocType(docType);
    setFormCustomer('');
    setFormIssueDate('');
    setFormDueDate('');
    setFormDiscount('0');
    setFormTax('0');
    setFormNotes('');
    setLines([newLine()]);
    setCreateOpen(true);
  };

  const openView = async (inv: InvoiceListItem) => {
    try {
      const res = await api.get(`/invoices/${inv.id}`);
      setView(res.data as InvoiceDetail);
    } catch {
      toast.error('Impossible de charger le document');
    }
  };

  const handleDownloadPdf = async () => {
    if (!view) return;
    try {
      await downloadInvoicePdf(view, currentStore?.name ?? undefined);
    } catch {
      toast.error('Impossible de générer le PDF');
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const items = lines
      .filter((l) => l.description.trim())
      .map((l) => ({
        type: l.type,
        description: l.description.trim(),
        quantity: Number(l.quantity) || 1,
        unitPrice: Number(l.unitPrice) || 0,
      }));
    if (items.length === 0) {
      toast.error('Ajoutez au moins une ligne au document');
      return;
    }
    if (!formCustomer) {
      toast.error('Choisissez un client');
      return;
    }
    createMutation.mutate({
      docType: formDocType,
      customerId: formCustomer,
      issueDate: formIssueDate || undefined,
      dueDate: formDueDate || undefined,
      discount: Number(formDiscount) || 0,
      tax: Number(formTax) || 0,
      notes: formNotes || undefined,
      items,
    });
  };

  const openPay = (inv: InvoiceDetail) => {
    const remaining = Math.max(0, inv.totalAr - inv.amountPaidAr);
    setPayAmount(String(remaining));
    setPayMethod('CASH');
    setView(inv);
    setPayOpen(true);
  };

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!view) return;
    const amount = Number(payAmount);
    if (amount <= 0) {
      toast.error('Montant invalide');
      return;
    }
    payMutation.mutate({ id: view.id, amount, method: payMethod });
  };

  const handleDownloadList = async (inv: InvoiceListItem) => {
    try {
      const res = await api.get(`/invoices/${inv.id}`);
      await downloadInvoicePdf(res.data as InvoiceDetail, currentStore?.name ?? undefined);
      toast.success('PDF généré');
    } catch {
      toast.error('Impossible de générer le PDF');
    }
  };

  const remaining = view ? Math.max(0, view.totalAr - view.amountPaidAr) : 0;

  return (
    <div>
      <PageHeader
        title="Facturation"
        subtitle="Devis et factures de votre boutique"
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Nouveau document
          </Button>
        }
      />

      <Card className="mb-4 p-2 flex flex-col sm:flex-row gap-2">
        <div className="flex rounded-xl bg-slate-100 p-1 gap-1">
          {(['INVOICE', 'QUOTE'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setDocType(t)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                docType === t ? 'bg-white shadow-sm text-dark-900 ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {invoiceDocTypeLabels[t]}s
            </button>
          ))}
        </div>
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Rechercher par n° ou client..." />
        </div>
      </Card>

      {error ? (
        <ErrorMessage message={(error as any).response?.data?.error ?? 'Erreur de chargement'} />
      ) : isLoading ? (
        <Loading />
      ) : !invoices || invoices.data.length === 0 ? (
        <Card>
          <EmptyState title="Aucun document" description="Créez votre première facture ou devis." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100 bg-slate-50/60">
                  <th className="px-4 py-3 font-medium">N°</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium text-right">Montant</th>
                  <th className="px-4 py-3 font-medium text-right">Payé</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.data.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-dark-900">{inv.number}</td>
                    <td className="px-4 py-3 text-slate-600">{inv.customer?.fullName ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(inv.issueDate)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-dark-900">{formatAr(inv.totalAr)}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{formatAr(inv.amountPaidAr)}</td>
                    <td className="px-4 py-3">
                      <Badge className={invoiceStatusBadge[inv.status] ?? 'bg-slate-100 text-slate-600'}>
                        {invoiceStatusLabels[inv.status] ?? inv.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" title="Télécharger en PDF" onClick={() => handleDownloadList(inv)}>
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openView(inv)} title="Voir">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="hover:text-red-600" onClick={() => setDeleteTarget(inv)} title="Supprimer">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {invoices.pagination.total > 20 && (
            <div className="px-4 py-3 border-t border-slate-100 text-sm text-slate-500">
              {invoices.pagination.total} document(s)
            </div>
          )}
        </Card>
      )}

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nouveau document" size="xl"
        description="Créez une facture ou un devis pour un client.">
        <form onSubmit={handleCreate} className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Type de document" required>
              <Select value={formDocType} onChange={(e) => setFormDocType(e.target.value)}>
                <option value="INVOICE">Facture</option>
                <option value="QUOTE">Devis</option>
              </Select>
            </Field>
            <Field label="Client" required>
              <Select value={formCustomer} onChange={(e) => setFormCustomer(e.target.value)} required>
                <option value="">Choisir un client...</option>
                {(customers ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.fullName}</option>
                ))}
              </Select>
            </Field>
            <Field label="Date d'émission">
              <Input type="date" value={formIssueDate} onChange={(e) => setFormIssueDate(e.target.value)} />
            </Field>
            <Field label="Date d'échéance">
              <Input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} />
            </Field>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-700">Lignes du document</p>
              <Button type="button" variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, newLine()])}>
                <Plus className="w-3.5 h-3.5" />
                Ajouter une ligne
              </Button>
            </div>
            <div className="space-y-2">
              {lines.map((l, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <Select
                    value={l.type}
                    onChange={(e) => updateLine(idx, 'type', e.target.value)}
                    className="col-span-3"
                  >
                    <option value="PART">Produit / Pièce</option>
                    <option value="LABOR">Main d'œuvre</option>
                    <option value="OTHER">Autre</option>
                  </Select>
                  <Input
                    value={l.description}
                    onChange={(e) => updateLine(idx, 'description', e.target.value)}
                    placeholder="Description"
                    className="col-span-5"
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
                </div>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-4 gap-4">
            <Field label="Remise (Ar)">
              <Input type="number" min={0} value={formDiscount} onChange={(e) => setFormDiscount(e.target.value)} />
            </Field>
            <Field label="TVA (Ar)">
              <Input type="number" min={0} value={formTax} onChange={(e) => setFormTax(e.target.value)} />
            </Field>
            <div className="sm:col-span-2 flex flex-col justify-end">
              <div className="rounded-lg bg-slate-50 px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-slate-500">Total à régler</span>
                <span className="text-lg font-bold text-dark-900">{formatAr(grandTotal)}</span>
              </div>
            </div>
          </div>

          <Field label="Notes">
            <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Optionnel" />
          </Field>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Création...' : 'Créer le document'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* View modal */}
      <Modal open={!!view} onClose={() => setView(null)} size="lg"
        title={`${invoiceDocTypeLabels[view?.docType ?? 'INVOICE']} ${view?.number ?? ''}`}
        footer={
          view ? (
            <>
              <Button variant="outline" onClick={() => setView(null)}>Fermer</Button>
              <Button variant="dark" onClick={handleDownloadPdf} title="Télécharger en PDF">
                <Download className="w-4 h-4" />
                PDF
              </Button>
              {view.docType === 'QUOTE' && view.status !== 'ACCEPTED' && view.status !== 'REJECTED' && view.status !== 'CANCELLED' && (
                <Button onClick={() => acceptMutation.mutate(view.id)} disabled={acceptMutation.isPending}>
                  <BadgeCheck className="w-4 h-4" />
                  Transformer en facture
                </Button>
              )}
              {view.docType === 'INVOICE' && remaining > 0 && (
                <Button onClick={() => openPay(view)}>
                  <Wallet className="w-4 h-4" />
                  Encaisser un paiement
                </Button>
              )}
            </>
          ) : null
        }
      >
        {view && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Badge className={invoiceStatusBadge[view.status] ?? 'bg-slate-100 text-slate-600'}>
                {invoiceStatusLabels[view.status] ?? view.status}
              </Badge>
              <Badge className="bg-slate-100 text-slate-600">
                {view.customer?.fullName ?? '—'}
              </Badge>
              {view.paymentMethod && (
                <Badge className="bg-blue-50 text-blue-600">
                  {paymentMethodLabels[view.paymentMethod] ?? view.paymentMethod}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-400">Date</p>
                <p className="font-medium">{formatDate(view.issueDate)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Échéance</p>
                <p className="font-medium">{view.dueDate ? formatDate(view.dueDate) : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Articles</p>
                <p className="font-medium">{view.items.length}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Statut paiement</p>
                <p className="font-medium">{view.paymentStatus}</p>
              </div>
            </div>

            <div className="border border-slate-100 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs uppercase text-slate-500">
                    <th className="px-3 py-2">Description</th>
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
                      <td className="px-3 py-2 text-right">{it.quantity}</td>
                      <td className="px-3 py-2 text-right">{formatAr(it.unitPrice)}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatAr(it.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-1 text-sm ml-auto w-full sm:w-64">
              <div className="flex justify-between text-slate-500">
                <span>Sous-total</span>
                <span>{formatAr(view.subtotalAr)}</span>
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
                <FileText className="w-4 h-4 hidden" />
                <span>Total</span>
                <span>{formatAr(view.totalAr)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Payé</span>
                <span>{formatAr(view.amountPaidAr)}</span>
              </div>
              <div className="flex justify-between font-semibold text-green-600">
                <span>Reste à payer</span>
                <span>{formatAr(remaining)}</span>
              </div>
            </div>

            {view.notes && (
              <div className="text-sm text-slate-600 bg-slate-50 rounded-lg px-4 py-3">
                <span className="font-medium">Notes : </span>
                {view.notes}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Pay modal */}
      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Encaisser un paiement" size="sm">
        {view && (
          <form onSubmit={handlePay} className="space-y-4">
            <div className="rounded-lg bg-slate-50 px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-slate-500">Reste à payer : {view.number}</span>
              <span className="font-bold text-dark-900">{formatAr(remaining)}</span>
            </div>
            <Field label="Montant encaissé" required>
              <Input type="number" min={0} step="any" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} required />
            </Field>
            <Field label="Mode de paiement">
              <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                <option value="CASH">Espèces</option>
                <option value="MOBILE_MONEY">Mobile Money (MVola, Orange Money...)</option>
                <option value="BANK_TRANSFER">Virement bancaire</option>
                <option value="CARD">Carte bancaire</option>
                <option value="OTHER">Autre</option>
              </Select>
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setPayOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={payMutation.isPending}>
                {payMutation.isPending ? 'Enregistrement...' : 'Encaisser'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Supprimer le document"
        message={`Voulez-vous vraiment supprimer « ${deleteTarget?.number} » ? Cette action est irréversible.`}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}