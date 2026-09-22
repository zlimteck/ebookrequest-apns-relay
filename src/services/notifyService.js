// Log console systématique (surveillance via les logs Docker) + webhook optionnel
// (ntfy.sh, Discord/Slack via un endpoint compatible { text }) si NOTIFY_WEBHOOK_URL
// est défini. Ne doit jamais faire échouer l'inscription si le webhook est en panne.
export async function notifyPendingRequest({ instanceId, label, domain, contactEmail }) {
  console.log(
    `[Register] Nouvelle demande en attente d'approbation: instanceId=${instanceId} label="${label}" domain=${domain}${contactEmail ? ` contact=${contactEmail}` : ''}`
  );

  const webhookUrl = process.env.NOTIFY_WEBHOOK_URL;
  if (!webhookUrl) return;

  const text = [
    'Nouvelle demande d\'instance EbookRequest APNs Relay',
    `instanceId: ${instanceId}`,
    `label: ${label}`,
    `domain: ${domain}`,
    contactEmail ? `contact: ${contactEmail}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.warn(`[Notify] Webhook a répondu avec le statut ${res.status}`);
    }
  } catch (err) {
    console.warn('[Notify] Échec de l\'envoi au webhook:', err.message);
  }
}
