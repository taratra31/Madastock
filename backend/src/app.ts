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

app.use(
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
});

app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/v1/auth', authLimiter, authRoutes);
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
app.use('/api/v1/admin', adminRoutes);

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
