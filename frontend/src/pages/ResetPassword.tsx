import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AtSign, Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import api from '../lib/api';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import AuthShell from '../components/AuthShell';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirm) {
      toast.error('Les deux mots de passe ne correspondent pas');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/auth/reset-password', { email, code, newPassword });
      toast.success('Mot de passe réinitialisé. Connectez-vous !');
      navigate('/login', { replace: true });
    } catch (err) {
      const msg = (err as AxiosError<{ error: string }>).response?.data?.error;
      toast.error(msg ?? 'Code invalide ou expiré');
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
      title="Nouveau mot de passe"
      subtitle="Saisissez le code reçu et choisissez un nouveau mot de passe."
      footer={
        <Link to="/forgot-password" className="font-semibold text-emerald-300 hover:text-emerald-200">
          Demander un nouveau code
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-emerald-50/90 mb-1.5">
            Email du compte
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
          <label htmlFor="code" className="block text-sm font-medium text-emerald-50/90 mb-1.5">
            Code de réinitialisation
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
            className={`${inputCls} text-center text-xl font-bold tracking-[0.4em]`}
            placeholder="000000"
          />
          <p className="text-[11px] text-emerald-100/60 mt-1.5">
            Code non reçu ? Renseignez votre e-mail sur la page « Mot de passe oublié ».
          </p>
        </div>

        <div>
          <label htmlFor="newPassword" className="block text-sm font-medium text-emerald-50/90 mb-1.5">
            Nouveau mot de passe
          </label>
          <div className="relative">
            <Lock className={iconCls} />
            <input
              id="newPassword"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={`${inputCls} pl-10 pr-11`}
              placeholder="8 caractères minimum"
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
          <label htmlFor="confirm" className="block text-sm font-medium text-emerald-50/90 mb-1.5">
            Confirmer le mot de passe
          </label>
          <div className="relative">
            <Lock className={iconCls} />
            <input
              id="confirm"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={`${inputCls} pl-10`}
              placeholder="••••••••"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || code.length !== 6 || newPassword.length < 8}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 disabled:cursor-not-allowed text-[#04140d] font-bold py-3 text-sm transition shadow-lg shadow-emerald-500/20"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Réinitialisation...
            </>
          ) : (
            'Réinitialiser le mot de passe'
          )}
        </button>
      </form>
    </AuthShell>
  );
}
