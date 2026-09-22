import { Router } from 'express';
import { authRateLimiter } from '../middleware/rateLimit.js';
import { findInstanceStatusByToken } from '../services/instanceService.js';

const router = Router();

// Permet à une instance de vérifier elle-même si sa demande a été approuvée, avec son
// propre token (pas l'ADMIN_SECRET, réservé à l'opérateur du relais). Même rate limiting
// par IP que /send avant vérification du token, pour ne pas offrir une surface de
// brute-force sans limite sur les tokens d'instance.
router.get('/status', authRateLimiter, (req, res) => {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(404).json({ error: 'Not found' });
  }

  const instance = findInstanceStatusByToken(token);
  if (!instance) {
    return res.status(404).json({ error: 'Not found' });
  }

  res.json({ status: instance.status });
});

export default router;
