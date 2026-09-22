import prisma from '../lib/prisma';
import { badRequest, notFound } from '../utils/httpError';

export interface InteractionInput {
  type?: string;
  subject?: string;
  body?: string;
  customerId?: string;
  leadId?: string;
  workOrderId?: string;
}

export async function listInteractions(storeId: string, query: { customerId?: string; leadId?: string; workOrderId?: string }) {
  const where: Record<string, unknown> = { storeId };
  if (query.customerId) where.customerId = query.customerId;
  if (query.leadId) where.leadId = query.leadId;
  if (query.workOrderId) where.workOrderId = query.workOrderId;

  const interactions = await prisma.interaction.findMany({
    where,
    include: {
      performedBy: { select: { id: true, fullName: true } },
      customer: { select: { id: true, firstName: true, lastName: true } },
      lead: { select: { id: true, firstName: true, lastName: true } },
      workOrder: { select: { id: true, orderNumber: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return {
    data: interactions.map((i) => ({
      id: i.id,
      type: i.type,
      subject: i.subject,
      body: i.body,
      createdAt: i.createdAt,
      performedBy: i.performedBy,
      customer: i.customer ? { id: i.customer.id, fullName: `${i.customer.firstName} ${i.customer.lastName}`.trim() } : null,
      lead: i.lead ? { id: i.lead.id, fullName: `${i.lead.firstName} ${i.lead.lastName}`.trim() } : null,
      workOrder: i.workOrder,
    })),
  };
}

export async function createInteraction(storeId: string, userId: string, input: InteractionInput) {
  if (!input.type) throw badRequest('type requis');
  if (!input.customerId && !input.leadId && !input.workOrderId) {
    throw badRequest('customerId, leadId ou workOrderId requis');
  }

  const interaction = await prisma.interaction.create({
    data: {
      storeId,
      type: input.type,
      subject: input.subject || null,
      body: input.body || null,
      customerId: input.customerId || null,
      leadId: input.leadId || null,
      workOrderId: input.workOrderId || null,
      performedById: userId,
    },
  });

  if (input.leadId) {
    await prisma.lead.update({
      where: { id: input.leadId },
      data: { lastContactAt: new Date(), status: 'CONTACTED' },
    });
  }

  return interaction;
}

export async function deleteInteraction(storeId: string, interactionId: string) {
  const existing = await prisma.interaction.findFirst({ where: { id: interactionId, storeId } });
  if (!existing) throw notFound('Interaction introuvable');
  await prisma.interaction.delete({ where: { id: interactionId } });
}