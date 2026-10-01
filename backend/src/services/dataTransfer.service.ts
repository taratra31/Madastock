import prisma from '../lib/prisma';
import type { Prisma } from '@prisma/client';
import { badRequest } from '../utils/httpError';

// ============================================================
// IMPORT / EXPORT CSV
//
// Le séparateur dépend de la région : la France et Madagascar
// utilisent « ; » comme séparateur décimal, l'excel francophone
// ouvre donc le fichier correctement avec un point-virgule.
// ============================================================

const SEP = ';';

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes(SEP) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(SEP)];
  for (const row of rows) lines.push(row.map(csvCell).join(SEP));
  // BOM : Excel lit alors correctement les accents.
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

/** Analyseur CSV minimal (guillemets + séparateur libre). */
export function parseCsv(content: string): string[][] {
  const text = content.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ';') {
      row.push(cell);
      cell = '';
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);

  return rows;
}

function toNumber(value: string | undefined): number | null {
  if (!value || !value.trim()) return null;
  // Accepte « 1 234,56 », « 1234.56 », « 1234,56 ».
  const normalized = value
    .replace(/\s/g, '')
    .replace(/[^\d,.\-]/g, '')
    .replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

// ------------------------------------------------------------
// EXPORTS
// ------------------------------------------------------------

export async function exportProducts(storeId: string) {
  const products = await prisma.product.findMany({
    where: { storeId },
    include: { category: { select: { name: true } }, brand: { select: { name: true } } },
    orderBy: { name: 'asc' },
  });

  return {
    filename: `produits-${new Date().toISOString().slice(0, 10)}.csv`,
    csv: toCsv(
      [
        'Nom', 'Référence (SKU)', 'Code-barres', 'Catégorie', 'Marque', 'Unité',
        'Prix achat', 'Prix vente', 'Prix gros', 'TVA %', 'Seuil alerte', 'Suivi stock', 'Actif',
      ],
      products.map((p) => [
        p.name,
        p.sku ?? '',
        p.barcode ?? '',
        p.category?.name ?? '',
        p.brand?.name ?? '',
        p.unit,
        Number(p.costPriceAr),
        Number(p.sellingPriceAr),
        p.wholesalePriceAr === null ? '' : Number(p.wholesalePriceAr),
        p.taxRatePct,
        p.lowStockThreshold,
        p.trackStock ? 'oui' : 'non',
        p.isActive ? 'oui' : 'non',
      ]),
    ),
  };
}

export async function exportStock(storeId: string) {
  const stocks = await prisma.stock.findMany({
    where: { storeId, quantityAr: { not: 0 } },
    include: {
      warehouse: { select: { name: true } },
      product: { select: { name: true, sku: true, costPriceAr: true, unit: true } },
      variant: { select: { name: true } },
    },
    orderBy: [{ warehouse: { name: 'asc' } }, { product: { name: 'asc' } }],
  });

  return {
    filename: `stock-${new Date().toISOString().slice(0, 10)}.csv`,
    csv: toCsv(
      ['Produit', 'Variante', 'SKU', 'Dépôt', 'Quantité', 'Réservé', 'Unité', 'Prix achat', 'Valeur', 'Lot', 'Péremption'],
      stocks.map((s) => [
        s.product?.name ?? '',
        s.variant?.name ?? '',
        s.product?.sku ?? '',
        s.warehouse.name,
        Number(s.quantityAr),
        Number(s.reservedQty),
        s.product?.unit ?? 'pcs',
        Number(s.product?.costPriceAr ?? 0),
        Number(s.quantityAr) * Number(s.product?.costPriceAr ?? 0),
        s.batchNumber ?? '',
        s.expiryDate ? s.expiryDate.toISOString().slice(0, 10) : '',
      ]),
    ),
  };
}

export async function exportSales(storeId: string, from?: string, to?: string) {
  const createdAt: Record<string, Date> = {};
  if (from) createdAt.gte = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    createdAt.lte = end;
  }

  const sales = await prisma.sale.findMany({
    where: { storeId, ...(Object.keys(createdAt).length ? { createdAt } : {}) },
    include: { customer: { select: { firstName: true, lastName: true } }, items: true },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  });

  const name = (c: { firstName: string | null; lastName: string | null } | null) =>
    c ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() : '';

  return {
    filename: `ventes-${new Date().toISOString().slice(0, 10)}.csv`,
    csv: toCsv(
      ['N° ticket', 'Date', 'Client', 'Articles', 'Total HT', 'Remise', 'TVA', 'Total TTC', 'Payé', 'Statut'],
      sales.map((s) => [
        s.receiptNumber,
        s.createdAt.toISOString(),
        name(s.customer),
        s.items.length,
        Number(s.subtotalAr),
        Number(s.discountAr),
        Number(s.taxAr),
        Number(s.totalAr),
        Number(s.amountPaidAr),
        s.status,
      ]),
    ),
  };
}

