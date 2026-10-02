/**
 * Prefixe des pages reservees (inscription + espace de gestion).
 *
 * Pourquoi : les URL `/register` et `/dashboard` se devinent toutes seules et
 * finissent dans les logs, les signets, les historiques et les scanners. La
 * cle vient de la variable d'environnement `VITE_APP_KEY` (**jamais** du code
 * ni du depot, qui est public), donc `git clone` ne revele rien.
 *
 * Deux precautions :
 * - la cle est lue au build (Vite la substitue dans le bundle) ; sans elle,
 *   l'application retombe sur les chemins historiques et fonctionne normalement ;
 * - `VITE_APP_KEY` n'est pas un mot de passe : c'est de l'obscurcissement.
 *   La securite reelle reste assuree par le serveur (plafond de tentatives,
 *   verification email obligatoire, JWT).
 */
const raw = (import.meta.env.VITE_APP_KEY ?? '').trim().replace(/^\/+|\/+$/g, '');

/** Prefixe normalise, par exemple `/k7m4x9q2`. Vide si aucune cle n'est definie. */
export const APP_KEY = raw;

/** `true` si l'URL courante est dans l'espace reserve. */
export function isInPrivateArea(pathname: string = window.location.pathname): boolean {
  if (!APP_KEY) return false;
  return pathname === `/${APP_KEY}` || pathname.startsWith(`/${APP_KEY}/`);
}

/**
 * Chemin complet d'une page reservee, a utiliser pour les liens qui
 * traversent la frontiere public -> prive (CTA du landing, redirection apres
 * connexion). Le rechargement complet qu'implique `location.assign` est
 * volontaire : le `basename` du routeur est fige au demarrage, un simple
 * `navigate()` resterait dans le mauvais routeur.
 */
export function appUrl(path: string): string {
  return APP_KEY ? `/${APP_KEY}${path}` : path;
}

/** Redirection hors du routeur : force le rechargement et le bon basename. */
export function goToApp(path: string): void {
  window.location.assign(appUrl(path));
}