import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AtSign, Eye, EyeOff, Loader2, Lock, LogIn, ShieldCheck } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { toast } from 'sonner';
import AuthShell from '../components/AuthShell';

export default function Login() {
  const { login, isAuthenticated, isLoading, authError } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = identifier.trim();
    if (!value) {
      toast.error('Saisissez votre email ou votre numéro de téléphone');
      return;
    }
    setSubmitting(true);
    try {
      const result = await login(value, password);
      if (result.requiresVerification) {
        toast.info('Vérifiez votre e-mail ou votre WhatsApp pour confirmer le compte');
        navigate('/verify-email', { replace: true });
        return;
      }
      toast.success('Connexion réussie');
    } catch {
      toast.error(authError ?? 'Erreur de connexion');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    'w-full rounded-xl bg-white/10 ring-1 ring-white/20 px-4 py-3 text-sm text-white placeholder-emerald-100/40 ' +
    'focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white/15 transition';

  return (
    <AuthShell
      title="Connexion"
      subtitle="Un seul champ : votre email ou votre numéro de téléphone."
      footer={
        <>
          Pas encore de compte ?{' '}
          <Link to="/register" className="font-semibold text-emerald-300 hover:text-emerald-200">
            Créer un compte
          </Link>
        </>
      }
    >
      {authError && (
        <div className="mb-5 rounded-xl bg-red-500/15 ring-1 ring-red-400/40 text-red-100 text-sm px-4 py-3">
          {authError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="identifier" className="block text-sm font-medium text-emerald-50/90 mb-1.5">
            Email ou numéro de téléphone
          </label>
          <div className="relative">
            <AtSign className="w-4.5 h-4.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-200/70 w-4 h-4" />
            <input
              id="identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className={`${inputCls} pl-10`}
              placeholder="votre@email.mg ou 034 00 000 00"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-emerald-50/90">
              Mot de passe
            </label>
            <Link
              to="/forgot-password"
              className="text-xs text-emerald-200/80 hover:text-emerald-100 font-medium"
            >
              Mot de passe oublié ?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-200/70" />
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputCls} pl-10 pr-11`}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-lg text-emerald-200/70 hover:text-white hover:bg-white/10 transition"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || isLoading}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 disabled:cursor-not-allowed text-[#04140d] font-bold py-3 text-sm transition shadow-lg shadow-emerald-500/20"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Connexion...
            </>
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              Se connecter
            </>
          )}
        </button>

        <p className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-100/60 pt-1">
          <ShieldCheck className="w-3.5 h-3.5" />
          Connexion sécurisée — vos données restent privées.
        </p>
      </form>
    </AuthShell>
  );
}
