import { Router } from 'express';
import { requireAdminAuth } from '../middleware/adminAuth.js';
import { listPendingInstances, listActiveInstances, approveInstance, rejectInstance } from '../services/instanceService.js';

const router = Router();

// Authentification uniquement via Authorization: Bearer <ADMIN_SECRET>, jamais de
// cookies/session — Access-Control-Allow-Origin: * est donc sans risque ici (pas de
// credentials à protéger derrière une origine précise). Le preflight OPTIONS doit être
// géré avant requireAdminAuth : le navigateur ne renvoie jamais le header Authorization
// dessus, une auth à ce stade le ferait échouer systématiquement en 401/503.
router.use('/admin', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

router.get('/admin/pending', requireAdminAuth, (req, res) => {
  res.json(listPendingInstances());
});

router.get('/admin/instances', requireAdminAuth, (req, res) => {
  res.json(listActiveInstances());
});

router.post('/admin/approve/:instanceId', requireAdminAuth, (req, res) => {
  const approved = approveInstance(req.params.instanceId);
  if (!approved) {
    return res.status(404).json({ error: 'Pending instance not found' });
  }
  console.log(`[Admin] Instance approuvée: ${req.params.instanceId}`);
  res.json({ instanceId: req.params.instanceId, status: 'active' });
});

router.post('/admin/reject/:instanceId', requireAdminAuth, (req, res) => {
  const rejected = rejectInstance(req.params.instanceId);
  if (!rejected) {
    return res.status(404).json({ error: 'Pending instance not found' });
  }
  console.log(`[Admin] Demande rejetée: ${req.params.instanceId}`);
  res.status(204).send();
});

export default router;
