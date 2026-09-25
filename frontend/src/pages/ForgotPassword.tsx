import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AtSign, Loader2, Send } from 'lucide-react';
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

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      const msg = (err as AxiosError<{ error: string }>).response?.data?.error;
      if ((err as AxiosError).response?.status === 429) {
        toast.error('Veuillez patienter avant de demander un nouveau code');
      } else if (msg) {
        toast.error(msg);
      } else {
        toast.error("Impossible d'envoyer le code de réinitialisation");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const backToLogin = (
    <Link to="/login" className={authLinkCls}>
      Retour à la connexion
    </Link>
  );

  return (
    <AuthShell
      title="Mot de passe oublié"
      subtitle="Nous vous envoyons un code pour en choisir un nouveau."
      footer={sent ? backToLogin : undefined}
    >
      {sent ? (
        <div className="text-center">
          <p className="text-sm text-slate-600">
            Si un compte existe pour <span className="font-semibold text-slate-800">{email}</span>, un code
            vient d'être envoyé par WhatsApp ou e-mail.
          </p>
          <Link to="/reset-password" className={`${authPrimaryBtnCls} mt-5`}>
            J'ai reçu le code
          </Link>
        </div>
      ) : (
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

          <button type="submit" disabled={submitting} className={authPrimaryBtnCls}>
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Envoi...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Envoyer le code
              </>
            )}
          </button>
        </form>
      )}

      {!sent && <div className="mt-5 text-center text-sm">{backToLogin}</div>}
    </AuthShell>
  );
}
