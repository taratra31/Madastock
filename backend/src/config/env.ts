import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  PORT: z.string().default('5000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  ARIARI_API_URL: z.string().default('https://api.ariari.mg'),
  ARIARI_SECRET: z.string().default(''),
  ARIARI_WEBHOOK_URL: z.string().default(''),
  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform(Number),
  RATE_LIMIT_MAX: z.string().default('600').transform(Number),
  // Plafond ANTI-BRUTE-FORCE : seuls les échecs sont comptés
  // (`skipSuccessfulRequests`). 10 échecs / 15 min et par IP.
  AUTH_RATE_LIMIT_MAX: z.string().default('10').transform(Number),
  // Plafond LARGE pour /auth/me et /auth/refresh : ces appels sont normaux
  // (chargement de page, retour sur l'onglet, reconnexion) et ne doivent pas
  // partager le compteur anti-bruteforce, sinon un utilisateur légitime se
  // fait bloquer avec « Trop de tentatives ».
  AUTH_SOFT_RATE_LIMIT_MAX: z.string().default('300').transform(Number),
  ADMIN_RATE_LIMIT_MAX: z.string().default('2000').transform(Number),
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.string().default('587').transform(Number),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  EMAIL_PROVIDER: z.enum(['smtp', 'brevo', 'resend']).default('smtp'),
  EMAIL_API_KEY: z.string().default(''),
  MAIL_FROM: z.string().default('MadaStock <noreply@madastock.mg>'),
  VERIFY_CODE_TTL_MINUTES: z.string().default('15').transform(Number),
  // Bootstrap admin : SANS ces deux variables, AUCUN compte n'est créé.
  SUPERADMIN_EMAIL: z.string().email('Email superadmin invalide').optional(),
  SUPERADMIN_PASSWORD: z.string().min(12, 'Mot de passe superadmin : 12 caractères minimum').optional(),
  // 'closed' refuse toute nouvelle inscription (réponse générique).
  REGISTRATION_MODE: z.enum(['open', 'closed']).default('open'),
  // --- Assistant IA (Google Gemini, OPTIONNEL) ---
  // Sans GEMINI_API_KEY, /ai/chat et /ai/generate répondent 503 ; les
  // suggestions restent disponibles (elles sont calculées côté serveur).
  GEMINI_API_KEY: z.string().default(''),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  // --- Canal WhatsApp OTP (OPTIONNEL, neutre par défaut) ---
  // Ce canal est INACTIF tant que WHATSAPP_OTP_ENABLED != '1'. Quand il est
  // actif, le code 6 chiffres part en WhatsApp (expéditeur = notre numéro pairé
  // WHATSAPP_SENDER_NUMBER) avec repli automatique sur l'e-mail si le client
  // n'a pas de téléphone, si la session n'est pas pairée ou si l'envoi échoue.
  WHATSAPP_OTP_ENABLED: z.string().default('0'),
  WHATSAPP_SENDER_NUMBER: z.string().default('+261326321784'),
  // Force une version WhatsApp Web précise, ex. "2.3000.1048298845".
  // Vide = vaChercher la version en cours directement chez WhatsApp.
  WHATSAPP_WA_VERSION: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env;

try {
  _env = envSchema.parse(process.env);
} catch (error) {
  console.error('Invalid environment variables:', error);
  process.exit(1);
}

// Garde-fous production sur la solidité du JWT_SECRET.
//
// ⚠ AVERTISSEMENT, PAS BLOCAGE. Un `process.exit(1)` ici a déjà fait tomber
// l'application en production : unRender dont le secret fait 24 caractères
// s'est mis à boucler sur "Exited with status 1". Un secret trop court est
// une faiblesse, pas une panne : on crie dans les logs et on démarre.
//
// Pour rendre le contrôle bloquant (une fois le secret réellement renforcé) :
// JWT_STRICT_STARTUP=1.
if (_env.NODE_ENV === 'production') {
  const problems: string[] = [];

  if (_env.JWT_SECRET.length < 32) {
    problems.push(
      `JWT_SECRET fait ${_env.JWT_SECRET.length} caractères : 32 minimum est ` +
        'recommandé pour rendre le brute-force du secret hors de portée.',
    );
  }

  const weakSecret = /^(changeme|secret|example|test|dev|madastock|123)/i;
  if (weakSecret.test(_env.JWT_SECRET)) {
    problems.push('JWT_SECRET ressemble à un exemple : changez-le par une valeur aléatoire.');
  }

  if (problems.length > 0) {
    const strict = process.env.JWT_STRICT_STARTUP === '1';
    const log = strict ? console.error : console.warn;
    log(`[ENV] JWT_SECRET à renforcer en production${strict ? ' (démarrage bloqué)' : ''} :`);
    for (const problem of problems) log(`  - ${problem}`);
    log('[ENV] Générez une valeur solide avec : node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
    log('[ENV] ATTENTION : changer JWT_SECRET déconnecte toutes les sessions ouvertes.');

    if (strict) process.exit(1);
  }
}

export const env = _env;
