import { env } from '../config/env';
import { badGateway, badRequest, HttpError } from '../utils/httpError';

export type AriariStatus = 'PENDING' | 'INCOMPLETE' | 'PAID' | 'FAILED';

export interface AriariPart {
  id: string;
  amount: number;
  transactionId?: string;
  date?: string;
}

export interface AriariPaymentData {
  id: string;
  amount: number;
  rest: number;
  status: AriariStatus;
  url: string;
  parts: AriariPart[];
  name: string | null;
  imgUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

function pickId(obj: Record<string, unknown>): string | null {
  for (const key of ['id', '_id', 'paymentId']) {
    const value = obj[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}

/** Normalise un statut Ariari (accepte aussi bien des valeurs minuscules que majuscules). */
export function normalizeAriariStatus(status: unknown): AriariStatus {
  const s = String(status ?? '').toUpperCase();
  if (s === 'PAID' || s === 'FAILED' || s === 'INCOMPLETE') return s;
  return 'PENDING';
}

function parsePayment(payload: unknown): AriariPaymentData | null {
  if (!payload || typeof payload !== 'object') return null;

  // L'API renvoie parfois un wrapper { status: 'ok', data: { ... } }.
  let obj = payload as Record<string, unknown>;
  const data = obj.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    obj = data as Record<string, unknown>;
  }

  const id = pickId(obj);
  if (!id) return null;

  const amount = Number(obj.amount ?? 0);
  const rest = Number(obj.rest ?? amount);

  return {
    id,
    amount: Number.isFinite(amount) ? amount : 0,
    rest: Number.isFinite(rest) ? rest : amount,
    status: normalizeAriariStatus(obj.status),
    url: typeof obj.url === 'string' ? obj.url : '',
    parts: Array.isArray(obj.parts)
      ? (obj.parts as Record<string, unknown>[]).map((part) => ({
          id: String(part._id ?? part.id ?? ''),
          amount: Number(part.amount ?? 0),
          transactionId: typeof part.transactionId === 'string' ? part.transactionId : undefined,
          date: typeof part.date === 'string' ? part.date : undefined,
        }))
      : [],
    name: typeof obj.name === 'string' ? obj.name : null,
    imgUrl: typeof obj.imgUrl === 'string' ? obj.imgUrl : null,
    createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : null,
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : null,
  };
}

async function ariariFetch(path: string, body?: Record<string, unknown>): Promise<unknown> {
  if (!env.ARIARI_SECRET) {
    throw badRequest('Paiement en ligne non configuré');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${env.ARIARI_API_URL}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-secret': env.ARIARI_SECRET,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await res.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }

    if (!res.ok) {
      const message = (payload as { message?: string })?.message;
      console.warn(`[ARIARI_ERROR] status=${res.status} message=${message ?? ''}`);
      if (res.status === 404 || res.status === 400) {
        throw badRequest(message || 'Aucun paiement trouvé chez Ariari');
      }
      if (res.status === 401) {
        throw badRequest('Clé API Ariari invalide');
      }
      throw badGateway('Le service de paiement est momentanément indisponible. Réessayez.');
    }

    return payload;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    const aborted = (error as Error)?.name === 'AbortError';
    console.warn(`[ARIARI_ERROR] network ${aborted ? 'timeout' : 'failure'}`);
    throw badGateway('Le service de paiement est momentanément indisponible. Réessayez.');
  } finally {
    clearTimeout(timeout);
  }
}

export interface CreatePaymentLinkParams {
  amount: number;
  name: string;
  redirectSuccess: string;
  redirectFailure: string;
  silentSuccess: string;
  silentProgress: string;
  silentFailure: string;
}

/**
 * Crée un paiement Ariari (POST /api/payments, header x-secret).
 * Retourne la page de paiement hébergée (payment.url) + l'id du paiement.
 */
export async function createPaymentLink(params: CreatePaymentLinkParams): Promise<AriariPaymentData> {
  const res = await ariariFetch('/api/payments', {
    amount: params.amount,
    name: params.name,
    hooks: {
      redirectSuccess: params.redirectSuccess,
      redirectFailure: params.redirectFailure,
      silentSuccess: params.silentSuccess,
      silentProgress: params.silentProgress,
      silentFailure: params.silentFailure,
    },
  });
  const payment = parsePayment(res);
  if (!payment) throw badGateway('Réponse Ariari incompréhensible');
  return payment;
}

/**
 * Re-lecture de l'état réel d'un paiement (GET /api/payments/{id}).
 * C'est la SOURCE DE VÉRITÉ : les statuts ne sont jamais acceptés « sur parole ».
 */
export async function getPaymentStatus(paymentId: string): Promise<AriariPaymentData> {
  const res = await ariariFetch(`/api/payments/${encodeURIComponent(paymentId)}`);
  const payment = parsePayment(res);
  if (!payment) throw badRequest('Aucun paiement trouvé chez Ariari');
  return payment;
}

/**
 * Extrait l'identifiant de paiement d'une notification Ariari (webhooks silent*).
 * Le payload n'étant pas signé, seul l'id est utilisé pour une re-lecture authentifiée.
 */
export function extractPaymentId(rawBody: Buffer): string | null {
  if (!rawBody) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const root = parsed as Record<string, unknown>;
  const direct = pickId(root);
  if (direct) return direct;

  for (const key of ['data', 'payment', 'payload', 'body']) {
    const nested = root[key];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const inner = pickId(nested as Record<string, unknown>);
      if (inner) return inner;
    }
  }
  return null;
}