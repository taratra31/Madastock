import prisma from '../lib/prisma';
import { badRequest, notFound } from '../utils/httpError';

export interface InvoiceItemInput {
  type?: 'LABOR' | 'PART' | 'OTHER';
  description?: string;
  productId?: string | null;
  quantity?: number;
  unitPrice?: number;
  discount?: number;
  tax?: number;
}

export interface InvoiceInput {
  docType?: string;
  customerId?: string;
  vehicleId?: string;
  workOrderId?: string;
  issueDate?: string;
  dueDate?: string;
  validUntil?: string;
  discount?: number;
  tax?: number;
  notes?: string;
  status?: string;
  items?: InvoiceItemInput[];
}

const PAID_STATUSES = ['PAID', 'PARTIALLY_PAID'];

export async function listInvoices(
  storeId: string,
  query: {
    docType?: string;
    status?: string;
    customerId?: string;
    workOrderId?: string;
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
  if (query.docType) where.docType = query.docType;
  if (query.status) where.status = query.status;
  if (query.customerId) where.customerId = query.customerId;
  if (query.workOrderId) where.workOrderId = query.workOrderId;
  if (query.from || query.to) {
    where.issueDate = {};
    if (query.from) where.issueDate.gte = new Date(query.from);
    if (query.to) where.issueDate.lte = new Date(query.to);
  }
  if (query.search) {
    const q = query.search.trim();
    where.OR = [{ number: { contains: q } }, { customer: { lastName: { contains: q } } }];
  }

  const [total, invoices] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
        vehicle: { select: { id: true, plateNumber: true } },
        workOrder: { select: { id: true, orderNumber: true } },
        _count: { select: { items: true } },
      },
      orderBy: { issueDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    data: invoices.map((inv) => ({
      id: inv.id,
      number: inv.number,
      docType: inv.docType,
      status: inv.status,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      subtotalAr: Number(inv.subtotalAr),
      discountAr: Number(inv.discountAr),
      taxAr: Number(inv.taxAr),
      totalAr: Number(inv.totalAr),
      amountPaidAr: Number(inv.amountPaidAr),
      paymentStatus: inv.paymentStatus,
      paymentMethod: inv.paymentMethod,
      itemsCount: inv._count.items,
      customer: inv.customer
        ? { id: inv.customer.id, fullName: `${inv.customer.firstName} ${inv.customer.lastName}`.trim(), phone: inv.customer.phone }
        : null,
      vehicle: inv.vehicle,
      workOrder: inv.workOrder,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getInvoice(storeId: string, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, storeId },
    include: {
      customer: true,
      vehicle: true,
      workOrder: true,
      items: { include: { product: { select: { id: true, name: true, sku: true } } }, orderBy: { createdAt: 'asc' } },
      reminders: { orderBy: { remindAt: 'asc' }, take: 10 },
    },
  });
  if (!invoice) throw notFound('Document introuvable');
  return serializeInvoice(invoice);
}

export async function createInvoice(storeId: string, userId: string, input: InvoiceInput) {
  const docType = input.docType ?? 'INVOICE';

  if (input.workOrderId) {
    const workOrder = await prisma.workOrder.findFirst({
      where: { id: input.workOrderId, storeId },
      include: { items: true },
    });
    if (!workOrder) throw notFound('Ordre de réparation introuvable');
    const existingInvoice = await prisma.invoice.findUnique({ where: { workOrderId: workOrder.id } });
    if (existingInvoice) throw badRequest('Un document existe déjà pour cet ordre de réparation');
    if (!workOrder.customerId) throw badRequest('L\'ordre de réparation n\'a pas de client');

    const items = workOrder.items.map((it) => ({
      type: it.type as 'LABOR' | 'PART' | 'OTHER',
      description: it.description,
      productId: it.productId,
      quantity: Number(it.quantityAr),
      unitPrice: Number(it.unitPriceAr),
      discount: Number(it.discountAr),
      tax: Number(it.taxAr),
    }));

    return buildInvoice(storeId, userId, {
      ...input,
      docType,
      customerId: workOrder.customerId,
      vehicleId: workOrder.vehicleId ?? undefined,
      workOrderId: workOrder.id,
      items,
    });
  }

  if (!input.customerId) throw badRequest('customerId requis');

  return buildInvoice(storeId, userId, input);
}

export async function updateInvoice(storeId: string, invoiceId: string, input: InvoiceInput) {
  const existing = await prisma.invoice.findFirst({
    where: { id: invoiceId, storeId },
    include: { items: true },
  });
  if (!existing) throw notFound('Document introuvable');
  if (PAID_STATUSES.includes(existing.status)) {
    throw badRequest('Un document payé ne peut plus être modifié');
  }

  const items = input.items ? normalizeItems(input.items) : null;
  const subtotal = items ? items.reduce((s, it) => s + it.lineTotal, 0) : Number(existing.subtotalAr);
  const discount = input.discount ?? Number(existing.discountAr);
  const tax = input.tax ?? Number(existing.taxAr);
  const total = subtotal - discount + tax;

  return prisma.$transaction(async (tx) => {
    if (items) await tx.invoiceItem.deleteMany({ where: { invoiceId } });
    const invoice = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        docType: input.docType ?? existing.docType,
        status: input.status ?? existing.status,
        customerId: input.customerId ?? existing.customerId,
        vehicleId: input.vehicleId !== undefined ? input.vehicleId : existing.vehicleId,
        issueDate: input.issueDate ? new Date(input.issueDate) : existing.issueDate,
        dueDate: input.dueDate !== undefined ? (input.dueDate ? new Date(input.dueDate) : null) : existing.dueDate,
        validUntil: input.validUntil !== undefined ? (input.validUntil ? new Date(input.validUntil) : null) : existing.validUntil,
        subtotalAr: subtotal,
        discountAr: discount,
        taxAr: tax,
        totalAr: total,
        notes: input.notes !== undefined ? input.notes : existing.notes,
        items: items
          ? { create: items.map((it) => buildItemData(it)) }
          : undefined,
      },
      include: { customer: true, vehicle: true, workOrder: true, items: true },
    });
    return serializeInvoice(invoice);
  });
}

