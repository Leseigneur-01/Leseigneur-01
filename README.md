# Agence 360 — studio créatif & atelier d’impression

Site vitrine en français pour une agence de communication et une imprimerie à Abidjan. **A360 est un nom de démonstration** : le nom, les coordonnées et les visuels sont à remplacer par ceux de l’agence. Les projets du portfolio sont des concepts illustratifs, et non des références clients réelles.

## Démarrer

Node.js 22.12 ou supérieur est nécessaire.

```bash
npm install
npm run dev
```

Le site et son API sont accessibles sur le port `5173` (ou celui défini par `PORT`). L’application utilise Vite et Express ; les fichiers de configuration et les commandes `next:*` conservés depuis le gabarit de `main` ne pilotent pas ce site et nécessitent une application Next distincte.

Pour vérifier le build et les tests :

```bash
npm run build
npm test
```

Pour un démarrage de production : `npm run build`, puis `npm start` derrière un proxy HTTPS correctement configuré. En production, les formulaires refusent les soumissions si HTTPS ou reCAPTCHA ne sont pas configurés.

## Contenu HTML

Le fichier [`contenu-du-site.html`](contenu-du-site.html) contient le HTML lisible de la page d’accueil et des gabarits inertes pour les étapes du devis et l’accès BAT. Il peut être consulté sur `/contenu-du-site.html` lorsque le serveur est lancé. Les interactions et les étapes du formulaire sont créées par les composants React (`src/App.jsx`, `src/QuoteModal.jsx`, `src/BatModal.jsx`, `src/ContactForm.jsx`) et utilisent l’API Node : ce fichier HTML seul ne remplace pas le projet complet.

Après une modification du contenu des composants, régénérer le HTML avec `npm run export:html`.

## Ce qui est inclus

- Accueil responsive, expertises studio / imprimerie, explication des finitions, portfolio filtrable et fiches de projets conceptuels.
- Devis en quatre étapes : coordonnées, conseil ou impression, petit / grand format, spécifications conditionnelles, quantité, livraison et dépôt d’**un fichier** PDF, AI, PSD ou INDD jusqu’à 1 Gio. Les données sont vérifiées côté navigateur et serveur. Aucun tarif n’étant fourni, le site demande un devis sur mesure et n’invente pas de prix.
- Formulaire de contact, espace BAT par lien personnel, aperçu PDF et validation. Une validation confirmée met en file une fiche de travail pour l’atelier.
- Stockage local privé hors de `public/` et `dist/`, noms internes aléatoires, vérification de signature des fichiers, liens de téléchargement de 24 h réservés aux administrateurs authentifiés, et suppression des sources 30 jours après la livraison enregistrée. Le BAT validé est conservé.
- File de webhooks persistante avec tentatives, événement CRM au dépôt, et événements de notification / relance à l’envoi du devis, à +48 h et +96 h si le statut reste « devis envoyé ». Les messages et la tâche commerciale sont fournis dans les événements.
- API d’administration protégée par clé, code TOTP et liste d’IP ; limitation de débit et champ anti-robot. reCAPTCHA v3 est prévu et obligatoire en production.

## Important avant toute utilisation réelle

Cette réalisation est une **base fonctionnelle de démonstration**, pas un service commercial déjà raccordé. Sans configuration, les demandes sont enregistrées localement, mais **aucun CRM, e-mail, SMS, WhatsApp ou atelier ne reçoit automatiquement de notification**. Les webhooks doivent être reliés à des services réels et testés. La validation BAT par lien est une approbation technique : elle ne remplace pas à elle seule une signature électronique avec vérification d’identité et journal de preuve légal.

Avant la mise en ligne, prévoir notamment un domaine et un proxy en **HTTPS/TLS 1.3**, reCAPTCHA v3, une adresse d’atelier réelle, une politique de confidentialité, une sauvegarde chiffrée, un antivirus en quarantaine pour les fichiers, la surveillance des tâches, et une infrastructure de stockage pérenne. L’application utilise des fichiers JSON et des verrous dans un seul processus ; pour plusieurs instances ou un usage critique, utiliser une base transactionnelle, un stockage objet privé et une file de tâches supervisée. Le test sous charge d’un fichier de 1 Gio et le réglage des limites / délais du proxy restent nécessaires.

Copier `.env.example` vers `.env` et compléter les variables. Les variables `VITE_AGENCY_*` sont publiques et intégrées lors de la compilation : relancer le serveur de développement ou reconstruire après modification. Sans adresse, la carte renvoie uniquement vers Abidjan et ne prétend pas localiser l’atelier.

Voir [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) pour les choix CRM, les événements, le workflow BAT, les commandes d’administration et la checklist de sécurité.
