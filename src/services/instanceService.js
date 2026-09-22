import { createHash, randomBytes } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';

const INSTANCES_FILE = process.env.INSTANCES_FILE || './instances.json';
const INSTANCE_ID_RE = /^[a-zA-Z0-9._-]{3,100}$/;

let instances = [];

export function loadInstances() {
  try {
    const raw = readFileSync(INSTANCES_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    instances = Array.isArray(parsed) ? parsed : [];
    console.log(`[Auth] ${instances.length} instance(s) chargée(s) depuis ${INSTANCES_FILE}`);
  } catch (err) {
    instances = [];
    console.warn(`[Auth] Impossible de charger ${INSTANCES_FILE} (${err.message}) — aucune instance autorisée.`);
  }
}

function saveInstances() {
  writeFileSync(INSTANCES_FILE, JSON.stringify(instances, null, 2), 'utf-8');
}

function hashToken(token) {
  return createHash('sha256').update(token, 'utf-8').digest('hex');
}

// Statut absent = instances déjà présentes avant l'introduction de ce champ, à traiter
// comme "active" pour ne pas casser les instances approuvées manuellement avant ce changement.
function isActive(instance) {
  return instance.status == null || instance.status === 'active';
}

/**
 * @param {string} token
 * @returns {{ instanceId: string, label: string } | null}
 */
export function findInstanceByToken(token) {
  if (!token) return null;
  const hash = hashToken(token);
  const match = instances.find((i) => i.apiKeyHash === hash);
  if (!match || !isActive(match)) return null;
  return { instanceId: match.instanceId, label: match.label };
}

/**
 * Comme findInstanceByToken, mais retourne aussi le statut pending, pour que
 * l'instance appelante puisse vérifier elle-même l'avancement de sa demande.
 * @param {string} token
 * @returns {{ instanceId: string, status: 'pending' | 'active' } | null}
 */
export function findInstanceStatusByToken(token) {
  if (!token) return null;
  const hash = hashToken(token);
  const match = instances.find((i) => i.apiKeyHash === hash);
  if (!match) return null;
  return { instanceId: match.instanceId, status: isActive(match) ? 'active' : 'pending' };
}

export class InstanceServiceError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function isValidInstanceId(instanceId) {
  return typeof instanceId === 'string' && INSTANCE_ID_RE.test(instanceId);
}

/**
 * Crée une demande d'instance en attente d'approbation manuelle et retourne le
 * jeton en clair (une seule fois — seul son hash est conservé).
 */
export function addPendingInstance({ instanceId, label, domain, contactEmail }) {
  if (instances.some((i) => i.instanceId === instanceId)) {
    throw new InstanceServiceError('Instance ID already requested', 409);
  }

  const token = randomBytes(32).toString('hex');
  const entry = {
    instanceId,
    label,
    domain,
    ...(contactEmail ? { contactEmail } : {}),
    apiKeyHash: hashToken(token),
    status: 'pending',
    requestedAt: new Date().toISOString(),
  };

  instances.push(entry);
  saveInstances();

  return token;
}

/**
 * @returns {{ instanceId, label, domain, contactEmail, requestedAt }[]} — jamais le token/hash.
 */
export function listPendingInstances() {
  return instances
    .filter((i) => i.status === 'pending')
    .map(({ instanceId, label, domain, contactEmail, requestedAt }) => ({
      instanceId,
      label,
      domain,
      ...(contactEmail ? { contactEmail } : {}),
      requestedAt,
    }));
}

/**
 * @returns {{ instanceId, label, domain, contactEmail, approvedAt }[]} — jamais le token/hash.
 */
export function listActiveInstances() {
  return instances
    .filter(isActive)
    .map(({ instanceId, label, domain, contactEmail, approvedAt }) => ({
      instanceId,
      label,
      domain,
      ...(contactEmail ? { contactEmail } : {}),
      ...(approvedAt ? { approvedAt } : {}),
    }));
}

export function approveInstance(instanceId) {
  const entry = instances.find((i) => i.instanceId === instanceId && i.status === 'pending');
  if (!entry) return false;
  entry.status = 'active';
  entry.approvedAt = new Date().toISOString();
  saveInstances();
  return true;
}

export function rejectInstance(instanceId) {
  const index = instances.findIndex((i) => i.instanceId === instanceId && i.status === 'pending');
  if (index === -1) return false;
  instances.splice(index, 1);
  saveInstances();
  return true;
}
