import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        <div className="flex justify-center mb-4">
          <img src="/logo-madastock.png" alt="MadaStock" className="w-20 h-20 rounded-2xl object-contain border border-slate-200 p-1" />
        </div>
        <h1 className="text-2xl font-bold text-center mb-6">Mot de passe oublié</h1>

        {sent ? (
          <div className="text-center">
            <p className="text-sm text-slate-600 mb-6">
              {`Si un compte existe pour ${email}, un code de réinitialisation a été envoyé par e-mail.`}
            </p>
            <Link
              to="/reset-password"
              className="inline-block bg-green-600 hover:bg-green-700 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors"
            >
              J'ai reçu le code, réinitialiser
            </Link>
            <p className="text-center text-sm text-slate-500 mt-4">
              <Link to="/login" className="text-green-600 hover:underline font-medium">
                Retour à la connexion
              </Link>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-slate-500">
              Saisissez votre adresse e-mail : nous vous enverrons un code pour définir un nouveau mot de passe.
            </p>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="votre@email.mg"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
            >
              {submitting ? 'Envoi...' : 'Envoyer le code'}
            </button>
          </form>
        )}

        {!sent && (
          <p className="text-center text-sm text-slate-500 mt-6">
            <Link to="/login" className="text-green-600 hover:underline font-medium">
              Retour à la connexion
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}