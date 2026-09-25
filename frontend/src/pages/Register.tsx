import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AtSign, Eye, EyeOff, Loader2, Lock, Phone, UserPlus, User } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { toast } from 'sonner';
import AuthShell from '../components/AuthShell';

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
    setSubmitting(true);
    try {
      const result = await register({ email, password, fullName, phone: phone || undefined });
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

  const inputCls =
    'w-full rounded-xl bg-white/10 ring-1 ring-white/20 px-4 py-3 text-sm text-white placeholder-emerald-100/40 ' +
    'focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white/15 transition';
  const iconCls = 'absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-200/70';

  return (
    <AuthShell
      title="Créer un compte"
      subtitle="Un seul compte par email et par numéro de téléphone."
      footer={
        <>
          Déjà un compte ?{' '}
          <Link to="/login" className="font-semibold text-emerald-300 hover:text-emerald-200">
            Se connecter
          </Link>
        </>
      }
    >
      {authError && (
        <div className="mb-5 rounded-xl bg-red-500/15 ring-1 ring-red-400/40 text-red-100 text-sm px-4 py-3">
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
          <label htmlFor="fullName" className="block text-sm font-medium text-emerald-50/90 mb-1.5">
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
          <label htmlFor="email" className="block text-sm font-medium text-emerald-50/90 mb-1.5">
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
          <label htmlFor="phone" className="block text-sm font-medium text-emerald-50/90 mb-1.5">
            Téléphone <span className="text-emerald-100/60 font-normal">(WhatsApp, OTP)</span>
          </label>
          <div className="relative">
            <Phone className={iconCls} />
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={`${inputCls} pl-10`}
              placeholder="034 00 000 00"
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-emerald-50/90 mb-1.5">
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
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-lg text-emerald-200/70 hover:text-white hover:bg-white/10 transition"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-emerald-50/90 mb-1.5"
          >
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
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 disabled:cursor-not-allowed text-[#04140d] font-bold py-3 text-sm transition shadow-lg shadow-emerald-500/20"
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
