import prisma from '../lib/prisma';
import { badRequest, notFound } from '../utils/httpError';

export interface ReminderInput {
  type?: string;
  remindAt?: string;
  title?: string;
  message?: string;
  customerId?: string;
  leadId?: string;
  vehicleId?: string;
  workOrderId?: string;
  invoiceId?: string;
  assignedToId?: string;
}

export async function listReminders(
  storeId: string,
  query: { status?: string; type?: string; upcoming?: boolean }
) {
  const where: Record<string, unknown> = { storeId };
  if (query.status) where.status = query.status;
  if (query.type) where.type = query.type;
  if (query.upcoming) {
    where.status = { in: ['PENDING', 'SENT'] };
    where.remindAt = { gte: new Date() };
  }

  const reminders = await prisma.reminder.findMany({
    where,
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      lead: { select: { id: true, firstName: true, lastName: true, phone: true } },
      vehicle: { select: { id: true, plateNumber: true } },
      workOrder: { select: { id: true, orderNumber: true } },
      invoice: { select: { id: true, number: true } },
      assignedTo: { select: { id: true, fullName: true } },
    },
    orderBy: [{ status: 'asc' }, { remindAt: 'asc' }],
    take: 300,
  });

  return {
    data: reminders.map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      remindAt: r.remindAt,
      title: r.title,
      message: r.message,
      completedAt: r.completedAt,
      createdAt: r.createdAt,
      customer: r.customer ? { id: r.customer.id, fullName: `${r.customer.firstName} ${r.customer.lastName}`.trim(), phone: r.customer.phone } : null,
      lead: r.lead ? { id: r.lead.id, fullName: `${r.lead.firstName} ${r.lead.lastName}`.trim(), phone: r.lead.phone } : null,
      vehicle: r.vehicle,
      workOrder: r.workOrder,
      invoice: r.invoice,
      assignedTo: r.assignedTo,
    })),
  };
}

export async function createReminder(storeId: string, input: ReminderInput) {
  if (!input.type) throw badRequest('type requis');
  if (!input.remindAt) throw badRequest('remindAt requis');
  if (!input.title) throw badRequest('title requis');
  return prisma.reminder.create({
    data: {
      storeId,
      type: input.type,
      remindAt: new Date(input.remindAt),
      title: input.title,
      message: input.message || null,
      customerId: input.customerId || null,
      leadId: input.leadId || null,
      vehicleId: input.vehicleId || null,
      workOrderId: input.workOrderId || null,
      invoiceId: input.invoiceId || null,
      assignedToId: input.assignedToId || null,
    },
  });
}

export async function updateReminder(storeId: string, reminderId: string, input: ReminderInput) {
  const existing = await prisma.reminder.findFirst({ where: { id: reminderId, storeId } });
  if (!existing) throw notFound('Rappel introuvable');
  return prisma.reminder.update({
    where: { id: reminderId },
    data: {
      type: input.type ?? existing.type,
      remindAt: input.remindAt ? new Date(input.remindAt) : existing.remindAt,
      title: input.title ?? existing.title,
      message: input.message !== undefined ? input.message : existing.message,
      customerId: input.customerId !== undefined ? input.customerId : existing.customerId,
      leadId: input.leadId !== undefined ? input.leadId : existing.leadId,
      vehicleId: input.vehicleId !== undefined ? input.vehicleId : existing.vehicleId,
      workOrderId: input.workOrderId !== undefined ? input.workOrderId : existing.workOrderId,
      invoiceId: input.invoiceId !== undefined ? input.invoiceId : existing.invoiceId,
      assignedToId: input.assignedToId !== undefined ? input.assignedToId : existing.assignedToId,
    },
  });
}

export async function setReminderStatus(storeId: string, reminderId: string, status: string) {
  const existing = await prisma.reminder.findFirst({ where: { id: reminderId, storeId } });
  if (!existing) throw notFound('Rappel introuvable');
  if (!['PENDING', 'SENT', 'DONE', 'CANCELLED'].includes(status)) throw badRequest('Statut invalide');
  return prisma.reminder.update({
    where: { id: reminderId },
    data: { status, completedAt: status === 'DONE' ? new Date() : null },
  });
}

export async function deleteReminder(storeId: string, reminderId: string) {
  const existing = await prisma.reminder.findFirst({ where: { id: reminderId, storeId } });
  if (!existing) throw notFound('Rappel introuvable');
  await prisma.reminder.delete({ where: { id: reminderId } });
}