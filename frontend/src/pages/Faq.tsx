import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, HelpCircle, ArrowRight } from 'lucide-react';
import MarketingLayout from '../layouts/MarketingLayout';
import { faqs } from '../lib/content';

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <MarketingLayout>
      <section className="bg-gradient-to-b from-slate-50 via-white to-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-8 text-center">
          <span className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full">
            <HelpCircle className="w-3.5 h-3.5" />
            Aide & questions
          </span>
          <h1 className="mt-5 text-4xl md:text-5xl font-bold tracking-tight text-dark-900">
            Questions fréquentes
          </h1>
          <p className="mt-4 text-slate-500 text-lg">
            Tout ce qu’il faut savoir avant de démarrer avec MadaStock.
          </p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="space-y-3">
          {faqs.map((f, i) => (
            <div key={f.question} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
              >
                <span className="font-semibold text-dark-900 text-[15px]">{f.question}</span>
                <ChevronDown
                  className={`w-4.5 h-4.5 text-slate-400 shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`}
                  style={{ width: 18, height: 18 }}
                />
              </button>
              {open === i && (
                <div className="px-5 pb-5 -mt-1 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                  {f.answer}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl bg-dark-900 text-white p-8 text-center">
          <h2 className="text-2xl font-bold">Pas trouvé votre réponse ?</h2>
          <p className="mt-2 text-slate-400 text-sm">
            Écrivez-nous, notre équipe locale vous répond rapidement par WhatsApp ou e-mail.
          </p>
          <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-100 text-dark-900 font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              Démarrer gratuitement
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="mailto:madaorganisation@gmail.com"
              className="inline-flex items-center justify-center gap-2 border border-white/40 hover:bg-white/10 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              Contacter l’équipe
            </a>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}