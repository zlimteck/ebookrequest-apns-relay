import rateLimit from 'express-rate-limit';

// Appliqué avant requireInstanceAuth, par IP : sans ça, les requêtes avec un jeton
// invalide ne sont jamais comptées (le rate limiter par instance ne voit que les
// requêtes déjà authentifiées) — un scan de jetons au hasard tournerait sans limite.
export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

// Appliqué après requireInstanceAuth : la clé de quota est l'instanceId authentifié,
// pas l'IP, pour qu'un jeton compromis ne puisse pas spammer sous couvert de plusieurs IP.
export const sendRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.instance?.instanceId || req.ip,
  message: { error: 'Too many requests' },
});

// Public et sans auth par nature (c'est le point d'entrée pour obtenir un token) —
// limite basse par IP pour empêcher un script de créer des dizaines de demandes bidon.
export const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});
