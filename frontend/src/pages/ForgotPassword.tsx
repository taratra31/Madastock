import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AtSign, Loader2, Send } from 'lucide-react';
import api from '../lib/api';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import AuthShell from '../components/AuthShell';

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
      if (err && (err as AxiosError).response?.status === 429) {
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
    <Link to="/login" className="font-semibold text-emerald-300 hover:text-emerald-200">
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
          <p className="text-sm text-emerald-50/85">
            Si un compte existe pour <span className="font-semibold text-white">{email}</span>, un code
            vient d'être envoyé par WhatsApp ou e-mail.
          </p>
          <Link
            to="/reset-password"
            className="mt-5 w-full inline-flex items-center justify-center rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#04140d] font-bold py-3 text-sm transition"
          >
            J'ai reçu le code
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-emerald-50/90 mb-1.5">
              Email du compte
            </label>
            <div className="relative">
              <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-200/70" />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl bg-white/10 ring-1 ring-white/20 px-4 py-3 pl-10 text-sm text-white placeholder-emerald-100/40 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white/15 transition"
                placeholder="votre@email.mg"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 disabled:cursor-not-allowed text-[#04140d] font-bold py-3 text-sm transition shadow-lg shadow-emerald-500/20"
          >
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
