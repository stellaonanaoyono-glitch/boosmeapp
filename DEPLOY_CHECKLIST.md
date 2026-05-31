# BOOST.ME — Checklist Déploiement Phase 1

## 1. SUPABASE — Exécuter le schéma

1. Va sur https://app.supabase.com/project/hddxbjmdtbxvxwmmdxmj
2. Clique sur "SQL Editor" dans le menu gauche
3. Colle le contenu de `boostme_schema.sql`
4. Clique "Run"
5. Vérifie que toutes les tables sont créées dans "Table Editor"

Tables créées :
- profiles
- challenges (avec les 13 challenges seedés)
- user_challenges
- daily_validations
- daily_content
- promo_codes (avec les 6 codes seedés)
- referral_codes
- payments

## 2. SUPABASE — Configurer l'Auth

1. Authentication > Settings
2. "Site URL" : https://boostme.app
3. "Redirect URLs" : ajouter https://boostme.app/**, http://localhost:*/**
4. Email Settings : activer "Confirm email" (recommandé)
5. Email Templates : personnaliser avec le nom BOOST.ME

## 3. NETLIFY — Déployer

1. Va sur https://app.netlify.com
2. "Add new site" > "Import an existing project"
3. Connecte ton GitHub
4. Sélectionne le repo boostme-app
5. Build settings : laisser vide (site statique)
6. Deploy

## 4. NETLIFY — Variables d'environnement

Dans Site Settings > Environment Variables, ajouter :

SUPABASE_URL=https://hddxbjmdtbxvxwmmdxmj.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=[TA CLE SERVICE ROLE — NE JAMAIS METTRE DANS LE CODE]
STRIPE_SECRET_KEY=[TA CLE STRIPE SECRET — Phase 2]
NOTCHPAY_SECRET_KEY=[TA CLE NOTCHPAY SECRET — Phase 2]

## 5. SUPABASE — Allowed Hosts

Dans Settings > API > Allowed Hosts :
- Ajouter : https://boostme.app
- Ajouter : https://*.netlify.app (pour les previews)

## 6. TESTS À FAIRE AVANT D'ANNONCER

- [ ] S'inscrire avec un vrai email
- [ ] Vérifier que le profil est créé dans Supabase (Table Editor > profiles)
- [ ] Se connecter avec les identifiants créés
- [ ] Vérifier que le dashboard est accessible
- [ ] Vérifier que la déconnexion fonctionne
- [ ] Tester depuis un mobile iOS et Android
- [ ] Tenter d'accéder à /boostme-app/dashboard.html sans être connecté -> doit rediriger vers login

## 7. PHASE 2 (prochaine session)

- Netlify Functions pour Stripe
- Netlify Functions pour NotchPay
- Webhook de confirmation de paiement
- Mise à jour automatique du plan en base
