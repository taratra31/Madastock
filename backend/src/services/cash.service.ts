import prisma from '../lib/prisma';
import { badRequest, notFound } from '../utils/httpError';
import type { CashTransactionInput, CloseSessionInput, OpenSessionInput } from '../validators/cash.validator';

/** Types de mouvement : ce qui rentre (+) dans la caisse. */
const CREDIT_TYPES = ['SALE', 'DEPOSIT', 'ADJUSTMENT'];

export async function getOpenSession(storeId: string) {
  return prisma.cashSession.findFirst({
    where: { storeId, status: 'OPEN' },
    include: { openedBy: { select: { id: true, fullName: true } } },
  });
}

/**
 * Enregistre un mouvement dans la caisse ouverte, si elle existe.
 * Silencieux si aucune session n'est ouverte : la vente ou la dépense ne doit
 * jamais échouer à cause du module caisse.
 */
export async function recordCashMovement(args: {
  storeId: string;
  userId: string;
  transactionType: string;
  amountAr: number;
  method?: string;
  source?: string;
  description?: string | null;
  saleId?: string;
  expenseId?: string;
  purchaseId?: string;
  signed?: boolean;
}) {
  const amount = Number(args.amountAr);
  if (!Number.isFinite(amount) || amount === 0) return null;

  const session = await getOpenSession(args.storeId);
  if (!session) return null;

  // signed=false => le type décide du sens (par défaut).
  const isCredit = args.signed === undefined ? CREDIT_TYPES.includes(args.transactionType) : args.signed;
  const stored = isCredit ? Math.abs(amount) : -Math.abs(amount);

  return prisma.cashTransaction.create({
    data: {
      cashSessionId: session.id,
      storeId: args.storeId,
      transactionType: args.transactionType,
      amountAr: stored,
      source: args.source ?? 'MANUAL',
      method: args.method ?? 'CASH',
      description: args.description ?? null,
      saleId: args.saleId ?? null,
      expenseId: args.expenseId ?? null,
      purchaseId: args.purchaseId ?? null,
      createdById: args.userId,
    },
  });
}

export async function removeCashMovements(args: {
  storeId: string;
  expenseId?: string;
  purchaseId?: string;
  saleId?: string;
}) {
  return prisma.cashTransaction.deleteMany({
    where: {
      storeId: args.storeId,
      ...(args.expenseId ? { expenseId: args.expenseId } : {}),
      ...(args.purchaseId ? { purchaseId: args.purchaseId } : {}),
      ...(args.saleId ? { saleId: args.saleId } : {}),
    },
  });
}

async function sessionTotals(sessionId: string) {
  const agg = await prisma.cashTransaction.aggregate({
    where: { cashSessionId: sessionId },
    _sum: { amountAr: true },
    _count: true,
  });
  const net = Number(agg._sum.amountAr ?? 0);
  return {
    movementsCount: agg._count,
    inflowAr: net > 0 ? net : 0,
    outflowAr: net < 0 ? Math.abs(net) : 0,
    netAr: net,
  };
}

function serializeSession(session: any, totals: { movementsCount: number; inflowAr: number; outflowAr: number; netAr: number }) {
  const opening = Number(session.openingBalanceAr);
  return {
    id: session.id,
    status: session.status,
    openingBalanceAr: opening,
    closingBalanceAr: session.closingBalanceAr === null ? null : Number(session.closingBalanceAr),
    expectedCloseAr: session.expectedCloseAr === null ? null : Number(session.expectedCloseAr),
    differenceAr: session.differenceAr === null ? null : Number(session.differenceAr),
    theoreticalAr: opening + totals.netAr,
    openedAt: session.openedAt,
    closedAt: session.closedAt,
    openedByName: session.openedBy?.fullName ?? null,
    notes: session.notes,
    ...totals,
  };
}

