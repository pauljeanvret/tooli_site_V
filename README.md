# Toolia

Landing page et SaaS Toolia : connexion Gmail, labels, analyse d'emails, brouillons IA, apprentissage du style d'écriture et quotas par offre.

## Test local

```bash
npm install
copy .env.example .env.local
npm run dev
```

Ouvrez ensuite http://localhost:3000.

Parcours principal :

1. Cliquez sur `Automatiser ma boîte Gmail`.
2. Créez un compte ou connectez-vous.
3. Choisissez une offre sur `/pricing`.
4. Finalisez le paiement via Stripe Checkout si Stripe est configuré.
5. Complétez la configuration Toolia.
6. Connectez Gmail via Google OAuth.
7. Activez Toolia ou utilisez le mode test.
8. Pilotez l'automatisation depuis `/dashboard`.

## Mode test

Le mode test reste disponible pour travailler localement sans paiement réel. Il ne débloque pas les fonctionnalités payantes réelles et ne remplace pas une souscription Stripe active.

Toolia ne demande jamais le mot de passe Gmail. La connexion Gmail réelle passe uniquement par Google OAuth.

## Variables d'environnement

Copiez `.env.example` vers `.env.local`, puis remplissez les clés nécessaires.

- Supabase : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` ou `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_SECRET_KEY`
- Stripe : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- Stripe Price IDs : `STRIPE_STARTER_MONTHLY_PRICE_ID`, `STRIPE_STARTER_SETUP_PRICE_ID`, `STRIPE_PRO_MONTHLY_PRICE_ID`, `STRIPE_PRO_SETUP_PRICE_ID`, `STRIPE_PREMIUM_MONTHLY_PRICE_ID`, `STRIPE_PREMIUM_SETUP_PRICE_ID`
- Google OAuth : `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- IA : `OPENROUTER_API_KEY` ou `OPENAI_API_KEY`, avec `LLM_PROVIDER=openrouter` ou `LLM_PROVIDER=openai`
- Telegram futur : `TELEGRAM_BOT_TOKEN`
- Worker/n8n futur : `CRON_SECRET`, `WORKER_SECRET`, `N8N_WEBHOOK_URL`
- Sécurité : `ENCRYPTION_KEY`

## Stripe

Toolia utilise Stripe comme source de vérité pour les offres payantes. Le frontend ne doit pas modifier directement le plan réel d'un compte.

### Produits/prix à créer dans Stripe

Créez trois produits ou trois ensembles de prix :

- Starter : 29 EUR/mois + 49 EUR de frais de mise en place
- Pro : 69 EUR/mois + 99 EUR de frais de mise en place
- Premium : 129 EUR/mois + 199 EUR de frais de mise en place

Pour chaque offre, créez :

- un prix récurrent mensuel
- un prix one-time pour les frais de mise en place

Renseignez ensuite les six Price IDs dans `.env.local`.

### Checkout

La route `POST /api/stripe/checkout` :

- exige une session Supabase Bearer valide
- accepte uniquement `starter`, `pro` ou `premium`
- crée une session Stripe Checkout avec l'abonnement mensuel et les frais de mise en place
- ajoute `user_id` et `plan` dans les métadonnées Stripe
- est réservée aux nouvelles souscriptions, sans abonnement actif existant

### Upgrades

La page `/billing/change-plan?target=pro` ou `/billing/change-plan?target=premium` affiche d'abord le changement d'offre à l'utilisateur : offre actuelle, nouvelle offre, différence de mise en place et changement de prix mensuel. La route `POST /api/stripe/upgrade` ne doit être appelée qu'après cette confirmation explicite.

- Starter -> Pro : facture 50 EUR de différence de mise en place
- Starter -> Premium : facture 150 EUR de différence de mise en place
- Pro -> Premium : facture 100 EUR de différence de mise en place

L'upgrade ouvre une session Stripe Checkout en `mode: payment` pour le total estimé à payer aujourd'hui : delta de setup + ajustement proratisé de l'abonnement pour la période en cours. Après `checkout.session.completed`, le webhook met à jour l'abonnement Stripe existant avec le nouveau prix mensuel, sans prorata supplémentaire, puis confirme le plan dans Supabase. Cette route ne crée jamais une deuxième souscription et ne met jamais le plan à jour directement depuis le frontend.

Les setup fees ne sont jamais remboursés automatiquement.

### Webhook

La route `POST /api/stripe/webhook` vérifie `STRIPE_WEBHOOK_SECRET`.

Événements Stripe à écouter :

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

Seul le webhook met à jour la table `subscriptions`. Les statuts `active` et `trialing` débloquent les fonctionnalités payantes.

Pour tester en local :

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copiez le signing secret affiché par Stripe CLI dans `STRIPE_WEBHOOK_SECRET`.

