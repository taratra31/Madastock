export interface FaqItem {
  question: string;
  answer: string;
}

export const faqs: FaqItem[] = [
  {
    question: 'C\u2019est quoi MadaStock ?',
    answer:
      'MadaStock est une solution SaaS 100% web de gestion de boutique, pensée pour les commerçants malgaches : ventes, stock, clients, fournisseurs, caisse et rapports.',
  },
  {
    question: 'Dois-je installer un logiciel ?',
    answer:
      'Non. MadaStock fonctionne sur navigateur depuis un ordinateur, un téléphone ou une tablette connectés à Internet.',
  },
  {
    question: 'Puis-je utiliser MadaStock sur mobile ?',
    answer:
      'Oui, l\u2019interface est responsive et optimisée pour les écrans tactiles, parfait pour les caissiers et les tournées.',
  },
  {
    question: 'Mes données sont-elles sécurisées ?',
    answer:
      'Oui. Authentification sécurisée, accès par rôles, et chaque boutique est isolée : vos données ne sont visibles que par vous et vos collaborateurs autorisés.',
  },
  {
    question: 'Et si j\u2019ai plusieurs boutiques ?',
    answer:
      'Avec le plan Pro, vous pouvez gérer des boutiques illimitées depuis un seul compte. Chaque boutique garde ses produits, son stock et ses ventes séparés.',
  },
  {
    question: 'Comment payer mon abonnement ?',
    answer:
      'Paiement en ligne sécurisé via MVola, Orange Money, Airtel Money et carte bancaire. Le lien de paiement est généré automatiquement depuis la page Abonnement.',
  },
  {
    question: 'Y a-t-il un essai gratuit ?',
    answer:
      'Oui, le plan Gratuit est disponible sans limite de durée pour tester la caisse, le stock et les rapports. Vous ne saisissez aucune carte bancaire pour commencer.',
  },
  {
    question: 'Que se passe-t-il si je perds Internet ?',
    answer:
      'MadaStock nécessite une connexion Internet. En cas de coupure, vos données restent sauvegardées : reconnexion, tout est là.',
  },
  {
    question: 'MadaStock convient-il aux garages et pharmacies ?',
    answer:
      'Oui : trois secteurs sont pris en charge — Boutique, Pharmacie et Garage — avec des modules adaptés (véhicules, ordres de réparation, péremptions).',
  },
  {
    question: 'Puis-je exporter mes données ?',
    answer:
      'Factures et rapports sont exportables en PDF. L\u2019export complet des données est disponible sur demande auprès de notre équipe.',
  },
  {
    question: 'Comment être accompagné ?',
    answer:
      'Notre équipe locale vous accompagne par WhatsApp, e-mail et téléphone. Une formation est incluse dans les plans Pro et Entreprise.',
  },
];