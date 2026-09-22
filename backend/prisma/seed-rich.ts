import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const pad3 = (n: number) => String(n).padStart(3, '0');

const image = (seed: string) => `https://picsum.photos/seed/madastock-${seed}/600/600`;

const cities = ['Antananarivo', 'Toamasina', 'Antsirabe', 'Fianarantsoa', 'Mahajanga', 'Toliara', 'Antsiranana', 'Morondava'];
const firstNames = ['Jean', 'Mamy', 'Rado', 'Hery', 'Lova', 'Fidelis', 'Nirina', 'Tsiky', 'Voahangy', 'Harilala', 'Toky', 'Mialy', 'Fenosoa', 'Harena', 'Lalaina', 'Onja', 'Ravaka', 'Anja', 'Christelle', 'Nantenaina', 'Tantely', 'Hasina', 'Miora', 'Fara', 'Tovo', 'Sedera', 'Fitia', 'Koloina', 'Manda', 'Zara'];
const lastNames = ['Rakotomalala', 'Rasolofoson', 'Andrianarisoa', 'Razafindratsimba', 'Randriamampionona', 'Rakotoarisoa', 'Andriamihaja', 'Ratsimbazafy', 'Rabeantoandro', 'Ranaivoson', 'Ramaroson', 'Herimanana', 'Razanamanga', 'Rakotovao', 'Andrianantenaina', 'Raveloson', 'Raharijaona', 'Solofoniaina', 'Randriamanantena', 'Rakotondrabe'];

const makes = ['Toyota', 'Peugeot', 'Renault', 'Hyundai', 'Kia', 'Mitsubishi', 'Nissan', 'Honda', 'Suzuki', 'Mazda', 'Ford', 'Volkswagen', 'Chevrolet', 'Dacia'];
const models: Record<string, string[]> = {
  Toyota: ['Corolla', 'Hilux', 'Avensis', 'Land Cruiser', 'Yaris', 'Rav4'],
  Peugeot: ['208', '301', '308', 'Partner', '406', '607'],
  Renault: ['Clio', 'Megane', 'Kangoo', 'Duster', 'Logan', 'Symbol'],
  Hyundai: ['Grand i10', 'Accent', 'Sonata', 'Tucson', 'H1'],
  Kia: ['Picanto', 'Rio', 'Ceed', 'Sportage', 'K2700'],
  Mitsubishi: ['L200', 'Pajero', 'Outlander', 'Lancer', 'Montero'],
  Nissan: ['March', 'Sunny', 'X-Trail', 'Navara', 'Almera'],
  Honda: ['Civic', 'Accord', 'CR-V', 'Fit', 'HR-V'],
  Suzuki: ['Swift', 'Jimny', 'Grand Vitara', 'Baleno'],
  Mazda: ['3', '5', 'BT-50', '6'],
  Ford: ['Ranger', 'Focus', 'Fiesta', 'Ecosport'],
  Volkswagen: ['Polo', 'Golf', 'Passat', 'Amarok', 'Tiguan'],
  Chevrolet: ['Aveo', 'Cruze', 'Spin', 'Onix'],
  Dacia: ['Logan', 'Sandero', 'Duster', 'Lodgy'],
};

const plateLetters = ['TAA', 'TAB', 'TAR', 'TBC', 'TAV', 'TAZ', 'TAJ', 'TAM', 'TAN', 'TAV', 'TAK', 'TAB'];

function makePlate(n: number) {
  const num = Math.floor(1000 + Math.random() * 8900);
  const letters = plateLetters[n % plateLetters.length];
  return `${num} ${letters}`;
}

