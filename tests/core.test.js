import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createStorage, hasValidSignature, makePayload, totp, validateQuote, verifyTotp } from '../server/core.js';
import { createJobs } from '../server/jobs.js';

const base = {
  company: 'Entreprise CI', contact: 'Awa Koffi', email: 'awa@example.ci', phone: '+225 07 07 07 07 07', district: 'Marcory',
  projectType: 'Impression de supports', category: 'Petit format', product: 'Brochure', format: 'A4',
  paper: 'Couché mat', grammage: '135 g/m²', printSide: 'Recto / verso', colors: 'CMJN',
  finishings: ['Dos carré collé', 'Pelliculage mat'], quantity: 500, delivery: 'Retrait à l’agence', consent: true,
};

test('le deviseur valide les branches petit, grand et création, puis produit le payload CRM', () => {
  const small = validateQuote(base);
  const payload = makePayload(small, { originalName: 'brochure.pdf', size: 145 * 1024 * 1024 }, 'id-test', new Date('2026-11-09T07:19:00Z'));
  assert.equal(payload.event_type, 'web_form_submission');
  assert.equal(payload.client_info.phone, '+2250707070707');
  assert.equal(payload.project_lead['assigned_pôle'], 'Technique et Imprimerie');
  assert.equal(payload.project_lead.specifications.quantity, 500);
  assert.deepEqual(payload.project_lead.specifications.finishing_options, ['Dos carré collé', 'Pelliculage mat']);
  assert.equal(payload.project_lead.file_attachment.file_url, null);
  assert.equal(payload.project_lead.file_attachment.file_size_mb, 145);
  const large = validateQuote({ ...base, projectType: 'Projet 360°', category: 'Grand format / Signalétique', product: 'Bâche', width: '2', height: '1.5', support: 'Vinyle', fixings: ['Aux 4 coins'], lamination: 'Anti-UV mate', delivery: 'Livraison sur site / Pose', deliveryAddress: 'Cocody' });
  assert.deepEqual(makePayload(large, null, 'id').project_lead.specifications.dimensions_m, { width: 2, height: 1.5 });
  const creative = validateQuote({ ...base, projectType: 'Conseil & création', service: 'Identité visuelle', brief: 'Nouvelle identité', desiredDate: '2026-12-01', additionalDetails: 'Couleurs vives' });
  assert.equal(makePayload(creative, null, 'id').project_lead.additional_details, 'Couleurs vives');
  assert.equal(makePayload(creative, null, 'id').project_lead.desired_date, '2026-12-01');
  assert.throws(() => validateQuote({ ...base, phone: '0707070707' }), /téléphone/i);
  assert.throws(() => validateQuote({ ...base, quantity: 0 }), /quantité/i);
  assert.throws(() => validateQuote({ ...base, consent: false }), /accord/i);
  assert.throws(() => validateQuote({ ...base, website: 'spam' }), /invalide/i);
  assert.throws(() => validateQuote({ ...large, fixings: ['Aucune', 'Aux 4 coins'] }), /fixations/i);
});

test('les signatures des fichiers et le deuxième facteur sont vérifiés', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kora-signature-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'file');
  for (const [ext, bytes] of [['.pdf', Buffer.from('%PDF-1.7')], ['.ai', Buffer.from('%!PS-Adobe')], ['.psd', Buffer.from('8BPS')], ['.indd', Buffer.from('0606edf5d81d46e5bd31efe7fe74b71d', 'hex')]]) {
    await fs.writeFile(file, bytes); assert.equal(await hasValidSignature(file, ext), true);
  }
  await fs.writeFile(file, 'not a PDF'); assert.equal(await hasValidSignature(file, '.pdf'), false);
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  assert.equal(totp(secret, 59000), '287082');
  assert.equal(verifyTotp(secret, '287082', 59000), true);
  assert.equal(verifyTotp(secret, '000000', 59000), false);
});

