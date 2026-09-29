import { Router } from 'express';
import { authRateLimiter } from '../middleware/rateLimit.js';
import { revokeInstanceByToken } from '../services/instanceService.js';
import { auditLog } from '../services/auditLog.js';

const router = Router();

// Auto-désinscription : symétrique de /status, même mécanisme d'auth (le token de
// l'instance elle-même, pas l'ADMIN_SECRET) et même opacité en cas de token invalide.
router.post('/revoke', authRateLimiter, (req, res) => {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    auditLog('Revoke', 'Tentative sans jeton', req);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const instanceId = revokeInstanceByToken(token);
  if (!instanceId) {
    auditLog('Revoke', 'Tentative avec un jeton inconnu', req);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  auditLog('Revoke', `Instance auto-révoquée instanceId=${instanceId}`, req);
  res.json({ revoked: true });
});

export default router;
