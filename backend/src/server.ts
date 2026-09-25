import app from './app';
import { env } from './config/env';
import { ensureSuperAdmin } from './bootstrap/superadmin';
import { initWhatsAppSocket } from './services/whatsapp.service';
import { runDailyJobs, startScheduler } from './services/scheduler.service';

const port = env.PORT;

ensureSuperAdmin()
  .catch((error) => {
    console.error('[SUPERADMIN] Échec du bootstrap :', error);
  })
  .finally(() => {
    app.listen(port, () => {
      console.log(`MadaStock API running on http://localhost:${port}`);
      console.log(`Environment: ${env.NODE_ENV}`);
    });
    initWhatsAppSocket().catch((error) => {
      console.error('[WHATSAPP] Échec de l\'initialisation :', error);
    });
    // Expiration des abonnements, alertes J-3 / J-1, stock bas, rappels du jour.
    void runDailyJobs();
    startScheduler();
  });
