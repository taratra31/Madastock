import makeWASocket, {
  DisconnectReason,
  initAuthCreds,
  makeCacheableSignalKeyStore,
  type WASocket,
  type SignalKeyStore,
  type SignalDataTypeMap,
  type SignalDataSet,
  type AuthenticationCreds,
  type ConnectionState,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { env } from '../config/env';
import prisma from '../lib/prisma';

// ============================================================================
// OTP WhatsApp — Baileys (aucune API, aucun forfait).
//
// ** Votre numéro est l'EXPÉDITEUR ** : env.WHATSAPP_SENDER_NUMBER
// (ex. +261326321784). Le client reçoit le code OTP en WhatsApp sur son propre
// numéro (users.phone), avec repli automatique sur l'e-mail si WhatsApp est
// inactif / non pairé / hors-ligne.
//
// Conception « deploy-safe & opt-in » :
//   - Canal 100 % OPTIONNEL. Par défaut WHATSAPP_OTP_ENABLED n'est pas actif :
//     le flux e-mail existant (mailer.service) est inchangé, tous les tests
//     restent verts. L'activation = flag d'env + un QR à scanner une fois.
//   - La session WhatsApp (creds + clés signal) est persistée dans NEON
//     (table whatsapp_kv) → elle SURVIT aux redeploys/restarts Render : aucun
//     QR à resscanner à chaque deploy. L'appairage initial se fait via
//     GET /api/v1/admin/whatsapp/qr (QR serveur à scanner avec WhatsApp →
//     Appareils liés).
//   - sendOtpWhatsApp() ne lève JAMAIS : si non pairé / hors-ligne /
//     indisponible, il renvoie false → l'appelant garde l'e-mail en secours.
//     Aucun flux de connexion n'est cassé par ce service.
// ============================================================================

const KV_TABLE = 'whatsapp_kv';

const logger = pino({ level: process.env.WHATSAPP_LOG_LEVEL || 'warn' });

const isPostgres = (): boolean => env.DATABASE_URL.startsWith('postgres');

const ph = (index: number): string => (isPostgres() ? `$${index}` : '?');

// ---------------------------------------------------------------------------
// KV persistant dans Neon (session Baileys + creds + clés).
// ---------------------------------------------------------------------------
async function ensureKvTable(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "${KV_TABLE}" (
        "key" TEXT PRIMARY KEY,
        "value" TEXT NOT NULL,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    );
  } catch {
    // SQLite (dev) : variante sans TIMESTAMP(3)
    try {
      await prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "${KV_TABLE}" (
          "key" TEXT PRIMARY KEY,
          "value" TEXT NOT NULL,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
      );
    } catch {
      // session non persistée → QR à nouveau, jamais d'erreur fatale
    }
  }
}

async function kvGet(key: string): Promise<string | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<{ value: string }[]>(
      `SELECT "value" FROM "${KV_TABLE}" WHERE "key" = ${ph(1)}`,
      key,
    );
    return rows?.[0]?.value ?? null;
  } catch {
    return null;
  }
}

async function kvSet(key: string, value: string): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${KV_TABLE}" ("key", "value", "updatedAt")
       VALUES (${ph(1)}, ${ph(2)}, CURRENT_TIMESTAMP)
       ON CONFLICT ("key") DO UPDATE SET "value" = excluded."value", "updatedAt" = CURRENT_TIMESTAMP`,
      key,
      value,
    );
  } catch {
    // ignorer : session non persistée, rien de bloquant
  }
}

// ---------------------------------------------------------------------------
// SignalKeyStore branché sur Neon.
// ---------------------------------------------------------------------------
const BUFFER_TAG = '__wa_buf__';

function isValidCreds(creds: Partial<AuthenticationCreds> | null): boolean {
  if (!creds) return false;
  const noise = creds.noiseKey as { public?: unknown; private?: unknown } | undefined;
  const identity = creds.signedIdentityKey as { public?: unknown; private?: unknown } | undefined;
  const isBufferLike = (v: unknown): boolean =>
    Buffer.isBuffer(v) || v instanceof Uint8Array || (v as { type?: string })?.type === 'Buffer';
  return (
    typeof creds.me?.id === 'string' &&
    isBufferLike(noise?.public) &&
    isBufferLike(noise?.private) &&
    isBufferLike(identity?.public) &&
    isBufferLike(identity?.private)
  );
}

async function clearKv(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM "${KV_TABLE}"`);
  } catch {
    // ignoré
  }
}

