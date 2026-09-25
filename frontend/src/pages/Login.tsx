import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AtSign, Eye, EyeOff, Loader2, Lock, LogIn, ShieldCheck } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { toast } from 'sonner';
import AuthShell, {
  authIconCls,
  authInputCls,
  authLabelCls,
  authLinkCls,
  authPrimaryBtnCls,
} from '../components/AuthShell';

/** Écriture nationale malgache : 034 12 345 67 (10 chiffres). */
function formatMgPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00261')) digits = digits.slice(5);
  else if (digits.startsWith('261') && digits.length > 10) digits = digits.slice(3);
  if (digits.length > 10) digits = digits.slice(0, 10);
  if (digits.length > 0 && !digits.startsWith('0')) digits = `0${digits}`;

  const parts: string[] = [];
  let i = 0;
  for (const size of [3, 2, 3, 2]) {
    if (i >= digits.length) break;
    parts.push(digits.slice(i, i + size));
    i += size;
  }
  if (i < digits.length) parts.push(digits.slice(i));
  return parts.join(' ');
}

export default function Login() {
  const { login, isAuthenticated, isLoading, authError } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const sessionExpired = searchParams.get('expired') === '1';
  // Dès qu'un chiffre est tapé, le champ bascule en mode numéro : le drapeau
  // et l'indicatif +261 apparaissent, l'email n'en a pas.
  const isPhone = !identifier.includes('@') && /\d/.test(identifier);

  const handleIdentifierChange = (raw: string) => {
    setIdentifier(raw.includes('@') || !/\d/.test(raw) ? raw : formatMgPhone(raw));
  };

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
      if (sessionExpired) searchParams.delete('expired');
      setSearchParams(searchParams, { replace: true });
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

  return (
    <AuthShell
      title="Connexion"
      subtitle="Un seul champ : votre email ou votre numéro de téléphone."
      footer={
        <>
          Pas encore de compte ?{' '}
          <Link to="/register" className={authLinkCls}>
            Créer un compte
          </Link>
        </>
      }
    >
      {sessionExpired && (
        <div className="mb-5 rounded-xl bg-amber-50 ring-1 ring-amber-200 text-amber-800 text-sm px-4 py-3">
          Votre session a expiré. Merci de vous reconnecter.
        </div>
      )}

      {authError && (
        <div className="mb-5 rounded-xl bg-red-50 ring-1 ring-red-200 text-red-700 text-sm px-4 py-3">
          {authError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="identifier" className={authLabelCls}>
            Email ou numéro de téléphone
          </label>
          <div className="relative">
            {isPhone ? (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pr-2.5 border-r border-emerald-200 select-none pointer-events-none">
                <span className="text-lg leading-none" role="img" aria-label="Madagascar">
                  🇲🇬
                </span>
                <span className="text-sm font-semibold text-slate-700">+261</span>
              </span>
            ) : (
              <AtSign className={authIconCls} />
            )}
            <input
              id="identifier"
              name="identifier"
              type="text"
              inputMode={isPhone ? 'tel' : 'email'}
              autoComplete="username"
              required
              value={identifier}
              onChange={(e) => handleIdentifierChange(e.target.value)}
              className={`${authInputCls} ${isPhone ? 'pl-[5.25rem]' : 'pl-10'}`}
              placeholder={isPhone ? '034 00 000 00' : 'votre@email.mg ou 034 00 000 00'}
            />
          </div>
          {isPhone && (
            <p className="mt-1.5 text-[11px] text-slate-400">
              Madagascar 🇲🇬 — tapez les 10 chiffres (ex. 034 12 345 67).
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className={authLabelCls.replace('mb-1.5', '')}>
              Mot de passe
            </label>
            <Link to="/forgot-password" className="text-xs font-medium text-emerald-700 hover:text-emerald-600">
              Mot de passe oublié ?
            </Link>
          </div>
          <div className="relative">
            <Lock className={authIconCls} />
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${authInputCls} pl-10 pr-11`}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button type="submit" disabled={submitting || isLoading} className={authPrimaryBtnCls}>
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

        <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 pt-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600/70" />
          Connexion sécurisée — vos données restent privées.
        </p>
      </form>
    </AuthShell>
  );
}