export async function exportInvoices(storeId: string) {
  const invoices = await prisma.invoice.findMany({
    where: { storeId },
    include: { customer: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  });

  const name = (c: { firstName: string | null; lastName: string | null } | null) =>
    c ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() : '';

  return {
    filename: `factures-${new Date().toISOString().slice(0, 10)}.csv`,
    csv: toCsv(
      ['N° facture', 'Client', 'Date', 'Montant TTC', 'Payé', 'Reste', 'Statut', 'Échéance'],
      invoices.map((i) => [
        i.number,
        name(i.customer) || '',
        i.issueDate.toISOString(),
        Number(i.totalAr),
        Number(i.amountPaidAr),
        Number(i.totalAr) - Number(i.amountPaidAr),
        i.paymentStatus,
        i.dueDate ? i.dueDate.toISOString().slice(0, 10) : '',
      ]),
    ),
  };
}

// ------------------------------------------------------------
// IMPORT PRODUITS
// ------------------------------------------------------------

const IMPORT_COLUMNS = [
  'nom', 'sku', 'codeBarres', 'categorie', 'marque', 'unite', 'prixAchat', 'prixVente',
  'prixGros', 'tvaPct', 'seuilAlerte', 'suiviStock',
];

/**
 * Crée ou met à jour des produits à partir d'un CSV.
 * - Le nom est la clé : un produit qui existe déjà (même nom) est mis à jour.
 * - Chaque ligne renvoie le verdict pour pouvoir afficher un rapport à l'utilisateur.
 */
export async function importProducts(
  storeId: string,
  content: string,
): Promise<{ created: number; updated: number; skipped: number; errors: string[] }> {
  const rows = parseCsv(content);
  if (rows.length < 2) throw badRequest('Fichier CSV vide ou sans ligne d\'en-tête');

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const nameIndex = header.indexOf('nom');
  if (nameIndex === -1) throw badRequest('Colonne « nom » obligatoire dans le fichier CSV');
  if (rows.length - 1 > 500) throw badRequest('Maximum 500 lignes par import');

  const indexOf = (col: string) => header.indexOf(col);
  const sellPriceIndex = indexOf('prixvente');

  const existing = await prisma.product.findMany({
    where: { storeId },
    select: { id: true, name: true },
  });
  const byName = new Map(existing.map((p) => [p.name.trim().toLowerCase(), p.id]));

  // Catégories / marques : on les crée si besoin.
  const [categories, brands] = await Promise.all([
    prisma.category.findMany({ where: { storeId }, select: { id: true, name: true } }),
    prisma.brand.findMany({ where: { storeId }, select: { id: true, name: true } }),
  ]);
  const categoryCache = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.id]));
  const brandCache = new Map(brands.map((b) => [b.name.trim().toLowerCase(), b.id]));

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  const resolveCategory = async (name: string): Promise<string | null> => {
    const clean = name.trim();
    if (!clean) return null;
    const key = clean.toLowerCase();
    if (categoryCache.has(key)) return categoryCache.get(key)!;
    const row = await prisma.category.create({ data: { storeId, name: clean } });
    categoryCache.set(key, row.id);
    return row.id;
  };

  const resolveBrand = async (name: string): Promise<string | null> => {
    const clean = name.trim();
    if (!clean) return null;
    const key = clean.toLowerCase();
    if (brandCache.has(key)) return brandCache.get(key)!;
    const row = await prisma.brand.create({ data: { storeId, name: clean } });
    brandCache.set(key, row.id);
    return row.id;
  };

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const line = i + 1;
    const name = (row[nameIndex] ?? '').trim();
    if (!name) {
      skipped += 1;
      errors.push(`Ligne ${line} : nom manquant`);
      continue;
    }

    const sellingPriceAr = sellPriceIndex >= 0 ? toNumber(row[sellPriceIndex]) : null;
    if (sellingPriceAr === null) {
      skipped += 1;
      errors.push(`Ligne ${line} (${name}) : prix de vente manquant`);
      continue;
    }

    try {
      const key = name.toLowerCase();
      const id = byName.get(key);

      // On ne construit que les champs réellement présents dans le fichier :
      // Prisma refuse un `undefined` explicite.
      const cell = (col: string) => {
        const i = indexOf(col);
        return i >= 0 ? (row[i] ?? '').trim() : '';
      };
      const num = (col: string) => toNumber(cell(col));

      // Champs optionnels du produit, renseignés seulement si la colonne
      // existe dans le fichier. `costPriceAr` est obligatoire en base : on
      // le met à 0 quand le fichier ne fournit pas de prix d'achat.
      const fields: Partial<
        Prisma.ProductUncheckedCreateInput & { categoryId: string | null; brandId: string | null }
      > = {
        sellingPriceAr,
        unit: cell('unite') || 'pcs',
        costPriceAr: 0,
      };
      if (cell('sku')) fields.sku = cell('sku');
      if (cell('codebarres')) fields.barcode = cell('codebarres');
      const cost = num('prixachat');
      if (cost !== null) fields.costPriceAr = cost;
      const wholesale = num('prixgros');
      if (wholesale !== null) fields.wholesalePriceAr = wholesale;
      const tax = num('tvapct');
      if (tax !== null) fields.taxRatePct = tax;
      const threshold = num('seuilalerte');
      if (threshold !== null) fields.lowStockThreshold = threshold;
      const track = cell('suivistock');
      if (track) fields.trackStock = /^(oui|true|1|yes)$/i.test(track);

      const categoryId =
        indexOf('categorie') >= 0 ? await resolveCategory(row[indexOf('categorie')] ?? '') : null;
      const brandId = indexOf('marque') >= 0 ? await resolveBrand(row[indexOf('marque')] ?? '') : null;

      if (id) {
        await prisma.product.update({
          where: { id },
          data: { ...fields, ...(categoryId ? { categoryId } : {}), ...(brandId ? { brandId } : {}) },
        });
        updated += 1;
      } else {
        const created2 = await prisma.product.create({
          data: {
            ...fields,
            storeId,
            name,
            slug: `${slugify(name)}-${Date.now()}`,
            categoryId,
            brandId,
          } as Prisma.ProductUncheckedCreateInput,
        });
        byName.set(key, created2.id);
        created += 1;
      }
    } catch (error) {
      skipped += 1;
      errors.push(`Ligne ${line} (${name}) : ${(error as Error).message}`);
    }
  }

  return { created, updated, skipped, errors: errors.slice(0, 20) };
}

