# MadaStock

SaaS multi-tenant de gestion de boutique pour les commerçants malgaches (ar)

## Stack

- **Backend** : Node.js, Express, TypeScript, Prisma ORM, PostgreSQL
- **Frontend** : React, TypeScript, Vite, Tailwind CSS, TanStack Query
- **Sécurité** : JWT, bcrypt, express-rate-limit, Zod (validation), Helmet
- **Infra** : Docker Compose (postgres + backend + frontend)

## Structure

```
madastock/
├── backend/          # API Express + Prisma
│   ├── prisma/       # Schema, migrations, seed
│   ├── src/
│   │   ├── config/   # Configuration (env)
│   │   ├── controllers/
│   │   ├── errors/   # Classes d'erreurs
│   │   ├── middlewares/  # Auth, valideur, multi-tenant
│   │   ├── routes/
│   │   ├── services/ # Logique métier
│   │   ├── types/    # Types TypeScript
│   │   ├── utils/    # Helpers
│   │   └── validators/   # Schémas Zod
│   └── tests/
├── frontend/         # Interface React
│   └── src/
│       ├── components/
│       ├── contexts/
│       ├── hooks/
│       ├── layouts/
│       ├── pages/
│       ├── routes/
│       ├── services/
│       ├── types/
│       └── utils/
├── docker-compose.yml
└── .gitignore
```

## Démarrage rapide

### Avec Docker (recommandé)

```bash
docker compose up --build
```

- Frontend : http://localhost:3000
- Backend : http://localhost:5000

### Développement local

Prérequis : Node.js >= 18, PostgreSQL.

```bash
# 1. Base de données
docker compose up -d postgres

# 2. Backend
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init
npx prisma db seed
npm run dev        # http://localhost:5000

# 3. Frontend
cd ../frontend
npm install
npm run dev        # http://localhost:5173
```

## Scripts backend

| Commande | Description |
|---|---|
| `npm run dev` | Serveur de dev (tsx watch) |
| `npm run build` | Compilation TypeScript |
| `npm start` | Serveur de production |
| `npm test` | Tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run typecheck` | Vérification TypeScript |
| `npm run prisma:studio` | UI Prisma Studio |

## API

- Swagger UI : http://localhost:5000/api/v1/docs
- Health check : http://localhost:5000/api/v1/health

## Multi-tenant

Chaque boutique (Store) est isolée : toutes les données (produits, stocks, ventes, caisses, rapports, etc.) sont scopées par `storeId`. Les accès se font via `StoreMember` et un système de permissions par rôle.

## Rôles

| Rôle | Description |
|---|---|
| `OWNER` | Propriétaire (tous les droits) |
| `ADMIN` | Administration |
| `MANAGER` | Gestion courante |
| `CASHIER` | Caissier(ère) |
| `STOCK_MANAGER` | Gestionnaire de stock |
| `ACCOUNTANT` | Comptable |

## Ordre des phases de développement

1. Initialisation complète du projet ✅
2. Base de données (schéma Prisma + migrations + seed)
3. Auth (inscription, connexion, rôles, token)
4. Gestion des boutiques + multi-tenant
5. Catalogue (catégories, produits, variantes)
6. Stock (entrepôts, stocks, mouvements)
7. Ventes, achats, fournisseurs, clients
8. Caisse & comptabilité
9. Dashboard & rapports (Recharts)
10. Abonnements & facturation
11. Notifications & audit
12. Docker Compose + déploiement