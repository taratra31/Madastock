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
  RATE_LIMIT_MAX: z.string().default('100').transform(Number),
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.string().default('587').transform(Number),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  EMAIL_PROVIDER: z.enum(['smtp', 'brevo', 'resend']).default('smtp'),
  EMAIL_API_KEY: z.string().default(''),
  MAIL_FROM: z.string().default('MadaStock <noreply@madastock.mg>'),
  VERIFY_CODE_TTL_MINUTES: z.string().default('15').transform(Number),
  SUPERADMIN_EMAIL: z.string().email('Email superadmin invalide').optional(),
  SUPERADMIN_PASSWORD: z.string().min(6).optional(),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env;

try {
  _env = envSchema.parse(process.env);
} catch (error) {
  console.error('Invalid environment variables:', error);
  process.exit(1);
}

export const env = _env;