// ------------------------------------------------------------
// IMPORT INVENTAIRE (quantités par dépôt)
// ------------------------------------------------------------

export interface StockImportRow {
  sku: string;
  warehouse: string;
  quantity: number;
  batchNumber?: string | null;
  expiryDate?: string | null;
}

/**
 * Met à jour les quantités à partir d'un CSV d'inventaire.
 * Colonnes attendues : sku (ou nom), depot, quantite [, lot, peremption].
 * Chaque ligne écrit un mouvement d'ajustement pour garder la trace.
 */
export async function importStock(
  storeId: string,
  content: string,
  userId?: string,
): Promise<{ updated: number; skipped: number; errors: string[] }> {
  const rows = parseCsv(content);
  if (rows.length < 2) throw badRequest('Fichier CSV vide ou sans ligne d\'en-tête');
  if (rows.length - 1 > 1000) throw badRequest('Maximum 1000 lignes par import');

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const qtyIndex = header.findIndex((h) => h === 'quantite' || h === 'quantité' || h === 'qty');
  const skuIndex = header.findIndex((h) => h === 'sku' || h === 'reference');
  const nameIndex = header.indexOf('nom');
  const whIndex = header.indexOf('depot') >= 0 ? header.indexOf('depot') : header.indexOf('entrepot');
  const batchIndex = header.indexOf('lot');
  const expiryIndex = header.indexOf('peremption');

  if (qtyIndex === -1) throw badRequest('Colonne « quantite » obligatoire');
  if (skuIndex === -1 && nameIndex === -1) throw badRequest('Colonne « sku » ou « nom » obligatoire');

  const warehouses = await prisma.warehouse.findMany({
    where: { storeId },
    select: { id: true, name: true, isMain: true },
  });
  const whByName = new Map(warehouses.map((w) => [w.name.trim().toLowerCase(), w.id]));
  const defaultWarehouse = warehouses.find((w) => w.isMain) ?? warehouses[0];

  const products = await prisma.product.findMany({
    where: { storeId },
    select: { id: true, name: true, sku: true, trackStock: true },
  });
  const productBySku = new Map(
    products.filter((p) => p.sku).map((p) => [p.sku!.trim().toLowerCase(), p]),
  );
  const productByName = new Map(products.map((p) => [p.name.trim().toLowerCase(), p]));

  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const line = i + 1;

    const sku = skuIndex >= 0 ? (row[skuIndex] ?? '').trim() : '';
    const name = nameIndex >= 0 ? (row[nameIndex] ?? '').trim() : '';
    const product = sku
      ? productBySku.get(sku.toLowerCase())
      : productByName.get(name.toLowerCase());

    if (!product) {
      skipped += 1;
      errors.push(`Ligne ${line} : produit ${sku || name} introuvable`);
      continue;
    }
    if (!product.trackStock) {
      skipped += 1;
      errors.push(`Ligne ${line} : « ${product.name} » n'a pas de suivi de stock`);
      continue;
    }

    const quantity = toNumber(row[qtyIndex]);
    if (quantity === null || quantity < 0) {
      skipped += 1;
      errors.push(`Ligne ${line} : quantité invalide`);
      continue;
    }

    const whName = whIndex >= 0 ? (row[whIndex] ?? '').trim() : '';
    const warehouseId = (whName ? whByName.get(whName.toLowerCase()) : null) ?? defaultWarehouse?.id;
    if (!warehouseId) {
      skipped += 1;
      errors.push(`Ligne ${line} : dépôt ${whName} introuvable`);
      continue;
    }

    const batchNumber = batchIndex >= 0 ? (row[batchIndex] ?? '').trim() || null : null;
    const expiryRaw = expiryIndex >= 0 ? (row[expiryIndex] ?? '').trim() : '';
    const expiryDate = expiryRaw ? new Date(expiryRaw) : null;

    try {
      const existing = await prisma.stock.findFirst({
        where: { warehouseId, productId: product.id, variantId: null },
      });
      const previous = existing ? Number(existing.quantityAr) : 0;
      const delta = quantity - previous;

      if (existing) {
        await prisma.stock.update({
          where: { id: existing.id },
          data: {
            quantityAr: quantity,
            ...(batchNumber ? { batchNumber } : {}),
            ...(expiryDate && !Number.isNaN(expiryDate.getTime()) ? { expiryDate } : {}),
          },
        });
      } else {
        await prisma.stock.create({
          data: {
            storeId,
            warehouseId,
            productId: product.id,
            quantityAr: quantity,
            reservedQty: 0,
            batchNumber,
            ...(expiryDate && !Number.isNaN(expiryDate.getTime()) ? { expiryDate } : {}),
          },
        });
      }

      if (delta !== 0) {
        await prisma.stockMovement.create({
          data: {
            storeId,
            warehouseId,
            productId: product.id,
            movementType: 'ADJUSTMENT',
            quantity: Math.abs(delta),
            reason: `Inventaire : ${previous} → ${quantity}`,
            createdById: userId ?? null,
          },
        });
      }
      updated += 1;
    } catch (error) {
      skipped += 1;
      errors.push(`Ligne ${line} (${product.name}) : ${(error as Error).message}`);
    }
  }

  return { updated, skipped, errors: errors.slice(0, 20) };
}

export const IMPORT_COLUMNS_DOC = IMPORT_COLUMNS;
