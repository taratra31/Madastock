import { env } from '../config/env';
import { serviceUnavailable } from '../utils/httpError';

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Connaissance de l'application injectée dans le prompt système. */
// Liste triée : nom du menu -> description + route.
const MODULES = [
  ['Tableau de bord', '/dashboard', 'Vue d\'ensemble : ventes du jour, du mois, produits en stock faible, encaissements.'],
  ['Produits', '/products', 'Catalogue des produits : prix de vente, coût, seuil de stock bas (alerte).'],
  ['Catégories', '/categories', 'Classer les produits par catégorie.'],
  ['Stock', '/stock', 'Entrées/sorties, mouvements par dépôt, quantité par produit.'],
  ['Ventes', '/sales', 'Vendre, encaisser, tickets de caisse, paiement mobile.'],
  ['Clients', '/customers', 'Fiche clients, dette (à encaisser), historique.'],
  ['Factures', '/invoices', 'Devis et factures PDF, encaissements partiels, relances.'],
  ['Fournisseurs', '/suppliers', 'Fiches fournisseurs et achats associés.'],
  ['Achats', '/purchases', 'Bon de commande fournisseur et réception de stock.'],
  ['Dépenses', '/expenses', 'Charges du magasin (loyer, eau, transport…) hors achats.'],
  ['Marques', '/brands', 'Marques des produits.'],
  ['Caisse', '/cash', 'Ouverture/fermeture de caisse, pointage, écarts.'],
  ['Reminders', '/reminders', 'Alertes clients programmées (rappel, anniversaire, suivi véhicule).'],
  ['Notifications', '/notifications', 'Alertes du système (stock bas, abonnement, événements).'],
  ['Abonnement', '/billing', 'Formules, paiement, historique des commandes.'],
  ['Paramètres', '/settings', 'Infos boutique, adresse, devise, dépôts, équipe.'],
] as [string, string, string][];

const GUIDE_MAIN_TEXT = `Tu es l'assistant de MadaStock, un logiciel de gestion de boutique 100% malgache : ventes, stock, clients, factures, tâches véhicules, caisse.

Modules disponibles (nom du menu → adresse → utilité) :
${MODULES.map(([name, path, use]) => `- ${name} (${path}) : ${use}`).join('\n')}

Consignes :
- Réponds dans la langue de l'utilisateur (généralement français ou malgache).
- Réponds court et concret : dis précisément quels boutons/menus cliquer.
- Si la question ne parle pas de MadaStock, recentre poliment.
- Tu peux donner le chemin (ex. « va dans Stock ») à partir de la liste ci-dessus.`;

const GENERATE_PROMPTS: Record<string, { system: string; user: (context: Record<string, unknown>) => string }> = {
  productDescription: {
    system:
      "Tu es un rédacteur marketing pour un magasin à Madagascar. Écris une description produit courte et vendeuse en français (2 à 3 phrases), sans emoji ni tableau.",
    user: (context: Record<string, unknown>) =>
      `Produit : ${context.name ?? '-'}\nCatégorie : ${context.category ?? '-'}\nMarque : ${context.brand ?? '-'}\nPrix : ${context.priceAr ?? '-'} Ar${context.sellingPoints ? `\nPoints forts : ${context.sellingPoints}` : ''}`,
  },
  customerMessage: {
    system:
      "Tu es un assistant pour un commerçant malgache. Rédige un message court, poli et professionnel en français pour un client. Pas d'emoji.",
    user: (context: Record<string, unknown>) =>
      `But du message : ${context.purpose ?? 'contact client'}\nClient : ${context.customerName ?? '-'}\nBoutique : ${context.storeName ?? 'notre boutique'}`,
  },
  reminder: {
    system:
      "Tu es un assistant pour un garage / une boutique à Madagascar. Rédige un message de rappel court et cordial en français pour un client.",
    user: (context: Record<string, unknown>) =>
      `Rappel : ${context.type ?? 'rendez-vous'}\nClient : ${context.customerName ?? '-'}\nDate : ${context.date ?? '-'}${context.vehicle ? `\nVéhicule : ${context.vehicle}` : ''}`,
  },
};

export function isAiConfigured(): boolean {
  return Boolean(env.GEMINI_API_KEY);
}

async function geminiGenerateText(
  system: string,
  messages: ChatMessage[],
  maxTokens = 900
): Promise<string> {
  if (!env.GEMINI_API_KEY) {
    throw serviceUnavailable("L'assistant IA n'est pas configuré (GEMINI_API_KEY manquante).");
  }

  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const res = await fetch(
    `${GEMINI_API}/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: system }] },
        generationConfig: { temperature: 0.5, maxOutputTokens: maxTokens },
      }),
    }
  );

  if (!res.ok) {
    throw serviceUnavailable(`Le service IA est indisponible (${res.status}).`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text) {
    throw serviceUnavailable("L'IA n'a retourné aucun texte.");
  }
  return text.trim();
}

export async function chat(opts: {
  storeName: string;
  planName: string | null;
  messages: ChatMessage[];
}): Promise<string> {
  const system = `${GUIDE_MAIN_TEXT}\n\nContexte boutique : ${opts.storeName}${
    opts.planName ? ` (formule ${opts.planName})` : ''
  }.`;
  // Garder un historique raisonnable pour limiter le coût.
  const history = opts.messages.slice(-12);
  return geminiGenerateText(system, history, 900);
}

export async function generate(opts: {
  kind: string;
  context: Record<string, unknown>;
}): Promise<string> {
  const prompt = GENERATE_PROMPTS[opts.kind];
  if (!prompt) {
    throw new Error(`Type de génération inconnu : ${opts.kind}`);
  }
  const system = prompt.system;
  const userMessage: ChatMessage = { role: 'user', content: prompt.user(opts.context) };
  return geminiGenerateText(system, [userMessage], 600);
}

export { GEMINI_API };