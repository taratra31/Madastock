import prisma from '../lib/prisma';

export async function getGarageStats(storeId: string) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart.getTime() + 86400000);

  const [
    vehicles,
    activeWorkOrders,
    todayWorkOrders,
    todayAppointments,
    leads,
    openLeads,
    mechanics,
    pendingReminders,
    unpaidInvoices,
    revenue,
    monthRevenue,
    customerCount,
    completedToday,
  ] = await Promise.all([
    prisma.vehicle.count({ where: { storeId, isActive: true } }),
    prisma.workOrder.count({
      where: { storeId, status: { in: ['QUOTED', 'IN_PROGRESS', 'WAITING_PART', 'PAUSED'] } },
    }),
    prisma.workOrder.count({ where: { storeId, receivedAt: { gte: todayStart, lt: todayEnd } } }),
    prisma.appointment.count({ where: { storeId, status: { in: ['SCHEDULED', 'CONFIRMED'] }, scheduledAt: { gte: todayStart, lt: todayEnd } } }),
    prisma.lead.count({ where: { storeId, status: { not: 'LOST' } } }),
    prisma.lead.count({ where: { storeId, status: { in: ['NEW', 'CONTACTED', 'QUALIFIED', 'FOLLOW_UP'] } } }),
    prisma.mechanic.count({ where: { storeId, isActive: true } }),
    prisma.reminder.count({ where: { storeId, status: { in: ['PENDING', 'SENT'] }, remindAt: { lte: todayEnd } } }),
    prisma.invoice.aggregate({
      where: {
        storeId,
        docType: 'INVOICE',
        status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
      },
      _sum: { totalAr: true, amountPaidAr: true },
      _count: true,
    }),
    prisma.invoice.aggregate({
      where: { storeId, docType: 'INVOICE', status: { in: ['PAID', 'PARTIALLY_PAID'] } },
      _sum: { amountPaidAr: true },
    }),
    prisma.invoice.aggregate({
      where: {
        storeId,
        docType: 'INVOICE',
        status: { in: ['PAID', 'PARTIALLY_PAID'] },
        updatedAt: { gte: todayStart },
      },
      _sum: { amountPaidAr: true },
    }),
    prisma.customer.count({ where: { storeId, isActive: true } }),
    prisma.workOrder.count({ where: { storeId, completedAt: { gte: todayStart, lt: todayEnd } } }),
  ]);

  const openInvoices = unpaidInvoices._count;
  const outstandingAr =
    Number(unpaidInvoices._sum?.totalAr ?? 0) - Number(unpaidInvoices._sum?.amountPaidAr ?? 0);
  const totalRevenueAr = Number(revenue._sum?.amountPaidAr ?? 0);
  const revenueTodayAr = Number(monthRevenue._sum?.amountPaidAr ?? 0);

  const byStatus = await prisma.workOrder.groupBy({
    by: ['status'],
    where: { storeId },
    _count: { _all: true },
  });
  const statusBreakdown: Record<string, number> = {};
  for (const row of byStatus) statusBreakdown[row.status] = row._count._all;

  const recentWorkOrders = await prisma.workOrder.findMany({
    where: { storeId },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true } },
      vehicle: { select: { id: true, plateNumber: true, make: true, model: true } },
    },
    orderBy: { receivedAt: 'desc' },
    take: 8,
  });

  const upcomingAppointments = await prisma.appointment.findMany({
    where: { storeId, status: { in: ['SCHEDULED', 'CONFIRMED'] }, scheduledAt: { gte: new Date() } },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      vehicle: { select: { id: true, plateNumber: true } },
      mechanic: { select: { id: true, fullName: true, colorHex: true } },
    },
    orderBy: { scheduledAt: 'asc' },
    take: 8,
  });

  const reminders = await prisma.reminder.findMany({
    where: { storeId, status: { in: ['PENDING', 'SENT'] }, remindAt: { gte: new Date() } },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      lead: { select: { id: true, firstName: true, lastName: true } },
      vehicle: { select: { id: true, plateNumber: true } },
    },
    orderBy: { remindAt: 'asc' },
    take: 8,
  });

  return {
    counts: {
      vehicles,
      customers: customerCount,
      activeWorkOrders,
      todayWorkOrders,
      completedToday,
      todayAppointments,
      leads,
      openLeads,
      mechanics,
      pendingReminders,
    },
    finance: {
      outstandingInvoices: openInvoices,
      outstandingAr,
      totalRevenueAr,
      revenueTodayAr,
    },
    statusBreakdown,
    recentWorkOrders: recentWorkOrders.map((wo) => ({
      id: wo.id,
      orderNumber: wo.orderNumber,
      status: wo.status,
      priority: wo.priority,
      totalAr: Number(wo.totalAr),
      receivedAt: wo.receivedAt,
      customer: wo.customer ? { id: wo.customer.id, fullName: `${wo.customer.firstName} ${wo.customer.lastName}`.trim() } : null,
      vehicle: wo.vehicle
        ? { id: wo.vehicle.id, plateNumber: wo.vehicle.plateNumber, label: [wo.vehicle.make, wo.vehicle.model].filter(Boolean).join(' ') }
        : null,
    })),
    upcomingAppointments: upcomingAppointments.map((a) => ({
      id: a.id,
      type: a.type,
      status: a.status,
      scheduledAt: a.scheduledAt,
      durationMin: a.durationMin,
      title: a.title,
      customer: a.customer ? { id: a.customer.id, fullName: `${a.customer.firstName} ${a.customer.lastName}`.trim(), phone: a.customer.phone } : null,
      vehicle: a.vehicle,
      mechanic: a.mechanic,
    })),
    reminders: reminders.map((r) => ({
      id: r.id,
      type: r.type,
      remindAt: r.remindAt,
      title: r.title,
      message: r.message,
      customer: r.customer,
      lead: r.lead,
      vehicle: r.vehicle,
    })),
  };
}