import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

/**
 * Relit la page courante à chaque navigation. En SPA, le déclencheur
 * « page_view » de GTM ne se déclenche que sur le chargement initial ;
 * on pousse donc un événement `pageview` dans dataLayer à chaque
 * changement de route (à brancher dans GTM sur un déclencheur personnalisé
 * ou « History Change »). Ne bloque jamais en cas d'erreur.
 */
export default function GtmPageView() {
  const location = useLocation();

  useEffect(() => {
    try {
      window.dataLayer = window.dataLayer ?? [];
      window.dataLayer.push({
        event: 'pageview',
        page: location.pathname + location.search,
        title: document.title,
      });
    } catch {
      // analytique non bloquante
    }
  }, [location.pathname, location.search, location.hash]);

  return null;
}