import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { env } from '../config/env';

/**
 * Bootstrap du compte superadmin.
 *
 * SÉCURITÉ : il n'existe AUCUN couple email/mot de passe par défaut.
 * Le compte n'est créé que si l'opérateur fournit explicitement
 * SUPERADMIN_EMAIL **et** SUPERADMIN_PASSWORD dans l'environnement.
 *
 * Le mot de passe d'un compte existant n'est JAMAIS réécrit au démarrage
 * (sinon un redéploiement réinitialise le mot de passe choisi par l'admin).
 */
export async function ensureSuperAdmin(): Promise<void> {
  const email = env.SUPERADMIN_EMAIL?.toLowerCase().trim();
  const password = env.SUPERADMIN_PASSWORD;

  if (!email || !password) {
    console.warn(
      '[SUPERADMIN] SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD absents : aucun compte créé. ' +
        'Définissez les deux variables pour provisionner le premier administrateur.',
    );
    return;
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });

    if (!existing) {
      const passwordHash = await bcrypt.hash(password, 12);
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
      return;
    }

    // Promotion des droits manquants uniquement (jamais de mot de passe).
    const needsUpdate = !existing.isSuperAdmin || !existing.emailVerified;
    if (needsUpdate) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { isSuperAdmin: true, emailVerified: true },
      });
      console.log(`[SUPERADMIN] Compte promu superadmin : ${email}`);
    } else {
      console.log(`[SUPERADMIN] Superadmin déjà actif : ${email}`);
    }

    if (!existing.isActive) {
      console.warn(
        `[SUPERADMIN] ATTENTION : ${email} est désactivé et n'a pas été réactivé. ` +
          'Réactivez-le depuis l\'administration.',
      );
    }

    const matches = await bcrypt.compare(password, existing.passwordHash);
    if (!matches) {
      console.warn(
        `[SUPERADMIN] Le mot de passe de ${email} ne correspond pas à SUPERADMIN_PASSWORD. ` +
          'Le mot de passe existant a été conservé ; mettez à jour la variable si nécessaire.',
      );
    }
  } catch (error) {
    console.error('[SUPERADMIN] Échec de la vérification du superadmin :', error);
  }
}