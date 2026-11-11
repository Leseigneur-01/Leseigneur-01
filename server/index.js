import 'dotenv/config';
import crypto from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE, createStorage, hasValidSignature, makePayload, newToken, safeEqual, tokenHash, validateContact, validateQuote, verifyTotp } from './core.js';
import { createJobs } from './jobs.js';

process.umask(0o077);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isProduction = process.env.NODE_ENV === 'production';
const privateRoot = path.resolve(process.env.PRIVATE_STORAGE_DIR || path.join(projectRoot, 'var', 'private'));
for (const publicDir of ['public', 'dist'].map(dir => path.join(projectRoot, dir))) {
  if (privateRoot === publicDir || privateRoot.startsWith(publicDir + path.sep)) throw new Error('Le stockage privé doit être hors de la racine publique.');
}
const storage = createStorage(privateRoot);
await storage.init();
const webhookConfig = {
  crm: { url: process.env.CRM_WEBHOOK_URL, secret: process.env.CRM_WEBHOOK_SECRET },
  automation: { url: process.env.AUTOMATION_WEBHOOK_URL, secret: process.env.AUTOMATION_WEBHOOK_SECRET },
  production: { url: process.env.PRODUCTION_WEBHOOK_URL, secret: process.env.PRODUCTION_WEBHOOK_SECRET },
};
for (const { url, secret } of Object.values(webhookConfig)) {
  if (url) {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol) || (isProduction && parsed.protocol !== 'https:')) throw new Error('Les webhooks doivent utiliser HTTPS en production.');
    if (isProduction && !secret) throw new Error('Chaque webhook configuré doit avoir un secret de signature en production.');
  }
}
const jobs = createJobs(storage, { webhooks: webhookConfig, agencyName: process.env.AGENCY_NAME || 'KORA Studio & Print' });
const app = express();
const server = http.createServer(app);
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  frameguard: isProduction ? undefined : false,
  contentSecurityPolicy: isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://www.google.com', 'https://www.gstatic.com'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https://www.gstatic.com'],
      fontSrc: ["'self'", 'data:'],
      frameSrc: ["'self'", 'https://www.google.com', 'https://recaptcha.google.com'],
      connectSrc: ["'self'", 'https://www.google.com', 'https://www.gstatic.com'],
      objectSrc: ["'none'"], baseUri: ["'self'"], frameAncestors: ["'self'"],
    },
  } : false,
  referrerPolicy: { policy: 'no-referrer' },
}));
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (isProduction && !req.secure) return res.status(403).json({ error: 'Une connexion HTTPS est nécessaire.' });
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('origin')) {
    try { const origin = new URL(req.get('origin')); if (origin.host !== req.get('host') || (isProduction && origin.protocol !== 'https:')) return res.status(403).json({ error: 'Origine non autorisée.' }); }
    catch { return res.status(403).json({ error: 'Origine non autorisée.' }); }
  }
  next();
});
app.use(express.json({ limit: '32kb' }));
const publicLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Trop de tentatives. Réessayez dans quelques minutes.' } });
const tokenLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Trop de tentatives. Réessayez plus tard.' } });
const upload = multer({
  storage: multer.diskStorage({ destination: (_req, _file, cb) => cb(null, storage.directory('tmp')), filename: (_req, _file, cb) => cb(null, crypto.randomUUID()) }),
  limits: { fileSize: MAX_FILE_SIZE, files: 1, fields: 2, fieldSize: 32 * 1024 },
  fileFilter: (_req, file, cb) => ALLOWED_EXTENSIONS.has(path.extname(file.originalname).toLowerCase()) ? cb(null, true) : cb(Object.assign(new Error('Format de fichier non accepté.'), { status: 400 })),
});
function checkAdmin(req, res, next) {
  const key = process.env.ADMIN_API_KEY || '';
  const totpSecret = process.env.ADMIN_TOTP_SECRET || '';
  const ips = (process.env.ADMIN_ALLOW_IPS || '').split(',').map(x => x.trim().replace(/^::ffff:/, '')).filter(Boolean);
  const requestIp = (req.ip || '').replace(/^::ffff:/, '');
  const allowed = ips.length ? ips.includes(requestIp) : !isProduction && ['127.0.0.1', '::1'].includes(requestIp);
  const bearer = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!allowed || key.length < 32 || !safeEqual(key, bearer) || !verifyTotp(totpSecret, req.get('x-admin-totp') || '')) {
    return res.status(403).json({ error: 'Accès administrateur refusé.' });
  }
  next();
}
async function verifyCaptcha(req, res, next) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  const siteKey = process.env.RECAPTCHA_SITE_KEY;
  if (!secret || !siteKey) {
    if (isProduction) return res.status(503).json({ error: 'La protection anti-spam doit être configurée avant la mise en service.' });
    return next();
  }
  const token = req.get('x-recaptcha-token') || '';
  if (!token) return res.status(400).json({ error: 'Vérification anti-spam manquante. Réessayez.' });
  try {
    const body = new URLSearchParams({ secret, response: token });
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', { method: 'POST', body, signal: AbortSignal.timeout(8000) });
    const data = await response.json();
    const action = req.path.includes('/contact') ? 'contact' : 'quote';
    if (!data.success || data.action !== action || Number(data.score) < 0.5) return res.status(400).json({ error: 'La vérification anti-spam a échoué. Réessayez.' });
    const expectedHost = process.env.RECAPTCHA_EXPECTED_HOSTNAME || (process.env.PUBLIC_BASE_URL ? new URL(process.env.PUBLIC_BASE_URL).hostname : '');
    if ((isProduction && !expectedHost) || (expectedHost && data.hostname !== expectedHost)) return res.status(400).json({ error: 'Vérification anti-spam invalide.' });
    next();
  } catch { res.status(503).json({ error: 'Vérification anti-spam indisponible. Réessayez plus tard.' }); }
}
function publicBase(req) {
  if (process.env.PUBLIC_BASE_URL) {
    const url = new URL(process.env.PUBLIC_BASE_URL);
    if (isProduction && url.protocol !== 'https:') throw new Error('PUBLIC_BASE_URL doit utiliser HTTPS.');
    return url.origin;
  }
  if (isProduction) throw new Error('PUBLIC_BASE_URL doit être configuré.');
  return `${req.protocol}://${req.get('host')}`;
}
const safeOriginalName = name => path.basename(name.replaceAll('\\', '/')).replace(/[\x00-\x1f\x7f]/g, '').slice(0, 180);
const removeTemp = file => file?.path ? fs.rm(file.path, { force: true }).catch(() => {}) : Promise.resolve();
const requireUuid = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.get('/api/config', (_req, res) => res.json({
  recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY || null,
  crmConfigured: Boolean(webhookConfig.crm.url),
  productionConfigured: Boolean(webhookConfig.production.url),
  mode: isProduction ? 'production' : 'demonstration',
}));

