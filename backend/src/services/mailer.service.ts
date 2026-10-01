import nodemailer from 'nodemailer';
import dns from 'node:dns';
import { env } from '../config/env';

dns.setDefaultResultOrder('ipv4first');

function resolveSmtpHost(host: string): string {
  const lookupSync = (dns as unknown as {
    lookupSync: (hostname: string, options: { family: number }) => { address: string };
  }).lookupSync;
  try {
    return lookupSync(host, { family: 4 }).address;
  } catch {
    return host;
  }
}

function parseMailFrom(from: string): { name: string; email: string } {
  const match = /^(.*)\s*<\s*([^>]+)\s*>$/.exec(from.trim());
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { name: 'MadaStock', email: from.trim() };
}

export function mailerConfigured(): boolean {
  if (env.EMAIL_PROVIDER !== 'smtp') {
    return Boolean(env.EMAIL_API_KEY);
  }
  return Boolean(env.SMTP_USER && env.SMTP_PASS);
}

const smtpTransporter =
  env.EMAIL_PROVIDER === 'smtp' && mailerConfigured()
    ? nodemailer.createTransport({
        host: resolveSmtpHost(env.SMTP_HOST),
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
        tls: resolveSmtpHost(env.SMTP_HOST) === env.SMTP_HOST ? undefined : { servername: env.SMTP_HOST },
      })
    : null;

async function sendByBrevo(to: string, subject: string, text: string, html: string): Promise<void> {
  const { name, email } = parseMailFrom(env.MAIL_FROM);
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': env.EMAIL_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name, email },
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Brevo ${res.status}: ${body.slice(0, 300)}`);
  }
}

async function sendByResend(to: string, subject: string, text: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.EMAIL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [to],
      subject,
      text,
      html,
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend ${res.status}: ${body.slice(0, 300)}`);
  }
}

/** Les noms de produits viennent des utilisateurs : on les échappe avant l'injection dans l'e-mail. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Envoi effectif : Brevo → Resend → SMTP. Jamais bloquant pour l'appelant. */async function deliver(to: string, subject: string, text: string, html: string): Promise<void> {
  if (env.EMAIL_PROVIDER === 'brevo') {
    await sendByBrevo(to, subject, text, html);
    return;
  }
  if (env.EMAIL_PROVIDER === 'resend') {
    await sendByResend(to, subject, text, html);
    return;
  }

  if (!smtpTransporter) {
    if (env.NODE_ENV === 'production') {
      throw new Error('E-mail non configuré (EMAIL_PROVIDER/clef API ou SMTP manquant)');
    }
    console.warn(`[mailer] E-mail non configuré — « ${subject} » pour ${to} (dev)`);
    return;
  }

  await smtpTransporter.sendMail({ from: env.MAIL_FROM, to, subject, text, html });
}

export async function sendPasswordResetEmail(to: string, code: string): Promise<void> {
  const subject = 'MadaStock — Réinitialisation du mot de passe';
  const text = `Votre code de réinitialisation MadaStock est : ${code}. Il expire dans ${env.VERIFY_CODE_TTL_MINUTES} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px">
  <h2 style="color:#16a34a;margin:0 0 12px">MadaStock</h2>
  <p>Votre code de réinitialisation du mot de passe est :</p>
  <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#0f172a;background:#f1f5f9;padding:12px;text-align:center;border-radius:8px">${code}</p>
  <p>Il expire dans ${env.VERIFY_CODE_TTL_MINUTES} minutes. Saisissez-le sur la page « Nouveau mot de passe » pour définir un nouveau mot de passe.</p>
  <p style="color:#94a3b8;font-size:12px">Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail.</p>
</div>`;

  await deliver(to, subject, text, html);
}

export async function sendVerifyCodeEmail(to: string, code: string): Promise<void> {
  const subject = 'MadaStock — Code de vérification';
  const text = `Votre code de vérification MadaStock est : ${code}. Il expire dans ${env.VERIFY_CODE_TTL_MINUTES} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px">
  <h2 style="color:#16a34a;margin:0 0 12px">MadaStock</h2>
  <p>Votre code de vérification est :</p>
  <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#0f172a;background:#f1f5f9;padding:12px;text-align:center;border-radius:8px">${code}</p>
  <p>Il expire dans ${env.VERIFY_CODE_TTL_MINUTES} minutes.</p>
  <p style="color:#94a3b8;font-size:12px">Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail.</p>
</div>`;

  await deliver(to, subject, text, html);
}

export interface LowStockLine {
  productName: string;
  quantity: number;
  threshold: number;
  warehouseName?: string | null;
}

/** Résumé quotidien des produits sous le seuil d'alerte (une seule fois par jour et par boutique). */
export async function sendLowStockEmail(
  to: string,
  storeName: string,
  lines: LowStockLine[],
): Promise<void> {
  const rows = lines
    .map(
      (l) =>
        `<tr><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${escapeHtml(l.productName)}${
          l.warehouseName ? ` <span style="color:#94a3b8">(${escapeHtml(l.warehouseName)})</span>` : ''
        }</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right">${l.quantity}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;color:#b91c1c">${l.threshold}</td></tr>`,
    )
    .join('');

  const subject = `MadaStock — ${lines.length} produit(s) sous le seuil d'alerte`;
  const text =
    `Stock bas dans « ${storeName} » :\n\n` +
    lines.map((l) => `- ${l.productName} : ${l.quantity} restant(s) (seuil ${l.threshold})`).join('\n');

  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px">
  <h2 style="color:#16a34a;margin:0 0 4px">MadaStock</h2>
  <p style="margin:0 0 12px;color:#475569">Alerte stock — <strong>${escapeHtml(storeName)}</strong></p>
  <p>${lines.length} produit(s) sont sous le seuil d'alerte. Pensez à passer une commande de réapprovisionnement.</p>
  <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:12px 0;font-size:14px">
    <thead><tr style="background:#f8fafc">
      <th align="left" style="padding:8px">Produit</th>
      <th align="right" style="padding:8px">En stock</th>
      <th align="right" style="padding:8px">Seuil</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p style="color:#94a3b8;font-size:12px">Vous recevez cet e-mail une fois par jour tant qu'un produit reste sous le seuil.</p>
</div>`;

  await deliver(to, subject, text, html);
}