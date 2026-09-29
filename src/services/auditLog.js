// Timestamp explicite dans chaque ligne : les logs Docker ont déjà un horodatage
// d'ingestion, mais celui-ci reflète le moment exact de l'action côté application,
// utile si les deux dérivent (buffering, restart, agrégateur externe).
export function auditLog(tag, message, req) {
  const ip = req?.ip || 'unknown';
  console.log(`[${tag}] ${message} ip=${ip} at=${new Date().toISOString()}`);
}
