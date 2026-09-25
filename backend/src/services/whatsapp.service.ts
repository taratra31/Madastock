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
      `SELECT "value" FROM "${KV_TABLE}" WHERE "key" = ?`,
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
       VALUES (?, ?, CURRENT_TIMESTAMP)
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
    const rawCreds = await kvGet('creds.json');
    const creds: AuthenticationCreds = rawCreds
      ? JSON.parse(rawCreds)
      : initAuthCreds();

    const sock = makeWASocket({
      auth: {
        creds,
        keys: makeCacheableSignalKeyStore(signalKeys(), {
          info: () => {},
          warn: () => {},
          error: (_input?: object) => {},
          level: 'silent',
        } as never),
      },
      version: [2, 3000, 1018531300],
      browser: ['MadaStock', 'Chrome', '1.0'],
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      getMessage: async () => undefined,
      logger: {
        level: 'silent',
      } as never,
    });

    sock.ev.on('creds.update', (next) => {
      void kvSet('creds.json', JSON.stringify(next));
    });

    sock.ev.on('connection.update', (update: Partial<ConnectionState>) => {
      const u = update as unknown as {
        qr?: string;
        connection?: string;
        lastDisconnect?: { error?: { output?: { statusCode?: number } } };
      };
      if (u.qr) {
        lastQr = u.qr;
        lastError = null;
      }
      if (u.connection === 'open') {
        isPaired = true;
        lastQr = null;
      }
      if (u.connection === 'close') {
        const code = u.lastDisconnect?.error?.output?.statusCode;
        if (code === DisconnectReason.loggedOut) {
          isPaired = false;
          lastError = 'Session expirée (loggedOut) — rescannez le QR';
        } else {
          lastError = 'Connexion WhatsApp fermée';
        }
        socket = null;
        void sock.ev.removeAllListeners('connection.update');
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

/** QR d'appairage (un seul scan — WhatsApp → Appareils liés). */
export async function getWhatsappQr(): Promise<string | null> {
  if (!isEnabled()) return null;
  if (!socket) {
    await connectOnce();
    // attendre un cycle QR possible
    for (let i = 0; i < 12 && !lastQr; i++) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return lastQr;
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
      `Expédié par MadaStock (+261326321784)`;
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
