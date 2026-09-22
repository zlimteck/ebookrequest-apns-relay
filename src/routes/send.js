import { Router } from 'express';
import { requireInstanceAuth } from '../middleware/auth.js';
import { authRateLimiter, sendRateLimiter } from '../middleware/rateLimit.js';
import { sendPush, isApnsConfigured } from '../services/apnsService.js';

const router = Router();

router.post('/send', authRateLimiter, requireInstanceAuth, sendRateLimiter, async (req, res) => {
  const { deviceTokens, title, body, url } = req.body || {};

  if (!Array.isArray(deviceTokens) || deviceTokens.length === 0) {
    return res.status(400).json({ error: 'deviceTokens must be a non-empty array' });
  }
  if (!title || !body) {
    return res.status(400).json({ error: 'title and body are required' });
  }

  if (!isApnsConfigured()) {
    return res.status(503).json({ error: 'APNs relay not configured' });
  }

  try {
    const result = await sendPush(deviceTokens, { title, body, url });

    console.log(
      `[Send] instance=${req.instance.instanceId} sent=${result.sent} failed=${result.failed} at=${new Date().toISOString()}`
    );

    res.json(result);
  } catch (err) {
    console.error(`[Send] instance=${req.instance.instanceId} error:`, err.message);
    res.status(err.statusCode || 500).json({ error: 'Failed to send push notification' });
  }
});

export default router;