function encodeValue(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (Buffer.isBuffer(val) || val instanceof Uint8Array) {
      return { [BUFFER_TAG]: Buffer.from(val as Uint8Array).toString('base64') };
    }
    return val;
  });
}

function decodeValue<T>(raw: string): T {
  return JSON.parse(raw, (_key, val) => {
    if (val && typeof val === 'object' && typeof (val as Record<string, unknown>)[BUFFER_TAG] === 'string') {
      return Buffer.from((val as Record<string, string>)[BUFFER_TAG], 'base64');
    }
    return val;
  }) as T;
}

function signalKeys(): SignalKeyStore {
  return {
    async get<T extends keyof SignalDataTypeMap>(type: T, ids: string[]) {
      const out: { [id: string]: SignalDataTypeMap[T] } = {};
      for (const id of ids) {
        const raw = await kvGet(`sig:${type}:${id}`);
        if (raw) out[id] = decodeValue<SignalDataTypeMap[T]>(raw);
      }
      return out;
    },
    async set(data: SignalDataSet) {
      for (const [type, entries] of Object.entries(data)) {
        if (!entries) continue;
        for (const [id, value] of Object.entries(entries)) {
          await kvSet(`sig:${type}:${id}`, encodeValue(value));
        }
      }
    },
    async clear() {
      /* conservateur : on ne vide pas le KV de façon sauvage */
    },
  };
}

// ---------------------------------------------------------------------------
// État Baileys.
// ---------------------------------------------------------------------------
let socket: WASocket | null = null;
let connecting = false;
let lastQr: string | null = null;
let isPaired = false;
let lastError: string | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectAttempts = 0;
let wasPaired = false;

function scheduleReconnect(): void {
  if (!isEnabled() || reconnectTimer) return;
  reconnectAttempts += 1;
  if (reconnectAttempts > 10) return;
  const delay = Math.min(30_000, 2_000 * reconnectAttempts);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connectOnce();
  }, delay);
}

function isEnabled(): boolean {
  return (env.WHATSAPP_OTP_ENABLED ?? '').trim().toLowerCase() === '1';
}

function senderNumber(): string {
  return env.WHATSAPP_SENDER_NUMBER || '+261326321784';
}

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('261')) return `${digits}@s.whatsapp.net`;
  if (digits.startsWith('0')) return `261${digits.slice(1)}@s.whatsapp.net`;
  if (digits.startsWith('+')) return normalizePhone(digits.slice(1));
  return `261${digits}@s.whatsapp.net`;
}

async function connectOnce(): Promise<WASocket | null> {
  if (socket) return socket;
  if (connecting) return null;
  connecting = true;
  try {
    await ensureKvTable();
    let creds: AuthenticationCreds | null = null;
    const rawCreds = await kvGet('creds.json');
    if (rawCreds) {
      try {
        creds = decodeValue<AuthenticationCreds>(rawCreds);
      } catch {
        creds = null;
      }
    }
    if (!creds || !isValidCreds(creds)) {
      if (rawCreds) {
        await clearKv();
      }
      creds = initAuthCreds();
    }

    const sock = makeWASocket({
      auth: {
        creds,
        keys: makeCacheableSignalKeyStore(signalKeys(), logger),
      },
      browser: ['MadaStock', 'Chrome', '1.0'],
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      getMessage: async () => undefined,
      logger,
    });

    sock.ev.on('creds.update', (next) => {
      void kvSet('creds.json', encodeValue(next));
    });

    sock.ev.on('connection.update', (update: Partial<ConnectionState>) => {
      const u = update as unknown as {
        qr?: string;
        connection?: string;
        lastDisconnect?: { error?: { output?: { statusCode?: number }; message?: string } };
      };
      if (u.qr) {
        lastQr = u.qr;
        lastError = null;
        reconnectAttempts = 0;
      }
      if (u.connection === 'open') {
        isPaired = true;
        wasPaired = true;
        lastQr = null;
        reconnectAttempts = 0;
      }
      if (u.connection === 'close') {
        const error = u.lastDisconnect?.error;
        const code = error?.output?.statusCode;
        isPaired = false;
        if (code === DisconnectReason.loggedOut) {
          lastError = 'Session expirée (401) — rescannez le QR';
        } else if (code === DisconnectReason.restartRequired) {
          lastError = 'WhatsApp exige une mise à jour de Baileys (515)';
        } else if (code === DisconnectReason.multideviceMismatch) {
          lastError = 'Session déjà appairée ailleurs (411) — rescannez le QR';
        } else {
          lastError = `Connexion fermée (code ${code ?? 'inconnu'}) : ${error?.message ?? 'erreur réseau'}`;
        }
        logger.warn(
          { code, message: error?.message, wasPaired },
          '[whatsapp] deconnexion',
        );
        socket = null;
        void sock.ev.removeAllListeners('connection.update');
        const fatal = [
          DisconnectReason.loggedOut,
          DisconnectReason.restartRequired,
          DisconnectReason.multideviceMismatch,
          DisconnectReason.forbidden,
        ].includes(code as DisconnectReason);
        if (fatal) {
          void clearKv();
          reconnectAttempts = 0;
        } else {
          scheduleReconnect();
        }
      }
    });

    socket = sock;
    return sock;
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
    return null;
  } finally {
    connecting = false;
  }
}