async function main() {
  const store = await prisma.store.findUnique({ where: { slug: 'mounaya' } });
  const admin = await prisma.user.findUnique({ where: { email: 'admin@madastock.mg' } });
  if (!store || !admin) {
    console.error('Lancez d\u2019abord le seed de base (npm run prisma:seed).');
    return;
  }
  const storeId = store.id;
  const warehouse = await prisma.warehouse.findFirst({ where: { storeId, isMain: true } });
  if (!warehouse) {
    console.error('Entrepôt principal introuvable.');
    return;
  }
  const adminId = admin.id;

  const cat = async (name: string) => {
    const c = await prisma.category.findFirst({ where: { storeId, name } });
    if (!c) throw new Error(`Catégorie introuvable : ${name}`);
    return c.id;
  };

  // ============================================================
  // 1) PRODUITS + PHOTOS (+ pièces + stock)
  // ============================================================
  const productCount = await prisma.product.count({ where: { storeId } });
  if (productCount < 55) {
    const catalog: { name: string; cat: string; desc: string; cost: number; sell: number; qty: number; wholesale?: number }[] = [
      // Tissus & textiles
      { name: 'Tissu Wax Rose Passion', cat: 'Tissus', desc: 'Tissu wax 100% coton, motif rose. Vendu au mètre.', cost: 26000, sell: 47000, qty: 60 },
      { name: 'Tissu Lamba Ariane', cat: 'Tissus', desc: 'Lamba traditionnel malgache haute qualité.', cost: 30000, sell: 55000, qty: 45 },
      { name: 'Pagne Wax Bleu Nuit', cat: 'Tissus', desc: 'Pagne wax bleu nuit imprimé.', cost: 20000, sell: 38000, qty: 70 },
      { name: 'Soie Sauvage Landy', cat: 'Tissus', desc: 'Soie sauvage tissée à la main.', cost: 90000, sell: 160000, qty: 12, wholesale: 140000 },
      { name: 'Tissu Viscose Fleuri', cat: 'Tissus', desc: 'Viscose légère à motifs floraux.', cost: 18000, sell: 34000, qty: 55 },
      { name: 'Coton Brodé Antaimoro', cat: 'Tissus', desc: 'Papier Antaimoro & coton brodé premium.', cost: 40000, sell: 75000, qty: 18, wholesale: 65000 },
      // Bijoux
      { name: 'Collier Perles de Mer', cat: 'Bijoux', desc: 'Collier de perles naturelles.', cost: 35000, sell: 68000, qty: 22, wholesale: 58000 },
      { name: 'Boucles d\u2019oreilles Filigrane', cat: 'Bijoux', desc: 'Filigrane argent travaillé à la main.', cost: 40000, sell: 78000, qty: 16 },
      { name: 'Bracelet Argentsa', cat: 'Bijoux', desc: 'Bracelet en argent sterling.', cost: 48000, sell: 90000, qty: 14, wholesale: 79000 },
      { name: 'Bague Pierre Précieuse', cat: 'Bijoux', desc: 'Bague ornée d\u2019une pierre locale.', cost: 55000, sell: 105000, qty: 10 },
      { name: 'Collier Édénique Tatie', cat: 'Bijoux', desc: 'Collier statement artisanal.', cost: 30000, sell: 58000, qty: 25 },
      { name: 'Set Parure Antique', cat: 'Bijoux', desc: 'Parure complète style antique.', cost: 42000, sell: 82000, qty: 12 },
      // Artisanat
      { name: 'Panier Tressé Rabanna', cat: 'Artisanat', desc: 'Panier en fibres naturelles tressées.', cost: 15000, sell: 32000, qty: 40 },
      { name: 'Chapeau Vakomana', cat: 'Artisanat', desc: 'Chapeau tressé pandanus.', cost: 12000, sell: 28000, qty: 35 },
      { name: 'Tableau Rafia Miroir', cat: 'Artisanat', desc: 'Tableau mural en rafia.', cost: 25000, sell: 52000, qty: 15 },
      { name: 'Corbeille Rotin', cat: 'Artisanat', desc: 'Corbeille en rotin galvanisé.', cost: 20000, sell: 44000, qty: 28 },
      { name: 'Sculpture Bois Dur', cat: 'Artisanat', desc: 'Sculpture artisanal en bois dur.', cost: 60000, sell: 120000, qty: 8, wholesale: 105000 },
      { name: 'Sac Tressé Sisal', cat: 'Artisanat', desc: 'Sac de plage tressé sisal.', cost: 18000, sell: 40000, qty: 30 },
      // Accessoires
      { name: 'Sac à main Cuir Tova', cat: 'Accessoires', desc: 'Sac cuir véritable cousu main.', cost: 80000, sell: 150000, qty: 9, wholesale: 130000 },
      { name: 'Ceinture Tressée Homme', cat: 'Accessoires', desc: 'Ceinture cuir tressée.', cost: 25000, sell: 50000, qty: 24 },
      { name: 'Écharpe Soie Malaky', cat: 'Accessoires', desc: 'Écharpe en soie malaky.', cost: 30000, sell: 65000, qty: 18 },
      { name: 'Sac Banane Wax', cat: 'Accessoires', desc: 'Sac banane en tissu wax.', cost: 12000, sell: 26000, qty: 40 },
      { name: 'Sandales Cuir TIA', cat: 'Accessoires', desc: 'Sandales en cuir faites main.', cost: 35000, sell: 70000, qty: 20 },
      // Maison
      { name: 'Bougies Vanille Ambrée', cat: 'Maison', desc: 'Bougie parfumée vanille ambrée, cire de soja.', cost: 14000, sell: 30000, qty: 45 },
      { name: 'Diffuseur Ylang-Ylang', cat: 'Maison', desc: 'Diffuseur à bâtonnets ylang-ylang.', cost: 22000, sell: 48000, qty: 26 },
      { name: 'Nappe Brodée Ravinala', cat: 'Maison', desc: 'Nappe en coton brodée main.', cost: 28000, sell: 58000, qty: 14 },
      { name: 'Set Corbeille Balai', cat: 'Maison', desc: 'Set maison tressé.', cost: 16000, sell: 36000, qty: 32 },
      { name: 'Tapis Sol Raso', cat: 'Maison', desc: 'Tapis de sol tressé.', cost: 40000, sell: 85000, qty: 8, wholesale: 74000 },
      // Vêtements
      { name: 'Boubou Homme Wax', cat: 'Vêtements', desc: 'Boubou homme en wax premium.', cost: 55000, sell: 105000, qty: 16, wholesale: 92000 },
      { name: 'Robe Vague à Fleurs', cat: 'Vêtements', desc: 'Robe fluide imprimé fleurs.', cost: 30000, sell: 65000, qty: 22 },
      { name: 'Lamba Femme Traditionnel', cat: 'Vêtements', desc: 'Lamba traditionnel femme.', cost: 25000, sell: 53000, qty: 30 },
      { name: 'Chemise Lin Manakara', cat: 'Vêtements', desc: 'Chemise en lin natif.', cost: 40000, sell: 80000, qty: 15 },
      { name: 'Ensemble Enfant Wax', cat: 'Vêtements', desc: 'Ensemble enfant en wax coloré.', cost: 20000, sell: 42000, qty: 26 },
      { name: 'Pagne Mandela Femme', cat: 'Vêtements', desc: 'Pagne femme coupe droite.', cost: 32000, sell: 68000, qty: 19 },
      // Pièces auto — garage
      { name: 'Disques de frein avant', cat: 'Pièces détachées', desc: 'Paire de disques de frein ventilés.', cost: 120000, sell: 210000, qty: 14, wholesale: 190000 },
      { name: 'Kit embrayage', cat: 'Pièces détachées', desc: 'Kit embrayage complet (disque + butée + mécanisme).', cost: 220000, sell: 380000, qty: 8, wholesale: 350000 },
      { name: 'Alternateur 90A', cat: 'Pièces détachées', desc: 'Alternateur neuf 90A.', cost: 180000, sell: 320000, qty: 10 },
      { name: 'Démarreur universel', cat: 'Pièces détachées', desc: 'Démarreur universel 12V.', cost: 160000, sell: 290000, qty: 9 },
      { name: 'Flexibles de frein (x2)', cat: 'Pièces détachées', desc: 'Paire de flexibles de frein avant.', cost: 45000, sell: 85000, qty: 20 },
      { name: 'Galet tendeur', cat: 'Pièces détachées', desc: 'Galet tendeur courroie accessoires.', cost: 70000, sell: 130000, qty: 12 },
      { name: 'Pompe à eau', cat: 'Pièces détachées', desc: 'Pompe à eau moteur.', cost: 90000, sell: 165000, qty: 11 },
      { name: 'Sonde lambda', cat: 'Pièces détachées', desc: 'Sonde lambda origine.', cost: 85000, sell: 155000, qty: 13 },
      { name: 'Tringlerie boîte de vitesses', cat: 'Pièces détachées', desc: 'Tringlerie de commande BV.', cost: 30000, sell: 60000, qty: 18 },
      { name: 'Ressorts avant', cat: 'Pièces détachées', desc: 'Paire de ressorts de suspension avant.', cost: 95000, sell: 180000, qty: 10 },
      { name: 'Roulement roue avant', cat: 'Pièces détachées', desc: 'Roulement de roue avant.', cost: 55000, sell: 105000, qty: 15 },
      { name: 'Vilebrequin 1.6L', cat: 'Pièces détachées', desc: 'Vilebrequin acier forgé 1.6L.', cost: 450000, sell: 780000, qty: 3, wholesale: 710000 },
    ];

    const partsCatId = await cat('Pièces détachées');
    const existingNames = new Set((await prisma.product.findMany({ where: { storeId }, select: { name: true } })).map((p) => p.name));

    let added = 0;
    let skuIdx = await prisma.product.count({ where: { storeId } }) + 1;
    for (const pd of catalog) {
      if (existingNames.has(pd.name)) continue;
      const categoryId = pd.cat === 'Pièces détachées' ? partsCatId : await cat(pd.cat);
      const slugBase = pd.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      let slug = slugBase;
      let idxSlug = 1;
      while (await prisma.product.findUnique({ where: { storeId_slug: { storeId, slug } } })) {
        slug = `${slugBase}-${++idxSlug}`;
      }
      const product = await prisma.product.create({
        data: {
          storeId, categoryId, name: pd.name, slug, description: pd.desc,
          imageUrl: image(slug), sku: `MSK-${pad3(skuIdx++)}`,
          costPriceAr: pd.cost, sellingPriceAr: pd.sell,
          wholesalePriceAr: pd.wholesale ?? undefined,
          lowStockThreshold: 5, trackStock: true,
        },
      });
      await prisma.stock.create({
        data: {
          storeId, warehouseId: warehouse.id, productId: product.id, quantityAr: pd.qty, reservedQty: 0,
          minStock: 5,
        },
      });
      existingNames.add(pd.name);
      added++;
    }
    console.log(`+ ${added} produits et pièces avec photos`);
  }

  // ============================================================
  // 2) CLIENTS
  // ============================================================
  const customerCount = await prisma.customer.count({ where: { storeId } });
  if (customerCount < 15) {
    const existingPhones = new Set((await prisma.customer.findMany({ where: { storeId }, select: { phone: true } })).map((c) => c.phone));
    let added = 0;
    let cid = 0;
    while (customerCount + added < 38 && cid < 40) {
      const first = pick(firstNames);
      const last = pick(lastNames);
      const phone = `+26137${String(500000 + randInt(0, 900000)).slice(0, 1)}${String(500000 + randInt(0, 999999)).padStart(6, '0').slice(0, 6)}`;
      if (existingPhones.has(phone)) { cid++; continue; }
      existingPhones.add(phone);
      const created = new Date(Date.now() - randInt(0, 700) * 86400000);
      const customer = await prisma.customer.create({
        data: {
          storeId, firstName: first, lastName: last, phone,
          email: `${first.toLowerCase()}.${last.toLowerCase()}@gmail.com`,
          city: pick(cities), address: `Lot ${randInt(1, 400)} ${pick(['Tanambao', 'Andravoahangy', 'Ivandry', 'Ambohijatovo', '67 Ha', 'Ankorondrano', 'Ambatobe', 'Antsahabe', 'Mahamasina'])}`,
          gender: 'M', isVip: randInt(0, 9) < 2, notes: 'Client fidèle', createdAt: created,
        },
      });
      void customer;
      added++;
      cid++;
    }
    console.log(`+ ${added} clients`);
  }

  // ============================================================
  // 3) VÉHICULES
  // ============================================================
  const vehicleCount = await prisma.vehicle.count({ where: { storeId } });
  if (vehicleCount < 10) {
    const customers = await prisma.customer.findMany({ where: { storeId, isActive: true } });
    const existingPlates = new Set((await prisma.vehicle.findMany({ where: { storeId }, select: { plateNumber: true } })).map((v) => v.plateNumber));
    let added = 0;
    let guard = 0;
    while (vehicleCount + added < 26 && guard < 60) {
      const plate = makePlate(added);
      guard++;
      if (existingPlates.has(plate)) continue;
      existingPlates.add(plate);
      const customer = pick(customers);
      const make = pick(makes);
      const model = pick(models[make]);
      await prisma.vehicle.create({
        data: {
          storeId, customerId: customer.id, plateNumber: plate, make, model,
          year: randInt(2008, 2024), color: pick(['Noir', 'Blanc', 'Gris clair', 'Rouge', 'Bleu nuit', 'Argent', 'Beige', 'Vert']),
          fuelType: randInt(0, 3) === 0 ? 'DIESEL' : 'PETROL', vehicleType: randInt(0, 7) < 2 ? 'MOTORCYCLE' : 'CAR',
          mileageKm: randInt(12000, 220000), notes: `Véhicule de ${customer.firstName}`,
          vin: Array.from({ length: 17 }, () => 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789'[randInt(0, 30)]).join(''),
        },
      });
      added++;
    }
    console.log(`+ ${added} véhicules`);
  }

  // ============================================================
  // 4) MÉCANICIENS
  // ============================================================
  const mechanicCount = await prisma.mechanic.count({ where: { storeId } });
  if (mechanicCount < 8) {
    const more = [
      { fullName: 'Tolojanahary R.', specialty: 'Transmission & Embrayage', hourlyRateAr: 24000, commissionPct: 5, colorHex: '#7c3aed' },
      { fullName: 'Karlin Ranaivo', specialty: 'Climatisation & Électricité', hourlyRateAr: 23000, commissionPct: 4, colorHex: '#0ea5e9' },
      { fullName: 'Fabrice Andria', specialty: 'Moteur Diesel', hourlyRateAr: 27000, commissionPct: 6, colorHex: '#dc2626' },
      { fullName: 'Tahiry Manjaka', specialty: 'Suspension & Direction', hourlyRateAr: 21000, commissionPct: 4, colorHex: '#059669' },
      { fullName: 'Solofo Harivelo', specialty: 'Peinture & Carrosserie', hourlyRateAr: 22000, commissionPct: 5, colorHex: '#ea580c' },
      { fullName: 'Nirina Rakotondra', specialty: 'Diagnostic Électronique', hourlyRateAr: 29000, commissionPct: 6, colorHex: '#4f46e5' },
    ];
    const existing = new Set((await prisma.mechanic.findMany({ where: { storeId }, select: { fullName: true } })).map((m) => m.fullName));
    let added = 0;
    for (const m of more) {
      if (existing.has(m.fullName)) continue;
      await prisma.mechanic.create({
        data: { storeId, fullName: m.fullName, phone: `+26133${String(800000 + added * 1111).slice(0, 6)}`, specialty: m.specialty, hourlyRateAr: m.hourlyRateAr, commissionPct: m.commissionPct, colorHex: m.colorHex },
      });
      existing.add(m.fullName);
      added++;
    }
    console.log(`+ ${added} mécaniciens`);
  }

  // ============================================================
  // 5) ORDRES DE RÉPARATION + consommation stock
  // ============================================================
  const workOrderCount = await prisma.workOrder.count({ where: { storeId } });
  if (workOrderCount < 15) {
    const customers = await prisma.customer.findMany({ where: { storeId, isActive: true } });
    const vehicles = await prisma.vehicle.findMany({ where: { storeId, isActive: true } });
    const mechanics = await prisma.mechanic.findMany({ where: { storeId, isActive: true } });
    const parts = await prisma.product.findMany({ where: { storeId, category: { name: 'Pièces détachées' } } });
    const laborTasks = [
      { desc: 'Révision générale (vidange + filtres)', hours: 2, rate: 35000 },
      { desc: 'Remplacement kit embrayage', hours: 5, rate: 45000 },
      { desc: 'Remplacement amortisseurs arrière', hours: 3, rate: 40000 },
      { desc: 'Remplacement disques et plaquettes de frein', hours: 2.5, rate: 42000 },
      { desc: 'Diagnostic électronique complet', hours: 1.5, rate: 55000 },
      { desc: 'Remplacement courroie de distribution', hours: 4, rate: 50000 },
      { desc: 'Réparation climatisation', hours: 3, rate: 48000 },
      { desc: 'Réglage parallélisme et équilibrage', hours: 1, rate: 25000 },
      { desc: 'Remplacement pompe à eau', hours: 3, rate: 42000 },
      { desc: 'Peinture carrosserie (panneau)', hours: 6, rate: 30000 },
    ];
    const complaints = [
      'Bruit au passage des bosses', 'Perte de puissance en côte', 'Réchauffement moteur anormal',
      'Fuite d\u2019huile sous le véhicule', 'Voyant moteur allumé', 'Traction à droite', 'Bruit de grincement au freinage',
      'Vibrations au volant à 90 km/h', 'Démarrage difficile à froid', 'Odeur de brûlé dans l\u2019habitacle',
      'Embrayage qui patine', 'AC ne refroidit plus', 'Fumée noire à l\u2019échappement', 'Courroie qui siffle',
    ];
    const statuses: { s: string; p: string }[] = [
      { s: 'QUOTED', p: 'LOW' }, { s: 'QUOTED', p: 'NORMAL' }, { s: 'QUOTED', p: 'NORMAL' }, { s: 'QUOTED', p: 'HIGH' }, { s: 'QUOTED', p: 'LOW' },
      { s: 'IN_PROGRESS', p: 'NORMAL' }, { s: 'IN_PROGRESS', p: 'HIGH' }, { s: 'IN_PROGRESS', p: 'NORMAL' }, { s: 'IN_PROGRESS', p: 'URGENT' }, { s: 'IN_PROGRESS', p: 'NORMAL' },
      { s: 'WAITING_PART', p: 'NORMAL' }, { s: 'WAITING_PART', p: 'HIGH' }, { s: 'WAITING_PART', p: 'NORMAL' },
      { s: 'PAUSED', p: 'NORMAL' }, { s: 'PAUSED', p: 'LOW' },
      { s: 'COMPLETED', p: 'NORMAL' }, { s: 'COMPLETED', p: 'HIGH' }, { s: 'COMPLETED', p: 'NORMAL' }, { s: 'COMPLETED', p: 'URGENT' }, { s: 'COMPLETED', p: 'NORMAL' },
      { s: 'COLLECTED', p: 'NORMAL' }, { s: 'COLLECTED', p: 'LOW' },
      { s: 'CANCELLED', p: 'NORMAL' },
    ];

    const allNumbers = new Set((await prisma.workOrder.findMany({ where: { storeId }, select: { orderNumber: true } })).map((w) => w.orderNumber));
    const numberFor = (date: Date, seq: number) => {
      const ymd = date.toISOString().slice(0, 10).replace(/-/g, '');
      let n = `WO-${ymd}-${pad3(seq)}`;
      while (allNumbers.has(n)) { seq++; n = `WO-${ymd}-${pad3(seq)}`; }
      allNumbers.add(n);
      return n;
    };

    let added = 0;
    for (let i = 0; i < statuses.length; i++) {
      const st = statuses[i];
      const vehicle = vehicles[randInt(0, vehicles.length - 1)] ?? null;
      const customer = vehicle ? await prisma.customer.findUnique({ where: { id: vehicle.customerId } }) : pick(customers);
      if (!customer) continue;
      const mechanic = mechanics[randInt(0, mechanics.length - 1)] ?? null;
      const lab = pick(laborTasks);
      const partA = parts[randInt(0, parts.length - 1)];
      const maybePart = randInt(0, 9) < 7 ? partA : null;
      const numLabor = randInt(1, 2);
      const items: { type: string; description: string; productId: string | null; qty: number; unit: number }[] = [];
      let laborCost = 0, partsCost = 0;
      for (let k = 0; k < numLabor; k++) {
        const t = pick(laborTasks);
        const unit = t.rate;
        const qty = k === 0 ? lab.hours : t.hours;
        items.push({ type: 'LABOR', description: t.desc, productId: null, qty, unit });
        laborCost += qty * unit;
      }
      if (maybePart) {
        const qty = randInt(1, 2);
        items.push({ type: 'PART', description: maybePart.name, productId: maybePart.id, qty, unit: Number(maybePart.sellingPriceAr) });
        partsCost += qty * Number(maybePart.sellingPriceAr);
      }
      const daysAgo = randInt(0, 21);
      const receivedAt = new Date(Date.now() - daysAgo * 86400000 - randInt(0, 11) * 3600000);
      receivedAt.setMinutes(0, 0, 0);
      const total = laborCost + partsCost;
      const completed = st.s === 'COMPLETED' || st.s === 'COLLECTED';
      const completedAt = completed ? new Date(receivedAt.getTime() + randInt(5, 30) * 3600000) : null;
      const wo = await prisma.workOrder.create({
        data: {
          storeId, orderNumber: numberFor(receivedAt, i + 1), customerId: customer.id,
          vehicleId: vehicle?.id ?? null, mechanicId: mechanic?.id ?? null,
          status: st.s as never, priority: st.p as never,
          complaint: pick(complaints), diagnosis: 'Diagnostic : vérification effectuée, réparation recommandée.',
          receivedAt, completedAt,
          estimatedDeliveryAt: st.s === 'QUOTED' ? new Date(receivedAt.getTime() + 86400000) : null,
          laborCostAr: laborCost, partsCostAr: partsCost, totalAr: total,
          paymentStatus: completed ? 'PAID' : 'PENDING', amountPaidAr: completed ? total : 0,
          notes: st.s === 'PAUSED' ? 'En attente d\u2019accord client.' : null,
          createdById: adminId,
          items: { create: items.map((it) => ({ type: it.type as never, description: it.description, productId: it.productId, quantityAr: it.qty, unitPriceAr: it.unit, discountAr: 0, taxAr: 0, lineTotalAr: it.qty * it.unit })) },
        },
      });
      // Consommation stock pour les pièces des OR terminés
      if (completed) {
        for (const it of items) {
          if (it.type !== 'PART' || !it.productId) continue;
          const stock = await prisma.stock.findFirst({ where: { storeId, productId: it.productId } });
          if (stock && Number(stock.quantityAr) >= it.qty) {
            await prisma.stock.update({ where: { id: stock.id }, data: { quantityAr: Number(stock.quantityAr) - it.qty } });
            await prisma.stockMovement.create({
              data: {
                storeId, warehouseId: stock.warehouseId, productId: it.productId, movementType: 'STOCK_OUT',
                quantity: it.qty, unitCostAr: it.unit, reason: `Pièce utilisée - ${wo.orderNumber}`,
                referenceId: wo.id, referenceType: 'WORK_ORDER', createdById: adminId, createdAt: completedAt ?? new Date(),
              },
            });
          }
        }
      }
      added++;
    }
    console.log(`+ ${added} ordres de réparation`);
  }

  // ============================================================
  // 6) RENDEZ-VOUS
  // ============================================================
  const appointmentCount = await prisma.appointment.count({ where: { storeId } });
  if (appointmentCount < 12) {
    const vehicles = await prisma.vehicle.findMany({ where: { storeId, isActive: true } });
    const mechanics = await prisma.mechanic.findMany({ where: { storeId, isActive: true } });
    const types = ['REPAIR', 'MAINTENANCE', 'INSPECTION', 'DIAGNOSIS', 'PICKUP'];
    const statuses = ['SCHEDULED', 'SCHEDULED', 'CONFIRMED', 'CONFIRMED', 'SCHEDULED'];
    const titles = { REPAIR: 'Réparation', MAINTENANCE: 'Entretien / Vidange', INSPECTION: 'Contrôle technique', DIAGNOSIS: 'Diagnostic', PICKUP: 'Enlèvement véhicule' };
    let added = 0;
    for (let i = 0; i < 14; i++) {
      const vehicle = vehicles[randInt(0, vehicles.length - 1)] ?? null;
      if (!vehicle) break;
      const mechanic = mechanics[randInt(0, mechanics.length - 1)] ?? null;
      const type = types[randInt(0, types.length - 1)];
      const dayOffset = randInt(0, 13);
      const scheduledAt = new Date();
      scheduledAt.setDate(scheduledAt.getDate() + dayOffset);
      scheduledAt.setHours(8 + Math.floor(i % 9), (i * 17) % 60, 0, 0);
      await prisma.appointment.create({
        data: {
          storeId, customerId: vehicle.customerId, vehicleId: vehicle.id,
          mechanicId: mechanic?.id ?? null, type: type as never, status: statuses[randInt(0, statuses.length - 1)] as never,
          scheduledAt, durationMin: 60 + (i % 4) * 30, title: titles[type as keyof typeof titles],
          notes: dayOffset === 0 ? 'RDV aujourd\u2019hui' : null, createdById: adminId,
        },
      });
      added++;
    }
    console.log(`+ ${added} rendez-vous`);
  }

  // ============================================================
  // 7) LEADS
  // ============================================================
  const leadCount = await prisma.lead.count({ where: { storeId } });
  if (leadCount < 8) {
    const sources = ['REFERRAL', 'WALK_IN', 'ONLINE', 'PHONE', 'SOCIAL_MEDIA'];
    const statuses = ['NEW', 'NEW', 'CONTACTED', 'QUALIFIED', 'FOLLOW_UP', 'FOLLOW_UP', 'WON', 'LOST'];
    const existingPhones = new Set((await prisma.lead.findMany({ where: { storeId }, select: { phone: true } })).map((l) => l.phone));
    let added = 0;
    for (let i = 0; i < 18; i++) {
      const first = pick(firstNames);
      const last = pick(lastNames);
      const phone = `+26138${String(400000 + randInt(0, 900000)).slice(0, 6)}`;
      if (existingPhones.has(phone)) continue;
      existingPhones.add(phone);
      const engaged = randInt(0, 9) >= 4;
      const status = statuses[randInt(0, statuses.length - 1)];
      await prisma.lead.create({
        data: {
          storeId, firstName: first, lastName: last, phone,
          email: `${first.toLowerCase()}.${last.toLowerCase()}@yahoo.fr`,
          source: sources[randInt(0, sources.length - 1)] as never, status: status as never,
          valueAr: randInt(3, 60) * 100000,
          notes: 'Prospect atelier / boutique',
          nextFollowUpAt: status !== 'WON' && status !== 'LOST' ? new Date(Date.now() + randInt(1, 6) * 86400000) : null,
          firstContactAt: engaged ? new Date(Date.now() - randInt(1, 12) * 86400000) : null,
          lastContactAt: engaged ? new Date(Date.now() - randInt(0, 3) * 86400000) : null,
          createdAt: new Date(Date.now() - randInt(3, 25) * 86400000),
        },
      });
      added++;
    }
    console.log(`+ ${added} prospects`);
  }

  // ============================================================
  // 8) INTERACTIONS (historique CRM)
  // ============================================================
  const interactionCount = await prisma.interaction.count({ where: { storeId } });
  if (interactionCount === 0) {
    const leads = await prisma.lead.findMany({ where: { storeId }, include: { convertedCustomer: true } });
    const customers = await prisma.customer.findMany({ where: { storeId, isActive: true } });
    const workOrders = await prisma.workOrder.findMany({ where: { storeId } });
    const types = ['CALL', 'WHATSAPP', 'SMS', 'EMAIL', 'VISIT', 'MEETING'];
    const subjects = [
      'Premier appel de prospection', 'Suivi du devis', 'Confirmation de rendez-vous', 'Relance paiement facture',
      'Rappel entretien préventif', 'Prise de rendez-vous', 'Merci pour votre visite', 'Confirmation réparation terminée',
      'Prospection nouveaux clients', 'Présentation catalogue',
    ];
    let added = 0;
    for (let i = 0; i < 26; i++) {
      const type = types[randInt(0, types.length - 1)];
      const at = new Date(Date.now() - randInt(0, 20) * 86400000 - randInt(0, 9) * 3600000);
      const roll = i % 5;
      const data: { customerId?: string; leadId?: string; workOrderId?: string } = {};
      if (roll === 0 && leads.length) data.leadId = pick(leads).id;
      else if (roll === 1 && customers.length) data.customerId = pick(customers).id;
      else if (roll === 2 && workOrders.length) data.workOrderId = pick(workOrders).id;
      else if (roll === 3 && leads.length) data.leadId = pick(leads).id;
      else if (customers.length) data.customerId = pick(customers).id;
      if (!data.customerId && !data.leadId && !data.workOrderId) data.customerId = customers[0]?.id;
      await prisma.interaction.create({
        data: {
          storeId, type: type as never, subject: pick(subjects),
          body: 'Échange avec le client (appel suivi d\u2019un message). Résultat à reporter dans le prochain suivi.',
          customerId: data.customerId ?? null, leadId: data.leadId ?? null, workOrderId: data.workOrderId ?? null,
          performedById: adminId, createdAt: at,
        },
      });
      added++;
    }
    console.log(`+ ${added} interactions CRM`);
  }

  // ============================================================
  // 9) DEVIS & FACTURES
  // ============================================================
  const invoiceCount = await prisma.invoice.count({ where: { storeId } });
  if (invoiceCount < 8) {
    const customers = await prisma.customer.findMany({ where: { storeId, isActive: true } });
    const vehicles = await prisma.vehicle.findMany({ where: { storeId, isActive: true } });
    const parts = await prisma.product.findMany({ where: { storeId, category: { name: 'Pièces détachées' } } });
    const existingNumbers = new Set((await prisma.invoice.findMany({ where: { storeId }, select: { number: true } })).map((i) => i.number));
    const numberFor = (docType: string, date: Date, seq: number) => {
      const ymd = date.toISOString().slice(0, 10).replace(/-/g, '');
      const prefix = docType === 'QUOTE' ? 'DEV' : 'INV';
      let n = `${prefix}-${ymd}-${pad3(seq)}`;
      while (existingNumbers.has(n)) { seq++; n = `${prefix}-${ymd}-${pad3(seq)}`; }
      existingNumbers.add(n);
      return n;
    };

    const docs: { docType: string; status: string; daysAgo: number }[] = [
      { docType: 'QUOTE', status: 'SENT', daysAgo: 1 },
      { docType: 'QUOTE', status: 'SENT', daysAgo: 2 },
      { docType: 'QUOTE', status: 'ACCEPTED', daysAgo: 3 },
      { docType: 'QUOTE', status: 'ACCEPTED', daysAgo: 4 },
      { docType: 'QUOTE', status: 'EXPIRED', daysAgo: 20 },
      { docType: 'QUOTE', status: 'SENT', daysAgo: 1 },
      { docType: 'INVOICE', status: 'ISSUED', daysAgo: 6 },
      { docType: 'INVOICE', status: 'PARTIALLY_PAID', daysAgo: 10 },
      { docType: 'INVOICE', status: 'OVERDUE', daysAgo: 25 },
      { docType: 'INVOICE', status: 'ISSUED', daysAgo: 4 },
      { docType: 'INVOICE', status: 'PAID', daysAgo: 12 },
      { docType: 'INVOICE', status: 'PARTIALLY_PAID', daysAgo: 8 },
    ];
    let added = 0;
    for (let i = 0; i < docs.length; i++) {
      const d = docs[i];
      const customer = pick(customers);
      const vehicle = vehicles[randInt(0, vehicles.length - 1)] ?? null;
      const part = parts[randInt(0, parts.length - 1)];
      const labor = { qty: randInt(1, 3), unit: randInt(20000, 50000) };
      const itemDefs = [
        { type: 'LABOR', description: 'Main d\u2019œuvre atelier', productId: null, qty: labor.qty, unit: labor.unit },
      ];
      if (part) itemDefs.push({ type: 'PART', description: part.name, productId: part.id, qty: randInt(1, 2), unit: Number(part.sellingPriceAr) });
      const subtotal = itemDefs.reduce((s, it) => s + it.qty * it.unit, 0);
      const discount = d.docType === 'QUOTE' ? randInt(0, 50000) : 0;
      const total = subtotal - discount;
      const issueDate = new Date(Date.now() - d.daysAgo * 86400000);
      const paidFrac = d.status === 'PAID' ? 1 : d.status === 'PARTIALLY_PAID' ? 0.5 : 0;
      await prisma.invoice.create({
        data: {
          storeId, number: numberFor(d.docType, issueDate, i + 1), docType: d.docType as never, status: d.status as never,
          customerId: customer.id, vehicleId: vehicle?.id ?? null, workOrderId: null,
          issueDate, dueDate: d.docType === 'INVOICE' ? new Date(issueDate.getTime() + 15 * 86400000) : null,
          subtotalAr: subtotal, discountAr: discount, taxAr: 0, totalAr: total,
          amountPaidAr: Math.round(total * paidFrac),
          paymentStatus: d.status === 'PAID' ? 'PAID' : paidFrac > 0 ? 'PARTIALLY_PAID' : 'PENDING',
          paymentMethod: paidFrac > 0 ? pick(['CASH', 'MOBILE_MONEY', 'BANK_TRANSFER']) : null,
          notes: d.docType === 'QUOTE' ? 'Devis de réparation' : 'Facture de réparation',
          createdById: adminId,
          items: { create: itemDefs.map((it) => ({ type: it.type as never, description: it.description, productId: it.productId, quantityAr: it.qty, unitPriceAr: it.unit, discountAr: 0, taxAr: 0, lineTotalAr: it.qty * it.unit })) },
        },
      });
      added++;
    }
    console.log(`+ ${added} devis & factures`);
  }

  // ============================================================
  // 10) RAPPELS
  // ============================================================
  const reminderCount = await prisma.reminder.count({ where: { storeId } });
  if (reminderCount < 10) {
    const vehicles = await prisma.vehicle.findMany({ where: { storeId, isActive: true } });
    const leads = await prisma.lead.findMany({ where: { storeId } });
    const invoices = await prisma.invoice.findMany({ where: { storeId } });
    const inDays = (d: number, h = 8) => {
      const dt = new Date(); dt.setDate(dt.getDate() + d); dt.setHours(h, 30, 0, 0); return dt;
    };
    let added = 0;
    const make = async (type: string, status: string, remindAt: Date, title: string, message: string, rel: { customerId?: string; vehicleId?: string; leadId?: string; invoiceId?: string; workOrderId?: string }) => {
      await prisma.reminder.create({
        data: {
          storeId, type: type as never, status: status as never, remindAt, title, message,
          customerId: rel.customerId ?? null, vehicleId: rel.vehicleId ?? null, leadId: rel.leadId ?? null,
          invoiceId: rel.invoiceId ?? null, workOrderId: rel.workOrderId ?? null, assignedToId: adminId,
          completedAt: status === 'DONE' ? new Date() : null,
        },
      });
      added++;
    };
    for (let i = 0; i < 6 && vehicles[i]; i++) {
      const v = vehicles[i];
      await make('SERVICE_DUE', i === 0 ? 'SENT' : 'PENDING', inDays(5 + i * 3), `Entretien programmé - ${v.plateNumber}`, `Rappeler le client pour la révision du ${v.plateNumber}.`, { customerId: v.customerId, vehicleId: v.id });
    }
    for (let i = 0; i < 5 && leads[i]; i++) {
      const l = leads[i];
      const status = i < 2 ? 'DONE' : 'PENDING';
      await make('FOLLOW_UP', status, i < 2 ? new Date(Date.now() - i * 86400000) : inDays(1 + i), `Relance prospect ${l.firstName} ${l.lastName}`, 'Contacter le prospect pour confirmer son devis.', { leadId: l.id });
    }
    for (let i = 0; i < 4 && invoices[i]; i++) {
      const inv = invoices[i];
      await make('PAYMENT', i === 1 ? 'SENT' : 'PENDING', inDays(2 + i), `Paiement ${inv.number}`, 'Relancer le client pour le règlement de la facture.', { invoiceId: inv.id, customerId: inv.customerId });
    }
    await make('APPOINTMENT', 'PENDING', inDays(1), 'Rappel rendez-vous', 'Relancer le client pour confirmer son rendez-vous de demain.', { customerId: vehicles[0]?.customerId, vehicleId: vehicles[0]?.id });
    console.log(`+ ${added} rappels`);
  }

  // ============================================================
  // 11) VENTES (dashboard riche) + déstockage & mouvements
  // ============================================================
  const richSaleMarker = await prisma.sale.findFirst({ where: { storeId, receiptNumber: { startsWith: 'MNY2-' } } });
  if (!richSaleMarker) {
    const products = await prisma.product.findMany({ where: { storeId, isActive: true } });
    const customers = await prisma.customer.findMany({ where: { storeId, isActive: true } });
    const methods = ['CASH', 'CASH', 'MOBILE_MONEY', 'MOBILE_MONEY', 'BANK_TRANSFER', 'CARD'];
    let seqByDay: Record<string, number> = {};
    const receivedAtFor = (offset: number) => {
      const d = new Date(); d.setDate(d.getDate() - offset); d.setHours(randInt(8, 18), randInt(0, 59), 0, 0); return d;
    };
    let added = 0;
    for (let i = 0; i < 45; i++) {
      const offset = randInt(0, 29);
      const at = receivedAtFor(offset);
      const dayKey = at.toISOString().slice(0, 10);
      seqByDay[dayKey] = (seqByDay[dayKey] ?? 0) + 1;
      const receiptNumber = `MNY2-${dayKey.replace(/-/g, '')}-${pad3(seqByDay[dayKey])}`;
      const itemCount = randInt(1, 4);
      const chosen: { productId: string; qty: number; sell: number; cost: number }[] = [];
      for (let k = 0; k < itemCount; k++) {
        const p = pick(products);
        chosen.push({ productId: p.id, qty: randInt(1, 3), sell: Number(p.sellingPriceAr), cost: Number(p.costPriceAr) });
      }
      const subtotal = chosen.reduce((s, c) => s + c.sell * c.qty, 0);
      const discount = randInt(0, 4) === 0 ? Math.round(subtotal * 0.05) : 0;
      const total = subtotal - discount;
      const customer = randInt(0, 9) < 7 ? pick(customers) : null;
      const method = pick(methods);
      const paymentStatus = randInt(0, 9) < 8 ? 'PAID' : 'PARTIALLY_PAID';
      const amountPaid = paymentStatus === 'PAID' ? total : Math.round(total * 0.5);
      const sale = await prisma.sale.create({
        data: {
          storeId, receiptNumber, customerId: customer?.id ?? null,
          status: 'COMPLETED', paymentStatus: paymentStatus as never,
          subtotalAr: subtotal, discountAr: discount, taxAr: 0, totalAr: total,
          amountPaidAr: amountPaid, changeAr: 0, paymentMethod: method as never,
          isWholesale: false, createdById: adminId, createdAt: at, updatedAt: at,
          items: { create: chosen.map((c) => ({ productId: c.productId, quantityAr: c.qty, unitPriceAr: c.sell, costPriceAr: c.cost, discountAr: 0, taxAr: 0, lineTotalAr: c.sell * c.qty })) },
        },
      });
      for (const c of chosen) {
        const stock = await prisma.stock.findFirst({ where: { storeId, productId: c.productId } });
        const qtyNow = stock ? Number(stock.quantityAr) : 0;
        const remove = Math.min(c.qty, qtyNow);
        if (stock && remove > 0) {
          await prisma.stock.update({ where: { id: stock.id }, data: { quantityAr: qtyNow - remove } });
        }
        await prisma.stockMovement.create({
          data: {
            storeId, warehouseId: warehouse.id, productId: c.productId, movementType: 'SALE',
            quantity: remove, unitCostAr: c.cost, reason: `Vente ${receiptNumber}`,
            referenceId: sale.id, referenceType: 'Sale', createdById: adminId, createdAt: at,
          },
        });
      }
      added++;
    }
    console.log(`+ ${added} ventes`);
  }

  console.log('Seed riche terminé.');
  console.log(`  - Produits : ${await prisma.product.count({ where: { storeId } })}`);
  console.log(`  - Clients : ${await prisma.customer.count({ where: { storeId } })}`);
  console.log(`  - Véhicules : ${await prisma.vehicle.count({ where: { storeId } })}`);
  console.log(`  - Mécaniciens : ${await prisma.mechanic.count({ where: { storeId } })}`);
  console.log(`  - Ordres de réparation : ${await prisma.workOrder.count({ where: { storeId } })}`);
  console.log(`  - Rendez-vous : ${await prisma.appointment.count({ where: { storeId } })}`);
  console.log(`  - Prospects : ${await prisma.lead.count({ where: { storeId } })}`);
  console.log(`  - Interactions : ${await prisma.interaction.count({ where: { storeId } })}`);
  console.log(`  - Devis & factures : ${await prisma.invoice.count({ where: { storeId } })}`);
  console.log(`  - Rappels : ${await prisma.reminder.count({ where: { storeId } })}`);
  console.log(`  - Ventes : ${await prisma.sale.count({ where: { storeId } })}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });