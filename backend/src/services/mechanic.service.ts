import prisma from '../lib/prisma';
import { badRequest, notFound } from '../utils/httpError';

export interface MechanicInput {
  fullName?: string;
  phone?: string;
  email?: string;
  specialty?: string;
  hourlyRateAr?: number;
  commissionPct?: number;
  colorHex?: string;
  isActive?: boolean;
}

export async function listMechanics(storeId: string) {
  const mechanics = await prisma.mechanic.findMany({
    where: { storeId },
    include: {
      _count: { select: { workOrders: true, appointments: true } },
      workOrders: {
        where: { status: { in: ['IN_PROGRESS', 'WAITING_PART', 'QUOTED'] } },
        select: { id: true, orderNumber: true, status: true, completedAt: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return {
    data: mechanics.map((m) => ({
      id: m.id,
      fullName: m.fullName,
      phone: m.phone,
      email: m.email,
      specialty: m.specialty,
      hourlyRateAr: m.hourlyRateAr ? Number(m.hourlyRateAr) : null,
      commissionPct: m.commissionPct ? Number(m.commissionPct) : null,
      colorHex: m.colorHex,
      isActive: m.isActive,
      workOrdersCount: m._count.workOrders,
      appointmentsCount: m._count.appointments,
      activeJobs: m.workOrders,
      createdAt: m.createdAt,
    })),
  };
}

export async function getMechanic(storeId: string, mechanicId: string) {
  const mechanic = await prisma.mechanic.findFirst({
    where: { id: mechanicId, storeId },
    include: {
      workOrders: { orderBy: { createdAt: 'desc' }, take: 20 },
      appointments: { orderBy: { scheduledAt: 'desc' }, take: 20 },
      _count: { select: { workOrders: true, appointments: true } },
    },
  });
  if (!mechanic) throw notFound('Mécanicien introuvable');
  return {
    ...mechanic,
    hourlyRateAr: mechanic.hourlyRateAr ? Number(mechanic.hourlyRateAr) : null,
    commissionPct: mechanic.commissionPct ? Number(mechanic.commissionPct) : null,
    workOrders: mechanic.workOrders.map((wo) => ({ ...wo, totalAr: Number(wo.totalAr) })),
  };
}

export async function createMechanic(storeId: string, input: MechanicInput) {
  if (!input.fullName) throw badRequest('fullName requis');
  return prisma.mechanic.create({
    data: {
      storeId,
      fullName: input.fullName,
      phone: input.phone || null,
      email: input.email || null,
      specialty: input.specialty || null,
      hourlyRateAr: input.hourlyRateAr ?? null,
      commissionPct: input.commissionPct ?? null,
      colorHex: input.colorHex || null,
      isActive: input.isActive ?? true,
    },
  });
}

export async function updateMechanic(storeId: string, mechanicId: string, input: MechanicInput) {
  const existing = await prisma.mechanic.findFirst({ where: { id: mechanicId, storeId } });
  if (!existing) throw notFound('Mécanicien introuvable');
  return prisma.mechanic.update({
    where: { id: mechanicId },
    data: {
      fullName: input.fullName ?? existing.fullName,
      phone: input.phone !== undefined ? input.phone : existing.phone,
      email: input.email !== undefined ? input.email : existing.email,
      specialty: input.specialty !== undefined ? input.specialty : existing.specialty,
      hourlyRateAr: input.hourlyRateAr !== undefined ? input.hourlyRateAr : existing.hourlyRateAr,
      commissionPct: input.commissionPct !== undefined ? input.commissionPct : existing.commissionPct,
      colorHex: input.colorHex !== undefined ? input.colorHex : existing.colorHex,
      isActive: input.isActive !== undefined ? input.isActive : existing.isActive,
    },
  });
}

export async function deleteMechanic(storeId: string, mechanicId: string) {
  const existing = await prisma.mechanic.findFirst({ where: { id: mechanicId, storeId } });
  if (!existing) throw notFound('Mécanicien introuvable');
  await prisma.mechanic.update({
    where: { id: mechanicId },
    data: { isActive: false },
  });
}