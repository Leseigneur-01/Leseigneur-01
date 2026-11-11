# Intégrations, exploitation et sécurité

## Choix CRM

| Critère | HubSpot | Zoho CRM | Odoo CRM / Ventes |
| --- | --- | --- | --- |
| Pertinent pour | Démarrage simple, suivi commercial et formulaires | Personnalisation et automatisations commerciales | CRM relié à la production, aux ventes et aux stocks |
| Atouts | Prise en main rapide, intégrations nombreuses | Personnalisation, écosystème Zoho, connecteurs de messagerie | ERP modulaire, devis, facturation, gestion de l’atelier possibles |
| À anticiper | Fonctions avancées selon l’abonnement | Paramétrage et formation de l’équipe | Intégration et maintenance par un spécialiste |
| Liaison avec ce site | Adaptateur webhook vers API HubSpot ou Make / Zapier | Adaptateur webhook vers API Zoho ou Make / Zapier | Adaptateur webhook vers API Odoo ou intégration spécifique |

Pour démarrer simplement, HubSpot peut convenir. Si l’objectif est de relier prospects, stocks papier et planning de production, étudier Odoo avec un intégrateur. Les offres, limites et tarifs de ces fournisseurs évoluent : les vérifier avant choix. **Aucun de ces CRM n’est connecté par défaut.**

## Webhooks sortants

Renseigner les URL HTTPS et leurs secrets dans `.env`. Les webhooks pointent vers un **adaptateur** sous votre contrôle (ou un scénario Make / Zapier capable de vérifier la signature), qui transforme les événements dans le format de votre CRM ou de votre fournisseur de messagerie. Une URL d’API HubSpot / Zoho / Odoo ne consomme pas automatiquement ce format générique.

| Variable | Événements | Action attendue de l’adaptateur |
| --- | --- | --- |
| `CRM_WEBHOOK_URL` | `web_form_submission`, `contact_form_submission`, `quote_expired` | Créer / mettre à jour le prospect ou l’opportunité CRM |
| `AUTOMATION_WEBHOOK_URL` | `quote_sent_notification`, `quote_follow_up_48h`, `quote_validity_96h` | Envoyer les messages via les fournisseurs configurés et créer la tâche CRM |
| `PRODUCTION_WEBHOOK_URL` | `bat_approved` | Créer la fiche de fabrication et la transmettre à l’atelier |

Le corps du devis respecte la structure du cahier des charges : `event_type`, `source`, `timestamp`, `client_info`, `project_lead`, `specifications`, `delivery_method` et `file_attachment`. La propriété `file_url` vaut volontairement `null` : **aucun lien public permanent n’est diffusé**. Le personnel autorisé génère un lien de 24 h via l’API ci-dessous. Les valeurs additionnelles comprennent notamment `lead_id`, les dimensions, le recto / verso, les couleurs et la date souhaitée.

Chaque requête porte `Idempotency-Key` et `X-Kora-Event-Id`. Un secret est requis pour chaque webhook configuré en production. `X-Kora-Signature` vaut `sha256=` suivi du HMAC-SHA256 hexadécimal du corps JSON exact. Vérifier la signature et dédupliquer la clé avant traitement. Les échecs sont conservés sur disque et réessayés avec temporisation croissante (maximum six heures). Surveiller `GET /api/admin/integrations` et les journaux ; une réponse 2xx doit signifier que l’adaptateur a lui-même enregistré l’événement durablement. Le système est prévu pour un **seul processus** ; une file transactionnelle externe est nécessaire pour une exploitation multi-instance.

### Déclencheurs commerciaux

1. Lorsque le CRM a réellement envoyé le devis chiffré, l’adaptateur met le dossier au statut `quote_sent` avec son lien HTTPS. Un événement immédiat contient un modèle d’e-mail et de SMS.
2. Après 48 h, si le statut est toujours `quote_sent`, un événement contient une relance WhatsApp / e-mail et une tâche d’appel prioritaire.
3. Après 96 h sans validation, un événement contient l’e-mail d’alerte de validité. Après 144 h, le dossier passe à `quote_expired`.
4. Lorsqu’une signature ou un acompte est effectivement constaté dans le CRM, synchroniser les statuts `quote_validated`, puis `deposit_paid`. Les relances en attente devenues obsolètes sont écartées.

Les canaux sont des **instructions dans les événements**, pas des envois autonomes. Configurer les fournisseurs, le consentement, les modèles WhatsApp approuvés et les règles d’envoi dans l’adaptateur. Le site ne prend ni signature électronique de devis ni paiement.

## Administration et BAT