export async function setInvoiceStatus(storeId: string, invoiceId: string, status: string) {
  const existing = await prisma.invoice.findFirst({ where: { id: invoiceId, storeId } });
  if (!existing) throw notFound('Document introuvable');
  if (PAID_STATUSES.includes(existing.status)) throw badRequest('Document déjà réglé');

  if (status === 'ACCEPTED' && existing.docType === 'QUOTE') {
    return prisma.invoice.update({ where: { id: invoiceId }, data: { status: 'ACCEPTED' } });
  }

  return prisma.invoice.update({
    where: { id: invoiceId },
    data: { status },
    include: { customer: true },
  });
}

export async function acceptQuoteAndCreateInvoice(storeId: string, userId: string, invoiceId: string) {
  const quote = await prisma.invoice.findFirst({
    where: { id: invoiceId, storeId, docType: 'QUOTE' },
    include: { items: true },
  });
  if (!quote) throw notFound('Devis introuvable');

  const items = quote.items.map((it) => ({
    type: it.type as 'LABOR' | 'PART' | 'OTHER',
    description: it.description,
    productId: it.productId,
    quantity: Number(it.quantityAr),
    unitPrice: Number(it.unitPriceAr),
    discount: Number(it.discountAr),
    tax: Number(it.taxAr),
  }));

  const invoice = await buildInvoice(storeId, userId, {
    docType: 'INVOICE',
    customerId: quote.customerId,
    vehicleId: quote.vehicleId ?? undefined,
    workOrderId: quote.workOrderId ?? undefined,
    discount: Number(quote.discountAr),
    tax: Number(quote.taxAr),
    notes: quote.notes ?? undefined,
    items,
  });

  await prisma.invoice.update({ where: { id: invoiceId }, data: { status: 'ACCEPTED' } });
  const doc = await prisma.invoice.findFirst({
    where: { id: invoice.id },
    include: { customer: true },
  });
  if (!doc) throw notFound('Document introuvable');
  return serializeInvoice(doc);
}

export async function recordPayment(
  storeId: string,
  invoiceId: string,
  input: { amount?: number; method?: string }
) {
  const existing = await prisma.invoice.findFirst({ where: { id: invoiceId, storeId } });
  if (!existing) throw notFound('Document introuvable');
  if (existing.docType !== 'INVOICE') throw badRequest('Un devis ne reçoit pas de paiement');
  if (existing.status === 'CANCELLED') throw badRequest('Document annulé');
  const amount = Number(input.amount ?? 0);
  if (amount <= 0) throw badRequest('Montant invalide');

  const paidSoFar = Number(existing.amountPaidAr);
  const total = Number(existing.totalAr);
  const method = (input.method ?? 'CASH') as string;
  const newPaid = Math.min(total, paidSoFar + amount);
  if (paidSoFar + amount > total) throw badRequest('Le montant dépasse le total du document');

  const status: string = newPaid >= total ? 'PAID' : 'PARTIALLY_PAID';
  return prisma.invoice.update({
    where: { id: invoiceId },
    data: { amountPaidAr: newPaid, paymentStatus: status, status, paymentMethod: method },
  });
}

export async function deleteInvoice(storeId: string, invoiceId: string) {
  const existing = await prisma.invoice.findFirst({ where: { id: invoiceId, storeId } });
  if (!existing) throw notFound('Document introuvable');
  await prisma.$transaction(async (tx) => {
    await tx.invoiceItem.deleteMany({ where: { invoiceId } });
    await tx.invoice.delete({ where: { id: invoiceId } });
  });
}

