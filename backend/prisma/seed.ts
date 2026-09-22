import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // --- Plans d'abonnement ---
  const plansData = [
    {
      name: 'FREE',
      description: 'Pour découvrir MadaStock : 1 utilisateur, 50 produits, 1 entrepôt.',
      priceAr: 0,
      billingCycle: 'MONTHLY',
      maxUsers: 1,
      maxProducts: 50,
      maxWarehouses: 1,
      maxCustomers: 100,
      featuresJson: JSON.stringify({ pos: true, stock: true, reports: false, multiWarehouse: false }),
    },
    {
      name: 'STARTER',
      description: 'Pour les petites boutiques en croissance.',
      priceAr: 25000,
      billingCycle: 'MONTHLY',
      maxUsers: 3,
      maxProducts: 500,
      maxWarehouses: 1,
      maxCustomers: 1000,
      featuresJson: JSON.stringify({ pos: true, stock: true, reports: true, multiWarehouse: false }),
    },
    {
      name: 'BUSINESS',
      description: 'Pour les boutiques établies avec plusieurs vendeurs.',
      priceAr: 50000,
      billingCycle: 'MONTHLY',
      maxUsers: 10,
      maxProducts: 5000,
      maxWarehouses: 3,
      maxCustomers: 5000,
      featuresJson: JSON.stringify({ pos: true, stock: true, reports: true, multiWarehouse: true, cashier: true }),
    },
    {
      name: 'PRO',
      description: 'Pour les chaînes de boutiques et la comptabilité avancée.',
      priceAr: 120000,
      billingCycle: 'MONTHLY',
      maxUsers: 50,
      maxProducts: 50000,
      maxWarehouses: 20,
      maxCustomers: 50000,
      featuresJson: JSON.stringify({ pos: true, stock: true, reports: true, multiWarehouse: true, cashier: true, accounting: true, api: true }),
    },
  ];

  for (const plan of plansData) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      update: {},
      create: plan,
    });
  }

  // --- Utilisateur démo ---
  const passwordHash = await bcrypt.hash('admin123', 10);

  const user = await prisma.user.upsert({
    where: { email: 'admin@madastock.mg' },
    update: {},
    create: {
      email: 'admin@madastock.mg',
      passwordHash,
      fullName: 'Admin MadaStock',
      phone: '+261340000000',
      emailVerified: true,
    },
  });

  // --- Boutique Mounaya démo ---
  const store = await prisma.store.upsert({
    where: { slug: 'mounaya' },
    update: {},
    create: {
      name: 'Mounaya',
      slug: 'mounaya',
      description: 'Boutique de produits artisanaux authentiques de Madagascar.',
      currency: 'MGA',
      country: 'MG',
      city: 'Antananarivo',
    },
  });

  const warehouse = await prisma.warehouse.findFirst({ where: { storeId: store.id } })
    ?? await prisma.warehouse.create({
      data: { storeId: store.id, name: 'Entrepôt principal', isMain: true },
    });

  const freePlan = await prisma.plan.findUnique({ where: { name: 'FREE' } });
  if (freePlan) {
    const now = new Date();
    const periodEnd = new Date(now); periodEnd.setMonth(periodEnd.getMonth() + 1);
    await prisma.subscription.upsert({
      where: { storeId: store.id },
      update: {},
      create: {
        storeId: store.id, planId: freePlan.id, status: 'TRIALING',
        trialEndsAt: new Date(now.getTime() + 14 * 86400000),
        currentPeriodStart: now, currentPeriodEnd: periodEnd,
        priceAr: freePlan.priceAr, billingCycle: freePlan.billingCycle,
      },
    });
  }

  await prisma.storeMember.upsert({
    where: { storeId_userId: { storeId: store.id, userId: user.id } },
    update: {},
    create: { storeId: store.id, userId: user.id, role: 'OWNER', isOwner: true, canManageAll: true },
  });

  const catDefs: [string, number][] = [
    ['Tissus', 1], ['Bijoux', 2], ['Artisanat', 3], ['Accessoires', 4], ['Maison', 5], ['Vêtements', 6],
  ];
  const catMap: Record<string, string> = {};
  for (const [name, order] of catDefs) {
    const c = await prisma.category.upsert({
      where: { storeId_name: { storeId: store.id, name } },
      update: {},
      create: { storeId: store.id, name, sortOrder: order },
    });
    catMap[name] = c.id;
  }

  const prods: { name: string; slug: string; desc: string; cat: string; sell: number; cost: number; img: string; qty: number }[] = [
    { name: 'Tissu Wax Africain', slug: 'tissu-wax-africain', desc: 'Tissu wax authentique haute qualité. Motifs colorés et durables.', cat: 'Tissus', sell: 45000, cost: 25000, img: 'https://images.unsplash.com/photo-1558171813-4c088753af8f?w=500', qty: 50 },
    { name: 'Bijoux Perles Artisanales', slug: 'bijoux-perles-artisanales', desc: 'Collier artisanal fait main avec des perles colorées.', cat: 'Bijoux', sell: 65000, cost: 30000, img: 'https://images.unsplash.com/photo-1515562141589-67f0d569b34e?w=500', qty: 25 },
    { name: 'Panier Enveloppe Tressé', slug: 'panier-enveloppe-tresse', desc: 'Panier tressé à la main en matériaux naturels.', cat: 'Artisanat', sell: 85000, cost: 40000, img: 'https://images.unsplash.com/photo-1595079676339-1534801ad6cf?w=500', qty: 15 },
    { name: 'Pagne Imprimé Premium', slug: 'pagne-imprime-premium', desc: 'Pagne imprimé couleurs vives et lavable.', cat: 'Tissus', sell: 35000, cost: 18000, img: 'https://images.unsplash.com/photo-1590735213920-68192a487bc2?w=500', qty: 80 },
    { name: 'Sac Cuir Artisanal', slug: 'sac-cuir-artisanal', desc: 'Sac cuir véritable fabriqué artisanalement.', cat: 'Accessoires', sell: 120000, cost: 65000, img: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=500', qty: 10 },
    { name: 'Bougies Parfumées Exotiques', slug: 'bougies-parfumees-exotiques', desc: 'Bougies artisanales aux senteurs exotiques, cire de soja.', cat: 'Maison', sell: 28000, cost: 12000, img: 'https://images.unsplash.com/photo-1602028915047-37269d1a73f7?w=500', qty: 40 },
    { name: 'Bracelet Woven', slug: 'bracelet-woven', desc: 'Bracelet tissé fait main, éco-responsable.', cat: 'Bijoux', sell: 18000, cost: 7000, img: 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=500', qty: 60 },
    { name: 'Ensemble Boubou Enfant', slug: 'ensemble-boubou-enfant', desc: 'Boubou enfant en tissu wax, élégant.', cat: 'Vêtements', sell: 75000, cost: 35000, img: 'https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?w=500', qty: 20 },
  ];

  for (const pd of prods) {
    const p = await prisma.product.upsert({
      where: { storeId_slug: { storeId: store.id, slug: pd.slug } },
      update: {},
      create: {
        storeId: store.id, categoryId: catMap[pd.cat], name: pd.name, slug: pd.slug,
        description: pd.desc, imageUrl: pd.img, costPriceAr: pd.cost, sellingPriceAr: pd.sell,
      },
    });
    const existing = await prisma.stock.findFirst({
      where: { warehouseId: warehouse.id, productId: p.id, variantId: null },
    });
    if (existing) {
      await prisma.stock.update({ where: { id: existing.id }, data: { quantityAr: pd.qty } });
    } else {
      await prisma.stock.create({
        data: { storeId: store.id, warehouseId: warehouse.id, productId: p.id, quantityAr: pd.qty, reservedQty: 0 },
      });
    }
  }

  // --- Ventes de démo (7 derniers jours) pour le dashboard ---
  const pmMethods = ['CASH', 'MOBILE_MONEY', 'CASH', 'MOBILE_MONEY', 'BANK_TRANSFER'];
  const customer = await prisma.customer.findFirst({ where: { storeId: store.id, phone: '+261345678901' } })
    ?? await prisma.customer.create({
      data: {
        storeId: store.id,
        firstName: 'Client',
        lastName: 'Démo',
        phone: '+261345678901',
        email: 'client@demo.mg',
        city: 'Antananarivo',
      },
    });

  const saleCount = await prisma.sale.count({ where: { storeId: store.id } });
  if (saleCount === 0) {
    const receiptSeq: Record<string, number> = {};
    const nbr = (offset: number) => {
      const d = new Date();
      d.setDate(d.getDate() - offset);
      d.setHours(9 + (offset % 9), (offset * 7) % 60, 0, 0);
      return d;
    };

    for (let i = 14; i >= 0; i--) {
      const date = nbr(i);
      const dayKey = date.toISOString().slice(0, 10);
      receiptSeq[dayKey] = (receiptSeq[dayKey] ?? 0) + 1;
      const receiptNumber = `MNY-${dayKey.replace(/-/g, '')}-${String(receiptSeq[dayKey]).padStart(3, '0')}`;

      const itemCount = 1 + Math.floor(Math.random() * 3);
      const chosen: { id: string; sell: number; cost: number; qty: number }[] = [];
      for (let k = 0; k < itemCount; k++) {
        const pd = prods[Math.floor(Math.random() * prods.length)];
        const product = await prisma.product.findUnique({ where: { storeId_slug: { storeId: store.id, slug: pd.slug } } });
        if (!product) continue;
        chosen.push({ id: product.id, sell: pd.sell, cost: pd.cost, qty: 1 + Math.floor(Math.random() * 3) });
      }
      if (chosen.length === 0) continue;

      const subtotal = chosen.reduce((s, c) => s + c.sell * c.qty, 0);
      const discountAr = Number((subtotal * (Math.floor(Math.random() * 10) / 100)).toFixed(2));
      const total = subtotal - discountAr;

      const sale = await prisma.sale.create({
        data: {
          storeId: store.id,
          receiptNumber,
          customerId: customer.id,
          status: 'COMPLETED',
          paymentStatus: 'PAID',
          subtotalAr: subtotal,
          discountAr,
          taxAr: 0,
          totalAr: total,
          amountPaidAr: total,
          changeAr: 0,
          paymentMethod: pmMethods[i % pmMethods.length] as any,
          createdById: user.id,
          createdAt: date,
          updatedAt: date,
          items: {
            create: chosen.map(c => ({
              productId: c.id,
              quantityAr: c.qty,
              unitPriceAr: c.sell,
              costPriceAr: c.cost,
              discountAr: 0,
              taxAr: 0,
              lineTotalAr: c.sell * c.qty,
            })),
          },
        },
      });

      for (const c of chosen) {
        await prisma.stockMovement.create({
          data: {
            storeId: store.id,
            warehouseId: warehouse.id,
            productId: c.id,
            movementType: 'SALE',
            quantity: c.qty,
            unitCostAr: c.cost,
            reason: 'Vente ' + receiptNumber,
            referenceId: sale.id,
            referenceType: 'Sale',
            createdById: user.id,
            createdAt: date,
          },
        });
        const stockRow = await prisma.stock.findFirst({
          where: { warehouseId: warehouse.id, productId: c.id, variantId: null },
        });
        if (stockRow) {
          await prisma.stock.update({
            where: { id: stockRow.id },
            data: { quantityAr: Math.max(0, Number(stockRow.quantityAr) - c.qty) },
          });
        }
      }
    }
  }

  // ============================================================
  // GARAGE & ATELIER — données démo (pièces, clients, véhicules, OR, dealer)
  // ============================================================
  const partsCat = await prisma.category.upsert({
    where: { storeId_name: { storeId: store.id, name: 'Pièces détachées' } },
    update: {},
    create: { storeId: store.id, name: 'Pièces détachées', sortOrder: 7 },
  });

  const parts: { name: string; slug: string; desc: string; sell: number; cost: number; qty: number }[] = [
    { name: 'Filtre à huile', slug: 'filtre-a-huile', desc: 'Filtre à huile universel (moteur essence/diesel).', sell: 45000, cost: 25000, qty: 30 },
    { name: 'Plaquettes de frein avant', slug: 'plaquettes-frein-avant', desc: 'Jeu de plaquettes de frein avant, qualité origine.', sell: 180000, cost: 95000, qty: 20 },
    { name: 'Bougie d\'allumage NGK', slug: 'bougie-allumage-ngk', desc: 'Bougie d\'allumage NGK standard.', sell: 22000, cost: 11000, qty: 60 },
    { name: 'Courroie de distribution', slug: 'courroie-distribution', desc: 'Courroie de distribution avec galet tendeur.', sell: 250000, cost: 130000, qty: 12 },
    { name: 'Amortisseur avant', slug: 'amortisseur-avant', desc: 'Amortisseur hydraulique avant.', sell: 320000, cost: 175000, qty: 10 },
    { name: 'Batterie 60Ah', slug: 'batterie-60ah', desc: 'Batterie automobile 60Ah sans entretien.', sell: 480000, cost: 290000, qty: 15 },
    { name: 'Liquide de frein DOT4', slug: 'liquide-frein-dot4', desc: 'Liquide de frein DOT4, 500ml.', sell: 35000, cost: 16000, qty: 40 },
    { name: 'Filtre à air', slug: 'filtre-a-air', desc: 'Filtre à air universel.', sell: 52000, cost: 24000, qty: 25 },
  ];
  for (const pd of parts) {
    const p = await prisma.product.upsert({
      where: { storeId_slug: { storeId: store.id, slug: pd.slug } },
      update: {},
      create: {
        storeId: store.id, categoryId: partsCat.id, name: pd.name, slug: pd.slug,
        description: pd.desc, costPriceAr: pd.cost, sellingPriceAr: pd.sell, lowStockThreshold: 5,
      },
    });
    const existing = await prisma.stock.findFirst({ where: { warehouseId: warehouse.id, productId: p.id, variantId: null } });
    if (existing) await prisma.stock.update({ where: { id: existing.id }, data: { quantityAr: pd.qty } });
    else await prisma.stock.create({ data: { storeId: store.id, warehouseId: warehouse.id, productId: p.id, quantityAr: pd.qty, reservedQty: 0 } });
  }

  // --- Clients garage ---
  const garageCustomers = [
    { first: 'Rakoto', last: 'Haja', phone: '+261341111111', city: 'Antananarivo', vip: true },
    { first: 'Rasoa', last: 'Mialisoa', phone: '+261342222222', city: 'Antananarivo', vip: false },
    { first: 'Andry', last: 'Nomenjanahary', phone: '+261343333333', city: 'Toamasina', vip: false },
    { first: 'Voahangy', last: 'Ratsimbazafy', phone: '+261344444444', city: 'Antananarivo', vip: true },
    { first: 'Tiana', last: 'Rabe', phone: '+261345555555', city: 'Fianarantsoa', vip: false },
    { first: 'Hery', last: 'Rasolofonirina', phone: '+261346666666', city: 'Mahajanga', vip: false },
  ];
  const custIds: string[] = [];
  for (const c of garageCustomers) {
    const existingC = await prisma.customer.findFirst({ where: { storeId: store.id, phone: c.phone } });
    const cu = existingC ?? await prisma.customer.create({
      data: { storeId: store.id, firstName: c.first, lastName: c.last, phone: c.phone, city: c.city, isVip: c.vip },
    });
    custIds.push(cu.id);
  }

  // --- Mécaniciens ---
  if ((await prisma.mechanic.count({ where: { storeId: store.id } })) === 0) {
    const mechanics = [
      { fullName: 'Jean Baptiste', phone: '+261330111111', specialty: 'Moteur & Électricité', hourlyRateAr: 25000, commissionPct: 5, colorHex: '#16a34a' },
      { fullName: 'Mamy Randria', phone: '+261330222222', specialty: 'Freins & Suspension', hourlyRateAr: 20000, commissionPct: 4, colorHex: '#2563eb' },
      { fullName: 'Mika Rakotomalala', phone: '+261330333333', specialty: 'Carrosserie', hourlyRateAr: 22000, commissionPct: 4, colorHex: '#d97706' },
      { fullName: 'Fara Razafy', phone: '+261330444444', specialty: 'Diagnostic & Vidange', hourlyRateAr: 18000, commissionPct: 3, colorHex: '#db2777' },
    ];
    for (const m of mechanics) {
      await prisma.mechanic.create({ data: { storeId: store.id, ...m } });
    }
  }

  // --- Véhicules ---
  const demoVehicles: (string | number)[][] = [
    ['5256 TAB', custIds[0], 'Toyota', 'Corolla', 2018, 'Haja'],
    ['7890 TAR', custIds[1], 'Peugeot', '208', 2020, 'Mialisoa'],
    ['3012 TYV', custIds[2], 'Mitsubishi', 'L200', 2016, 'Nomenjanahary'],
    ['8456 TAZ', custIds[3], 'Hyundai', 'Grand i10', 2019, 'Voahangy'],
    ['6631 TAJ', custIds[4], 'Kia', 'Picanto', 2017, 'Tiana'],
    ['1104 TAM', custIds[5], 'Toyota', 'Hilux', 2014, 'Hery'],
    ['9927 TBC', custIds[0], 'Renault', 'Clio 4', 2019, 'Haja'],
  ];
  if ((await prisma.vehicle.count({ where: { storeId: store.id } })) === 0) {
    for (const v of demoVehicles) {
      await prisma.vehicle.create({
        data: {
          storeId: store.id, customerId: String(v[1]), plateNumber: String(v[0]),
          make: String(v[2]), model: String(v[3]), year: Number(v[4]), fuelType: 'PETROL', vehicleType: 'CAR',
          mileageKm: 40000 + Math.floor(Math.random() * 90000), notes: `Véhicule de ${v[5] ?? ''}`,
        },
      });
    }
  }

  // --- Ordres de réparation ---
  if ((await prisma.workOrder.count({ where: { storeId: store.id } })) === 0) {
    const mechanics = await prisma.mechanic.findMany({ where: { storeId: store.id } });
    const vehicles = await prisma.vehicle.findMany({
      where: { storeId: store.id },
      include: { customer: true },
    });
    const partBySlug = async (slug: string) => prisma.product.findUnique({ where: { storeId_slug: { storeId: store.id, slug } } });

    const [filtreHuile, plaquettes, bougie, courroie, amortisseur, batterie, liquideFrein, filtreAir] = await Promise.all([
      partBySlug('filtre-a-huile'), partBySlug('plaquettes-frein-avant'), partBySlug('bougie-allumage-ngk'),
      partBySlug('courroie-distribution'), partBySlug('amortisseur-avant'), partBySlug('batterie-60ah'),
      partBySlug('liquide-frein-dot4'), partBySlug('filtre-a-air'),
    ]);

    const now = new Date();
    const daysAgo = (d: number, h: number) => { const dt = new Date(now); dt.setDate(dt.getDate() - d); dt.setHours(h, (d * 13) % 60, 0, 0); return dt; };

    type WoSeed = { v: number; mech: number; status: string; priority: string; complaint: string; diagnosis: string; dAgo: number; hour: number; discount: number; tax: number; items: { type: 'LABOR' | 'PART' | 'OTHER'; description: string; productId: string | null; qty: number; unit: number }[]; paymentStatus?: string; paid?: boolean };
    const woSeeds: WoSeed[] = [
      {
        v: 0, mech: 0, status: 'COMPLETED', priority: 'NORMAL', complaint: 'Bruit anormal au freinage',
        diagnosis: 'Plaquettes de frein usées à remplacer.', dAgo: 12, hour: 9, discount: 0, tax: 0,
        items: [
          { type: 'LABOR', description: 'Remplacement plaquettes de frein avant', productId: null, qty: 2, unit: 40000 },
          { type: 'PART', description: 'Plaquettes de frein avant', productId: plaquettes?.id ?? null, qty: 1, unit: 180000 },
        ],
        paymentStatus: 'PAID', paid: true,
      },
      {
        v: 1, mech: 3, status: 'COMPLETED', priority: 'NORMAL', complaint: 'Vidange + entretien courant',
        diagnosis: 'Huile moteur noire, filtre à changer.', dAgo: 8, hour: 10, discount: 10000, tax: 0,
        items: [
          { type: 'LABOR', description: 'Vidange + remplacement filtre à huile', productId: null, qty: 1, unit: 35000 },
          { type: 'PART', description: 'Filtre à huile', productId: filtreHuile?.id ?? null, qty: 1, unit: 45000 },
          { type: 'OTHER', description: 'Huile moteur 10W40 (4L)', productId: null, qty: 1, unit: 80000 },
        ],
        paymentStatus: 'PAID', paid: true,
      },
      {
        v: 2, mech: 1, status: 'IN_PROGRESS', priority: 'URGENT', complaint: 'Vibrations à l\'avant, direction instable',
        diagnosis: 'Amortisseur avant gauche fuyant.', dAgo: 1, hour: 8, discount: 0, tax: 0,
        items: [
          { type: 'LABOR', description: 'Remplacement amortisseur avant', productId: null, qty: 2, unit: 50000 },
          { type: 'PART', description: 'Amortisseur avant', productId: amortisseur?.id ?? null, qty: 1, unit: 320000 },
        ],
        paymentStatus: 'PENDING', paid: false,
      },
      {
        v: 3, mech: 2, status: 'WAITING_PART', priority: 'NORMAL', complaint: 'Rayure et tôle enfoncée portière arrière',
        diagnosis: 'Réparation carrosserie + peinture.', dAgo: 3, hour: 11, discount: 0, tax: 0,
        items: [
          { type: 'LABOR', description: 'Tôlerie + peinture portière arrière', productId: null, qty: 4, unit: 55000 },
        ],
        paymentStatus: 'PENDING', paid: false,
      },
      {
        v: 4, mech: 0, status: 'QUOTED', priority: 'LOW', complaint: 'Contrôle général avant voyage',
        diagnosis: 'Devis contrôle 50 points.', dAgo: 0, hour: 14, discount: 0, tax: 0,
        items: [
          { type: 'LABOR', description: 'Contrôle général 50 points', productId: null, qty: 1, unit: 60000 },
          { type: 'LABOR', description: 'Remplacement filtre à air', productId: null, qty: 1, unit: 15000 },
          { type: 'PART', description: 'Filtre à air', productId: filtreAir?.id ?? null, qty: 1, unit: 52000 },
        ],
        paymentStatus: 'PENDING', paid: false,
      },
      {
        v: 5, mech: 1, status: 'COMPLETED', priority: 'HIGH', complaint: 'Voyant batterie allumé',
        diagnosis: 'Batterie HS, remplacement nécessaire.', dAgo: 5, hour: 9, discount: 0, tax: 0,
        items: [
          { type: 'LABOR', description: 'Remplacement batterie', productId: null, qty: 1, unit: 20000 },
          { type: 'PART', description: 'Batterie 60Ah', productId: batterie?.id ?? null, qty: 1, unit: 480000 },
        ],
        paymentStatus: 'PAID', paid: true,
      },
      {
        v: 6, mech: 3, status: 'IN_PROGRESS', priority: 'NORMAL', complaint: 'Courroie bruyante',
        diagnosis: 'Courroie de distribution à remplacer.', dAgo: 2, hour: 13, discount: 0, tax: 0,
        items: [
          { type: 'LABOR', description: 'Remplacement courroie de distribution', productId: null, qty: 4, unit: 60000 },
          { type: 'PART', description: 'Courroie de distribution', productId: courroie?.id ?? null, qty: 1, unit: 250000 },
        ],
        paymentStatus: 'PENDING', paid: false,
      },
      {
        v: 1, mech: 2, status: 'PAUSED', priority: 'NORMAL', complaint: 'Fuite de liquide de frein, pédale molle',
        diagnosis: 'Flexible de frein endommagé, en attente de la pièce.', dAgo: 0, hour: 15, discount: 0, tax: 0,
        items: [
          { type: 'LABOR', description: 'Remplacement flexible de frein', productId: null, qty: 1, unit: 30000 },
          { type: 'PART', description: 'Liquide de frein DOT4', productId: liquideFrein?.id ?? null, qty: 1, unit: 35000 },
        ],
        paymentStatus: 'PENDING', paid: false,
      },
    ];

    let seq = 1;
    for (const w of woSeeds) {
      const vehicle = vehicles[w.v];
      if (!vehicle) continue;
      const mech = mechanics[w.mech];
      const labor = w.items.filter(i => i.type === 'LABOR').reduce((s, i) => s + i.qty * i.unit, 0);
      const parts = w.items.filter(i => i.type !== 'LABOR').reduce((s, i) => s + i.qty * i.unit, 0);
      const total = labor + parts - w.discount + w.tax;
      const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const orderNumber = `WO-${ymd}-${String(seq++).padStart(3, '0')}`;
      const receivedAt = daysAgo(w.dAgo, w.hour);
      const wo = await prisma.workOrder.create({
        data: {
          storeId: store.id, orderNumber, customerId: vehicle.customerId, vehicleId: vehicle.id,
          mechanicId: mech?.id ?? null, status: w.status as any, priority: w.priority as any,
          complaint: w.complaint, diagnosis: w.diagnosis, receivedAt,
          completedAt: w.status === 'COMPLETED' ? new Date(receivedAt.getTime() + 5 * 3600000) : null,
          laborCostAr: labor, partsCostAr: parts, discountAr: w.discount, taxAr: w.tax, totalAr: total,
          paymentStatus: (w.paymentStatus ?? 'PENDING') as any,
          amountPaidAr: w.paid ? total : 0, createdById: user.id,
          items: {
            create: w.items.map(it => ({
              type: it.type, description: it.description, productId: it.productId,
              quantityAr: it.qty, unitPriceAr: it.unit, discountAr: 0, taxAr: 0, lineTotalAr: it.qty * it.unit,
            })),
          },
        },
      });
      // Consommer le stock des pièces pour les OR terminés
      if (w.status === 'COMPLETED') {
        for (const it of w.items) {
          if (it.type !== 'PART' || !it.productId) continue;
          const stockRow = await prisma.stock.findFirst({ where: { storeId: store.id, productId: it.productId } });
          if (stockRow && Number(stockRow.quantityAr) >= it.qty) {
            await prisma.stock.update({ where: { id: stockRow.id }, data: { quantityAr: Number(stockRow.quantityAr) - it.qty } });
            await prisma.stockMovement.create({
              data: {
                storeId: store.id, warehouseId: stockRow.warehouseId, productId: it.productId,
                movementType: 'STOCK_OUT', quantity: it.qty, unitCostAr: it.unit,
                reason: `Pièce utilisée - ${orderNumber}`, referenceId: wo.id, referenceType: 'WORK_ORDER',
                createdById: user.id, createdAt: wo.completedAt,
              },
            });
          }
        }
      }
    }
  }

  // --- Rendez-vous ---
  if ((await prisma.appointment.count({ where: { storeId: store.id } })) === 0) {
    const mechanics = await prisma.mechanic.findMany({ where: { storeId: store.id } });
    const vehicles = await prisma.vehicle.findMany({ where: { storeId: store.id } });
    const upcoming = [1, 2, 3];
    const daysAhead = (d: number, h: number) => { const dt = new Date(); dt.setDate(dt.getDate() + d); dt.setHours(h, 30, 0, 0); return dt; };
    const types = ['REPAIR', 'MAINTENANCE', 'INSPECTION', 'DIAGNOSIS'];
    const statuses = ['SCHEDULED', 'CONFIRMED', 'CONFIRMED', 'SCHEDULED'];
    for (let i = 0; i < 6; i++) {
      const v = vehicles[i % vehicles.length];
      if (!v) continue;
      const mech = mechanics[i % mechanics.length];
      await prisma.appointment.create({
        data: {
          storeId: store.id, customerId: v.customerId, vehicleId: v.id, mechanicId: mech?.id ?? null,
          type: types[i % types.length] as any, status: statuses[i % statuses.length] as any,
          scheduledAt: daysAhead(upcoming[i % 3] + Math.floor(i / 3), 9 + i), durationMin: 60 + (i % 3) * 30,
          title: types[i % types.length] === 'MAINTENANCE' ? 'Entretien / Vidange' : types[i % types.length] === 'INSPECTION' ? 'Contrôle technique' : 'Réparation',
          createdById: user.id,
        },
      });
    }
  }

  // --- Leads ---
  if ((await prisma.lead.count({ where: { storeId: store.id } })) === 0) {
    const leads = [
      { first: 'Fanja', last: 'Rakotonirina', phone: '+261350111111', source: 'REFERRAL', status: 'NEW', valueAr: 800000 },
      { first: 'Solofo', last: 'Andrianina', phone: '+261350222222', source: 'ONLINE', status: 'CONTACTED', valueAr: 1200000 },
      { first: 'Lalatiana', last: 'Razafindrakoto', phone: '+261350333333', source: 'SOCIAL_MEDIA', status: 'QUALIFIED', valueAr: 2500000 },
      { first: 'Naina', last: 'Ravoahangy', phone: '+261350444444', source: 'WALK_IN', status: 'FOLLOW_UP', valueAr: 600000, nextFol: 2 },
      { first: 'Irinah', last: 'Rasamoelina', phone: '+261350555555', source: 'PHONE', status: 'NEW', valueAr: 400000 },
    ];
    for (const l of leads) {
      await prisma.lead.create({
        data: {
          storeId: store.id, firstName: l.first, lastName: l.last, phone: l.phone,
          source: l.source as any, status: l.status as any, valueAr: l.valueAr,
          notes: 'Prospect atelier',
          nextFollowUpAt: (l as any).nextFol ? new Date(Date.now() + (l as any).nextFol * 86400000) : null,
        },
      });
    }
  }

  // --- Devis & Factures ---
  if ((await prisma.invoice.count({ where: { storeId: store.id } })) === 0) {
    const workOrders = await prisma.workOrder.findMany({ where: { storeId: store.id }, include: { items: true } });
    const vehicles = await prisma.vehicle.findMany({ where: { storeId: store.id } });
    const invoicesTxt = await prisma.invoice.findMany({ where: { storeId: store.id } });

    const mkDoc = async (docType: 'QUOTE' | 'INVOICE', customerId: string, vehicleId: string | null, items: { type: string; description: string; productId: string | null; qty: number; unit: number }[], discount: number, status: string, paymentStatus: string, paidAmount: number, daysAgo: number, workOrderId: string | null, notes?: string) => {
      const count = invoicesTxt.length + 1;
      const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const prefix = docType === 'QUOTE' ? 'DEV' : 'INV';
      const number = `${prefix}-${ymd}-${String(count).padStart(3, '0')}`;
      const labor = items.filter(i => i.type === 'LABOR').reduce((s, i) => s + i.qty * i.unit, 0);
      const parts = items.filter(i => i.type !== 'LABOR').reduce((s, i) => s + i.qty * i.unit, 0);
      const subtotal = labor + parts;
      const total = subtotal - discount;
      const issueDate = new Date(); issueDate.setDate(issueDate.getDate() - daysAgo);
      const inv = await prisma.invoice.create({
        data: {
          storeId: store.id, number, docType, status: status as any, customerId, vehicleId, workOrderId,
          issueDate, dueDate: docType === 'INVOICE' ? new Date(issueDate.getTime() + 15 * 86400000) : null,
          subtotalAr: subtotal, discountAr: discount, taxAr: 0, totalAr: total,
          amountPaidAr: paidAmount, paymentStatus: paymentStatus as any, paymentMethod: paidAmount > 0 ? 'CASH' : null,
          notes, createdById: user.id,
          items: { create: items.map(i => ({ type: i.type as any, description: i.description, productId: i.productId, quantityAr: i.qty, unitPriceAr: i.unit, discountAr: 0, taxAr: 0, lineTotalAr: i.qty * i.unit })) },
        },
      });
      invoicesTxt.push({ id: inv.id, storeId: inv.storeId, number: inv.number } as never);
      return inv;
    };

    const completed = workOrders.slice(0, 2);
    if (completed[0]) {
      await mkDoc('INVOICE', completed[0].customerId, completed[0].vehicleId,
        completed[0].items.map(i => ({ type: i.type, description: i.description, productId: i.productId, qty: Number(i.quantityAr), unit: Number(i.unitPriceAr) })),
        Number(completed[0].discountAr), 'PAID', 'PAID', Number(completed[0].totalAr), 12, completed[0].id, 'Facture payée - réparation freins');
    }
    if (completed[1]) {
      await mkDoc('INVOICE', completed[1].customerId, completed[1].vehicleId,
        completed[1].items.map(i => ({ type: i.type, description: i.description, productId: i.productId, qty: Number(i.quantityAr), unit: Number(i.unitPriceAr) })),
        Number(completed[1].discountAr), 'ISSUED', 'PENDING', 0, 5, completed[1].id, 'Facture en attente de paiement');
    }
    if (vehicles[0]) {
      await mkDoc('QUOTE', vehicles[0].customerId, vehicles[0].id, [
        { type: 'LABOR', description: 'Révision + 50 points', productId: null, qty: 2, unit: 45000 },
        { type: 'PART', description: 'Bougies d\'allumage (x4)', productId: null, qty: 4, unit: 22000 },
      ], 0, 'SENT', 'PENDING', 0, 1, null, 'Devis de révision générale');
    }
    if (vehicles[3]) {
      await mkDoc('QUOTE', vehicles[3].customerId, vehicles[3].id, [
        { type: 'LABOR', description: 'Remplacement amortisseurs arrière', productId: null, qty: 2, unit: 45000 },
        { type: 'PART', description: 'Amortisseur arrière (x2)', productId: null, qty: 2, unit: 150000 },
      ], 15000, 'ACCEPTED', 'PENDING', 0, 2, null, 'Devis accepté - en attente de facturation');
    }
  }

  // --- Rappels ---
  if ((await prisma.reminder.count({ where: { storeId: store.id } })) === 0) {
    const vehicles = await prisma.vehicle.findMany({ where: { storeId: store.id } });
    const leads = await prisma.lead.findMany({ where: { storeId: store.id } });
    const customers = await prisma.customer.findMany({ where: { storeId: store.id } });
    const invoicesTxt = await prisma.invoice.findMany({ where: { storeId: store.id } });
    const inDays = (d: number) => new Date(Date.now() + d * 86400000);
    if (vehicles.length) {
      for (let i = 0; i < Math.min(4, vehicles.length); i++) {
        const v = vehicles[i];
        await prisma.reminder.create({
          data: {
            storeId: store.id, type: 'SERVICE_DUE', status: 'PENDING', remindAt: inDays(7 + i * 5),
            title: `Entretien programmé - ${v.plateNumber}`,
            message: `Rappeler le client pour la révision périodique du ${v.plateNumber}.`,
            vehicleId: v.id, customerId: v.customerId,
          },
        });
      }
    }
    if (leads.length) {
      for (let i = 0; i < Math.min(3, leads.length); i++) {
        const l = leads[i];
        await prisma.reminder.create({
          data: {
            storeId: store.id, type: 'FOLLOW_UP', status: 'PENDING', remindAt: inDays(1 + i),
            title: `Relance lead ${l.firstName} ${l.lastName}`,
            message: 'Appeler le prospect pour confirmer son devis.',
            leadId: l.id,
          },
        });
      }
    }
    if (invoicesTxt.length) {
      const inv = invoicesTxt[0];
      await prisma.reminder.create({
        data: {
          storeId: store.id, type: 'PAYMENT', status: 'PENDING', remindAt: inDays(3),
          title: `Paiement facture ${inv.number}`,
          message: 'Relancer le client pour le solde de la facture.', invoiceId: inv.id,
        },
      });
    }
    const anyCustomer = customers.find(c => !invoicesTxt.find(i => i.customerId === c.id));
    if (anyCustomer && vehicles.length) {
      await prisma.reminder.create({
        data: {
          storeId: store.id, type: 'FOLLOW_UP', status: 'PENDING', remindAt: inDays(2),
          title: 'Relance client satisfait',
          message: 'Appeler pour un retour d\'expérience après la réparation.',
          customerId: anyCustomer.id,
        },
      });
    }
  }

  console.log('Seed terminé.');
  console.log(`  - ${await prisma.plan.count()} plans`);
  console.log(`  - Boutique Mounaya (slug: mounaya, storeId: ${store.id})`);
  console.log(`  - Utilisateur démo : admin@madastock.mg / admin123`);
  console.log(`  - Garage : ${await prisma.mechanic.count({ where: { storeId: store.id } })} mécaniciens, ${await prisma.vehicle.count({ where: { storeId: store.id } })} véhicules, ${await prisma.workOrder.count({ where: { storeId: store.id } })} OR, ${await prisma.appointment.count({ where: { storeId: store.id } })} RV, ${await prisma.lead.count({ where: { storeId: store.id } })} leads, ${await prisma.reminder.count({ where: { storeId: store.id } })} rappels, ${await prisma.invoice.count({ where: { storeId: store.id } })} documents`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });