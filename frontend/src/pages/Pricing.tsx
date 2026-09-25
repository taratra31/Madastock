import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import api from '../lib/api';
import MarketingLayout from '../layouts/MarketingLayout';
import { enterpriseCard, planToCard, type PriceCard, type PublicPlan } from '../lib/plans';

export default function Pricing() {
  const [cards, setCards] = useState<PriceCard[]>([enterpriseCard]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<PublicPlan[]>('/public/plans')
      .then((res) => {
        const plans = res.data;
        const firstPaid = plans.find((p) => Number(p.priceAr) > 0);
        setCards([...plans.map((p) => planToCard(p, p.id === firstPaid?.id)), enterpriseCard]);
      })
      .catch(() => setCards([enterpriseCard]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <MarketingLayout>
      <section className="bg-gradient-to-b from-slate-50 via-white to-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-8 text-center">
          <span className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full">
            Tarifs simples et clairs
          </span>
          <h1 className="mt-5 text-4xl md:text-5xl font-bold tracking-tight text-dark-900">
            Choisissez votre offre
          </h1>
          <p className="mt-4 text-slate-500 text-lg">
            Commencez gratuitement, évoluez quand vous voulez. Sans engagement.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {loading
            ? [0, 1, 2].map((i) => (
                <div key={i} className="rounded-2xl border border-slate-200 bg-white p-6 animate-pulse h-96" />
              ))
            : cards.map((c) => (
                <div
                  key={c.key}
                  className={`relative rounded-2xl border bg-white p-6 flex flex-col transition-shadow ${
                    c.highlighted
                      ? 'border-green-500 shadow-xl shadow-green-500/10 ring-1 ring-green-500'
                      : 'border-slate-200 shadow-sm hover:shadow-md'
                  }`}
                >
                  {c.highlighted && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white text-[11px] font-bold px-3 py-1 rounded-full">
                      Recommandé
                    </span>
                  )}
                  <h3 className="text-lg font-bold text-dark-900">{c.name}</h3>
                  <div className="mt-3 flex items-baseline gap-1.5">
                    <span className="text-3xl font-extrabold text-dark-900">{c.price}</span>
                    <span className="text-sm text-slate-500">{c.period}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">{c.description}</p>

                  <ul className="mt-5 space-y-2.5 flex-1">
                    {c.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link
                    to={c.ctaHref.startsWith('/') ? c.ctaHref : `/register?plan=${c.key}`}
                    className={
                      c.highlighted
                        ? 'mt-6 inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-3 rounded-xl transition-colors'
                        : 'mt-6 inline-flex items-center justify-center gap-2 border border-slate-200 hover:border-slate-300 text-dark-900 font-semibold px-5 py-3 rounded-xl transition-colors'
                    }
                    {...(c.ctaHref.startsWith('mailto:') ? { as: 'a', href: c.ctaHref } : {})}
                  >
                    {c.cta}
                    {!c.ctaHref.startsWith('mailto:') && <ArrowRight className="w-4 h-4" />}
                  </Link>
                </div>
              ))}
        </div>

        <div className="mt-12 rounded-2xl bg-dark-900 text-white p-8 text-center">
          <h2 className="text-2xl font-bold">Prêt à lancer votre boutique ?</h2>
          <p className="mt-2 text-slate-400 text-sm max-w-xl mx-auto">
            Créez votre compte en moins d’une minute et commencez à encaisser dès aujourd’hui.
          </p>
          <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-100 text-dark-900 font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              Créer mon compte
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/faq"
              className="inline-flex items-center justify-center gap-2 border border-white/40 hover:bg-white/10 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              Lire la FAQ
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}