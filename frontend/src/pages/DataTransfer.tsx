import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { formatNumber } from '../lib/format';
import { usePermissions } from '../lib/permissions';
import {
  Button,
  Card,
  ErrorMessage,
  Field,
  Loading,
  PageHeader,
  Select,
} from '../components/ui';

type Dataset = 'products' | 'stock' | 'sales' | 'invoices';
type ImportKind = 'products' | 'stock';

interface ImportReport {
  created?: number;
  updated?: number;
  skipped?: number;
  errors: string[];
}

const EXPORTS: { key: Dataset; label: string; hint: string }[] = [
  { key: 'products', label: 'Produits', hint: 'Nom, référence, code-barres, prix, seuils' },
  { key: 'stock', label: 'Stock par dépôt', hint: 'Quantités, lots, péremptions, valeur' },
  { key: 'sales', label: 'Ventes', hint: 'Tickets, clients, totaux (5 000 derniers)' },
  { key: 'invoices', label: 'Factures', hint: 'Numéros, clients, paiements (5 000 dernières)' },
];

export default function DataTransfer() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canExport = can('data.export');
  const canImport = can('data.import');
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<ImportKind>('products');
  const [fileName, setFileName] = useState('');
  const [report, setReport] = useState<ImportReport | null>(null);

  const download = async (dataset: Dataset) => {
    try {
      const res = await api.get(`/data/export/${dataset}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const disposition = res.headers['content-disposition'] as string | undefined;
      const filename = disposition?.match(/filename="?([^"]+)"?/)?.[1] ?? `${dataset}.csv`;
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(`${filename} téléchargé`);
    } catch (error: any) {
      toast.error(error.response?.data?.error ?? 'Export impossible');
    }
  };

  const downloadTemplate = async (template: ImportKind) => {
    try {
      const res = await api.get(`/data/import/template?kind=${template}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = template === 'stock' ? 'modele-import-inventaire.csv' : 'modele-import-produits.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error(error.response?.data?.error ?? 'Modèle indisponible');
    }
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new Error('Choisissez un fichier CSV');
      const csv = await file.text();
      const res = await api.post(`/data/import/${kind}`, { csv });
      return res.data as ImportReport;
    },
    onSuccess: (data) => {
      setReport(data);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      toast.success('Import terminé');
    },
    onError: (error: any) => toast.error(error.response?.data?.error ?? error.message ?? 'Import impossible'),
  });

  return (
    <div>
      <PageHeader
        title="Import / Export"
        subtitle="Sauvegardez vos données ou rehearsals un inventaire en quelques secondes"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <Download className="w-5 h-5 text-green-600" />
            <h2 className="font-semibold text-dark-900">Exporter</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            Fichier CSV compatible Excel (séparateur point-virgule, accents inclus).
          </p>
          {!canExport ? (
            <p className="text-sm text-slate-500">Votre rôle ne permet pas l'export de données.</p>
          ) : (
            <div className="space-y-2">
              {EXPORTS.map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-dark-900">{item.label}</p>
                    <p className="text-xs text-slate-400 truncate">{item.hint}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => download(item.key)}>
                    <Download className="w-3.5 h-3.5" /> CSV
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <Upload className="w-5 h-5 text-green-600" />
            <h2 className="font-semibold text-dark-900">Importer</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            Produits : un nom déjà existant met à jour la fiche. Inventaire : les quantités sont
            ajustées et un mouvement est écrit pour chaque écart.
          </p>
          {!canImport ? (
            <p className="text-sm text-slate-500">Votre rôle ne permet pas l'import de données.</p>
          ) : (
            <div className="space-y-4">
              <Field label="Type d'import">
                <Select
                  value={kind}
                  onChange={(e) => {
                    setKind(e.target.value as ImportKind);
                    setFileName('');
                  }}
                >
                  <option value="products">Produits (création / mise à jour)</option>
                  <option value="stock">Inventaire (quantités par dépôt)</option>
                </Select>
              </Field>

              <div className="flex items-center gap-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
                  className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-green-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-green-700 hover:file:bg-green-100"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => importMutation.mutate()} disabled={!fileName || importMutation.isPending}>
                  {importMutation.isPending ? 'Import en cours...' : 'Lancer l\'import'}
                </Button>
                <Button variant="ghost" onClick={() => downloadTemplate(kind)}>
                  <FileSpreadsheet className="w-4 h-4" /> Télécharger le modèle
                </Button>
              </div>

              {report && (
                <div className="rounded-lg bg-slate-50 p-3 text-sm">
                  <p className="font-medium text-dark-900">
                    {formatNumber(report.created ?? 0)} créé(s), {formatNumber(report.updated ?? 0)} mis à jour,{' '}
                    {formatNumber(report.skipped ?? 0)} ignoré(s)
                  </p>
                  {report.errors.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-red-600 list-disc pl-4">
                      {report.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {!canExport && !canImport && (
        <div className="mt-4">
          <ErrorMessage message="Aucune permission d'import / export pour ce rôle." />
        </div>
      )}

      {importMutation.isPending && <Loading />}
    </div>
  );
}