### Portail client

La route `POST /api/stripe/portal` crée une session Customer Portal pour un utilisateur authentifié ayant un customer Stripe connu.

Les downgrades, annulations, factures et moyens de paiement doivent être gérés dans le portail sécurisé Stripe. Les upgrades passent par la page Toolia `/billing/change-plan`, puis par un Checkout de paiement dédié. Toolia ne modifie pas directement le plan depuis le frontend.

Note développeur : pour autoriser les upgrades/downgrades dans le Customer Portal, activez les mises à jour d'abonnement dans Stripe Dashboard et ajoutez uniquement les prix mensuels Starter, Pro et Premium. N'ajoutez pas les prix de setup fee aux changements de plan du portail.

## Worker Gmail automatique

La route `GET` ou `POST /api/worker/process-gmail` exécute le traitement Gmail automatique MVP.

Protection :

- la variable `WORKER_SECRET` doit être configurée
- chaque appel doit envoyer le header `x-worker-secret`
- la route refuse tout appel sans secret valide
- un verrou Supabase global `gmail_worker_global` empeche deux executions Gmail de tourner en meme temps
- le verrou expire automatiquement apres `WORKER_LOCK_TIMEOUT_SECONDS=600` secondes par defaut si une execution crashe

### Cron Vercel

Le cron de production est declare dans `vercel.json` :

- path : `/api/cron/process-gmail`
- schedule : `*/5 * * * *`

Vercel Cron envoie automatiquement `Authorization: Bearer <CRON_SECRET>` si `CRON_SECRET` est configure dans le projet Vercel.

La route `/api/cron/process-gmail` verifie `CRON_SECRET`, puis appelle le worker reel `/api/worker/process-gmail` avec le header interne `x-worker-secret: <WORKER_SECRET>`.

Variables requises en production :

- `CRON_SECRET`
- `WORKER_SECRET`
- migration Supabase `20260605123000_worker_global_lock.sql` appliquee

N'utilisez pas `force=1` dans le cron de production. Le cron global peut tourner toutes les 5 minutes, mais le worker garde les delais minimums par plan.

Appel manuel local :

```bash
curl.exe -X POST http://localhost:3000/api/worker/process-gmail ^
  -H "x-worker-secret: VOTRE_WORKER_SECRET"
```

Options de test possibles :

```bash
curl.exe -X POST "http://localhost:3000/api/worker/process-gmail?maxUsers=5&maxEmailsPerUser=10&force=1" ^
  -H "x-worker-secret: VOTRE_WORKER_SECRET"
```

Réglages optionnels :

- `WORKER_LOCK_TIMEOUT_SECONDS=600` definit la duree maximale du verrou global
- `WORKER_MAX_EMAILS_PER_USER_DEFAULT=5` limite le volume automatique par défaut
- `WORKER_BATCH_SIZE=5` limite la taille des lots envoyés à l'IA pour la classification
- `LLM_CLASSIFICATION_MODEL` permet d'utiliser un modèle moins coûteux pour classer les emails
- `LLM_DRAFT_MODEL` permet de garder un modèle plus qualitatif pour les brouillons

Règle d'accès payant :

- `active` et `trialing` peuvent être traités uniquement si `current_period_end` est encore dans le futur
- une résiliation programmée à la fin de période continue de fonctionner jusqu'à `current_period_end`
- `canceled`, `past_due`, `unpaid`, `incomplete` ou une période payée terminée bloquent le worker
- si l'abonnement n'est plus valide, Toolia ignore le compte et logue la raison

Comportement MVP :

- maximum 10 emails Gmail par utilisateur et par exécution, avec 5 par défaut
- emails déjà présents dans `email_processing_logs` ignorés pour éviter les doublons
- emails manifestement automatiques, trop courts ou newsletters ignorés avant tout appel IA
- seuls les emails réellement envoyés à l'IA consomment le quota mensuel d'analyses
- classification IA faite en lots compacts pour réduire le nombre d'appels LLM
- labels Gmail appliqués uniquement si la classification est assez fiable
- brouillons Gmail créés seulement si la catégorie le demande et si le quota le permet
- aucun email n'est envoyé automatiquement
- aucun email n'est supprimé définitivement
- aucun archivage automatique n'est appliqué dans ce MVP

Pour Vercel Cron, configurez une execution periodique vers `/api/cron/process-gmail`. Cette route relais verifie `CRON_SECRET`, puis appelle le worker interne avec `WORKER_SECRET`.

### Optimisation coÃ»t worker

Le worker limite les appels IA avant cron automatique :

