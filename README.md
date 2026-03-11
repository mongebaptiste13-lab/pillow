# Luna - App de Suivi de Pilule et Cycle Menstruel

Une application PWA progressive pour suivre ta pilule contraceptive et ton cycle menstruel.

## 🚀 Fonctionnalités

- ✅ **Rappel quotidien de pilule** - Notifications push personnalisées
- ✅ **Suivi du cycle** - Calendrier avec dates de prise de pilule
- ✅ **PWA installable** - Fonctionne hors ligne
- ✅ **Données sécurisées** - Stockage local avec Supabase optionnel
- ✅ **Interface mobile-first** - Optimisée pour tous les appareils

## 📋 Prérequis

- Node.js 18+ et pnpm
- (Optionnel) Compte Supabase pour la synchronisation cloud
- (Optionnel) Compte Firebase pour les notifications push

## ⚙️ Installation

### 1. Cloner et installer les dépendances

```bash
cd pillule
pnpm install
```

### 2. Configuration des variables d'environnement

Créer un fichier `.env.local` à la racine du projet :

```bash
cp .env.example .env.local
```

Remplir les variables :

```env
# Supabase (optionnel pour la V1)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Firebase Cloud Messaging (optionnel pour la V1)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
```

### 3. Lancer en développement

```bash
pnpm dev
```

L'app sera disponible sur `http://localhost:3000`

## 🗄️ Structure du projet

```
├── app/
│   ├── api/              # Routes API (pill-log, notifications, sync-data)
│   ├── layout.tsx        # Layout principal avec PWA setup
│   ├── page.tsx          # Page d'accueil
│   └── globals.css       # Styles globaux
├── components/
│   ├── dashboard.tsx     # Composant principal (onglets)
│   ├── onboarding.tsx    # Écran d'onboarding initial
│   ├── service-worker-provider.tsx
│   ├── theme-provider.tsx
│   └── ui/               # Composants UI réutilisables
├── lib/
│   ├── supabase-client.ts
│   ├── supabase-server.ts
│   ├── use-notifications.ts
│   ├── utils.ts
│   └── env.ts
├── public/
│   ├── manifest.json     # Manifest PWA
│   └── service-worker.ts # Service Worker
└── styles/
    └── globals.css       # Styles globaux
```

## 📱 Fonctionnement

### Onboarding initial

À la première visite, l'utilisateur configure :
- Son nom
- Son type de pilule (21/7 ou 28 jours)
- Son heure de prise quotidienne

Les données sont sauvegardées localement dans le navigateur.

### Onglet Pilule (principal)

- Affiche un gros bouton avec la question "As-tu pris ta pilule ?"
- Les boutons deviennent actifs 30 min avant l'heure programmée
- Avant cette heure, affiche un compte à rebours
- Après confirmation, programme un rappel de sécurité dans 2h30

### Onglet Suivi du cycle

- Calendrier du mois en cours
- Les jours où la pilule a été prise sont marqués en vert ✓
- Légende : Règles (rose), Fertile (orange), Pilule prise (vert)
- Section infos : durée du cycle, durée des règles, dernières règles

### Onglet Mon compte

- Paramètres des notifications
- Informations du cycle
- Bouton d'installation PWA (iOS/Android)

## 🔔 Notifications

### Permissions

L'app demandera automatiquement la permission pour les notifications.

### Types de notifications

1. **Rappel quotidien** - À l'heure programmée
2. **Rappel de sécurité** - 2h30 après confirmation
3. **Prédiction règles** - Quelques jours avant (optionnel)

### Sur iOS

Les notifications web exigent que l'app soit **ajoutée à l'écran d'accueil** :
1. Ouvrir dans Safari
2. Cliquer le bouton de partage
3. Sélectionner "Ajouter à l'écran d'accueil"

Sur Android, l'app s'installe directement via le prompt.

## 💾 Stockage des données

### V1 (MVP - Stockage local)

Toutes les données sont sauvegardées localement dans IndexedDB :
- Préférences utilisateur
- Journal de prise de pilule
- Dates des dernières règles

Les données restent privées sur l'appareil.

### V2+ (Supabase optionnel)

Configuration Supabase pour la synchronisation cloud :

**Tables requises :**

```sql
-- Profiles
CREATE TABLE profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  name TEXT,
  timezone TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Pill schedules
CREATE TABLE pill_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  pill_time TIME,
  pill_type TEXT,
  reminder_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

-- Pill logs
CREATE TABLE pill_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  scheduled_for DATE,
  taken_at TIMESTAMP,
  status TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Period entries
CREATE TABLE period_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP DEFAULT now()
);
```

Activer les RLS (Row Level Security) pour sécuriser l'accès aux données.

## 🛠️ Développement

### Lancer le dev server

```bash
pnpm dev
```

### Compiler pour la production

```bash
pnpm build
```

### Linter

```bash
pnpm lint
```

## 📂 Service Worker

Le service worker `public/service-worker.ts` gère :
- **Caching** des assets statiques
- **Offline support** - Fonctionnement hors ligne
- **Background sync** - Synchronisation en arrière-plan
- **Push notifications** - Réception des notifications

L'app s'enregistre automatiquement au chargement.

## 🔐 Sécurité

- Les données sensibles (cycles) ne sont jamais envoyées sans consentement
- Utiliser HTTPS en production
- Valider toutes les entrées sur le serveur
- Activer RLS sur Supabase pour les données multi-utilisateurs

## 🐛 Troubleshooting

### Service Worker ne s'enregistre pas

1. Vérifier que HTTPS est activé (ou localhost)
2. Vérifier que `public/service-worker.js` existe
3. Nettoyer le cache du navigateur

### Notifications ne fonctionnent pas

1. Vérifier les permissions (Settings > Notifications)
2. Sur iOS, l'app doit être sur l'écran d'accueil
3. Sur Android, autoriser les notifications pour le navigateur

### Données ne se synchronisent pas

1. Vérifier la connexion internet
2. Vérifier les variables d'environnement Supabase
3. Consulter les logs du service worker (DevTools > Application)

## 📚 Ressources

- [Next.js Documentation](https://nextjs.org/docs)
- [Progressive Web Apps](https://web.dev/progressive-web-apps/)
- [Supabase Docs](https://supabase.com/docs)
- [MDN Web Docs - Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

## 📄 Licence

MIT

## 👥 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une PR.

---

**💡 Note :** Cette V1 du MVP fonctionne entièrement en local. Les données Supabase/Firebase seront intégrées dans les prochaines versions.
