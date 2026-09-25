import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AtSign, Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import api from '../lib/api';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import AuthShell, {
  authIconCls,
  authInputCls,
  authLabelCls,
  authLinkCls,
  authPrimaryBtnCls,
} from '../components/AuthShell';

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

  const eyeBtnCls =
    'absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition';

  return (
    <AuthShell
      title="Nouveau mot de passe"
      subtitle="Saisissez le code reçu et choisissez un nouveau mot de passe."
      footer={
        <Link to="/forgot-password" className={authLinkCls}>
          Demander un nouveau code
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className={authLabelCls}>
            Email du compte
          </label>
          <div className="relative">
            <AtSign className={authIconCls} />
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${authInputCls} pl-10`}
              placeholder="votre@email.mg"
            />
          </div>
        </div>

        <div>
          <label htmlFor="code" className={authLabelCls}>
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
            className={`${authInputCls} text-center text-xl font-bold tracking-[0.4em] text-slate-800`}
            placeholder="000000"
          />
          <p className="text-[11px] text-slate-400 mt-1.5">
            Code non reçu ? Renseignez votre e-mail sur la page « Mot de passe oublié ».
          </p>
        </div>

        <div>
          <label htmlFor="newPassword" className={authLabelCls}>
            Nouveau mot de passe
          </label>
          <div className="relative">
            <Lock className={authIconCls} />
            <input
              id="newPassword"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={`${authInputCls} pl-10 pr-11`}
              placeholder="8 caractères minimum"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              className={eyeBtnCls}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="confirm" className={authLabelCls}>
            Confirmer le mot de passe
          </label>
          <div className="relative">
            <Lock className={authIconCls} />
            <input
              id="confirm"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={`${authInputCls} pl-10`}
              placeholder="••••••••"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || code.length !== 6 || newPassword.length < 8}
          className={authPrimaryBtnCls}
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
