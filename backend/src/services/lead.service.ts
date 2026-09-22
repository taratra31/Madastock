import prisma from '../lib/prisma';
import { badRequest, notFound } from '../utils/httpError';

export interface LeadInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  source?: string;
  status?: string;
  valueAr?: number;
  notes?: string;
  assignedToId?: string;
  nextFollowUpAt?: string;
}

const VALID_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'FOLLOW_UP', 'WON', 'LOST'];

export async function listLeads(
  storeId: string,
  query: { status?: string; search?: string; assignedToId?: string; page?: number; limit?: number }
) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));

  const where: Record<string, unknown> = { storeId };
  if (query.status) where.status = query.status;
  if (query.assignedToId) where.assignedToId = query.assignedToId;
  if (query.search) {
    const q = query.search.trim();
    where.OR = [
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q } },
      { email: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [total, leads] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, fullName: true } },
        convertedCustomer: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    data: leads.map((l) => serializeLead(l)),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getLeadFunnel(storeId: string) {
  const grouped = await prisma.lead.groupBy({
    by: ['status'],
    where: { storeId },
    _count: { _all: true },
  });
  const stats: Record<string, number> = {};
  for (const s of VALID_STATUSES) stats[s] = 0;
  for (const g of grouped) stats[g.status] = g._count._all;
  const total = grouped.reduce((sum, g) => sum + g._count._all, 0);
  return { total, stats };
}

export async function getLead(storeId: string, leadId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, storeId },
    include: {
      assignedTo: { select: { id: true, fullName: true } },
      convertedCustomer: true,
      interactions: { orderBy: { createdAt: 'desc' }, take: 30 },
      reminders: { where: { status: { in: ['PENDING', 'SENT'] } }, orderBy: { remindAt: 'asc' }, take: 20 },
    },
  });
  if (!lead) throw notFound('Lead introuvable');
  return serializeLead(lead);
}

export async function createLead(storeId: string, input: LeadInput) {
  if (!input.firstName || !input.lastName) throw badRequest('firstName et lastName requis');
  return serializeLead(
    await prisma.lead.create({
      data: {
        storeId,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone || null,
        email: input.email || null,
        source: input.source ?? 'WALK_IN',
        status: input.status ?? 'NEW',
        valueAr: input.valueAr ?? null,
        notes: input.notes || null,
        assignedToId: input.assignedToId || null,
        nextFollowUpAt: input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : null,
        firstContactAt: input.status === 'CONTACTED' ? new Date() : null,
      },
      include: { assignedTo: { select: { id: true, fullName: true } } },
    })
  );
}

export async function updateLead(storeId: string, leadId: string, input: LeadInput) {
  const existing = await prisma.lead.findFirst({ where: { id: leadId, storeId } });
  if (!existing) throw notFound('Lead introuvable');
  return serializeLead(
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        firstName: input.firstName ?? existing.firstName,
        lastName: input.lastName ?? existing.lastName,
        phone: input.phone !== undefined ? input.phone : existing.phone,
        email: input.email !== undefined ? input.email : existing.email,
        source: input.source ?? existing.source,
        status: input.status ?? existing.status,
        valueAr: input.valueAr !== undefined ? input.valueAr : existing.valueAr,
        notes: input.notes !== undefined ? input.notes : existing.notes,
        assignedToId: input.assignedToId !== undefined ? input.assignedToId : existing.assignedToId,
        nextFollowUpAt:
          input.nextFollowUpAt !== undefined
            ? input.nextFollowUpAt
              ? new Date(input.nextFollowUpAt)
              : null
            : existing.nextFollowUpAt,
        lastContactAt:
          input.status === 'CONTACTED' || input.status === 'FOLLOW_UP' ? new Date() : existing.lastContactAt,
      },
      include: { assignedTo: { select: { id: true, fullName: true } } },
    })
  );
}

export async function setLeadStatus(storeId: string, leadId: string, status: string) {
  if (!VALID_STATUSES.includes(status)) throw badRequest('Statut invalide');
  const existing = await prisma.lead.findFirst({ where: { id: leadId, storeId } });
  if (!existing) throw notFound('Lead introuvable');
  return serializeLead(
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        status,
        firstContactAt: existing.firstContactAt ?? (status === 'CONTACTED' ? new Date() : undefined),
        lastContactAt: status === 'CONTACTED' || status === 'FOLLOW_UP' ? new Date() : undefined,
      },
      include: { assignedTo: { select: { id: true, fullName: true } } },
    })
  );
}

export async function convertLead(storeId: string, leadId: string) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, storeId } });
  if (!lead) throw notFound('Lead introuvable');

  let customer = lead.convertedCustomerId
    ? await prisma.customer.findFirst({ where: { id: lead.convertedCustomerId } })
    : null;

  await prisma.$transaction(async (tx) => {
    if (!customer) {
      customer = await tx.customer.create({
        data: {
          storeId,
          firstName: lead.firstName,
          lastName: lead.lastName,
          phone: lead.phone,
          email: lead.email,
          notes: `Converti depuis un lead (${lead.source})`,
        },
      });
    }
    await tx.lead.update({
      where: { id: leadId },
      data: { status: 'WON', convertedCustomerId: customer.id },
    });
  });

  return getLead(storeId, leadId);
}

export async function deleteLead(storeId: string, leadId: string) {
  const existing = await prisma.lead.findFirst({ where: { id: leadId, storeId } });
  if (!existing) throw notFound('Lead introuvable');
  await prisma.lead.delete({ where: { id: leadId } });
}

export function serializeLead(l: {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  source: string;
  status: string;
  valueAr: unknown;
  notes: string | null;
  nextFollowUpAt: Date | null;
  firstContactAt: Date | null;
  lastContactAt: Date | null;
  createdAt: Date;
  assignedTo?: { id: string; fullName: string } | null;
  convertedCustomer?: { id: string; firstName: string; lastName: string } | null;
}) {
  return {
    id: l.id,
    fullName: `${l.firstName} ${l.lastName}`.trim(),
    firstName: l.firstName,
    lastName: l.lastName,
    phone: l.phone,
    email: l.email,
    source: l.source,
    status: l.status,
    valueAr: l.valueAr ? Number(l.valueAr) : null,
    notes: l.notes,
    nextFollowUpAt: l.nextFollowUpAt,
    firstContactAt: l.firstContactAt,
    lastContactAt: l.lastContactAt,
    createdAt: l.createdAt,
    assignedTo: l.assignedTo,
    convertedCustomer: l.convertedCustomer,
  };
}