import { formatNumber } from './format';

export interface PublicPlan {
  id: string;
  name: string;
  description: string;
  priceAr: string | number;
  billingCycle: string;
  durationMonths: number;
  maxUsers: number;
  maxProducts: number;
  maxWarehouses: number;
  maxCustomers: number;
  maxSalesPerMonth: number | null;
  features: Record<string, boolean>;
}

export interface PriceCard {
  key: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  highlighted: boolean;
  cta: string;
  ctaHref: string;
}

export const featureLabels: { key: string; label: string }[] = [
  { key: 'pos', label: 'Caisse & ventes' },
  { key: 'stock', label: 'Gestion de stock' },
  { key: 'reports', label: 'Rapports & statistiques' },
  { key: 'loyalty', label: 'Clients & fidélité' },
  { key: 'suppliers', label: 'Fournisseurs & achats' },
  { key: 'multiWarehouse', label: 'Multi-entrepôts' },
  { key: 'cashier', label: 'Comptes caissiers' },
  { key: 'accounting', label: 'Comptabilité avancée' },
  { key: 'api', label: 'API & intégrations' },
];

export const planDisplayName: Record<string, string> = {
  FREE: 'Gratuit',
  STARTER: 'Starter',
  BUSINESS: 'Business',
  PRO: 'Pro',
};

export function planToCard(plan: PublicPlan, popular: boolean): PriceCard {
  const features: string[] = [];
  for (const { key, label } of featureLabels) {
    if (plan.features[key]) features.push(label);
  }
  const users = plan.maxUsers > 1 ? `Jusqu\u2019à ${plan.maxUsers} utilisateurs` : '1 utilisateur';
  const products = `Jusqu\u2019à ${plan.maxProducts} produits`;
  const warehouses = plan.maxWarehouses > 1 ? `Jusqu\u2019à ${plan.maxWarehouses} entrepôts` : '1 entrepôt';
  const customers = plan.maxCustomers > 1 ? `Jusqu\u2019à ${plan.maxCustomers} clients` : 'Clients';
  features.push(users);
  features.push(products);
  features.push(warehouses);
  features.push(customers);
  if (plan.maxSalesPerMonth) features.push(`Jusqu\u2019à ${plan.maxSalesPerMonth} ventes / mois`);

  const free = Number(plan.priceAr) <= 0;
  return {
    key: plan.id,
    name: planDisplayName[plan.name] ?? plan.name,
    price: free ? '0 Ar' : `${formatNumber(plan.priceAr)} Ar`,
    period: free ? 'pour toujours' : '/ mois',
    description: plan.description,
    features,
    highlighted: popular,
    cta: free ? 'Commencer gratuitement' : `Choisir ${planDisplayName[plan.name] ?? plan.name}`,
    ctaHref: '/register',
  };
}

export const enterpriseCard: PriceCard = {
  key: 'enterprise',
  name: 'Entreprise',
  price: 'Sur devis',
  period: 'contactez-nous',
  description: 'Pour les réseaux et les besoins sur mesure.',
  features: ['Tout le plan Pro', 'API & intégrations', 'Formation dédiée', 'Superviseur / gestionnaire dédié', 'Contrat personnalisé'],
  highlighted: false,
  cta: 'Nous contacter',
  ctaHref: 'mailto:madaorganisation@gmail.com',
};