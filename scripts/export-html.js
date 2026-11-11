import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { format } from 'prettier';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

// Exporte la page d'accueil en HTML lisible, sans dupliquer les composants sources.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vite = await createServer({ root, configFile: false, plugins: [react()], optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const { default: App } = await vite.ssrLoadModule('/src/App.jsx');
  const { default: QuoteModal } = await vite.ssrLoadModule('/src/QuoteModal.jsx');
  const { default: BatModal } = await vite.ssrLoadModule('/src/BatModal.jsx');
  const rendered = renderToStaticMarkup(React.createElement(App));
  const content = rendered.replace(/^<link rel="preload" as="image"[^>]*\/>/, '');
  // Gabarits inertes destinés à la lecture du code : React gère les vrais écrans.
  const noop = () => {};
  const quoteStates = [
    ['devis-01-coordonnees', { initialStep: 1 }],
    ['devis-02-conseil', { initialType: 'Conseil & création', initialStep: 2 }],
    ['devis-02-petit-format', { initialType: 'Impression de supports', initialStep: 2, initialValues: { category: 'Petit format' } }],
    ['devis-02-grand-format', { initialType: 'Impression de supports', initialStep: 2, initialValues: { category: 'Grand format / Signalétique' } }],
    ['devis-03-petit-format', { initialType: 'Impression de supports', initialStep: 3, initialValues: { category: 'Petit format', format: 'Personnalisé' } }],
    ['devis-03-grand-format', { initialType: 'Impression de supports', initialStep: 3, initialValues: { category: 'Grand format / Signalétique' } }],
    ['devis-03-conseil', { initialType: 'Conseil & création', initialStep: 3 }],
    ['devis-04-impression', { initialType: 'Impression de supports', initialStep: 4, initialValues: { delivery: 'Livraison sur site / Pose' } }],
    ['devis-04-conseil', { initialType: 'Conseil & création', initialStep: 4 }],
  ];
  const templates = quoteStates.map(([id, props]) => `<template id="${id}">${renderToStaticMarkup(React.createElement(QuoteModal, { ...props, onClose: noop }))}</template>`).join('\n')
    + `\n<template id="espace-bat">${renderToStaticMarkup(React.createElement(BatModal, { initialToken: '', onClose: noop }))}</template>`;
  const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#f7f6ef" />
    <meta name="description" content="Studio créatif et atelier d'impression à Abidjan : conseil, identité de marque, création graphique et impression sur mesure." />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="preload" as="image" href="/images/hero-print.webp" />
    <link rel="stylesheet" href="/src/styles.css" />
    <title>KORA — Studio créatif & atelier d’impression</title>
  </head>
  <body>
    <!--
      HTML de la page d'accueil généré depuis src/App.jsx.
      Les filtres, le formulaire de devis, le contact et l'espace BAT sont
      générés et gérés par les composants React et l'API Node du projet.
      Les gabarits HTML inertes de leurs états figurent en fin de fichier.
      Pour utiliser le site complet : npm install, puis npm run dev.
      Régénérer ce fichier après une modification : npm run export:html.
    -->
    <noscript>Activez JavaScript pour utiliser les filtres, les formulaires et l’espace BAT.</noscript>
    <div id="root">${content}</div>
    <!-- Gabarits de lecture des écrans interactifs. Ils sont inertes : le site utilise les composants React. -->
    ${templates}
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`;
  const output = path.join(root, 'contenu-du-site.html');
  await fs.writeFile(output, await format(html, { parser: 'html', printWidth: 110, htmlWhitespaceSensitivity: 'css' }), 'utf8');
  console.log('HTML généré : contenu-du-site.html');
} finally {
  await vite.close();
}
