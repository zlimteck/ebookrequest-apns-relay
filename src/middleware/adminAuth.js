import { timingSafeEqual } from 'crypto';

// Secret statique distinct des tokens par instance — comparaison à temps constant
// pour éviter qu'une différence de timing ne renseigne un attaquant sur le secret.
export function requireAdminAuth(req, res, next) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return res.status(503).json({ error: 'Admin endpoints not configured' });
  }

  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const provided = Buffer.from(token, 'utf-8');
  const expected = Buffer.from(secret, 'utf-8');
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}
