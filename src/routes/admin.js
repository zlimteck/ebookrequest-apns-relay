import { Router } from 'express';
import { requireAdminAuth } from '../middleware/adminAuth.js';
import { listPendingInstances, listActiveInstances, approveInstance, rejectInstance } from '../services/instanceService.js';

const router = Router();

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
