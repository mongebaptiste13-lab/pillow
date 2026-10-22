# Pillow 💊

Ton rappel de pilule, élégant et fiable. Application web installable (PWA) en français :
rappels push même app fermée, suivi des prises, plaquette 21/7, gestion du stock, historique et statistiques.

**Stack :** Next.js 16 · React 19 · Tailwind 4 · Supabase (Auth, Postgres, Realtime) · Web Push (VAPID)

## Démarrage

```bash
pnpm install
cp .env.example .env.local      # puis remplis les valeurs (voir ci-dessous)
pnpm vapid                      # génère les clés VAPID à copier dans .env.local
pnpm dev
```

### 1. Supabase

1. Crée un projet sur [supabase.com](https://supabase.com).
2. Ouvre **SQL Editor** et exécute `supabase-setup.sql` (idempotent : tu peux le relancer sans risque).
3. **Authentication → URL Configuration** : ajoute l'URL de ton site (et `http://localhost:3000`) dans *Site URL* / *Redirect URLs* (nécessaire pour « mot de passe oublié »).
4. Copie dans `.env.local` : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` (⚠️ cette dernière reste côté serveur, ne la préfixe jamais par `NEXT_PUBLIC_`).

### 2. Notifications push

| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | clés générées par `pnpm vapid` |
| `VAPID_SUBJECT` | `mailto:toi@exemple.fr` |
| `CRON_SECRET` | secret partagé qui protège `/api/cron/dispatch` |

Les rappels sont envoyés par un **dispatcher serveur** (`/api/cron/dispatch`) qui doit être appelé **chaque minute**. Il envoie :
rappel à l'heure de prise, jusqu'à 3 relances toutes les 30 min, rappels « plus tard », alerte de stock (9 h), rappel de reprise après la pause (18 h la veille). Les envois sont dédoublonnés (aucun doublon même si le cron se chevauche) et respectent le fuseau horaire de chaque utilisatrice.

Deux façons de le déclencher, au choix :

- **Netlify** : `netlify/functions/dispatch-notifications.mjs` est déjà planifiée (`* * * * *`). Définis `CRON_SECRET` dans Netlify (l'URL du site est détectée automatiquement).
- **Supabase pg_cron + pg_net** : exécute `supabase-cron.sql` après avoir remplacé l'URL du site et le `CRON_SECRET`.

Test manuel :

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://ton-site/api/cron/dispatch
```

### 3. Installer sur le téléphone

- **Android / desktop** : bouton « Installer » dans Réglages (ou menu du navigateur).
- **iPhone** : les notifications push ne fonctionnent qu'une fois l'app **ajoutée à l'écran d'accueil** (Partager → *Sur l'écran d'accueil*), iOS 16.4 minimum. Active ensuite les notifications depuis Réglages.

## Scripts

| Commande | |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js |
| `pnpm typecheck` | TypeScript strict |
| `pnpm test` | tests de la logique (jours/fuseaux, plaquette, séries) et du dispatcher |
| `pnpm vapid` | génère une paire de clés VAPID |

## Architecture

- `lib/dispatch.ts` : moteur de notifications (injectable, testé avec un Supabase en mémoire)
- `lib/pack.ts`, `lib/stats.ts`, `lib/date.ts` : cycle 21/7, séries, jours locaux par fuseau
- `hooks/use-pillow-data.ts` : mises à jour optimistes, file d'attente hors ligne, synchro Realtime
- `public/service-worker.js` : push avec actions « Je l'ai prise » / « Plus tard », cache hors ligne
- `app/api/*` : abonnement push, rappel différé, test de notification, suppression de compte, cron

## Sécurité

Row Level Security activée sur toutes les tables ; chaque utilisatrice ne voit que ses données. La clé `service_role` n'est utilisée que par les routes serveur.
