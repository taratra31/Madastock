import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import AuthShell, {
  authInputCls,
  authLabelCls,
  authLinkCls,
  authPrimaryBtnCls,
} from '../components/AuthShell';

export default function VerifyEmail() {
  const { pendingVerifyEmail, verifyEmail, resendCode, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [resending, setResending] = useState(false);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await verifyEmail(code);
      toast.success('Compte activé');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(
        (err as AxiosError<{ error: string }>).response?.data?.error ?? 'Code invalide ou expiré',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resending) return;
    setResending(true);
    try {
      await resendCode();
      toast.success('Un nouveau code a été envoyé');
      setCountdown(60);
    } catch (err) {
      const status = (err as AxiosError).response?.status;
      const msg = (err as AxiosError<{ error: string }>).response?.data?.error;
      toast.error(msg ?? 'Impossible de renvoyer le code');
      if (status === 429) setCountdown(60);
    } finally {
      setResending(false);
    }
  };

  if (!pendingVerifyEmail) {
    return (
      <AuthShell
        title="Aucune vérification en cours"
        subtitle="Connectez-vous ou créez un compte pour recevoir un code de vérification."
      >
        <Link to="/login" className={authPrimaryBtnCls}>
          Se connecter
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Vérifiez votre compte"
      subtitle={
        <>
          Un code à 6 chiffres a été envoyé à{' '}
          <span className="font-semibold text-emerald-700">{pendingVerifyEmail}</span> (WhatsApp ou e-mail).
        </>
      }
      footer={
        <Link to="/login" className={authLinkCls}>
          Retour à la connexion
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="code" className={authLabelCls}>
            Code de vérification
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className={`${authInputCls} text-center text-2xl font-bold tracking-[0.5em] text-slate-800`}
            placeholder="000000"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || code.length !== 6}
          className={authPrimaryBtnCls}
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Vérification...
            </>
          ) : (
            'Vérifier et me connecter'
          )}
        </button>
      </form>

      <div className="mt-5 text-center text-sm text-slate-500">
        {countdown > 0 ? (
          <span>Renvoyer le code dans {countdown}s</span>
        ) : (
          <>
            Code non reçu ?{' '}
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className={authLinkCls}
            >
              {resending ? 'Envoi...' : 'Renvoyer le code'}
            </button>
          </>
        )}
      </div>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600/70" />
        Le code expire après quelques minutes.
      </p>
    </AuthShell>
  );
}
