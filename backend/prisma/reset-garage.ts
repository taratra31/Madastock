import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const store = await prisma.store.findUnique({ where: { slug: 'mounaya' } });
  if (!store) { console.log('store introuvable'); return; }
  const sid = store.id;

  const wos = await prisma.workOrder.findMany({ where: { storeId: sid }, select: { id: true } });
  const woIds = wos.map(w => w.id);

  await prisma.invoiceItem.deleteMany({ where: { invoice: { storeId: sid } } });
  await prisma.invoice.deleteMany({ where: { storeId: sid } });
  await prisma.reminder.deleteMany({ where: { storeId: sid } });
  await prisma.interaction.deleteMany({ where: { storeId: sid } });
  await prisma.lead.deleteMany({ where: { storeId: sid } });
  await prisma.appointment.deleteMany({ where: { storeId: sid } });
  await prisma.stockMovement.deleteMany({ where: { referenceType: 'WORK_ORDER', referenceId: { in: woIds } } });
  await prisma.workOrderItem.deleteMany({ where: { workOrderId: { in: woIds } } });
  await prisma.workOrder.deleteMany({ where: { storeId: sid } });
  await prisma.vehicle.deleteMany({ where: { storeId: sid } });
  await prisma.mechanic.deleteMany({ where: { storeId: sid } });

  const phones = ['+261341111111','+261342222222','+261343333333','+261344444444','+261345555555','+261346666666'];
  await prisma.customer.deleteMany({ where: { storeId: sid, phone: { in: phones } } });

  const partsSlugs = ['filtre-a-huile','plaquettes-frein-avant','bougie-allumage-ngk','courroie-distribution','amortisseur-avant','batterie-60ah','liquide-frein-dot4','filtre-a-air'];
  const parts = await prisma.product.findMany({ where: { storeId: sid, slug: { in: partsSlugs } }, select: { id: true, categoryId: true } });
  await prisma.stock.deleteMany({ where: { storeId: sid, productId: { in: parts.map(p => p.id) } } });
  await prisma.stockMovement.deleteMany({ where: { product: { storeId: sid, slug: { in: partsSlugs } } } });
  for (const p of parts) {
    await prisma.product.delete({ where: { id: p.id } }).catch(() => {});
  }
  const cat = await prisma.category.findFirst({ where: { storeId: sid, name: 'Pièces détachées' } });
  if (cat) await prisma.category.delete({ where: { id: cat.id } });

  console.log('reset garage OK');
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });