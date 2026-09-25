import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { MessageCircle, RefreshCw, QrCode, ShieldCheck, Smartphone } from 'lucide-react';
import api from '../lib/api';
import { apiError } from '../lib/admin';
import { Badge, Button, Card, ErrorMessage, Loading, PageHeader } from '../components/ui';

interface WhatsappStatus {
  enabled: boolean;
  paired: boolean;
  qr: string | null;
  error: string | null;
  sender: string;
}

const STEPS = [
  'Ouvrez WhatsApp sur le téléphone qui envoie les codes.',
  'Menu ⋮ → Appareils liés → « Lier un appareil ».',
  'Scannez le QR affiché ci-dessous avec ce téléphone.',
];

export default function AdminWhatsApp() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'whatsapp'],
    queryFn: async () => {
      const res = await api.get('/admin/whatsapp');
      return res.data as WhatsappStatus;
    },
  });

  const [qr, setQr] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState('');
  const [notice, setNotice] = useState('');

  const loadQr = async () => {
    setQrLoading(true);
    setQrError('');
    setNotice('');
    try {
      const res = await api.get('/admin/whatsapp/qr');
      const payload = res.data as string | null;
      if (!payload) {
        setQr(null);
        setQrError('Aucun QR pour le moment. Vérifiez que WHATSAPP_OTP_ENABLED=1 sur Render, puis réessayez.');
        return;
      }
      setQr(await QRCode.toDataURL(payload, { width: 260, margin: 2 }));
    } catch (err) {
      setQr(null);
      setQrError(apiError(err, 'Impossible de générer le QR.'));
    } finally {
      setQrLoading(false);
    }
  };

  if (isLoading) return <Loading />;
  if (error) return <ErrorMessage message="Impossible de charger le statut WhatsApp." />;
  if (!data) return null;

  return (
    <div>
      <PageHeader
        title="WhatsApp"
        subtitle="Envoi automatique des codes OTP par WhatsApp"
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-3.5 h-3.5" />
            Actualiser
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle className="w-5 h-5 text-green-600" />
            <h2 className="text-sm font-semibold text-slate-800">État du canal</h2>
          </div>

          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Canal OTP WhatsApp</dt>
              <dd>
                {data.enabled ? (
                  <Badge className="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">Activé</Badge>
                ) : (
                  <Badge className="bg-slate-100 text-slate-600 ring-1 ring-slate-200">Désactivé</Badge>
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Appairage</dt>
              <dd>
                {data.paired ? (
                  <Badge className="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">Connecté</Badge>
                ) : (
                  <Badge className="bg-amber-50 text-amber-700 ring-1 ring-amber-200">Non appairé</Badge>
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Numéro expéditeur</dt>
              <dd className="font-medium text-slate-800">{data.sender}</dd>
            </div>
          </dl>

          {data.error && (
            <p className="mt-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              {data.error}
            </p>
          )}

          {!data.enabled && (
            <p className="mt-4 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
              Sur Render, ajoutez <code className="font-mono">WHATSAPP_OTP_ENABLED=1</code> puis redémarrez le service.
              Tant qu&apos;il n&apos;est pas activé, les codes sont envoyés uniquement par e-mail.
            </p>
          )}

          {data.paired && (
            <p className="mt-4 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
              La session est enregistrée en base : aucun nouveau scan n&apos;est nécessaire après un redéploiement.
            </p>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <QrCode className="w-5 h-5 text-green-600" />
            <h2 className="text-sm font-semibold text-slate-800">Appairage du numéro</h2>
          </div>

          {qr ? (
            <div className="flex flex-col items-center gap-3">
              <img src={qr} alt="QR d'appairage WhatsApp" className="w-[260px] h-[260px] border border-slate-200 rounded-xl" />
              <p className="text-xs text-center text-slate-500">
                Ce QR expire rapidement. S&apos;il n&apos;est plus valide, cliquez sur « Nouveau QR ».
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500 mb-4">
              L&apos;appairage se fait une seule fois. Après le scan, la session est conservée automatiquement.
            </p>
          )}

          <Button className="w-full" onClick={loadQr} disabled={qrLoading || !data.enabled}>
            <Smartphone className="w-4 h-4" />
            {qrLoading ? 'Génération...' : qr ? 'Nouveau QR' : "Obtenir le QR d'appairage"}
          </Button>

          {qrError && <p className="mt-3 text-xs text-red-600">{qrError}</p>}
          {notice && <p className="mt-3 text-xs text-emerald-700">{notice}</p>}

          <div className="mt-5 pt-4 border-t border-slate-100">
            <p className="flex items-center gap-1.5 text-xs font-medium text-slate-700 mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              Comment appairer
            </p>
            <ol className="space-y-1.5 list-decimal list-inside text-xs text-slate-500">
              {STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        </Card>
      </div>
    </div>
  );
}
