import prisma from '../lib/prisma';
import { badRequest, notFound } from '../utils/httpError';

export interface AppointmentInput {
  customerId?: string;
  vehicleId?: string;
  mechanicId?: string;
  workOrderId?: string;
  type?: string;
  status?: string;
  scheduledAt?: string;
  durationMin?: number;
  title?: string;
  notes?: string;
}

export async function listAppointments(
  storeId: string,
  query: { from?: string; to?: string; status?: string; mechanicId?: string; customerId?: string }
) {
  const where: Record<string, any> = { storeId };
  if (query.status) where.status = query.status;
  if (query.mechanicId) where.mechanicId = query.mechanicId;
  if (query.customerId) where.customerId = query.customerId;
  if (query.from || query.to) {
    where.scheduledAt = {};
    if (query.from) where.scheduledAt.gte = new Date(query.from);
    if (query.to) where.scheduledAt.lte = new Date(query.to);
  }

  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      vehicle: { select: { id: true, plateNumber: true, make: true, model: true } },
      mechanic: { select: { id: true, fullName: true, colorHex: true } },
      workOrder: { select: { id: true, orderNumber: true, status: true } },
    },
    orderBy: { scheduledAt: 'asc' },
  });

  return {
    data: appointments.map((a) => ({
      id: a.id,
      type: a.type,
      status: a.status,
      scheduledAt: a.scheduledAt,
      durationMin: a.durationMin,
      title: a.title,
      notes: a.notes,
      customer: a.customer
        ? { id: a.customer.id, fullName: `${a.customer.firstName} ${a.customer.lastName}`.trim(), phone: a.customer.phone }
        : null,
      vehicle: a.vehicle
        ? { id: a.vehicle.id, plateNumber: a.vehicle.plateNumber, label: [a.vehicle.make, a.vehicle.model].filter(Boolean).join(' ') }
        : null,
      mechanic: a.mechanic ? { id: a.mechanic.id, fullName: a.mechanic.fullName, colorHex: a.mechanic.colorHex } : null,
      workOrder: a.workOrder ? { id: a.workOrder.id, orderNumber: a.workOrder.orderNumber, status: a.workOrder.status } : null,
    })),
  };
}

export async function getAppointment(storeId: string, appointmentId: string) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, storeId },
    include: {
      customer: true,
      vehicle: true,
      mechanic: true,
      workOrder: true,
      createdBy: { select: { id: true, fullName: true } },
    },
  });
  if (!appointment) throw notFound('Rendez-vous introuvable');
  return appointment;
}

export async function createAppointment(storeId: string, userId: string, input: AppointmentInput) {
  if (!input.customerId) throw badRequest('customerId requis');
  if (!input.scheduledAt) throw badRequest('scheduledAt requis');

  const customer = await prisma.customer.findFirst({ where: { id: input.customerId, storeId, isActive: true } });
  if (!customer) throw notFound('Client introuvable');

  return prisma.appointment.create({
    data: {
      storeId,
      customerId: input.customerId,
      vehicleId: input.vehicleId || null,
      mechanicId: input.mechanicId || null,
      workOrderId: input.workOrderId || null,
      type: input.type ?? 'REPAIR',
      status: input.status ?? 'SCHEDULED',
      scheduledAt: new Date(input.scheduledAt),
      durationMin: input.durationMin ?? 60,
      title: input.title || null,
      notes: input.notes || null,
      createdById: userId,
    },
  });
}

export async function updateAppointment(storeId: string, appointmentId: string, input: AppointmentInput) {
  const existing = await prisma.appointment.findFirst({ where: { id: appointmentId, storeId } });
  if (!existing) throw notFound('Rendez-vous introuvable');
  return prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      customerId: input.customerId ?? existing.customerId,
      vehicleId: input.vehicleId !== undefined ? input.vehicleId : existing.vehicleId,
      mechanicId: input.mechanicId !== undefined ? input.mechanicId : existing.mechanicId,
      workOrderId: input.workOrderId !== undefined ? input.workOrderId : existing.workOrderId,
      type: input.type ?? existing.type,
      status: input.status ?? existing.status,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : existing.scheduledAt,
      durationMin: input.durationMin ?? existing.durationMin,
      title: input.title !== undefined ? input.title : existing.title,
      notes: input.notes !== undefined ? input.notes : existing.notes,
    },
  });
}

export async function setAppointmentStatus(storeId: string, appointmentId: string, status: string) {
  const existing = await prisma.appointment.findFirst({ where: { id: appointmentId, storeId } });
  if (!existing) throw notFound('Rendez-vous introuvable');
  return prisma.appointment.update({ where: { id: appointmentId }, data: { status } });
}

export async function deleteAppointment(storeId: string, appointmentId: string) {
  const existing = await prisma.appointment.findFirst({ where: { id: appointmentId, storeId } });
  if (!existing) throw notFound('Rendez-vous introuvable');
  await prisma.appointment.delete({ where: { id: appointmentId } });
}