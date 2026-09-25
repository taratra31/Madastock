import { z } from 'zod';

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Email invalide')
  .max(255);

const passwordSchema = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
  .max(128);

const phoneSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || /^\+261(32|33|34|35|37|38)\d{7}$/.test(value),
    'Le numéro doit être un numéro mobile malgache valide',
  )
  .optional()
  .transform((value) => value || undefined);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: z.string().trim().min(2, 'Le nom complet est requis').max(255),
  phone: phoneSchema,
});

export const loginSchema = z
  .object({
    // Un seul champ : email OU numéro de téléphone.
    identifier: z.string().trim().max(255).optional(),
    // Conservé pour les anciens clients mobiles.
    email: z.string().trim().max(255).optional(),
    password: z.string().min(1, 'Le mot de passe est requis'),
  })
  .refine((data) => Boolean(data.identifier || data.email), {
    message: 'Saisissez votre email ou votre numéro de téléphone',
    path: ['identifier'],
  });

export const verifyEmailSchema = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/, 'Le code doit contenir 6 chiffres'),
});

export const resendCodeSchema = z.object({
  email: emailSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/, 'Le code doit contenir 6 chiffres'),
  newPassword: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendCodeInput = z.infer<typeof resendCodeSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;