import type { ReactNode } from 'react';

const HIGHLIGHTS = [
  { title: 'Ventes & caisse', text: 'Encaissez en quelques secondes, même hors ligne.' },
  { title: 'Stock & produits', text: 'Entrées, sorties, alertes de seuil, multi-dépôts.' },
  { title: 'Clients & factures', text: 'Suivi des clients, devis, factures et rapports.' },
];

/** Classes partagées par les pages d'authentification (thème blanc & vert). */
export const authInputCls =
  'w-full rounded-xl bg-white ring-1 ring-emerald-200 px-4 py-3 text-sm text-slate-800 ' +
  'placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ' +
  'focus:bg-white transition';

export const authLabelCls = 'block text-sm font-medium text-slate-700 mb-1.5';

export const authPrimaryBtnCls =
  'w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 ' +
  'disabled:bg-emerald-300 disabled:cursor-not-allowed text-white font-semibold py-3 text-sm transition ' +
  'shadow-lg shadow-emerald-600/20';

export const authIconCls = 'absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600/70';

export const authLinkCls = 'font-semibold text-emerald-700 hover:text-emerald-600';

export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen relative overflow-hidden bg-emerald-50/40 text-slate-800">
      {/* Fond clair : halos verts et grille discrète */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(900px 520px at 8% -10%, #d1fae5 0%, transparent 60%),' +
            'radial-gradient(800px 520px at 95% 5%, #ccfbf1 0%, transparent 58%),' +
            'radial-gradient(900px 600px at 50% 108%, #ecfdf5 0%, transparent 62%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(16,185,129,.12) 1px, transparent 1px),' +
            'linear-gradient(to bottom, rgba(16,185,129,.12) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
          maskImage: 'radial-gradient(circle at 50% 28%, black, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(circle at 50% 28%, black, transparent 80%)',
        }}
      />
      <div className="absolute -left-20 top-1/4 w-72 h-72 rounded-full bg-emerald-300/30 blur-3xl" />
      <div className="absolute -right-16 bottom-0 w-80 h-80 rounded-full bg-teal-200/40 blur-3xl" />

      <div className="relative min-h-screen px-4 py-8 sm:py-12 flex items-center justify-center">
        <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 lg:gap-10 items-stretch">
          {/* Panneau marque (écrans larges) */}
          <div className="hidden lg:flex flex-col justify-between rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 p-8 text-white shadow-xl shadow-emerald-700/20">
            <div>
              <div className="inline-flex items-center gap-3">
                <img
                  src="/logo-madastock.png"
                  alt="MadaStock"
                  className="w-14 h-14 rounded-2xl object-contain bg-white p-1 shadow-lg"
                />
                <span className="text-2xl font-bold tracking-tight">
                  Mada<span className="text-emerald-200">Stock</span>
                </span>
              </div>
              <h2 className="mt-8 text-4xl font-bold leading-tight">
                Gérez votre boutique
                <br />
                <span className="text-emerald-200">depuis votre téléphone.</span>
              </h2>
              <p className="mt-4 text-emerald-50/90 max-w-md">
                Le logiciel de gestion pour les commerçants à Madagascar et en Afrique : stock, ventes,
                factures et rapports au même endroit.
              </p>
            </div>

            <ul className="mt-8 space-y-3">
              {HIGHLIGHTS.map((h) => (
                <li
                  key={h.title}
                  className="flex items-start gap-3 rounded-2xl bg-white/10 ring-1 ring-white/20 px-4 py-3"
                >
                  <span className="mt-0.5 w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 text-white" fill="currentColor">
                      <path d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 111.4-1.4l3.8 3.8 6.8-6.8a1 1 0 011.4 0z" />
                    </svg>
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{h.title}</span>
                    <span className="block text-xs text-emerald-50/80">{h.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Carte blanche */}
          <div className="w-full flex flex-col justify-center">
            <div className="lg:hidden flex flex-col items-center mb-6">
              <img
                src="/logo-madastock.png"
                alt="MadaStock"
                className="w-16 h-16 rounded-2xl object-contain bg-white ring-1 ring-emerald-100 p-1 shadow-lg"
              />
              <span className="mt-2 text-xl font-bold tracking-tight text-slate-800">
                Mada<span className="text-emerald-600">Stock</span>
              </span>
            </div>

            <div className="rounded-3xl bg-white ring-1 ring-emerald-100 shadow-xl shadow-emerald-900/5 p-6 sm:p-8">
              <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
              {subtitle && <div className="mt-1.5 text-sm text-slate-500">{subtitle}</div>}
              <div className="mt-6">{children}</div>
            </div>

            {footer && <div className="mt-5 text-center text-sm text-slate-500">{footer}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