// ---------------------------------------------------------------------------
// API publique.
// ---------------------------------------------------------------------------
export function whatsappOtpEnabled(): boolean {
  return isEnabled();
}

export function whatsappStatus(): {
  enabled: boolean;
  paired: boolean;
  qr: string | null;
  error: string | null;
  sender: string;
} {
  return {
    enabled: isEnabled(),
    paired: isPaired,
    qr: lastQr,
    error: lastError,
    sender: senderNumber(),
  };
}

export interface WhatsappInfo {
  enabled: boolean;
  paired: boolean;
  qr: string | null;
  error: string | null;
  sender: string;
}

/**
 * Déclenche la connexion en tâche de fond et rend la main immédiatement :
 * le QR est ensuite lu via whatsappStatus() (polling côté client).
 * Aucun appel HTTP long — important sur Render (timeout de requête).
 */
export function requestWhatsappQr(): WhatsappInfo {
  if (isEnabled() && !socket && !connecting) {
    void connectOnce();
  }
  return whatsappStatus();
}

/** Repart de zéro : efface la session en base et génère un QR neuf. */
export async function resetWhatsappSession(): Promise<WhatsappInfo> {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (socket) {
    try {
      socket.ev.removeAllListeners('creds.update');
      socket.ev.removeAllListeners('connection.update');
      await socket.end(undefined);
    } catch {
      // ignoré
    }
  }
  socket = null;
  connecting = false;
  isPaired = false;
  lastQr = null;
  lastError = null;
  reconnectAttempts = 0;
  await ensureKvTable();
  await clearKv();
  void connectOnce();
  return whatsappStatus();
}

/**
 * Envoi du code OTP par WhatsApp (expéditeur = votre numéro).
 * @returns true si envoyé, false sinon (inactif / non pairé / échec) → repli mail.
 */
export async function sendOtpWhatsApp(
  rawPhone: string | null | undefined,
  code: string,
): Promise<boolean> {
  if (!isEnabled()) return false;
  const jid = normalizePhone(rawPhone);
  if (!jid) return false;
  try {
    const sock = await connectOnce();
    if (!sock || !isPaired) return false;
    const text =
      `🔐 MadaStock — Code de connexion\n\n` +
      `Votre code de vérification est : *${code}*\n` +
      `Il expire dans quelques minutes. Ne le partagez avec personne.\n\n` +
      `Envoyé par MadaStock (${senderNumber()})`;
    await sock.sendMessage(jid, { text });
    return true;
  } catch {
    return false;
  }
}

/** Petit hook appelé au boot : tente la reconnexion si session persistée. */
export async function initWhatsAppSocket(): Promise<void> {
  if (!isEnabled()) return;
  try {
    await ensureKvTable();
    const hasCreds = await kvGet('creds.json');
    if (hasCreds) {
      void connectOnce();
    }
  } catch {
    /* jamais bloquant */
  }
}
