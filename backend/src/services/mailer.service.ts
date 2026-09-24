import nodemailer from 'nodemailer';
import dns from 'node:dns';
import { env } from '../config/env';

dns.setDefaultResultOrder('ipv4first');

export const mailerConfigured = Boolean(env.SMTP_USER && env.SMTP_PASS);

function resolveSmtpHost(host: string): { host: string; servername: string } {
  const lookupSync = (dns as unknown as {
    lookupSync: (hostname: string, options: { family: number }) => { address: string };
  }).lookupSync;
  try {
    const ipv4 = lookupSync(host, { family: 4 }).address;
    return { host: ipv4, servername: host };
  } catch {
    return { host, servername: host };
  }
}

const smtpEndpoint = mailerConfigured ? resolveSmtpHost(env.SMTP_HOST) : null;

const transporter = mailerConfigured && smtpEndpoint
  ? nodemailer.createTransport({
      host: smtpEndpoint.host,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      tls: smtpEndpoint.host === smtpEndpoint.servername ? undefined : { servername: smtpEndpoint.servername },
    })
  : null;

export async function sendVerifyCodeEmail(to: string, code: string): Promise<void> {
  if (!transporter) {
    if (env.NODE_ENV === 'production') {
      throw new Error('SMTP non configuré (SMTP_USER / SMTP_PASS manquants)');
    }
    console.warn(`[mailer] SMTP non configuré — code de vérification pour ${to} : ${code} (dev)`);
    return;
  }

  await transporter.sendMail({
    from: env.MAIL_FROM,
    to,
    subject: 'MadaStock — Code de vérification',
    text: `Votre code de vérification MadaStock est : ${code}. Il expire dans ${env.VERIFY_CODE_TTL_MINUTES} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px">
  <h2 style="color:#16a34a;margin:0 0 12px">MadaStock</h2>
  <p>Votre code de vérification est :</p>
  <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#0f172a;background:#f1f5f9;padding:12px;text-align:center;border-radius:8px">${code}</p>
  <p>Il expire dans ${env.VERIFY_CODE_TTL_MINUTES} minutes.</p>
  <p style="color:#94a3b8;font-size:12px">Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail.</p>
</div>`,
  });
}