async function buildInvoice(storeId: string, userId: string, input: InvoiceInput) {
  const docType = input.docType ?? 'INVOICE';
  const rawItems = input.items ?? [];
  const items = normalizeItems(rawItems);
  if (items.length === 0) throw badRequest('Le document doit contenir au moins une ligne');

  const subtotal = items.reduce((s, it) => s + it.lineTotal, 0);
  const discount = input.discount ?? 0;
  const tax = input.tax ?? 0;
  const total = subtotal - discount + tax;

  const customer = await prisma.customer.findFirst({ where: { id: input.customerId, storeId, isActive: true } });
  if (!customer) throw notFound('Client introuvable');

  const number = await generateInvoiceNumber(storeId, docType);

  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.create({
      data: {
        storeId,
        number,
        docType,
        status: input.status ?? 'DRAFT',
        customerId: input.customerId as string,
        vehicleId: input.vehicleId || null,
        workOrderId: input.workOrderId || null,
        issueDate: input.issueDate ? new Date(input.issueDate) : new Date(),
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
        subtotalAr: subtotal,
        discountAr: discount,
        taxAr: tax,
        totalAr: total,
        notes: input.notes || null,
        createdById: userId,
        items: { create: items.map((it) => buildItemData(it)) },
      },
      include: { customer: true, vehicle: true, workOrder: true, items: true },
    });
    return serializeInvoice(invoice);
  });
}

interface NormalizedItem {
  type: 'LABOR' | 'PART' | 'OTHER';
  description: string;
  productId: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  lineTotal: number;
}

function normalizeItems(raw: InvoiceItemInput[]): NormalizedItem[] {
  return raw.map((it) => {
    const type = it.type ?? 'PART';
    const quantity = Number(it.quantity ?? 1);
    const unitPrice = Number(it.unitPrice ?? 0);
    const discount = Number(it.discount ?? 0);
    const tax = Number(it.tax ?? 0);
    if (!it.description) throw badRequest('Chaque ligne doit avoir une description');
    return {
      type,
      description: it.description,
      productId: it.productId || null,
      quantity,
      unitPrice,
      discount,
      tax,
      lineTotal: quantity * unitPrice - discount + tax,
    };
  });
}

function buildItemData(it: NormalizedItem) {
  return {
    type: it.type as 'LABOR' | 'PART' | 'OTHER',
    description: it.description,
    productId: it.productId,
    quantityAr: it.quantity,
    unitPriceAr: it.unitPrice,
    discountAr: it.discount,
    taxAr: it.tax,
    lineTotalAr: it.lineTotal,
  };
}

async function generateInvoiceNumber(storeId: string, docType: string): Promise<string> {
  const dayCount = await prisma.invoice.count({
    where: {
      storeId,
      docType,
      createdAt: { gte: new Date(new Date().toISOString().slice(0, 10)) },
    },
  });
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = docType === 'QUOTE' ? 'DEV' : 'INV';
  return `${prefix}-${ymd}-${String(dayCount + 1).padStart(3, '0')}`;
}

function serializeInvoice(inv: {
  id: string;
  number: string;
  docType: string;
  status: string;
  issueDate: Date;
  dueDate: Date | null;
  validUntil: Date | null;
  subtotalAr: unknown;
  discountAr: unknown;
  taxAr: unknown;
  totalAr: unknown;
  amountPaidAr: unknown;
  paymentStatus: string;
  paymentMethod: string | null;
  notes: string | null;
  createdAt: Date;
  customer?: unknown;
  vehicle?: unknown;
  workOrder?: unknown;
  items?: unknown;
  reminders?: unknown;
}) {
  return {
    id: inv.id,
    number: inv.number,
    docType: inv.docType,
    status: inv.status,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    validUntil: inv.validUntil,
    subtotalAr: Number(inv.subtotalAr),
    discountAr: Number(inv.discountAr),
    taxAr: Number(inv.taxAr),
    totalAr: Number(inv.totalAr),
    amountPaidAr: Number(inv.amountPaidAr),
    paymentStatus: inv.paymentStatus,
    paymentMethod: inv.paymentMethod,
    notes: inv.notes,
    createdAt: inv.createdAt,
    customer: inv.customer
      ? (() => {
          const c = inv.customer as { id: string; firstName?: string | null; lastName?: string | null };
          return { ...c, fullName: `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() };
        })()
      : null,
    vehicle: inv.vehicle,
    workOrder: inv.workOrder,
    items: (inv.items as Array<{
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
      type: it.type as 'LABOR' | 'PART' | 'OTHER',
      description: it.description,
      productId: it.productId,
      product: it.product ?? null,
      quantity: Number(it.quantityAr),
      unitPrice: Number(it.unitPriceAr),
      discount: Number(it.discountAr),
      tax: Number(it.taxAr),
      lineTotal: Number(it.lineTotalAr),
    })),
    reminders: inv.reminders,
  };
}