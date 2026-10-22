/**
 * Fonction planifiée Netlify : déclenche l'envoi des rappels chaque minute.
 * Elle appelle simplement la route /api/cron/dispatch du site, protégée par CRON_SECRET.
 * Variables requises sur Netlify : CRON_SECRET (et les variables habituelles du site).
 */
export default async () => {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL
  const secret = process.env.CRON_SECRET
  if (!base || !secret) {
    console.error('[dispatch] URL ou CRON_SECRET manquant')
    return
  }
  try {
    const res = await fetch(`${base}/api/cron/dispatch`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
    })
    const body = await res.text()
    console.log('[dispatch]', res.status, body.slice(0, 500))
  } catch (err) {
    console.error('[dispatch] échec', err)
  }
}

export const config = { schedule: '* * * * *' }
