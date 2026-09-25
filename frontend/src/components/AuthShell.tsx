import type { ReactNode } from 'react';

const HIGHLIGHTS = [
  { title: 'Ventes & caisse', text: 'Encaissez en quelques secondes, même hors ligne.' },
  { title: 'Stock & produits', text: 'Entrées, sorties, alertes de seuil, multi-dépôts.' },
  { title: 'Clients & factures', text: 'Suivi des clients, devis, factures et rapports.' },
];

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
    <div className="min-h-screen relative overflow-hidden bg-[#04140d] text-white">
      {/* Fond : dégradés, halos et grille discrète */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(1100px 620px at 12% -10%, #10b981 0%, transparent 55%),' +
            'radial-gradient(900px 620px at 92% 8%, #0ea5e9 0%, transparent 52%),' +
            'radial-gradient(1000px 700px at 50% 110%, #065f46 0%, transparent 60%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,.25) 1px, transparent 1px),' +
            'linear-gradient(to bottom, rgba(255,255,255,.25) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(circle at 50% 30%, black, transparent 78%)',
          WebkitMaskImage: 'radial-gradient(circle at 50% 30%, black, transparent 78%)',
        }}
      />
      <div className="absolute -left-24 top-1/3 w-72 h-72 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="absolute -right-20 bottom-0 w-80 h-80 rounded-full bg-sky-500/20 blur-3xl" />

      <div className="relative min-h-screen px-4 py-8 sm:py-12 flex items-center justify-center">
        <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 lg:gap-14 items-center">
          {/* Colonne marque (écrans larges) */}
          <div className="hidden lg:block">
            <div className="inline-flex items-center gap-3">
              <img
                src="/logo-madastock.png"
                alt="MadaStock"
                className="w-14 h-14 rounded-2xl object-contain bg-white/95 p-1 shadow-xl"
              />
              <span className="text-2xl font-bold tracking-tight">
                Mada<span className="text-emerald-400">Stock</span>
              </span>
            </div>
            <h2 className="mt-8 text-4xl font-bold leading-tight">
              Gérez votre boutique
              <br />
              <span className="text-emerald-400">depuis votre téléphone.</span>
            </h2>
            <p className="mt-4 text-emerald-50/80 max-w-md">
              Le logiciel de gestion pour les commerçants à Madagascar et en Afrique : stock, ventes,
              factures et rapports au même endroit.
            </p>
            <ul className="mt-8 space-y-3">
              {HIGHLIGHTS.map((h) => (
                <li key={h.title} className="flex items-start gap-3">
                  <span className="mt-0.5 w-6 h-6 rounded-lg bg-emerald-400/20 ring-1 ring-emerald-300/40 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 text-emerald-300" fill="currentColor">
                      <path d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 111.4-1.4l3.8 3.8 6.8-6.8a1 1 0 011.4 0z" />
                    </svg>
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{h.title}</span>
                    <span className="block text-xs text-emerald-100/70">{h.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Carte */}
          <div className="w-full">
            <div className="lg:hidden flex flex-col items-center mb-6">
              <img
                src="/logo-madastock.png"
                alt="MadaStock"
                className="w-16 h-16 rounded-2xl object-contain bg-white/95 p-1 shadow-xl"
              />
              <span className="mt-2 text-xl font-bold tracking-tight">
                Mada<span className="text-emerald-400">Stock</span>
              </span>
            </div>

            <div className="rounded-3xl bg-white/[0.08] backdrop-blur-xl ring-1 ring-white/20 shadow-2xl shadow-black/40 p-6 sm:p-8">
              <h1 className="text-2xl font-bold">{title}</h1>
              {subtitle && <p className="mt-1.5 text-sm text-emerald-50/75">{subtitle}</p>}
              <div className="mt-6">{children}</div>
            </div>

            {footer && <div className="mt-5 text-center text-sm text-emerald-50/75">{footer}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
