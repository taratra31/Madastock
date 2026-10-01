import prisma from '../lib/prisma';
import { badRequest, conflict, notFound } from '../utils/httpError';

/** Dépôts de la boutique, avec le nombre de références stockées. */
export async function listWarehouses(storeId: string) {
  const warehouses = await prisma.warehouse.findMany({
    where: { storeId },
    include: {
      _count: { select: { stocks: true } },
      stocks: { select: { quantityAr: true, product: { select: { costPriceAr: true } } } },
    },
    orderBy: [{ isMain: 'desc' }, { name: 'asc' }],
  });

  return warehouses.map((w) => ({
    id: w.id,
    name: w.name,
    address: w.address,
    isMain: w.isMain,
    isActive: w.isActive,
    // Un dépôt ne peut pas être supprimé s'il contient encore du stock :
    // on propose plutôt de le désactiver.
    productCount: w._count.stocks,
    totalUnits: w.stocks.reduce((sum, s) => sum + Number(s.quantityAr), 0),
    totalValueAr: w.stocks.reduce(
      (sum, s) => sum + Number(s.quantityAr) * Number(s.product?.costPriceAr ?? 0),
      0,
    ),
    createdAt: w.createdAt,
  }));
}

export async function createWarehouse(
  storeId: string,
  input: { name: string; address?: string | null; isMain?: boolean },
) {
  const name = input.name?.trim();
  if (!name) throw badRequest('Le nom du dépôt est obligatoire');

  const existing = await prisma.warehouse.count({ where: { storeId } });
  const isMain = input.isMain ?? existing === 0;

  return prisma.$transaction(async (tx) => {
    if (isMain) {
      await tx.warehouse.updateMany({ where: { storeId }, data: { isMain: false } });
    }
    return tx.warehouse.create({
      data: { storeId, name, address: input.address?.trim() || null, isMain },
    });
  });
}

export async function updateWarehouse(
  storeId: string,
  warehouseId: string,
  input: { name?: string; address?: string | null; isMain?: boolean; isActive?: boolean },
) {
  const warehouse = await prisma.warehouse.findFirst({ where: { id: warehouseId, storeId } });
  if (!warehouse) throw notFound('Dépôt introuvable');

  const name = input.name?.trim();
  if (name === '') throw badRequest('Le nom du dépôt est obligatoire');
  if (input.isActive === false && warehouse.isMain) {
    throw badRequest('Le dépôt principal ne peut pas être désactivé');
  }
  if (input.isActive === false) {
    const stocked = await prisma.stock.aggregate({
      where: { warehouseId },
      _sum: { quantityAr: true },
    });
    if (Number(stocked._sum.quantityAr ?? 0) !== 0) {
      throw badRequest('Videz le stock de ce dépôt avant de le désactiver');
    }
  }

  return prisma.$transaction(async (tx) => {
    if (input.isMain === true && !warehouse.isMain) {
      await tx.warehouse.updateMany({ where: { storeId }, data: { isMain: false } });
    }
    return tx.warehouse.update({
      where: { id: warehouseId },
      data: {
        ...(name ? { name } : {}),
        ...(input.address !== undefined ? { address: input.address?.trim() || null } : {}),
        ...(input.isMain !== undefined ? { isMain: input.isMain } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
  });
}

export async function deleteWarehouse(storeId: string, warehouseId: string) {
  const warehouse = await prisma.warehouse.findFirst({ where: { id: warehouseId, storeId } });
  if (!warehouse) throw notFound('Dépôt introuvable');
  if (warehouse.isMain) throw badRequest('Le dépôt principal ne peut pas être supprimé');

  const count = await prisma.stock.count({ where: { warehouseId } });
  if (count > 0) {
    throw conflict('Ce dépôt contient encore des produits : videz-le ou désactivez-le');
  }

  await prisma.warehouse.delete({ where: { id: warehouseId } });
}

/**
 * Transfert entre deux dépôts. Le stock sort d'un dépôt et arrive dans
 * l'autre : on écrit les deux mouvements pour que l'historique des deux
 * entrepôts soit juste.
 */
export async function transferStock(
  storeId: string,
  input: {
    productId: string;
    variantId?: string | null;
    fromWarehouseId: string;
    toWarehouseId: string;
    quantity: number;
    reason?: string | null;
  },
) {
  const quantity = Number(input.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) throw badRequest('Quantité invalide');
  if (input.fromWarehouseId === input.toWarehouseId) {
    throw badRequest('Le dépôt de départ et le dépôt d\'arrivée doivent être différents');
  }

  const [from, to] = await Promise.all([
    prisma.warehouse.findFirst({ where: { id: input.fromWarehouseId, storeId } }),
    prisma.warehouse.findFirst({ where: { id: input.toWarehouseId, storeId } }),
  ]);
  if (!from) throw notFound('Dépôt de départ introuvable');
  if (!to) throw notFound('Dépôt d\'arrivée introuvable');
  if (!from.isActive || !to.isActive) throw badRequest('Dépôt inactif');

  const transferId = crypto.randomUUID();
  const variantId = input.variantId || null;

  return prisma.$transaction(async (tx) => {
    const source = await tx.stock.findFirst({
      where: { warehouseId: from.id, productId: input.productId, variantId },
    });
    const available = source ? Number(source.quantityAr) - Number(source.reservedQty) : 0;
    if (available < quantity) {
      throw badRequest(
        `Stock insuffisant dans « ${from.name} » : ${available} disponible(s) pour ${quantity} demandé(s)`,
      );
    }

    if (source) {
      await tx.stock.update({
        where: { id: source.id },
        data: { quantityAr: Number(source.quantityAr) - quantity },
      });
    }

    const destination = await tx.stock.findFirst({
      where: { warehouseId: to.id, productId: input.productId, variantId },
    });
    if (destination) {
      await tx.stock.update({
        where: { id: destination.id },
        data: { quantityAr: Number(destination.quantityAr) + quantity },
      });
    } else {
      await tx.stock.create({
        data: {
          storeId,
          warehouseId: to.id,
          productId: input.productId,
          variantId,
          quantityAr: quantity,
          reservedQty: 0,
          isShared: false,
        },
      });
    }

    const reason = input.reason?.trim() || `Transfert ${from.name} → ${to.name}`;
    const common = {
      storeId,
      productId: input.productId,
      variantId,
      quantity,
      reason,
      referenceType: 'TRANSFER',
      referenceId: transferId,
    };
    await tx.stockMovement.createMany({
      data: [
        { ...common, warehouseId: from.id, movementType: 'TRANSFER_OUT' },
        { ...common, warehouseId: to.id, movementType: 'TRANSFER_IN' },
      ],
    });

    return {
      transferId,
      from: { id: from.id, name: from.name },
      to: { id: to.id, name: to.name },
      quantity,
    };
  });
}
