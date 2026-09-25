import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Mail, MapPin, Phone, Clock, BellRing } from 'lucide-react';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navLink = 'text-slate-600 hover:text-slate-900 font-medium text-sm transition-colors';

  const links: [string, string, boolean][] = [
    ['Fonctionnalités', '/#fonctionnalites', false],
    ['Comment ça marche', '/#comment', false],
    ['Tarifs', '/pricing', true],
    ['Témoignages', '/#temoignages', false],
    ['FAQ', '/faq', true],
  ];

  return (
    <div className="bg-white font-sans min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shadow-sm">
                <img src="/logo-madastock.png" alt="MadaStock" className="w-full h-full object-contain" />
              </span>
              <span className="text-xl font-bold tracking-tight text-dark-900">
                Mada<span className="text-green-600">Stock</span>
              </span>
            </Link>

            <nav className="hidden lg:flex items-center gap-8">
              {links.map(([label, href, isRoute]) =>
                isRoute ? (
                  <Link key={label} to={href} className={navLink}>
                    {label}
                  </Link>
                ) : (
                  <a key={label} href={href} className={navLink}>
                    {label}
                  </a>
                )
              )}
            </nav>

            <div className="hidden lg:flex items-center gap-3">
              <Link to="/login" className="text-sm font-medium text-slate-700 hover:text-dark-900 px-4 py-2 rounded-lg transition-colors">
                Se connecter
              </Link>
              <Link
                to="/register"
                className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg shadow-sm shadow-green-500/30 transition-colors"
              >
                Créer un compte
              </Link>
            </div>

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Menu"
            >
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="lg:hidden border-t border-slate-100 bg-white px-4 py-4 space-y-1">
            {links.map(([label, href, isRoute]) =>
              isRoute ? (
                <Link
                  key={label}
                  to={href}
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
                >
                  {label}
                </Link>
              ) : (
                <a
                  key={label}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
                >
                  {label}
                </a>
              )
            )}
            <div className="pt-2 flex flex-col gap-2">
              <Link
                to="/login"
                className="text-center text-sm font-medium text-slate-700 border border-slate-200 px-4 py-2.5 rounded-lg"
              >
                Se connecter
              </Link>
              <Link
                to="/register"
                className="text-center bg-green-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg"
              >
                Créer un compte
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-dark-900 text-slate-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid gap-10 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden">
                <img src="/logo-madastock.png" alt="MadaStock" className="w-full h-full object-contain" />
              </span>
              <span className="text-xl font-bold tracking-tight text-white">
                Mada<span className="text-green-500">Stock</span>
              </span>
            </div>
            <p className="mt-4 text-sm text-slate-400 leading-relaxed">
              La solution de gestion de boutique 100% malgache, pensée pour les commerçants de l’île.
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm">Produit</h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><a href="/#fonctionnalites" className="hover:text-white transition-colors">Fonctionnalités</a></li>
              <li><Link to="/pricing" className="hover:text-white transition-colors">Tarifs</Link></li>
              <li><a href="/#comment" className="hover:text-white transition-colors">Comment ça marche</a></li>
              <li><Link to="/faq" className="hover:text-white transition-colors">FAQ</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm">Entreprise</h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><a href="mailto:madaorganisation@gmail.com" className="hover:text-white transition-colors">Nous contacter</a></li>
              <li><Link to="/register" className="hover:text-white transition-colors">Créer un compte</Link></li>
              <li><Link to="/login" className="hover:text-white transition-colors">Se connecter</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm">Contact</h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-green-500" />
                +261 32 63 21 784
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-green-500" />
                madaorganisation@gmail.com
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-green-500" />
                Antananarivo, Madagascar
              </li>
              <li className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-green-500" />
                Lun – Sam : 8h – 18h
              </li>
              <li className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-green-500" />
                WhatsApp & e-mail
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-dark-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-500">
            <p>© {new Date().getFullYear()} MadaStock. Tous droits réservés.</p>
            <p>Fait avec passion à Madagascar · v1.0</p>
          </div>
        </div>
      </footer>
    </div>
  );
}