app.post('/api/quotes', publicLimit, verifyCaptcha, upload.single('file'), asyncRoute(async (req, res) => {
  try {
    let raw;
    try { raw = JSON.parse(req.body.data || '{}'); } catch { throw Object.assign(new Error('Données du formulaire invalides.'), { status: 400 }); }
    const data = validateQuote(raw);
    let sourceFile = null;
    if (req.file) {
      const extension = path.extname(req.file.originalname).toLowerCase();
      if (!await hasValidSignature(req.file.path, extension)) throw Object.assign(new Error('Le contenu du fichier ne correspond pas au format indiqué.'), { status: 400 });
      const storageId = crypto.randomUUID();
      sourceFile = { storage_id: storageId, originalName: safeOriginalName(req.file.originalname), size: req.file.size, extension };
      await fs.rename(req.file.path, path.join(storage.directory('files'), storageId));
    }
    const id = crypto.randomUUID();
    const reference = `KOR-${id.slice(0, 8).toUpperCase()}`;
    const payload = makePayload(data, sourceFile, id);
    const quote = { id, reference, status: 'new', created_at: payload.timestamp, payload, source_file: sourceFile, delivered_at: null };
    try {
      await storage.write('quotes', id, quote);
      await jobs.enqueue('crm', payload, `lead-${id}`, { quoteId: id });
    } catch (e) {
      if (sourceFile) await fs.rm(path.join(storage.directory('files'), sourceFile.storage_id), { force: true });
      await storage.remove('quotes', id);
      throw e;
    }
    void jobs.run();
    res.status(201).json({ reference, crmConfigured: Boolean(webhookConfig.crm.url), message: 'Votre demande a bien été enregistrée.' });
  } catch (e) { await removeTemp(req.file); throw e; }
}));

app.post('/api/contact', publicLimit, verifyCaptcha, asyncRoute(async (req, res) => {
  const data = validateContact(req.body);
  const id = crypto.randomUUID();
  const event = { event_type: 'contact_form_submission', source: 'site_web_agence', timestamp: new Date().toISOString(), lead_id: id, client_info: { contact_name: data.name, email: data.email }, message: data.message };
  await storage.write('contacts', id, event);
  await jobs.enqueue('crm', event, `contact-${id}`);
  void jobs.run();
  res.status(201).json({ message: 'Votre message a bien été enregistré.', crmConfigured: Boolean(webhookConfig.crm.url) });
}));

