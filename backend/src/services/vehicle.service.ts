import prisma from '../lib/prisma';
import { badRequest, notFound } from '../utils/httpError';

export interface VehicleInput {
  customerId?: string;
  plateNumber?: string;
  make?: string;
  model?: string;
  year?: number;
  vin?: string;
  color?: string;
  engineNo?: string;
  mileageKm?: number;
  fuelType?: string;
  vehicleType?: string;
  notes?: string;
  isActive?: boolean;
}

export async function listVehicles(
  storeId: string,
  query: { search?: string; customerId?: string; page?: number; limit?: number }
) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));

  const where: Record<string, unknown> = { storeId, isActive: true };
  if (query.customerId) where.customerId = query.customerId;
  if (query.search) {
    const q = query.search.trim();
    where.OR = [
      { plateNumber: { contains: q } },
      { make: { contains: q } },
      { model: { contains: q } },
      { engineNo: { contains: q } },
      { vin: { contains: q } },
      {
        customer: {
          OR: [
            { firstName: { contains: q } },
            { lastName: { contains: q } },
            { phone: { contains: q } },
          ],
        },
      },
    ];
  }

  const [total, vehicles] = await Promise.all([
    prisma.vehicle.count({ where }),
    prisma.vehicle.findMany({
      where,
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
        _count: { select: { workOrders: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    data: vehicles.map(serializeVehicle),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getVehicle(storeId: string, vehicleId: string) {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, storeId },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
      workOrders: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { mechanic: { select: { id: true, fullName: true } } },
      },
      appointments: { orderBy: { scheduledAt: 'desc' }, take: 10 },
    },
  });
  if (!vehicle) throw notFound('Véhicule introuvable');
  return {
    ...serializeVehicle(vehicle),
    customer: vehicle.customer,
    workOrders: vehicle.workOrders.map((wo) => ({ ...wo, totalAr: Number(wo.totalAr) })),
    appointments: vehicle.appointments,
  };
}

export async function createVehicle(storeId: string, input: VehicleInput) {
  if (!input.customerId) throw badRequest('customerId requis');
  if (!input.plateNumber) throw badRequest('Immatriculation requise');

  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, storeId, isActive: true },
  });
  if (!customer) throw notFound('Client introuvable');

  const exists = await prisma.vehicle.findUnique({ where: { storeId_plateNumber: { storeId, plateNumber: input.plateNumber } } });
  if (exists) throw badRequest('Un véhicule avec cette immatriculation existe déjà');

  return serializeVehicle(
    await prisma.vehicle.create({
      data: {
        storeId,
        customerId: input.customerId,
        plateNumber: input.plateNumber,
        make: input.make || null,
        model: input.model || null,
        year: input.year ?? null,
        vin: input.vin || null,
        color: input.color || null,
        engineNo: input.engineNo || null,
        mileageKm: input.mileageKm ?? null,
        fuelType: input.fuelType ?? 'PETROL',
        vehicleType: input.vehicleType ?? 'CAR',
        notes: input.notes || null,
      },
    })
  );
}

export async function updateVehicle(storeId: string, vehicleId: string, input: VehicleInput) {
  const existing = await prisma.vehicle.findFirst({ where: { id: vehicleId, storeId } });
  if (!existing) throw notFound('Véhicule introuvable');

  if (input.plateNumber && input.plateNumber !== existing.plateNumber) {
    const dup = await prisma.vehicle.findUnique({
      where: { storeId_plateNumber: { storeId, plateNumber: input.plateNumber } },
    });
    if (dup && dup.id !== vehicleId) throw badRequest('Immatriculation déjà utilisée');
  }

  return serializeVehicle(
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        customerId: input.customerId ?? existing.customerId,
        plateNumber: input.plateNumber ?? existing.plateNumber,
        make: input.make !== undefined ? input.make : existing.make,
        model: input.model !== undefined ? input.model : existing.model,
        year: input.year !== undefined ? input.year : existing.year,
        vin: input.vin !== undefined ? input.vin : existing.vin,
        color: input.color !== undefined ? input.color : existing.color,
        engineNo: input.engineNo !== undefined ? input.engineNo : existing.engineNo,
        mileageKm: input.mileageKm !== undefined ? input.mileageKm : existing.mileageKm,
        fuelType: input.fuelType ?? existing.fuelType,
        vehicleType: input.vehicleType ?? existing.vehicleType,
        notes: input.notes !== undefined ? input.notes : existing.notes,
        isActive: input.isActive !== undefined ? input.isActive : existing.isActive,
      },
    })
  );
}

export async function deleteVehicle(storeId: string, vehicleId: string) {
  const existing = await prisma.vehicle.findFirst({ where: { id: vehicleId, storeId } });
  if (!existing) throw notFound('Véhicule introuvable');
  await prisma.vehicle.update({ where: { id: vehicleId }, data: { isActive: false } });
}

function serializeVehicle(v: {
  id: string;
  plateNumber: string;
  make: string | null;
  model: string | null;
  year: number | null;
  vin: string | null;
  color: string | null;
  engineNo: string | null;
  mileageKm: number | null;
  fuelType: string;
  vehicleType: string;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  customer?: { id: string; firstName: string; lastName: string; phone: string | null } | null;
  _count?: { workOrders: number };
}) {
  return {
    id: v.id,
    plateNumber: v.plateNumber,
    make: v.make,
    model: v.model,
    label: [v.make, v.model, v.year ? `(${v.year})` : null].filter(Boolean).join(' ') || 'Véhicule',
    year: v.year,
    vin: v.vin,
    color: v.color,
    engineNo: v.engineNo,
    mileageKm: v.mileageKm,
    fuelType: v.fuelType,
    vehicleType: v.vehicleType,
    notes: v.notes,
    isActive: v.isActive,
    createdAt: v.createdAt,
    customer: v.customer
      ? {
          id: v.customer.id,
          fullName: `${v.customer.firstName} ${v.customer.lastName}`.trim(),
          phone: v.customer.phone,
        }
      : null,
    workOrdersCount: v._count?.workOrders ?? 0,
  };
}