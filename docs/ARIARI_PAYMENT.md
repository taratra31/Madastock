# Paiement des abonnements — Ariari.mg (MVola / Orange Money / Airtel Money)

Intégration d'**Ariari** pour le paiement des abonnements MadaStock avec **activation automatique** :
dès que l'argent est validé côté Ariari (statut `paid`), l'abonnement est activé immédiatement — sans action manuelle.

## Architecture

```
Frontend (Billing.tsx)                 Backend                         Ariari (api.ariari.mg)
   choix de l'offre             GET /api/v1/billing (plans/abonnement)
        ───────────────────>    POST /api/v1/billing/checkout
                                 [row PENDING en SQLite]              POST /api/payments  (header x-secret)
   redirection ───────────────  payment.url (page hébergée)  <──────── (pay.ariari.mg)
        │
        │  polling              GET /api/v1/billing/reference/:ref/status
        ◄───────────────────    → re-lecture API: GET /api/payments/{id}
        │
        │  (repli)              /api/webhooks/ariari  <──────────────── webhooks silent* (Success/Progress/Failure)
        └───────────────────    → re-lecture authentifiée → PAID = activation en transaction
```

- Paiements stockés dans la table `payments` ; identifiant externe Ariari dans `providerReference` (unique).
- Le **montant est toujours lu en base** (`plans.priceAr`, jamais la valeur du frontend).
- Référence marchande : `SUB-{8 premiers du userId}-{uuid}`.
- Durée d'abonnement : `plans.durationMonths` (défaut 1 mois, renouvellement sans perte des jours restants).

## Configuration (variables d'environnement)

| Variable | Description | Exemple |
|---|---|---|
| `ARIARI_API_URL` | Base de l'API Ariari | `https://api.ariari.mg` |
| `ARIARI_SECRET` | Secret du projet Ariari (ariari.mg → projet → "secret") | … |
| `ARIARI_WEBHOOK_URL` | URL de notification à régler côté Ariari | `https://madastock.onrender.com/api/webhooks/ariari` |

Local : `backend/.env` (ne jamais committer ; `ARIARI_SECRET` vide → le serveur refuse les paiements avec « Paiement en ligne non configuré »). `.env.example` : placeholders.

## API Ariari utilisée

- **Création** : `POST {ARIARI_API_URL}/api/payments` — header `x-secret: <secret>`.
  Body : `amount` (Ariary), `name`, `hooks.{redirectSuccess, redirectFailure, silentSuccess, silentProgress, silentFailure}`.
  Réponse : objet paiement (`_id`, `amount`, `rest`, `status`, `url`…).
- **Re-lecture** : `GET {ARIARI_API_URL}/api/payments/{id}` — header `x-secret`. Renvoie `{ status, data: {…} }`.
- Statuts : `pending` | `incomplete` (paiement partiel) | `paid` (validé) | `failed`.

## Webhook (pas de signature → re-lecture)

`POST /api/webhooks/ariari` (body brut via `express.raw`).

- Ariari ne signe pas ses `silent*` hooks : **aucun statut n'est accepté « sur parole »**.
- Le webhook sert uniquement de déclencheur : on extrait l'identifiant du paiement du body, puis on
  re-lit l'état réel via `GET /api/payments/{id}`. Un attaquant **ne peut pas** inventer un paiement validé.
- Réponse toujours `200 {ok:true, handled:…}` (pas de nouvelle tentative inutile).
- Le polling du frontend et le bouton « Vérifier » utilisent la même re-lecture (`refreshOrder`,
  `GET /api/v1/billing/reference/:ref/status`) : le webhook manquant n'est jamais bloquant.

## Activation / renouvellement

- `paid` (avec `amount` conforme) → transaction : paiement `SUCCESS` + `paidAt`, abonnement activé.
- **Idempotent** : un paiement déjà `SUCCESS` n'est jamais retraité (pas de double prolongation).
- Renouvellement : si l'abonnement est `ACTIVE` avec `currentPeriodEnd > now`, prolongation depuis
  `currentPeriodEnd` ; sinon depuis maintenant.
- `incomplete` / `pending` → aucune activation. `failed` → paiement `FAILED` (`failedAt`), aucune activation.

## Routes applicatives

| Méthode | Route | Auth | Rôle |
|---|---|---|---|
| GET | `/api/v1/billing` | JWT + Store | plans + abonnement courant |
| POST | `/api/v1/billing/checkout` | JWT + Store | crée le paiement Ariari + lien |
| POST | `/api/v1/billing/:orderId/refresh` | JWT + Store | re-lecture forcée |
| GET | `/api/v1/billing/reference/:ref/status` | JWT + Store | statut (polling frontend) |
| POST | `/api/webhooks/ariari` | public (re-lecture) | webhooks silent* Ariari |

## Tests

`backend/tests/ariari.test.ts` (vitest + Prisma mocké + supertest) :

- `extractPaymentId` : racine / wrapper `data|payment|payload` / body invalide.
- Webhook : body non JSON → `handled:false` ; id inconnu → `handled:false` ; PAID confirmé par l'API → activation ;
  **PAID contredit par l'API** (webhook bidon) → pas d'activation ; montant différent → pas d'activation ;
  FAILED ; renouvellement depuis `currentPeriodEnd` ; idempotence.
- `createCheckout` : plan inexistant/inactif, montant issu de la base, headers `x-secret`, hooks configurés,
  erreur Ariari → commande locale `FAILED`.
- Sécurité : checkout sans JWT → 401.

Lancer : `npm run test` (backend).

## Mise en production

1. Avoir le `secret` du projet Ariari (dashboard ariari.mg) → variable `ARIARI_SECRET`.
2. Régler côté Ariari les hooks du paiement vers `https://madastock.onrender.com/api/webhooks/ariari`
   (déjà géré par le checkout : c'est `ARIARI_WEBHOOK_URL`).
3. Env vars Render : `ARIARI_SECRET`, `ARIARI_WEBHOOK_URL` (URL publique du backend), `ARIARI_API_URL` ;
   retirer les anciennes `PAPI_*`.
4. Déployer et vérifier que `prisma migrate deploy` applique `…_payments_ariari`.
5. Test : acheter la formule STARTER depuis `https://madastock.onrender.com/app/billing`, payer sur la page
   Ariari, constater l'abonnement `ACTIVE` immédiatement après validation.

> Note : le projet tourne sur **SQLite** (pas PostgreSQL). La bascule Ariari se fait par renommage de colonne
> (`papiReference` → `providerReference`) + suppression des colonnes Papi inutilisées — transactionnel et sûr.