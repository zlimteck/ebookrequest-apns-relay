import apn from '@parse/node-apn';

// Provider construit une seule fois au démarrage puis réutilisé pour tous les envois —
// recréer une connexion HTTP/2 APNs à chaque requête serait coûteux et inutile ici,
// contrairement au backend principal, la config ne change jamais à chaud (pas d'admin UI).
let provider = null;
let bundleId = process.env.APNS_BUNDLE_ID || 'com.ebookrequest.ios.full';

function buildProvider() {
  const keyP8 = process.env.APNS_KEY_P8 || '';
  const keyId = process.env.APNS_KEY_ID || '';
  const teamId = process.env.APNS_TEAM_ID || '';
  bundleId = process.env.APNS_BUNDLE_ID || 'com.ebookrequest.ios.full';
  const production = process.env.APNS_PRODUCTION !== 'false';

  if (!keyP8 || !keyId || !teamId) {
    console.warn('[APNs] Relais non configuré (APNS_KEY_P8/APNS_KEY_ID/APNS_TEAM_ID manquant) — /send renverra une erreur 503.');
    return null;
  }

  try {
    return new apn.Provider({
      token: {
        // Autorise soit la clé brute (vrais retours à la ligne), soit collée sur une seule
        // ligne avec des "\n" littéraux — format courant en variable d'environnement.
        key: keyP8.includes('\\n') ? keyP8.replace(/\\n/g, '\n') : keyP8,
        keyId,
        teamId,
      },
      production,
    });
  } catch (err) {
    console.error('[APNs] Échec d\'initialisation du provider:', err.message);
    return null;
  }
}

export function initApnsProvider() {
  provider = buildProvider();
  return provider !== null;
}

export function isApnsConfigured() {
  return provider !== null;
}

/**
 * Envoie une notification push native identique à un lot de device tokens.
 * @param {string[]} deviceTokens
 * @param {{ title?: string, body?: string, url?: string }} payload
 * @returns {Promise<{ sent: number, failed: number, invalidTokens: string[] }>}
 */
export async function sendPush(deviceTokens, payload) {
  if (!provider) {
    throw Object.assign(new Error('APNs relay not configured'), { statusCode: 503 });
  }

  const notification = new apn.Notification();
  notification.topic = bundleId;
  notification.alert = { title: payload.title || 'EbookRequest', body: payload.body || '' };
  notification.sound = 'default';
  notification.payload = { url: payload.url || '/' };
  notification.expiry = Math.floor(Date.now() / 1000) + 3600; // Abandon après 1h si l'appareil est hors-ligne

  const result = await provider.send(notification, deviceTokens);

  const invalidTokens = [];
  for (const failure of result.failed) {
    const reason = failure.response?.reason;
    if (failure.status === '410' || reason === 'Unregistered' || reason === 'BadDeviceToken') {
      invalidTokens.push(failure.device);
    } else {
      console.error(`[APNs] Erreur envoi à ${failure.device}:`, reason || failure.error?.message);
    }
  }

  return {
    sent: result.sent.length,
    failed: result.failed.length,
    invalidTokens,
  };
}
