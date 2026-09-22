import { Router } from 'express';
import { isApnsConfigured } from '../services/apnsService.js';

const router = Router();

// Sans auth, pour un healthcheck Docker — répond même si APNs n'est pas configuré.
router.get('/health', (req, res) => {
  res.json({ status: 'ok', apnsConfigured: isApnsConfigured() });
});

export default router;
