import prisma from '../lib/prisma';
import type {
  Prisma,
} from '@prisma/client';
import { badRequest, notFound } from '../utils/httpError';

export interface WorkOrderItemInput {
  type?: 'LABOR' | 'PART' | 'OTHER';
  description?: string;
  productId?: string;
  quantity?: number;
  unitPrice?: number;
  discount?: number;
  tax?: number;
}

export interface WorkOrderInput {
  customerId?: string;
  vehicleId?: string;
  mechanicId?: string;
  status?: string;
  priority?: string;
  complaint?: string;
  diagnosis?: string;
  receivedAt?: string;
  estimatedDeliveryAt?: string;
  discount?: number;
  tax?: number;
  notes?: string;
  paymentMethod?: string;
  items?: WorkOrderItemInput[];
}

interface ItemRow {
  type: 'LABOR' | 'PART' | 'OTHER';
  description: string;
  productId: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  lineTotal: number;
}

export async function listWorkOrders(
  storeId: string,
  query: {
    status?: string;
    mechanicId?: string;
    vehicleId?: string;
    customerId?: string;
    search?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }
) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));

  const where: Record<string, any> = { storeId };
  if (query.status) where.status = query.status;
  if (query.mechanicId) where.mechanicId = query.mechanicId;
  if (query.vehicleId) where.vehicleId = query.vehicleId;
  if (query.customerId) where.customerId = query.customerId;
  if (query.from || query.to) {
    where.receivedAt = {};
    if (query.from) where.receivedAt.gte = new Date(query.from);
    if (query.to) where.receivedAt.lte = new Date(query.to);
  }
  if (query.search) {
    const q = query.search.trim();
    where.OR = [
      { orderNumber: { contains: q, mode: 'insensitive' } },
      { complaint: { contains: q, mode: 'insensitive' } },
      { diagnosis: { contains: q, mode: 'insensitive' } },
      {
        customer: {
          OR: [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q } },
          ],
        },
      },
      { vehicle: { plateNumber: { contains: q, mode: 'insensitive' } } },
    ];
  }

  const [total, workOrders] = await Promise.all([
    prisma.workOrder.count({ where }),
    prisma.workOrder.findMany({
      where,
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
        vehicle: { select: { id: true, plateNumber: true, make: true, model: true } },
        mechanic: { select: { id: true, fullName: true, colorHex: true } },
        _count: { select: { items: true } },
      },
      orderBy: { receivedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    data: workOrders.map(serializeWorkOrder),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getWorkOrder(storeId: string, workOrderId: string) {
  const workOrder = await prisma.workOrder.findFirst({
    where: { id: workOrderId, storeId },
    include: {
      customer: true,
      vehicle: true,
      mechanic: true,
      items: { include: { product: { select: { id: true, name: true, sku: true } } }, orderBy: { createdAt: 'asc' } },
      appointments: { orderBy: { scheduledAt: 'desc' }, take: 10 },
      invoice: true,
      interactions: { orderBy: { createdAt: 'desc' }, take: 10 },
      reminders: { orderBy: { remindAt: 'asc' }, take: 10 },
    },
  });
  if (!workOrder) throw notFound('Ordre de réparation introuvable');
  return serializeWorkOrderDetail(workOrder);
}

export async function createWorkOrder(storeId: string, userId: string, input: WorkOrderInput) {
  if (!input.customerId) throw badRequest('customerId requis');
  const customerId: string = input.customerId;

  const customer = await prisma.customer.findFirst({ where: { id: customerId, storeId, isActive: true } });
  if (!customer) throw notFound('Client introuvable');

  const items = computeItems(input.items ?? []);
  const { laborCost, partsCost } = computeCosts(items);
  const discount = input.discount ?? 0;
  const tax = input.tax ?? 0;
  const total = laborCost + partsCost - discount + tax;

  const orderNumber = await generateOrderNumber(storeId);

  return prisma.$transaction(async (tx) => {
    const workOrder = await tx.workOrder.create({
      data: {
        storeId,
        orderNumber,
        customerId,
        vehicleId: input.vehicleId || null,
        mechanicId: input.mechanicId || null,
        status: input.status ?? 'QUOTED',
        priority: input.priority ?? 'NORMAL',
        complaint: input.complaint || null,
        diagnosis: input.diagnosis || null,
        receivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(),
        estimatedDeliveryAt: input.estimatedDeliveryAt ? new Date(input.estimatedDeliveryAt) : null,
        laborCostAr: laborCost,
        partsCostAr: partsCost,
        discountAr: discount,
        taxAr: tax,
        totalAr: total,
        paymentMethod: input.paymentMethod ?? null,
        notes: input.notes || null,
        createdById: userId,
        items: {
          create: items.map((it) => ({
            type: it.type,
            description: it.description,
            productId: it.productId,
            quantityAr: it.quantity,
            unitPriceAr: it.unitPrice,
            discountAr: it.discount,
            taxAr: it.tax,
            lineTotalAr: it.lineTotal,
          })),
        },
      },
      include: { customer: true, vehicle: true, mechanic: true, items: true },
    });
    return serializeWorkOrderDetail(workOrder);
  });
}

export async function updateWorkOrder(storeId: string, workOrderId: string, input: WorkOrderInput) {
  const existing = await prisma.workOrder.findFirst({ where: { id: workOrderId, storeId } });
  if (!existing) throw notFound('Ordre de réparation introuvable');

  const items = input.items ? computeItems(input.items) : null;
  const discount = input.discount ?? Number(existing.discountAr);
  const tax = input.tax ?? Number(existing.taxAr);

  const { laborCost, partsCost } = items
    ? computeCosts(items)
    : { laborCost: Number(existing.laborCostAr), partsCost: Number(existing.partsCostAr) };
  const total = laborCost + partsCost - discount + tax;

  return prisma.$transaction(async (tx) => {
    if (items) {
      await tx.workOrderItem.deleteMany({ where: { workOrderId } });
    }
    const workOrder = await tx.workOrder.update({
      where: { id: workOrderId },
      data: {
        customerId: input.customerId ?? existing.customerId,
        vehicleId: input.vehicleId !== undefined ? input.vehicleId : existing.vehicleId,
        mechanicId: input.mechanicId !== undefined ? input.mechanicId : existing.mechanicId,
        priority: input.priority ?? existing.priority,
        complaint: input.complaint !== undefined ? input.complaint : existing.complaint,
        diagnosis: input.diagnosis !== undefined ? input.diagnosis : existing.diagnosis,
        receivedAt: input.receivedAt ? new Date(input.receivedAt) : existing.receivedAt,
        estimatedDeliveryAt:
          input.estimatedDeliveryAt !== undefined
            ? input.estimatedDeliveryAt
              ? new Date(input.estimatedDeliveryAt)
              : null
            : existing.estimatedDeliveryAt,
        laborCostAr: laborCost,
        partsCostAr: partsCost,
        discountAr: discount,
        taxAr: tax,
        totalAr: total,
        paymentMethod: input.paymentMethod !== undefined ? (input.paymentMethod as string | null) : existing.paymentMethod,
        notes: input.notes !== undefined ? input.notes : existing.notes,
        items: items
          ? {
              create: items.map((it) => ({
                type: it.type,
                description: it.description,
                productId: it.productId,
                quantityAr: it.quantity,
                unitPriceAr: it.unitPrice,
                discountAr: it.discount,
                taxAr: it.tax,
                lineTotalAr: it.lineTotal,
              })),
            }
          : undefined,
      },
      include: { customer: true, vehicle: true, mechanic: true, items: true },
    });
    return serializeWorkOrderDetail(workOrder);
  });
}

export async function changeWorkOrderStatus(
  storeId: string,
  workOrderId: string,
  input: {
    status?: string;
    paymentStatus?: string;
    paymentMethod?: string;
    amountPaidAr?: number;
  }
) {
  const existing = await prisma.workOrder.findFirst({
    where: { id: workOrderId, storeId },
    include: { items: true },
  });
  if (!existing) throw notFound('Ordre de réparation introuvable');
  if (!input.status) throw badRequest('status requis');

  const previous = existing.status;
  const next = input.status;

  return prisma.$transaction(async (tx) => {
    if (next === 'COMPLETED' && previous !== 'COMPLETED') {
      await consumeParts(tx, storeId, existing.items, existing.id);
    } else if (previous === 'COMPLETED' && next !== 'COMPLETED') {
      await restoreParts(tx, storeId, existing.items, existing.id);
    }

    const now = new Date();
    const workOrder = await tx.workOrder.update({
      where: { id: workOrderId },
      data: {
        status: next,
        completedAt:
          next === 'COMPLETED' ? (existing.completedAt ?? now) : existing.completedAt,
        paymentStatus: input.paymentStatus ?? existing.paymentStatus,
        paymentMethod:
          input.paymentMethod !== undefined ? input.paymentMethod : existing.paymentMethod,
        amountPaidAr: input.amountPaidAr !== undefined ? input.amountPaidAr : existing.amountPaidAr,
      },
      include: { customer: true, vehicle: true, mechanic: true, items: true },
    });
    return serializeWorkOrderDetail(workOrder);
  });
}

export async function deleteWorkOrder(storeId: string, workOrderId: string) {
  const existing = await prisma.workOrder.findFirst({
    where: { id: workOrderId, storeId },
    include: { items: true },
  });
  if (!existing) throw notFound('Ordre de réparation introuvable');

  if (existing.status === 'COMPLETED') {
    await prisma.$transaction(async (tx) => restoreParts(tx, storeId, existing.items, existing.id));
  }
  await prisma.$transaction(async (tx) => {
    await tx.workOrderItem.deleteMany({ where: { workOrderId } });
    await tx.appointment.updateMany({ where: { workOrderId }, data: { workOrderId: null } });
    await tx.workOrder.delete({ where: { id: workOrderId } });
  });
}

async function consumeParts(
  tx: Prisma.TransactionClient,
  storeId: string,
  items: { type: string; productId: string | null; description: string; lineTotalAr: unknown }[],
  workOrderId: string
) {
  for (const item of items) {
    if (item.type !== 'PART' || !item.productId) continue;
    const stock = await tx.stock.findFirst({
      where: { storeId, productId: item.productId, quantityAr: { gt: 0 } },
      orderBy: { quantityAr: 'desc' },
    });
    if (!stock) {
      throw badRequest(`Stock insuffisant pour la pièce "${item.description}"`);
    }
    const product = await tx.product.findUnique({ where: { id: item.productId } });
    if (product?.trackStock === false) continue;
    const available = Number(stock.quantityAr);
    if (available < 1) throw badRequest(`Stock insuffisant pour la pièce "${item.description}"`);
    await tx.stock.update({
      where: { id: stock.id },
      data: { quantityAr: available - 1 },
    });
    await tx.stockMovement.create({
      data: {
        storeId,
        warehouseId: stock.warehouseId,
        productId: item.productId,
        movementType: 'STOCK_OUT',
        quantity: 1,
        reason: `Pièce utilisée - OR ${workOrderId}`,
        referenceId: workOrderId,
        referenceType: 'WORK_ORDER',
      },
    });
  }
}

async function restoreParts(
  tx: Prisma.TransactionClient,
  storeId: string,
  items: { type: string; productId: string | null; description: string }[],
  workOrderId: string
) {
  for (const item of items) {
    if (item.type !== 'PART' || !item.productId) continue;
    const stock = await tx.stock.findFirst({
      where: { storeId, productId: item.productId },
      orderBy: { quantityAr: 'desc' },
    });
    if (!stock) continue;
    await tx.stock.update({
      where: { id: stock.id },
      data: { quantityAr: Number(stock.quantityAr) + 1 },
    });
    await tx.stockMovement.create({
      data: {
        storeId,
        warehouseId: stock.warehouseId,
        productId: item.productId,
        movementType: 'STOCK_IN',
        quantity: 1,
        reason: `Retour pièce - OR ${workOrderId}`,
        referenceId: workOrderId,
        referenceType: 'WORK_ORDER',
      },
    });
  }
}

function computeItems(raw: WorkOrderItemInput[]): ItemRow[] {
  return raw.map((it) => {
    const type = it.type ?? 'PART';
    const quantity = Number(it.quantity ?? 1);
    const unitPrice = Number(it.unitPrice ?? 0);
    const discount = Number(it.discount ?? 0);
    const tax = Number(it.tax ?? 0);
    if (!it.description) throw badRequest('Chaque ligne doit avoir une description');
    const lineTotal = quantity * unitPrice - discount + tax;
    return {
      type,
      description: it.description,
      productId: it.productId || null,
      quantity,
      unitPrice,
      discount,
      tax,
      lineTotal,
    };
  });
}

function computeCosts(items: ItemRow[]) {
  let laborCost = 0;
  let partsCost = 0;
  for (const it of items) {
    if (it.type === 'LABOR') laborCost += it.lineTotal;
    else partsCost += it.lineTotal;
  }
  return { laborCost, partsCost };
}

async function generateOrderNumber(storeId: string): Promise<string> {
  const dayCount = await prisma.workOrder.count({
    where: {
      storeId,
      receivedAt: {
        gte: new Date(new Date().toISOString().slice(0, 10)),
        lt: new Date(new Date(Date.now() + 86400000).toISOString().slice(0, 10)),
      },
    },
  });
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `WO-${ymd}-${String(dayCount + 1).padStart(3, '0')}`;
}

function serializeWorkOrder(wo: {
  id: string;
  orderNumber: string;
  status: string;
  priority: string;
  complaint: string | null;
  receivedAt: Date;
  estimatedDeliveryAt: Date | null;
  laborCostAr: unknown;
  partsCostAr: unknown;
  totalAr: unknown;
  paymentStatus: string;
  customer: { id: string; firstName: string; lastName: string; phone: string | null };
  vehicle: { id: string; plateNumber: string; make: string | null; model: string | null } | null;
  mechanic: { id: string; fullName: string; colorHex: string | null } | null;
  _count?: { items: number } | undefined;
}) {
  return {
    id: wo.id,
    orderNumber: wo.orderNumber,
    status: wo.status,
    priority: wo.priority,
    complaint: wo.complaint,
    receivedAt: wo.receivedAt,
    estimatedDeliveryAt: wo.estimatedDeliveryAt,
    laborCostAr: Number(wo.laborCostAr),
    partsCostAr: Number(wo.partsCostAr),
    totalAr: Number(wo.totalAr),
    paymentStatus: wo.paymentStatus,
    itemsCount: wo._count?.items ?? 0,
    customer: { id: wo.customer.id, fullName: `${wo.customer.firstName} ${wo.customer.lastName}`.trim(), phone: wo.customer.phone },
    vehicle: wo.vehicle
      ? { id: wo.vehicle.id, plateNumber: wo.vehicle.plateNumber, label: [wo.vehicle.make, wo.vehicle.model].filter(Boolean).join(' ') }
      : null,
    mechanic: wo.mechanic ? { id: wo.mechanic.id, fullName: wo.mechanic.fullName, colorHex: wo.mechanic.colorHex } : null,
  };
}

function serializeWorkOrderDetail(wo: {
  id: string;
  orderNumber: string;
  status: string;
  priority: string;
  complaint: string | null;
  diagnosis: string | null;
  receivedAt: Date;
  estimatedDeliveryAt: Date | null;
  completedAt: Date | null;
  laborCostAr: unknown;
  partsCostAr: unknown;
  discountAr: unknown;
  taxAr: unknown;
  totalAr: unknown;
  paymentStatus: string;
  paymentMethod: string | null;
  amountPaidAr: unknown;
  notes: string | null;
  createdAt: Date;
  customer?: unknown;
  vehicle?: unknown;
  mechanic?: unknown;
  items?: unknown;
  appointments?: unknown;
  invoice?: unknown;
  interactions?: unknown;
  reminders?: unknown;
}) {
  return {
    id: wo.id,
    orderNumber: wo.orderNumber,
    status: wo.status,
    priority: wo.priority,
    complaint: wo.complaint,
    diagnosis: wo.diagnosis,
    receivedAt: wo.receivedAt,
    estimatedDeliveryAt: wo.estimatedDeliveryAt,
    completedAt: wo.completedAt,
    laborCostAr: Number(wo.laborCostAr),
    partsCostAr: Number(wo.partsCostAr),
    discountAr: Number(wo.discountAr),
    taxAr: Number(wo.taxAr),
    totalAr: Number(wo.totalAr),
    paymentStatus: wo.paymentStatus,
    paymentMethod: wo.paymentMethod,
    amountPaidAr: Number(wo.amountPaidAr),
    notes: wo.notes,
    createdAt: wo.createdAt,
    customer: wo.customer,
    vehicle: wo.vehicle,
    mechanic: wo.mechanic,
    items: (wo.items as Array<{
      id: string;
      type: string;
      description: string;
      productId: string | null;
      product?: { id: string; name: string; sku: string | null } | null;
      quantityAr: unknown;
      unitPriceAr: unknown;
      discountAr: unknown;
      taxAr: unknown;
      lineTotalAr: unknown;
    }> | undefined)?.map((it) => ({
      id: it.id,
      type: it.type,
      description: it.description,
      productId: it.productId,
      product: it.product ?? null,
      quantity: Number(it.quantityAr),
      unitPrice: Number(it.unitPriceAr),
      discount: Number(it.discountAr),
      tax: Number(it.taxAr),
      lineTotal: Number(it.lineTotalAr),
    })),
    appointments: wo.appointments,
    invoice: wo.invoice,
    interactions: wo.interactions,
    reminders: wo.reminders,
  };
}