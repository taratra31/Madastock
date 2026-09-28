import { useNavigate } from 'react-router-dom';
import { Lock, ArrowUpRight } from 'lucide-react';
import { Button } from './ui';

export default function SubscriptionLock({ planName }: { planName?: string | null }) {
  const navigate = useNavigate();

  return (
    <div className="max-w-xl mx-auto text-center py-16">
      <span className="inline-flex w-16 h-16 rounded-2xl bg-amber-50 items-center justify-center">
        <Lock className="w-8 h-8 text-amber-500" />
      </span>
      <h2 className="text-2xl font-bold text-dark-900 mt-5">Abonnement expiré</h2>
      <p className="text-sm text-slate-500 mt-2 leading-relaxed">
        Votre offre{planName ? ` ${planName}` : ''} est arrivée à terme. Pour continuer à gérer votre activité avec
        MadaStock, choisissez une nouvelle formule. Vos données sont conservées et réactivables à tout moment.
      </p>
      <div className="flex flex-wrap justify-center gap-2 mt-6">
        <Button onClick={() => navigate('/pricing')}>Voir les offres</Button>
        <Button variant="dark" onClick={() => navigate('/billing')}>
          <ArrowUpRight className="w-4 h-4" /> Gérer mon abonnement
        </Button>
      </div>
    </div>
  );
}