- classification locale par rÃ¨gles pour les emails Ã©vidents : no-reply/newsletters ignorÃ©s, factures/urgences/clients classÃ©s sans LLM quand la catÃ©gorie existe
- classification LLM en lots compacts uniquement pour les emails ambigus
- brouillons routÃ©s par complexitÃ© avec `LLM_DRAFT_SMALL_MODEL`, `LLM_DRAFT_MEDIUM_MODEL`, `LLM_DRAFT_COMPLEX_MODEL`
- intervalles minimaux par plan définis dans `lib/saas/plan-config.ts` : Starter 30 min, Pro 10 min, Premium 5 min
- `force=1` est rÃ©servÃ© aux tests manuels
- estimation de coÃ»t optionnelle via les variables `LLM_*_INPUT_COST_PER_1M` et `LLM_*_OUTPUT_COST_PER_1M`

En dÃ©veloppement, la rÃ©ponse JSON expose notamment `skippedBeforeAi`, `skippedByRules`, `ruleClassified`, `emailsSentToLlm`, `llmClassificationCalls`, `draftGenerationCalls`, `classificationModels`, `draftModels`, `promptTokensEstimated`, `completionTokensEstimated` et `estimatedCost`.

### Admin finance et couts IA

La page interne `/admin/finance` est reservee aux comptes listes dans `ADMIN_EMAILS`.
Elle affiche, par mois et par client :

- revenu mensuel estime depuis le plan actif ;
- cout IA estime depuis `ai_usage_events` ;
- profit et marge estimes ;
- appels IA par action, modele et client.

Les logs de cout ne stockent pas les prompts, corps Gmail, objets d'emails, jetons OAuth, cles API ou secrets.
Les revenus sont estimes tant que les montants exacts des factures Stripe ne sont pas historises dans Supabase.

### Delais MVP par offre

Les delais minimums entre deux passages automatiques du worker sont alignes sur les valeurs MVP suivantes :

- Starter : 30 minutes
- Pro : 10 minutes
- Premium : 5 minutes

Ces valeurs ne configurent pas le cron elles-memes. Elles sont définies côté code dans `PLAN_GMAIL_INTERVAL_MINUTES` et servent de garde-fou côté worker quand une exécution externe appelle `/api/worker/process-gmail`.

## Telegram

Les alertes Telegram sont disponibles Ã  partir de l'offre Pro. Starter reste dÃ©sactivÃ©.

Variables :

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_USERNAME`
- `TELEGRAM_WEBHOOK_SECRET` optionnel
- `TELEGRAM_CONNECTION_TOKEN_TTL_MINUTES=15`

CrÃ©ation du bot :

1. Ouvrez Telegram et parlez Ã  BotFather.
2. CrÃ©ez un bot avec `/newbot`.
3. Renseignez le token dans `TELEGRAM_BOT_TOKEN`.
4. Renseignez le username sans `@` dans `TELEGRAM_BOT_USERNAME`.

UX client :

1. Dans Toolia, cliquez sur `Connecter Telegram`.
2. Toolia affiche un bouton `Ouvrir Telegram`, un QR code et trois instructions.
3. Le client appuie sur `DÃ©marrer` dans le bot Toolia.
4. Toolia dÃ©tecte automatiquement la connexion.
5. Le client peut envoyer une alerte test.

Webhook production :

```bash
curl -X POST "https://api.telegram.org/botVOTRE_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://votre-domaine.com/api/telegram/webhook","secret_token":"VOTRE_TELEGRAM_WEBHOOK_SECRET"}'
```

En local, utilisez un tunnel HTTPS puis configurez le webhook vers `/api/telegram/webhook`. Si le webhook local n'est pas pratique, utilisez `getUpdates` cÃ´tÃ© Telegram uniquement pour observer que le `/start token` arrive, sans demander au client de copier un chat ID.

## Architecture

Toolia ne génère pas de code arbitraire ni de workflow n8n par client.

```text
Réponses client
-> profil d'automatisation validé
-> stockage backend
-> labels Gmail
-> traitement générique
-> n8n plus tard comme scheduler/webhook masqué
```

Garde-fous :

- aucun envoi automatique d'email
- aucune suppression définitive d'email
- les brouillons restent à valider dans Gmail
- n8n n'est pas exposé dans l'interface client

## Routes principales

- `/signup`
- `/login`
- `/pricing`
- `/onboarding`
- `/onboarding/gmail`
- `/onboarding/profile`
- `/onboarding/preview`
- `/dashboard`
- `/dashboard/settings`

## Build

```bash
npm run build
```

## Base de données

Les migrations Supabase sont dans `supabase/migrations/`.

Elles couvrent notamment les profils, abonnements, connexions Gmail, profils d'automatisation, catégories, mappings de labels, logs d'emails, style d'écriture, quotas mensuels et événements d'usage IA.
