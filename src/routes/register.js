import { Router } from 'express';
import { registerRateLimiter } from '../middleware/rateLimit.js';
import { addPendingInstance, isValidInstanceId, InstanceServiceError } from '../services/instanceService.js';
import { notifyPendingRequest } from '../services/notifyService.js';

const router = Router();

function isNonEmptyString(value, maxLength) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
}

router.post('/register-request', registerRateLimiter, (req, res) => {
  const { instanceId, label, domain, contactEmail } = req.body || {};

  if (!isValidInstanceId(instanceId)) {
    return res.status(400).json({ error: 'instanceId must be 3-100 chars: letters, digits, dot, dash, underscore' });
  }
  if (!isNonEmptyString(label, 200)) {
    return res.status(400).json({ error: 'label is required (max 200 chars)' });
  }
  if (!isNonEmptyString(domain, 200)) {
    return res.status(400).json({ error: 'domain is required (max 200 chars)' });
  }
  if (contactEmail !== undefined && !isNonEmptyString(contactEmail, 200)) {
    return res.status(400).json({ error: 'contactEmail must be a non-empty string (max 200 chars)' });
  }

  let token;
  try {
    token = addPendingInstance({
      instanceId: instanceId.trim(),
      label: label.trim(),
      domain: domain.trim(),
      contactEmail: contactEmail?.trim(),
    });
  } catch (err) {
    if (err instanceof InstanceServiceError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error('[Register] Erreur inattendue:', err.message);
    return res.status(500).json({ error: 'Registration failed' });
  }

  notifyPendingRequest({ instanceId, label, domain, contactEmail }).catch(() => {});

  res.status(201).json({ token });
});

export default router;
