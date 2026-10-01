import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest } from '../utils/httpError';
import prisma from '../lib/prisma';
import * as aiService from '../services/ai.service';
import { getSubscriptionState } from '../services/subscription.service';
import { getDashboardStats } from '../services/dashboard.service';

const GENERATE_KINDS = ['productDescription', 'customerMessage', 'reminder'];

/** Public : permet de vérifier sans login si la clé Gemini est bien configurée. */
export const status = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ configured: aiService.isAiConfigured() });
});

export const chat = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const messages: unknown = req.body?.messages;
  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    messages.some((m) => m?.role !== 'user' && m?.role !== 'assistant') ||
    messages.some((m) => typeof m?.content !== 'string' || !m.content.trim())
  ) {
    throw badRequest('Messages invalides');
  }

  const store = await prisma.store.findUnique({
    where: { id: req.store.id },
    select: {
      name: true,
      subscription: { select: { plan: { select: { name: true } } } },
    },
  });

  const reply = await aiService.chat({
    storeName: store?.name ?? 'la boutique',
    planName: store?.subscription?.plan?.name ?? null,
    messages: messages as aiService.ChatMessage[],
  });
  res.json({ reply });
});

export const generate = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const kind: unknown = req.body?.kind;
  const context: unknown = req.body?.context;
  if (typeof kind !== 'string' || !GENERATE_KINDS.includes(kind)) {
    throw badRequest('Type de génération invalide');
  }
  const text = await aiService.generate({
    kind,
    context: context && typeof context === 'object' ? (context as Record<string, unknown>) : {},
  });
  res.json({ text });
});

/** Suggestions calculées côté serveur (stock bas, factures impayées, abonnement). */
export const suggestions = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const storeId = req.store.id;

  const [stats, subState, pendingInvoices] = await Promise.all([
    getDashboardStats(storeId),
    getSubscriptionState(storeId),
    prisma.invoice.count({
      where: {
        storeId,
        paymentStatus: 'PENDING',
        status: { notIn: ['DRAFT', 'CANCELLED', 'VOID'] },
      },
    }),
  ]);

  const suggestions = [];

  if (stats.counts.lowStock > 0) {
    suggestions.push({
      type: 'stock',
      title: `${stats.counts.lowStock} produit(s) en stock faible`,
      message:
        stats.lowStockProducts
          .slice(0, 3)
          .map((p) => p.name)
          .join(', ') + (stats.counts.lowStock > 3 ? '…' : ''),
      actionPath: '/stock',
    });
  }

  if (pendingInvoices > 0) {
    suggestions.push({
      type: 'invoice',
      title: `${pendingInvoices} facture(s) en attente de paiement`,
      message: 'Relancez vos clients pour encaisser ces factures.',
      actionPath: '/invoices',
    });
  }

  if (subState && !subState.billingExempt) {
    if (subState.isTrial && subState.trialDaysRemaining <= 7) {
      suggestions.push({
        type: 'subscription',
        title: `Essai gratuit — ${subState.trialDaysRemaining} jour(s) restant(s)`,
        message: 'Passez à une formule pour continuer à tout utiliser après la fin de l\'essai.',
        actionPath: '/billing',
      });
    }
    if (!subState.isLive) {
      suggestions.push({
        type: 'subscription',
        title: 'Abonnement expiré',
        message: 'Renouvelez votre abonnement pour retrouver toutes vos fonctionnalités.',
        actionPath: '/billing',
      });
    }
  }

  res.json({ suggestions });
});