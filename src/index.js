import express from 'express';
import { initApnsProvider } from './services/apnsService.js';
import { loadInstances } from './services/instanceService.js';
import healthRoutes from './routes/health.js';
import sendRoutes from './routes/send.js';
import statusRoutes from './routes/status.js';
import registerRoutes from './routes/register.js';
import adminRoutes from './routes/admin.js';

const app = express();

// Déployé derrière Cloudflare Tunnel (cloudflared) : la connexion TCP entrante vient
// toujours de cloudflared, pas du visiteur réel. "1" fait confiance à ce seul hop pour
// lire la vraie IP dans X-Forwarded-For — sans ça, req.ip serait identique pour tout le
// monde et le rate limiting par IP (authRateLimiter) ne servirait à rien.
app.set('trust proxy', 1);

app.use(express.json({ limit: '256kb' }));

app.use(healthRoutes);
app.use(sendRoutes);
app.use(statusRoutes);
app.use(registerRoutes);
app.use(adminRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

loadInstances();

if (!process.env.ADMIN_SECRET) {
  console.warn('[Admin] ADMIN_SECRET non défini — /admin/* renverront 503 tant qu\'il n\'est pas configuré.');
}

if (initApnsProvider()) {
  console.log('[APNs] Provider initialisé.');
} else {
  console.warn('[APNs] Relais non configuré — les appels à /send échoueront avec 503 tant que APNS_KEY_P8/APNS_KEY_ID/APNS_TEAM_ID ne sont pas fournis.');
}

const port = process.env.PORT || 3040;
app.listen(port, () => {
  console.log(`[Server] Relais APNs EbookRequest à l'écoute sur le port ${port}`);
});
