import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CreditCard } from 'lucide-react';
import { Button, Modal } from './ui';

export default function PremiumModal({
  open,
  onClose,
  planName,
}: {
  open: boolean;
  onClose: () => void;
  planName?: string | null;
}) {
  const navigate = useNavigate();

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Votre essai gratuit a expiré"
      description={planName ? `Offre arrivée à terme : ${planName}` : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Plus tard
          </Button>
          <Button variant="dark" onClick={() => navigate('/pricing')}>
            Voir les offres
          </Button>
          <Button onClick={() => navigate('/billing')}>
            <CreditCard className="w-4 h-4" /> S'abonner
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
        </span>
        <p className="text-sm text-slate-600 leading-relaxed">
          Votre période gratuite est terminée. Passez à une formule payante pour continuer à utiliser MadaStock
          (ventes, stock, factures, caisse…). Votre boutique et vos données restent conservées et réactivables à
          tout moment.
        </p>
      </div>
    </Modal>
  );
}