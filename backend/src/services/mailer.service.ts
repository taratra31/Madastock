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
    console.warn(`[mailer] E-mail non configuré — code de vérification pour ${to} : ${code} (dev)`);
    return;
  }

  await smtpTransporter.sendMail({ from: env.MAIL_FROM, to, subject, text, html });
}