import prisma from '../lib/prisma';
import { badRequest, conflict, forbidden, notFound } from '../utils/httpError';
import type { AddMemberInput, CreateStoreInput, UpdateStoreInput, UpdateMemberInput } from '../validators/store.validator';
import { notifyOwners } from './notification.service';
import { TRIAL_DAYS, trialPeriod } from './subscription.service';

export async function createStore(userId: string, input: CreateStoreInput) {
  const plan = await prisma.plan.findUnique({ where: { name: 'FREE' } });
  if (!plan) {
    throw badRequest('Plan par défaut introuvable');
  }

  const now = new Date();
  // L'essai gratuit dure TRIAL_DAYS : currentPeriodEnd suit trialEndsAt pour que
  // le compte à rebours affiché (J-13, J-12...) soit le seul vrai.
  const trial = trialPeriod(now);

  const result = await prisma.$transaction(async (tx) => {
    const store = await tx.store.create({
      data: {
        name: input.name,
        sector: input.sector,
        description: input.description,
        address: input.address,
        city: input.city,
        country: input.country,
        phone: input.phone,
        email: input.email,
        currency: input.currency,
      },
    });

    await tx.storeMember.create({
      data: {
        storeId: store.id,
        userId,
        role: 'OWNER',
        isOwner: true,
        canManageAll: true,
      },
    });

    await tx.subscription.create({
      data: {
        storeId: store.id,
        planId: plan.id,
        status: 'TRIALING',
        trialEndsAt: trial.end,
        currentPeriodStart: trial.start,
        currentPeriodEnd: trial.end,
        priceAr: plan.priceAr,
        billingCycle: plan.billingCycle,
      },
    });

    await tx.warehouse.create({
      data: {
        storeId: store.id,
        name: 'Entrepôt principal',
        isMain: true,
      },
    });

    return store;
  });

  // Bienvenue : lepropriétaire voit tout de suite son temps restant.
  await notifyOwners({
    storeId: result.id,
    type: 'SUBSCRIPTION_ACTIVATED',
    title: 'Essai gratuit de 14 jours',
    message: `La boutique « ${result.name} » est prête. Votre essai se termine le ${trial.end.toLocaleDateString('fr-FR')} : pensez à choisir un abonnement avant.`,
    data: { trialDays: TRIAL_DAYS, to: '/billing' },
  });

  return result;
}

export async function listStores(userId: string) {
  const memberships = await prisma.storeMember.findMany({
    where: { userId, store: { active: true } },
    select: {
      id: true,
      role: true,
      isOwner: true,
      canManageAll: true,
      store: {
        select: {
          id: true,
          name: true,
          sector: true,
          logoUrl: true,
          city: true,
          country: true,
          currency: true,
          active: true,
          createdAt: true,
          subscription: {
            select: {
              status: true,
              plan: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return memberships;
}

export async function getStore(storeId: string, userId: string) {
  const membership = await prisma.storeMember.findUnique({
    where: { storeId_userId: { storeId, userId } },
    select: {
      role: true,
      isOwner: true,
      store: {
        select: {
          id: true,
          name: true,
          sector: true,
          description: true,
          logoUrl: true,
          address: true,
          city: true,
          country: true,
          phone: true,
          email: true,
          fiscalNumber: true,
          statNumber: true,
          currency: true,
          timezone: true,
          active: true,
          createdAt: true,
          subscription: {
            select: {
              id: true,
              status: true,
              trialEndsAt: true,
              currentPeriodEnd: true,
              plan: { select: { name: true } },
            },
          },
          _count: { select: { members: true, products: true, sales: true } },
        },
      },
    },
  });

  if (!membership) {
    throw notFound('Boutique introuvable');
  }

  return { ...membership.store, myRole: membership.role, isOwner: membership.isOwner };
}

export async function updateStore(storeId: string, userId: string, input: UpdateStoreInput) {
  const membership = await prisma.storeMember.findUnique({
    where: { storeId_userId: { storeId, userId } },
  });

  if (!membership || (!membership.isOwner && membership.role !== 'ADMIN')) {
    throw forbidden('Droits insuffisants');
  }

  const store = await prisma.store.update({
    where: { id: storeId },
    data: input,
    select: { id: true, name: true, sector: true, description: true, city: true, country: true, currency: true },
  });

  return store;
}

export async function deleteStore(storeId: string, userId: string) {
  const membership = await prisma.storeMember.findUnique({
    where: { storeId_userId: { storeId, userId } },
  });

  if (!membership || !membership.isOwner) {
    throw forbidden('Seul le propriétaire peut supprimer cette boutique');
  }

  await prisma.store.update({
    where: { id: storeId },
    data: { active: false, deletedAt: new Date() },
  });
}

export async function addMember(storeId: string, input: AddMemberInput, requestorId: string) {
  const requestor = await prisma.storeMember.findUnique({
    where: { storeId_userId: { storeId, userId: requestorId } },
  });

  if (!requestor || (!requestor.isOwner && requestor.role !== 'ADMIN' && !requestor.canManageAll)) {
    throw forbidden('Droits insuffisants pour ajouter un membre');
  }

  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw notFound('Aucun compte trouvé avec cet email');
  }

  const existing = await prisma.storeMember.findUnique({
    where: { storeId_userId: { storeId, userId: user.id } },
  });
  if (existing) {
    throw conflict('Cet utilisateur est déjà membre de cette boutique');
  }

  const member = await prisma.storeMember.create({
    data: {
      storeId,
      userId: user.id,
      role: input.role,
    },
    include: {
      user: { select: { id: true, email: true, fullName: true, phone: true } },
    },
  });

  return member;
}

export async function listMembers(storeId: string) {
  const members = await prisma.storeMember.findMany({
    where: { storeId },
    select: {
      id: true,
      role: true,
      isOwner: true,
      canManageAll: true,
      createdAt: true,
      user: { select: { id: true, email: true, fullName: true, phone: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return members;
}

export async function updateMember(memberId: string, storeId: string, input: UpdateMemberInput, requestorId: string) {
  const requestor = await prisma.storeMember.findUnique({
    where: { storeId_userId: { storeId, userId: requestorId } },
  });

  if (!requestor || !requestor.isOwner) {
    throw forbidden('Seul le propriétaire peut modifier un rôle');
  }

  const member = await prisma.storeMember.findUnique({ where: { id: memberId } });
  if (!member || member.storeId !== storeId) {
    throw notFound('Membre introuvable');
  }
  if (member.isOwner) {
    throw forbidden('Impossible de modifier le rôle du propriétaire');
  }

  const updated = await prisma.storeMember.update({
    where: { id: memberId },
    data: { role: input.role },
    include: {
      user: { select: { id: true, email: true, fullName: true } },
    },
  });

  return updated;
}

export async function removeMember(memberId: string, storeId: string, requestorId: string) {
  const requestor = await prisma.storeMember.findUnique({
    where: { storeId_userId: { storeId, userId: requestorId } },
  });

  if (!requestor || (!requestor.isOwner && requestor.role !== 'ADMIN')) {
    throw forbidden('Droits insuffisants pour retirer un membre');
  }

  const member = await prisma.storeMember.findUnique({ where: { id: memberId } });
  if (!member || member.storeId !== storeId) {
    throw notFound('Membre introuvable');
  }
  if (member.isOwner) {
    throw forbidden('Impossible de retirer le propriétaire');
  }
  if (member.userId === requestorId) {
    throw forbidden('Vous ne pouvez pas vous retirer vous-même');
  }

  await prisma.storeMember.delete({ where: { id: memberId } });
}
