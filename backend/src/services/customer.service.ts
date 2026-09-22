import prisma from '../lib/prisma';
import { badRequest, notFound } from '../utils/httpError';

export interface CustomerInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  gender?: string;
  isVip?: boolean;
  notes?: string;
}

export async function listCustomers(
  storeId: string,
  query: { search?: string; page?: number; limit?: number; vipOnly?: boolean }
) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));

  const where: Record<string, unknown> = { storeId, isActive: true };
  if (query.vipOnly) where.isVip = true;
  if (query.search) {
    const q = query.search.trim();
    where.OR = [
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q } },
      { email: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      include: {
        _count: { select: { vehicles: true, workOrders: true, invoices: true } },
      },
      orderBy: [{ isVip: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    data: customers.map((c) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      fullName: `${c.firstName} ${c.lastName}`.trim(),
      phone: c.phone,
      email: c.email,
      address: c.address,
      city: c.city,
      gender: c.gender,
      isVip: c.isVip,
      loyaltyPoints: c.loyaltyPoints,
      debtAr: Number(c.debtAr),
      notes: c.notes,
      vehiclesCount: c._count.vehicles,
      workOrdersCount: c._count.workOrders,
      invoicesCount: c._count.invoices,
      createdAt: c.createdAt,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getCustomerStats(storeId: string) {
  const [total, vipCustomers, outstandingAgg, workOrders, invoices] = await Promise.all([
    prisma.customer.count({ where: { storeId, isActive: true } }),
    prisma.customer.count({ where: { storeId, isActive: true, isVip: true } }),
    prisma.invoice.aggregate({
      where: {
        storeId,
        docType: 'INVOICE',
        status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
      },
      _sum: { totalAr: true, amountPaidAr: true },
    }),
    prisma.workOrder.count({ where: { storeId, status: { not: 'CANCELLED' } } }),
    prisma.invoice.count({ where: { storeId } }),
  ]);

  return {
    total,
    vip: vipCustomers,
    outstandingAr:
      Number(outstandingAgg._sum?.totalAr ?? 0) - Number(outstandingAgg._sum?.amountPaidAr ?? 0),
    documents: workOrders + invoices,
  };
}

export async function getCustomer(storeId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, storeId },
    include: {
      vehicles: { where: { isActive: true }, orderBy: { createdAt: 'desc' } },
      workOrders: { orderBy: { createdAt: 'desc' }, take: 20 },
      invoices: { orderBy: { createdAt: 'desc' }, take: 20 },
      interactions: { orderBy: { createdAt: 'desc' }, take: 20 },
      reminders: { where: { status: { in: ['PENDING', 'SENT'] } }, orderBy: { remindAt: 'asc' }, take: 20 },
      _count: { select: { workOrders: true, invoices: true, vehicles: true } },
    },
  });
  if (!customer) throw notFound('Client introuvable');

  const outstanding = await prisma.invoice.aggregate({
    where: {
      storeId,
      customerId,
      docType: 'INVOICE',
      status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
    },
    _sum: { totalAr: true, amountPaidAr: true },
  });

  return {
    id: customer.id,
    firstName: customer.firstName,
    lastName: customer.lastName,
    fullName: `${customer.firstName} ${customer.lastName}`.trim(),
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
    city: customer.city,
    gender: customer.gender,
    isVip: customer.isVip,
    loyaltyPoints: customer.loyaltyPoints,
    debtAr: Number(customer.debtAr),
    notes: customer.notes,
    outstandingAr:
      Number(outstanding._sum?.totalAr ?? 0) - Number(outstanding._sum?.amountPaidAr ?? 0),
    counts: customer._count,
    vehicles: customer.vehicles,
    workOrders: customer.workOrders.map(serializeWorkOrder),
    invoices: customer.invoices.map(serializeInvoice),
    interactions: customer.interactions,
    reminders: customer.reminders,
  };
}

export async function createCustomer(storeId: string, input: CustomerInput) {
  if (!input.firstName || !input.lastName) throw badRequest('firstName et lastName requis');
  return serializeCustomer(
    await prisma.customer.create({
      data: {
        storeId,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone || null,
        email: input.email || null,
        address: input.address || null,
        city: input.city || null,
        gender: input.gender || null,
        isVip: input.isVip ?? false,
        notes: input.notes || null,
      },
    })
  );
}

export async function updateCustomer(storeId: string, customerId: string, input: CustomerInput) {
  const existing = await prisma.customer.findFirst({ where: { id: customerId, storeId } });
  if (!existing) throw notFound('Client introuvable');
  const customer = await prisma.customer.update({
    where: { id: customerId },
    data: {
      firstName: input.firstName ?? existing.firstName,
      lastName: input.lastName ?? existing.lastName,
      phone: input.phone !== undefined ? input.phone : existing.phone,
      email: input.email !== undefined ? input.email : existing.email,
      address: input.address !== undefined ? input.address : existing.address,
      city: input.city !== undefined ? input.city : existing.city,
      gender: input.gender !== undefined ? input.gender : existing.gender,
      isVip: input.isVip !== undefined ? input.isVip : existing.isVip,
      notes: input.notes !== undefined ? input.notes : existing.notes,
    },
  });
  return serializeCustomer(customer);
}

export async function deleteCustomer(storeId: string, customerId: string) {
  const existing = await prisma.customer.findFirst({ where: { id: customerId, storeId } });
  if (!existing) throw notFound('Client introuvable');
  await prisma.customer.update({
    where: { id: customerId },
    data: { isActive: false },
  });
}

function serializeCustomer(c: {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  gender: string | null;
  isVip: boolean;
  loyaltyPoints: number;
  debtAr: unknown;
  notes: string | null;
  createdAt: Date;
}) {
  return {
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    fullName: `${c.firstName} ${c.lastName}`.trim(),
    phone: c.phone,
    email: c.email,
    address: c.address,
    city: c.city,
    gender: c.gender,
    isVip: c.isVip,
    loyaltyPoints: c.loyaltyPoints,
    debtAr: Number(c.debtAr),
    notes: c.notes,
    createdAt: c.createdAt,
  };
}

function serializeWorkOrder(wo: {
  id: string;
  orderNumber: string;
  status: string;
  totalAr: unknown;
  receivedAt: Date;
}) {
  return { id: wo.id, orderNumber: wo.orderNumber, status: wo.status, totalAr: Number(wo.totalAr), receivedAt: wo.receivedAt };
}

function serializeInvoice(inv: {
  id: string;
  number: string;
  docType: string;
  status: string;
  totalAr: unknown;
  amountPaidAr: unknown;
  issueDate: Date;
}) {
  return { id: inv.id, number: inv.number, docType: inv.docType, status: inv.status, totalAr: Number(inv.totalAr), amountPaidAr: Number(inv.amountPaidAr), issueDate: inv.issueDate };
}