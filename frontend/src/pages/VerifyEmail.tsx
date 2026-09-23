import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';

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
      toast.success('Adresse e-mail vérifiée');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error((err as AxiosError<{ error: string }>).response?.data?.error ?? 'Code invalide ou expiré');
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 text-center">
          <h1 className="text-xl font-bold text-slate-800 mb-2">Aucune vérification en cours</h1>
          <p className="text-sm text-slate-500 mb-6">Connectez-vous ou créez un compte pour recevoir un code de vérification.</p>
          <Link to="/login" className="inline-block bg-green-600 hover:bg-green-700 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors">
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        <div className="flex justify-center mb-4">
          <img src="/logo-madastock.png" alt="MadaStock" className="w-16 h-16 rounded-2xl object-contain border border-slate-200 p-1" />
        </div>
        <h1 className="text-xl font-bold text-center mb-2">Vérification de votre e-mail</h1>
        <p className="text-sm text-slate-500 text-center mb-6">
          Un code a été envoyé à <span className="font-medium text-slate-700">{pendingVerifyEmail}</span>. Saisissez-le pour activer votre compte.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-slate-700 mb-1">Code de vérification</label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full border border-slate-300 rounded-lg px-3 py-3 text-center text-2xl font-bold tracking-[0.6em] text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="______"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || code.length !== 6}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
          >
            {submitting ? 'Vérification...' : 'Vérifier et me connecter'}
          </button>
        </form>

        <div className="text-center text-sm text-slate-500 mt-6">
          {countdown > 0 ? (
            <span>Renvoyer le code dans {countdown}s</span>
          ) : (
            <>
              Code non reçu ?{' '}
              <button type="button" onClick={handleResend} disabled={resending} className="text-green-600 hover:underline font-medium">
                {resending ? 'Envoi...' : 'Renvoyer le code'}
              </button>
            </>
          )}
        </div>

        <p className="text-center text-sm text-slate-500 mt-4">
          <Link to="/login" className="text-green-600 hover:underline font-medium">
            Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  );
}