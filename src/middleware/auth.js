import { findInstanceByToken } from '../services/instanceService.js';

// Jeton absent/invalide → 401 générique, sans indiquer si l'instance existe ou non,
// pour ne pas faciliter l'énumération des instances autorisées.
export function requireInstanceAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const instance = findInstanceByToken(token);
  if (!instance) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.instance = instance;
  next();
}