export async function openSession(storeId: string, userId: string, input: OpenSessionInput) {
  const existing = await getOpenSession(storeId);
  if (existing) throw badRequest('Une caisse est déjà ouverte. Clôturez-la avant d\'en ouvrir une nouvelle.');

  const opening = Number(input.openingBalanceAr ?? 0);
  const session = await prisma.cashSession.create({
    data: {
      storeId,
      openedById: userId,
      openingBalanceAr: opening,
      status: 'OPEN',
      notes: input.notes || null,
    },
    include: { openedBy: { select: { id: true, fullName: true } } },
  });

  return serializeSession(session, { movementsCount: 0, inflowAr: 0, outflowAr: 0, netAr: 0 });
}

export async function closeSession(storeId: string, userId: string, input: CloseSessionInput) {
  const session = await getOpenSession(storeId);
  if (!session) throw badRequest('Aucune caisse ouverte à clôturer');

  const totals = await sessionTotals(session.id);
  const expected = Number(session.openingBalanceAr) + totals.netAr;
  const closing = Number(input.closingBalanceAr);

  const closed = await prisma.cashSession.update({
    where: { id: session.id },
    data: {
      status: 'CLOSED',
      closedAt: new Date(),
      closedById: userId,
      closingBalanceAr: closing,
      expectedCloseAr: expected,
      differenceAr: closing - expected,
      notes: input.notes || session.notes,
    },
    include: {
      openedBy: { select: { id: true, fullName: true } },
    },
  });

  return serializeSession(closed, totals);
}

export async function listSessions(
  storeId: string,
  query: { status?: string; page?: number; limit?: number } = {},
) {
  const page = Math.max(1, Number(query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));
  const where: Record<string, any> = { storeId };
  if (query.status) where.status = query.status;

  const [sessions, total] = await Promise.all([
    prisma.cashSession.findMany({
      where,
      include: {
        openedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { openedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.cashSession.count({ where }),
  ]);

  const data = await Promise.all(
    sessions.map(async (s) => serializeSession(s, await sessionTotals(s.id))),
  );

  return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function getSessionDetail(storeId: string, sessionId: string) {
  const session = await prisma.cashSession.findFirst({
    where: { id: sessionId, storeId },
    include: {
      openedBy: { select: { id: true, fullName: true } },
    },
  });
  if (!session) throw notFound('Session de caisse introuvable');

  const [transactions, totals] = await Promise.all([
    prisma.cashTransaction.findMany({
      where: { cashSessionId: session.id },
      orderBy: { createdAt: 'asc' },
    }),
    sessionTotals(session.id),
  ]);

  return {
    ...serializeSession(session, totals),
    transactions: transactions.map((t) => ({
      id: t.id,
      transactionType: t.transactionType,
      amountAr: Number(t.amountAr),
      source: t.source,
      method: t.method,
      description: t.description,
      saleId: t.saleId,
      expenseId: t.expenseId,
      purchaseId: t.purchaseId,
      createdAt: t.createdAt,
    })),
  };
}

export async function addTransaction(
  storeId: string,
  userId: string,
  input: CashTransactionInput,
) {
  const session = await getOpenSession(storeId);
  if (!session) throw badRequest('Ouvrez d\'abord la caisse');

  const created = await recordCashMovement({
    storeId,
    userId,
    transactionType: input.transactionType,
    amountAr: Number(input.amountAr),
    method: input.method,
    source: 'MANUAL',
    description: input.description || null,
  });
  if (!created) throw badRequest('Mouvement enregistré');

  const totals = await sessionTotals(session.id);
  return {
    transaction: {
      id: created.id,
      transactionType: created.transactionType,
      amountAr: Number(created.amountAr),
      method: created.method,
      description: created.description,
      createdAt: created.createdAt,
    },
    ...serializeSession(
      await prisma.cashSession.findUnique({
        where: { id: session.id },
        include: { openedBy: { select: { id: true, fullName: true } } },
      }),
      totals,
    ),
  };
}
