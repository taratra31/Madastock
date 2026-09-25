import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AtSign, Eye, EyeOff, Loader2, Lock, User, UserPlus } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { toast } from 'sonner';
import AuthShell, {
  authIconCls as iconCls,
  authInputCls as inputCls,
  authLabelCls,
  authLinkCls,
  authPrimaryBtnCls,
} from '../components/AuthShell';
import FlagMG from '../components/FlagMG';

const MADAGASCAR_PHONE_PATTERN = /^(32|33|34|35|37|38)\d{7}$/;

function normalizeNationalPhone(value: string): string {
  const compact = value.trim().replace(/[\s.-]/g, '');
  const hasCountryCode = compact.startsWith('+') || compact.startsWith('00');
  const isMadagascarCode = compact.startsWith('+261') || compact.startsWith('00261');

  if (hasCountryCode && !isMadagascarCode) return '';

  let digits = compact.replace(/\D/g, '');
  if (digits.startsWith('00261')) digits = digits.slice(5);
  else if (digits.startsWith('261')) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 9);
}

export default function Register() {
  const { register, isAuthenticated, isLoading, authError } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }
    if (phone && !MADAGASCAR_PHONE_PATTERN.test(phone)) {
      toast.error('Le numéro doit commencer par 32, 33, 34, 35, 37 ou 38 et contenir 9 chiffres');
      return;
    }
    setSubmitting(true);
    try {
      const result = await register({
        email,
        password,
        fullName,
        phone: phone ? `+261${phone}` : undefined,
      });
      if (result.requiresVerification) {
        toast.success('Compte créé. Le code de vérification arrive.');
        navigate('/verify-email', { replace: true });
        return;
      }
      toast.success('Compte créé avec succès');
    } catch {
      toast.error(authError ?? "Erreur lors de l'inscription");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Créer un compte"
      subtitle="Un seul compte par email et par numéro de téléphone."
      footer={
        <>
          Déjà un compte ?{' '}
          <Link to="/login" className={authLinkCls}>
            Se connecter
          </Link>
        </>
      }
    >
      {authError && (
        <div className="mb-5 rounded-xl bg-red-50 ring-1 ring-red-200 text-red-700 text-sm px-4 py-3">
          {authError}{' '}
          {/existe déjà/i.test(authError) && (
            <Link to="/login" className="font-semibold underline">
              Se connecter
            </Link>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="fullName" className={authLabelCls}>
            Nom complet
          </label>
          <div className="relative">
            <User className={iconCls} />
            <input
              id="fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={`${inputCls} pl-10`}
              placeholder="Jean Ravelonarivo"
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className={authLabelCls}>
            Email
          </label>
          <div className="relative">
            <AtSign className={iconCls} />
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${inputCls} pl-10`}
              placeholder="votre@email.mg"
            />
          </div>
        </div>

        <div>
          <label htmlFor="phone" className={authLabelCls}>
            Téléphone <span className="text-slate-400 font-normal">(WhatsApp, OTP)</span>
          </label>
          <div
            className="flex overflow-hidden rounded-xl bg-white ring-1 ring-emerald-200 shadow-sm transition focus-within:ring-2 focus-within:ring-emerald-500"
            style={{ colorScheme: 'light' }}
          >
            <div className="flex shrink-0 items-center gap-2 border-r border-emerald-100 bg-white px-3.5 text-sm font-semibold text-slate-800">
              <FlagMG className="h-3 w-[1.15rem]" />
              <span>+261</span>
            </div>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={9}
              pattern="(32|33|34|35|37|38)[0-9]{7}"
              value={phone}
              onChange={(e) => setPhone(normalizeNationalPhone(e.target.value))}
              className="min-w-0 flex-1 bg-white px-4 py-3 text-sm text-slate-800 outline-none placeholder-slate-400 focus:bg-white focus:ring-0"
              placeholder="34 00 000 00"
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className={authLabelCls}>
            Mot de passe
          </label>
          <div className="relative">
            <Lock className={iconCls} />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputCls} pl-10 pr-11`}
              placeholder="Min. 8 caractères"
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

        <div>
          <label htmlFor="confirmPassword" className={authLabelCls}>
            Confirmer le mot de passe
          </label>
          <div className="relative">
            <Lock className={iconCls} />
            <input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`${inputCls} pl-10`}
              placeholder="Retapez le mot de passe"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || isLoading}
          className={authPrimaryBtnCls}
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Création...
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4" />
              Créer mon compte
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
}
