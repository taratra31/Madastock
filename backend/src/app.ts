import path from 'path';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { HttpError } from './utils/httpError';
import authRoutes from './routes/auth.routes';
import storeRoutes from './routes/store.routes';
import publicRoutes from './routes/public.routes';
import productRoutes from './routes/product.routes';
import categoryRoutes from './routes/category.routes';
import stockRoutes from './routes/stock.routes';
import dashboardRoutes from './routes/dashboard.routes';
import customerRoutes from './routes/customer.routes';
import mechanicRoutes from './routes/mechanic.routes';
import vehicleRoutes from './routes/vehicle.routes';
import workOrderRoutes from './routes/workOrder.routes';
import appointmentRoutes from './routes/appointment.routes';
import leadRoutes from './routes/lead.routes';
import interactionRoutes from './routes/interaction.routes';
import reminderRoutes from './routes/reminder.routes';
import invoiceRoutes from './routes/invoice.routes';
import saleRoutes from './routes/sale.routes';
import garageRoutes from './routes/garage.routes';
import billingRoutes from './routes/billing.routes';
import adminRoutes from './routes/admin.routes';
import supplierRoutes from './routes/supplier.routes';
import brandRoutes from './routes/brand.routes';
import purchaseRoutes from './routes/purchase.routes';
import expenseRoutes from './routes/expense.routes';
import cashRoutes from './routes/cash.routes';
import notificationRoutes from './routes/notification.routes';
import * as billingController from './controllers/billing.controller';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(cookieParser());

// Webhook Ariari : le body BRUT est reçu via express.raw() (aucune signature côté Ariari,
// le statut est revalidé par relecture de l'API). Registré AVANT express.json().
app.post(
  '/api/webhooks/ariari',
  express.raw({ type: 'application/json', limit: '1mb' }),
  billingController.ariariWebhook
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Anti-bruteforce : uniquement les endpoints qui manipulent un mot de passe ou
// un code, et uniquement les ÉCHECS (`skipSuccessfulRequests`). Un utilisateur
// légitime qui se connecte 30 fois ne sera donc jamais bloqué, tandis qu'une
// attaque par force brute reste plafonnée.
const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
});

// /me et /refresh sont des appels normaux (chargement de page, retour sur
// l'onglet, reconnexion). Leur plafond est large et distinct, sinon ils
// consomment le compteur ci-dessus et bloquent l'utilisateur sans raison.
const authSoftLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_SOFT_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes. Patientez quelques secondes.' },
});

const adminLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.ADMIN_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes. Patientez quelques minutes.' },
});

app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth : plafond serré (échecs uniquement) sur les routes qui manipulent un
// mot de passe ou un code, plafond large sur le reste de /auth.
const STRICT_AUTH_ROUTES = [
  '/login',
  '/register',
  '/verify-email',
  '/resend-code',
  '/forgot-password',
  '/reset-password',
];
for (const route of STRICT_AUTH_ROUTES) {
  app.use(`/api/v1/auth${route}`, authLimiter);
}
app.use('/api/v1/auth', authSoftLimiter, authRoutes);

// Back-office : déjà protégé par JWT + superadmin, plafond propre et large
// pour ne jamais bloquer le polling de l'appairage WhatsApp.
app.use('/api/v1/admin', adminLimiter, adminRoutes);

app.use(
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use('/api/v1/stores', storeRoutes);
app.use('/api/v1/public', publicRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/stock', stockRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/mechanics', mechanicRoutes);
app.use('/api/v1/vehicles', vehicleRoutes);
app.use('/api/v1/work-orders', workOrderRoutes);
app.use('/api/v1/appointments', appointmentRoutes);
app.use('/api/v1/leads', leadRoutes);
app.use('/api/v1/interactions', interactionRoutes);
app.use('/api/v1/reminders', reminderRoutes);
app.use('/api/v1/invoices', invoiceRoutes);
app.use('/api/v1/sales', saleRoutes);
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/garage', garageRoutes);
app.use('/api/v1/suppliers', supplierRoutes);
app.use('/api/v1/brands', brandRoutes);
app.use('/api/v1/purchases', purchaseRoutes);
app.use('/api/v1/expenses', expenseRoutes);
app.use('/api/v1/cash', cashRoutes);
app.use('/api/v1/notifications', notificationRoutes);

// Serve built frontend (production) — same origin, single port
const distDir = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof HttpError) {
    const body: Record<string, unknown> = { error: err.message };
    if (err.details !== undefined) {
      body.details = err.details;
    }
    return res.status(err.statusCode).json(body);
  }

  console.error('Unhandled error:', err);
  return res
    .status(500)
    .json({ error: env.NODE_ENV === 'production' ? 'Internal server error' : err.message });
});

export default app;