L’API `/api/admin/*` exige simultanément : `Authorization: Bearer <ADMIN_API_KEY>` (32 caractères minimum), `X-Admin-TOTP: <code à 6 chiffres>` et une adresse IP figurant dans `ADMIN_ALLOW_IPS` (liste séparée par des virgules). `ADMIN_TOTP_SECRET` est un secret base32 à ajouter dans une application d’authentification. Générer des secrets uniques hors du dépôt, par exemple :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
python3 -c "import os,base64; print(base64.b32encode(os.urandom(20)).decode())"
```

Ne pas partager les secrets ni les stocker dans le code. En production, placer l’application derrière un proxy maîtrisé et configurer correctement l’IP client ; ne pas exposer directement le port Node. Cette authentification d’API partagée reste une base : pour une équipe réelle, préférer un fournisseur d’identité avec comptes nominatifs, MFA, révocation et audit.

Parcours opérationnel (tous les appels d’administration portent les deux en-têtes ci-dessus) :

1. `GET /api/admin/quotes` pour lister les demandes ; `GET /api/admin/quotes/:id` pour les détails. Les messages de contact sont disponibles via `GET /api/admin/contacts`.
2. `POST /api/admin/quotes/:id/status` avec `{ "status": "quote_sent", "quote_url": "https://…" }`, puis `{ "status": "quote_validated" }` et `{ "status": "deposit_paid" }` après confirmation externe.
3. `POST /api/admin/quotes/:id/file-link` : retourne un lien valable 24 h. **Le téléchargement requiert aussi clé, TOTP et IP autorisée** ; le lien seul ne suffit pas.
4. `POST /api/admin/bats` en `multipart/form-data` avec `quote_id` et `proof` (PDF). Le retour `client_url` contient un jeton aléatoire valable 7 jours à transmettre confidentiellement au client. Un nouveau BAT remplace le précédent non validé.
5. Le client ouvre son lien, vérifie le PDF et confirme. L’état devient `bat_approved` et un événement `bat_approved` est mis en file pour l’atelier. Deux clics ne créent pas deux ordres.
6. `GET /api/admin/quotes/:id/bat` permet au personnel authentifié de récupérer le BAT validé, même après expiration du lien client.
7. Après livraison effective, `POST /api/admin/quotes/:id/delivered` avec `{ "confirm": true }`. Le nettoyage s’exécute au démarrage et chaque minute : il supprime le fichier source à partir de 30 jours après cette date, pas 30 jours après l’envoi initial. Le BAT validé reste conservé.

Le lien BAT est un secret au porteur : toute personne qui le possède peut approuver l’épreuve. Il faut un accès client nominatif, une preuve d’identité et un audit immuable si une validation contractuelle forte est requise.

## Checklist de déploiement

- Fournir la véritable identité, l’adresse, le téléphone, l’e-mail, les mentions légales et les consentements. Les images présentes sont générées et illustratives.
- Déployer derrière HTTPS **TLS 1.3**, avec certificats valides et redirection HTTP vers HTTPS. Activer `TRUST_PROXY=1` uniquement derrière un unique proxy de confiance, puis vérifier IP et protocole transmis. `PUBLIC_BASE_URL` doit être une origine HTTPS réelle.
- Activer reCAPTCHA v3 (`RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY`, domaine autorisé). Les formulaires de production échouent sans ces clés. Aucun secret n’est exposé au navigateur.
- Limiter les requêtes en bordure, configurer le proxy pour accepter au moins 1 Gio et des transferts longs, sans bufferiser intégralement en mémoire. Le serveur reçoit le fichier en flux sur disque ; tester une charge réelle avant lancement.
- Placer `PRIVATE_STORAGE_DIR` sur un volume persistant chiffré, hors racine web, avec permissions strictes, sauvegardes chiffrées, quotas et supervision. Les fichiers sont contrôlés par extension et signature mais **ne sont pas analysés contre les malwares** : ajouter une quarantaine et un antivirus avant accès prépresse.
- Restreindre l’administration aux IP autorisées et activer MFA nominatif. Le lien fichier expire en 24 h ; le lien BAT, en 7 jours. Ne jamais journaliser ces liens ni les inclure dans une page publique.
- Assurer le démarrage continu du worker intégré, surveiller les erreurs et la file, gérer les données personnelles et les sauvegardes selon une politique de rétention documentée. Les informations de prospects / contacts ne sont pas automatiquement supprimées par la purge des fichiers sources.
- Tester les connecteurs, la synchronisation des statuts CRM, les fournisseurs e-mail / SMS / WhatsApp, la création de tâches et la réception de la fiche de fabrication avec de faux dossiers avant utilisation réelle.