test('les relances sont mises en file selon le statut, et les sources sont purgées 30 jours après livraison', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kora-jobs-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const storage = createStorage(root); await storage.init();
  const events = [];
  const endpoint = http.createServer((req, res) => { let body = ''; req.on('data', b => { body += b; }); req.on('end', () => { events.push({ body: JSON.parse(body), key: req.headers['idempotency-key'], signature: req.headers['x-kora-signature'] }); res.writeHead(204); res.end(); }); });
  await new Promise(resolve => endpoint.listen(0, '127.0.0.1', resolve)); t.after(() => endpoint.close());
  const url = `http://127.0.0.1:${endpoint.address().port}`;
  const jobs = createJobs(storage, { webhooks: { crm: {}, production: { url, secret: 'secret-test' }, automation: { url, secret: 'secret-test' } }, agencyName: 'Agence Test' });
  const id = 'test-lead'; const quote = { id, reference: 'KOR-TEST', status: 'quote_sent', payload: makePayload(validateQuote(base), null, id), follow_up: { sent_at: new Date(Date.now() - 97 * 3600000).toISOString(), quote_url: 'https://example.ci/devis', generation: 'generation', queued: {} } };
  await storage.write('quotes', id, quote); await jobs.run();
  assert.deepEqual(events.map(e => e.body.event_type).sort(), ['quote_follow_up_48h', 'quote_sent_notification', 'quote_validity_96h']);
  assert.ok(events.every(e => e.key && e.signature.startsWith('sha256=')));
  await jobs.run(); assert.equal(events.length, 3, 'pas de relance dupliquée');
  const updated = await storage.read('quotes', id); updated.status = 'quote_validated'; await storage.write('quotes', id, updated);
  await storage.write('outbox', 'stale', { id: 'stale', destination: 'automation', payload: { event_type: 'stale' }, condition: { quoteId: id, status: 'quote_sent', generation: 'generation' }, attempts: 0, next_attempt: new Date(0).toISOString() });
  await jobs.run(); assert.equal(events.length, 3, 'aucune relance après validation'); assert.equal(await storage.read('outbox', 'stale'), null);
  const cancelled = { ...updated, status: 'cancelled', approved_bat: 'bat-hash' }; await storage.write('quotes', id, cancelled);
  await jobs.enqueue('production', { event_type: 'bat_approved' }, 'cancelled-work-order', { quoteId: id, approvedBat: 'bat-hash' });
  await jobs.run(); assert.equal(events.length, 3, 'aucun ordre de fabrication après annulation'); assert.equal(await storage.read('outbox', 'cancelled-work-order'), null);
  const sourceId = 'source-file'; await fs.writeFile(path.join(storage.directory('files'), sourceId), 'source');
  const delivered = { ...updated, status: 'delivered', delivered_at: new Date(Date.now() - 31 * 86400000).toISOString(), source_file: { storage_id: sourceId }, payload: makePayload(validateQuote(base), { originalName: 'source.pdf', size: 10 }, id) };
  await storage.write('quotes', id, delivered);
  await jobs.enqueue('crm', delivered.payload, `lead-${id}`, { quoteId: id });
  await jobs.cleanup();
  assert.equal((await storage.read('quotes', id)).source_file, null);
  assert.equal((await storage.read('quotes', id)).payload.project_lead.file_attachment.prepresse_status, 'deleted_after_retention');
  assert.equal((await storage.read('outbox', `lead-${id}`)).payload.project_lead.file_attachment.prepresse_status, 'deleted_after_retention');
  await assert.rejects(fs.stat(path.join(storage.directory('files'), sourceId)), { code: 'ENOENT' });
  await fs.writeFile(path.join(storage.directory('proofs'), 'unapproved-proof'), 'proof');
  await storage.write('bats', 'expired-bat', { quote_id: id, proof_id: 'unapproved-proof', status: 'pending', expires_at: new Date(0).toISOString() });
  const withPendingBat = await storage.read('quotes', id); withPendingBat.pending_bat = 'expired-bat'; await storage.write('quotes', id, withPendingBat);
  await jobs.cleanup();
  assert.equal(await storage.read('bats', 'expired-bat'), null);
  assert.equal((await storage.read('quotes', id)).pending_bat, null);
  await assert.rejects(fs.stat(path.join(storage.directory('proofs'), 'unapproved-proof')), { code: 'ENOENT' });
});