// Admin endpoints require an API key, a time-based second factor and an allowed IP.
app.get('/api/admin/quotes', tokenLimit, checkAdmin, asyncRoute(async (_req, res) => {
  const quotes = await Promise.all((await storage.list('quotes')).map(id => storage.read('quotes', id)));
  res.json(quotes.filter(Boolean).map(q => ({ id: q.id, reference: q.reference, status: q.status, created_at: q.created_at, client_info: q.payload.client_info, product_type: q.payload.project_lead.product_type, has_file: Boolean(q.source_file) })).sort((a,b) => b.created_at.localeCompare(a.created_at)));
}));
app.get('/api/admin/contacts', tokenLimit, checkAdmin, asyncRoute(async (_req, res) => {
  const contacts = await Promise.all((await storage.list('contacts')).map(id => storage.read('contacts', id)));
  res.json(contacts.filter(Boolean).sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
}));
app.get('/api/admin/integrations', tokenLimit, checkAdmin, asyncRoute(async (_req, res) => {
  const pending = await Promise.all((await storage.list('outbox')).map(id => storage.read('outbox', id)));
  res.json({ configured: { crm: Boolean(webhookConfig.crm.url), automation: Boolean(webhookConfig.automation.url), production: Boolean(webhookConfig.production.url) }, pending: pending.filter(Boolean).reduce((counts, job) => ({ ...counts, [job.destination]: (counts[job.destination] || 0) + 1 }), {}) });
}));
app.get('/api/admin/quotes/:id', tokenLimit, checkAdmin, asyncRoute(async (req, res) => {
  const quote = requireUuid(req.params.id) && await storage.read('quotes', req.params.id);
  if (!quote) return res.status(404).json({ error: 'Dossier introuvable.' });
  const { source_file, ...safe } = quote;
  res.json({ ...safe, has_file: Boolean(source_file) });
}));
app.get('/api/admin/quotes/:id/bat', tokenLimit, checkAdmin, asyncRoute(async (req, res) => {
  const quote = requireUuid(req.params.id) && await storage.read('quotes', req.params.id);
  const bat = quote?.approved_bat && await storage.read('bats', quote.approved_bat);
  if (!bat) return res.status(404).json({ error: 'BAT validé introuvable.' });
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `attachment; filename="${quote.reference}-bat.pdf"`);
  res.sendFile(path.join(storage.directory('proofs'), bat.proof_id));
}));
app.post('/api/admin/quotes/:id/status', tokenLimit, checkAdmin, asyncRoute(async (req, res) => {
  if (!requireUuid(req.params.id)) return res.status(404).json({ error: 'Dossier introuvable.' });
  await storage.withLock('quotes', req.params.id, async () => {
    const quote = await storage.read('quotes', req.params.id);
    if (!quote) return res.status(404).json({ error: 'Dossier introuvable.' });
    const nextStatus = req.body?.status;
    const transitions = { new: ['quote_sent', 'cancelled'], quote_sent: ['quote_validated', 'cancelled'], quote_validated: ['deposit_paid', 'cancelled'], quote_expired: ['quote_sent', 'cancelled'], deposit_paid: ['cancelled'], bat_approved: ['cancelled'] };
    if (!transitions[quote.status]?.includes(nextStatus)) return res.status(400).json({ error: 'Transition de statut non autorisée.' });
    if (nextStatus === 'quote_sent') {
      let url; try { url = new URL(req.body?.quote_url); } catch { return res.status(400).json({ error: 'Lien de devis HTTPS requis.' }); }
      if (url.protocol !== 'https:') return res.status(400).json({ error: 'Lien de devis HTTPS requis.' });
      quote.follow_up = { sent_at: new Date().toISOString(), quote_url: url.href, generation: crypto.randomUUID(), queued: {} };
    }
    quote.status = nextStatus;
    quote.updated_at = new Date().toISOString();
    if (nextStatus === 'quote_sent') await jobs.queueQuoteNotification(quote);
    await storage.write('quotes', quote.id, quote);
    res.json({ reference: quote.reference, status: quote.status });
  });
  void jobs.run();
}));
app.post('/api/admin/quotes/:id/delivered', tokenLimit, checkAdmin, asyncRoute(async (req, res) => {
  if (!requireUuid(req.params.id)) return res.status(404).json({ error: 'Dossier introuvable.' });
  await storage.withLock('quotes', req.params.id, async () => {
    const quote = await storage.read('quotes', req.params.id);
    if (!quote) return res.status(404).json({ error: 'Dossier introuvable.' });
    if (req.body?.confirm !== true || quote.status !== 'bat_approved') return res.status(400).json({ error: 'Confirmez la livraison d’un dossier dont le BAT a été validé.' });
    quote.delivered_at = new Date().toISOString();
    quote.status = 'delivered';
    await storage.write('quotes', quote.id, quote);
    res.json({ reference: quote.reference, delivered_at: quote.delivered_at });
  });
}));
app.post('/api/admin/quotes/:id/file-link', tokenLimit, checkAdmin, asyncRoute(async (req, res) => {
  const quote = requireUuid(req.params.id) && await storage.read('quotes', req.params.id);
  if (!quote?.source_file) return res.status(404).json({ error: 'Fichier introuvable.' });
  const token = newToken(); const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await storage.write('links', tokenHash(token), { quote_id: quote.id, expires_at: expires });
  res.json({ url: `${publicBase(req)}/api/files/${token}`, expires_at: expires, authentication_required: true });
}));
app.get('/api/files/:token', tokenLimit, checkAdmin, asyncRoute(async (req, res) => {
  if (!/^[A-Za-z0-9_-]{43}$/.test(req.params.token)) return res.status(404).json({ error: 'Lien invalide ou expiré.' });
  const link = await storage.read('links', tokenHash(req.params.token));
  if (!link || Date.parse(link.expires_at) < Date.now()) return res.status(404).json({ error: 'Lien invalide ou expiré.' });
  const quote = await storage.read('quotes', link.quote_id);
  if (!quote?.source_file) return res.status(404).json({ error: 'Fichier introuvable.' });
  res.set('Content-Type', 'application/octet-stream');
  res.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(quote.source_file.originalName)}`);
  res.sendFile(path.join(storage.directory('files'), quote.source_file.storage_id));
}));

app.post('/api/admin/bats', tokenLimit, checkAdmin, upload.single('proof'), asyncRoute(async (req, res) => {
  try {
    const quoteId = req.body?.quote_id || '';
    if (!requireUuid(quoteId)) throw Object.assign(new Error('Un dossier validé avec acompte payé est nécessaire.'), { status: 400 });
    if (!req.file || path.extname(req.file.originalname).toLowerCase() !== '.pdf' || !await hasValidSignature(req.file.path, '.pdf')) throw Object.assign(new Error('Le BAT doit être un fichier PDF valide.'), { status: 400 });
    const base = publicBase(req);
    const token = newToken(); const hash = tokenHash(token); const proofId = crypto.randomUUID();
    await storage.withLock('quotes', quoteId, async () => {
      const quote = await storage.read('quotes', quoteId);
      if (!quote || quote.status !== 'deposit_paid') throw Object.assign(new Error('Un dossier validé avec acompte payé est nécessaire.'), { status: 400 });
      const previousHash = quote.pending_bat;
      await fs.rename(req.file.path, path.join(storage.directory('proofs'), proofId));
      const bat = { quote_id: quote.id, proof_id: proofId, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), status: 'pending', approved_at: null };
      try {
        await storage.write('bats', hash, bat);
        quote.pending_bat = hash;
        if (quote.payload.project_lead.file_attachment) quote.payload.project_lead.file_attachment.prepresse_status = 'bat_ready';
        await storage.write('quotes', quote.id, quote);
      } catch (e) {
        await storage.remove('bats', hash);
        await fs.rm(path.join(storage.directory('proofs'), proofId), { force: true });
        throw e;
      }
      if (previousHash && previousHash !== hash) {
        const previous = await storage.read('bats', previousHash);
        if (previous?.status === 'pending') {
          await fs.rm(path.join(storage.directory('proofs'), previous.proof_id), { force: true });
          await storage.remove('bats', previousHash);
        }
      }
      res.status(201).json({ client_url: `${base}/?bat=${token}`, expires_at: bat.expires_at });
    });
  } catch (e) { await removeTemp(req.file); throw e; }
}));
async function findBat(token) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const hash = tokenHash(token); const bat = await storage.read('bats', hash);
  if (!bat || Date.parse(bat.expires_at) < Date.now()) return null;
  const quote = await storage.read('quotes', bat.quote_id);
  if (!quote || quote.status === 'cancelled' || (quote.pending_bat !== hash && quote.approved_bat !== hash)) return null;
  return { bat, quote, hash };
}
app.get('/api/bat/:token', tokenLimit, asyncRoute(async (req, res) => {
  const result = await findBat(req.params.token);
  if (!result) return res.status(404).json({ error: 'Ce lien BAT est invalide ou a expiré. Demandez un nouveau lien à l’agence.' });
  const { bat, quote, hash } = result;
  res.json({ reference: quote.reference, product: quote.payload.project_lead.specifications.product_name || quote.payload.project_lead.product_type, status: quote.approved_bat === hash ? 'approved' : 'pending', expires_at: bat.expires_at, approved_at: quote.bat_approved_at || null, productionConfigured: Boolean(webhookConfig.production.url) });
}));
app.get('/api/bat/:token/file', tokenLimit, asyncRoute(async (req, res) => {
  const result = await findBat(req.params.token);
  if (!result) return res.status(404).json({ error: 'Lien BAT invalide ou expiré.' });
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', 'inline; filename="bon-a-tirer.pdf"');
  res.sendFile(path.join(storage.directory('proofs'), result.bat.proof_id));
}));
app.post('/api/bat/:token/approve', tokenLimit, asyncRoute(async (req, res) => {
  if (req.body?.confirm !== true) return res.status(400).json({ error: 'Confirmez votre validation du BAT.' });
  const initial = await findBat(req.params.token);
  if (!initial) return res.status(404).json({ error: 'Lien BAT invalide ou expiré.' });
  await storage.withLock('quotes', initial.quote.id, async () => {
    const result = await findBat(req.params.token);
    if (!result) return res.status(404).json({ error: 'Lien BAT invalide ou expiré.' });
    const { bat, quote, hash } = result;
    if (quote.approved_bat !== hash && quote.status !== 'deposit_paid') return res.status(409).json({ error: 'Ce dossier ne peut plus être validé. Contactez l’agence.' });
    const approvedAt = quote.bat_approved_at || new Date().toISOString();
    if (quote.payload.project_lead.file_attachment) quote.payload.project_lead.file_attachment.prepresse_status = 'bat_approved';
    // Queue the work order first; the worker only sends it after the approved record is persisted.
    await jobs.enqueue('production', { event_type: 'bat_approved', timestamp: approvedAt, lead_id: quote.id, reference: quote.reference, client_info: quote.payload.client_info, project_lead: quote.payload.project_lead, work_order: { bat_status: 'approved', source_file_available: Boolean(quote.source_file) } }, `bat-${hash}`, { quoteId: quote.id, approvedBat: hash });
    if (quote.approved_bat !== hash) {
      quote.status = 'bat_approved'; quote.approved_bat = hash; quote.pending_bat = null; quote.bat_approved_at = approvedAt;
      await storage.write('quotes', quote.id, quote);
    }
    if (bat.status !== 'approved') { bat.status = 'approved'; bat.approved_at = approvedAt; await storage.write('bats', hash, bat); }
    res.json({ status: 'approved', approved_at: approvedAt, productionConfigured: Boolean(webhookConfig.production.url) });
  });
  void jobs.run();
}));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Route introuvable.' }));
app.use((error, req, res, _next) => {
  void removeTemp(req.file);
  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE' ? 'Le fichier dépasse la limite de 1 Go.' : 'Le fichier ou le formulaire dépasse les limites autorisées.';
    return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: message });
  }
  console.error('Erreur de requête :', error.status ? error.message : 'erreur interne');
  res.status(error.status || 500).json({ error: error.status ? error.message : 'Une erreur est survenue. Veuillez réessayer.' });
});

if (isProduction) {
  app.use(express.static(path.join(projectRoot, 'dist'), { maxAge: '1h', index: false }));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(projectRoot, 'dist', 'index.html')));
} else {
  // Vite's development server must never expose the local private storage directory.
  app.use((req, res, next) => {
    try {
      const requested = decodeURIComponent(req.path);
      const candidate = requested.startsWith('/@fs/') ? path.resolve('/' + requested.slice(5)) : path.resolve(projectRoot, '.' + requested);
      if (candidate === privateRoot || candidate.startsWith(privateRoot + path.sep)) return res.status(404).end();
      next();
    } catch { res.status(400).end(); }
  });
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true, host: '0.0.0.0', allowedHosts: true, hmr: { server } }, appType: 'spa' });
  app.use(vite.middlewares);
}
const port = Number(process.env.PORT || 5173);
server.requestTimeout = 60 * 60 * 1000;
server.headersTimeout = 60 * 1000;
server.listen(port, '0.0.0.0', () => console.log(`KORA disponible sur le port ${port}`));
void jobs.run();
setInterval(() => void jobs.run(), 60 * 1000).unref();
