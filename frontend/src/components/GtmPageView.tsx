import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Relit la page courante à chaque navigation.
 * - SPA : le déclencheur « page_view » de GTM/GA4 ne part que sur le
 *   chargement initial ; on envoie donc un événement `page_view` à gtag et
 *   un événement `pageview` dans dataLayer à chaque changement de route.
 * Ne bloque jamais en cas d'erreur.
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
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'page_view', {
          page_path: location.pathname + location.search,
          page_title: document.title,
        });
      }
    } catch {
      // analytique non bloquante
    }
  }, [location.pathname, location.search, location.hash]);

  return null;
}