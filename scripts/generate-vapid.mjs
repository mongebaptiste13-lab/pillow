/**
 * Génère une paire de clés VAPID pour les notifications push.
 *   pnpm vapid
 * Copie ensuite les valeurs dans .env.local ET dans les variables d'environnement
 * de ton hébergeur (Netlify : Site configuration → Environment variables).
 */
import webpush from 'web-push'
import { randomBytes } from 'node:crypto'

const keys = webpush.generateVAPIDKeys()
const cronSecret = randomBytes(24).toString('hex')

console.log(`
# ── À copier dans .env.local et chez ton hébergeur ──────────────────────────
NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}
VAPID_PRIVATE_KEY=${keys.privateKey}
VAPID_EMAIL=mailto:ton-email@exemple.fr
CRON_SECRET=${cronSecret}
# ─────────────────────────────────────────────────────────────────────────────
⚠️  La clé privée et CRON_SECRET sont secrètes : ne les commit jamais.
⚠️  Si tu changes de clé VAPID plus tard, tout le monde devra réactiver ses notifications.
`)
