/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Prefixe des pages réservées (inscription + espace de gestion).
   * Défini uniquement dans les variables d'environnement du build : jamais dans
   * le code, puisque le dépôt est public.
   */
  readonly VITE_APP_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}