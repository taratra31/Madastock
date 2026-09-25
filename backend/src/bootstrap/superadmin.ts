import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { env } from '../config/env';

const DEFAULT_EMAIL = 'admin@madastock.mg';
const DEFAULT_PASSWORD = 'admin123';

/**
 * Garantit qu'un (et un seul) compte superadmin existe en base au démarrage.
 * Idempotent : ne crée que si absent, promeut les champs manquants si présent,
 * et ne réinitialise le mot de passe QUE si SUPERADMIN_PASSWORD est défini dans l'environnement.
 */
export async function ensureSuperAdmin(): Promise<void> {
  const email = (env.SUPERADMIN_EMAIL || DEFAULT_EMAIL).toLowerCase().trim();

  try {
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      const needsUpdate = !existing.isSuperAdmin || !existing.isActive || !existing.emailVerified;
      if (needsUpdate) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { isSuperAdmin: true, isActive: true, emailVerified: true },
        });
        console.log(`[SUPERADMIN] Compte promu superadmin : ${email}`);
      } else {
        console.log(`[SUPERADMIN] Superadmin déjà actif : ${email}`);
      }

      if (env.SUPERADMIN_PASSWORD) {
        const passwordHash = await bcrypt.hash(env.SUPERADMIN_PASSWORD, 10);
        await prisma.user.update({
          where: { id: existing.id },
          data: { passwordHash },
        });
        console.log(`[SUPERADMIN] Mot de passe réinitialisé : ${email}`);
      }
      return;
    }

    const passwordHash = await bcrypt.hash(env.SUPERADMIN_PASSWORD || DEFAULT_PASSWORD, 10);
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: 'Super Admin',
        isSuperAdmin: true,
        isActive: true,
        emailVerified: true,
      },
    });
    console.log(`[SUPERADMIN] Superadmin créé : ${email}`);
  } catch (error) {
    console.error('[SUPERADMIN] Échec de la vérification du superadmin :', error);
  }
}