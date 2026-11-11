import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { tokenHash, totp } from '../server/core.js';

const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const apiKey = 'test-administrateur-cle-longue-123456789';
const quoteData = { company: 'Atelier Test', contact: 'Awa Koffi', email: 'awa@example.ci', phone: '+2250707070707', projectType: 'Impression de supports', category: 'Petit format', product: 'Brochure', format: 'A4', paper: 'Couché mat', grammage: '135 g/m²', printSide: 'Recto / verso', colors: 'CMJN', finishings: [], quantity: 500, delivery: 'Retrait à l’agence', consent: true };

async function freePort() {
  const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port;
}
function makeForm(data, name = 'projet.pdf', contents = '%PDF-1.7\nexample') {
  const form = new FormData(); form.append('data', JSON.stringify(data)); if (name) form.append('file', new Blob([contents], { type: 'application/pdf' }), name); return form;
}

test('parcours HTTP : devis, fichier privé, statuts, BAT et ordre de fabrication', { timeout: 30000 }, async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kora-http-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const events = []; let notify = () => {};
  const sink = http.createServer((req, res) => { let body = ''; req.on('data', chunk => { body += chunk; }); req.on('end', () => { events.push(JSON.parse(body)); res.writeHead(204); res.end(); notify(); }); });
  await new Promise(resolve => sink.listen(0, '127.0.0.1', resolve)); t.after(() => sink.close());
  const webhook = `http://127.0.0.1:${sink.address().port}`;
  const port = await freePort(); const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server/index.js'], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'development', PORT: String(port), PRIVATE_STORAGE_DIR: root, PUBLIC_BASE_URL: base, ADMIN_API_KEY: apiKey, ADMIN_TOTP_SECRET: secret, ADMIN_ALLOW_IPS: '127.0.0.1', CRM_WEBHOOK_URL: webhook, AUTOMATION_WEBHOOK_URL: webhook, PRODUCTION_WEBHOOK_URL: webhook }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => child.kill('SIGTERM'));
  let logs = ''; child.stderr.on('data', data => { logs += data.toString(); });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Serveur non démarré : ${logs}`)), 12000);
    child.stdout.on('data', data => { if (data.toString().includes('KORA disponible')) { clearTimeout(timer); resolve(); } });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Serveur arrêté (${code}) : ${logs}`)); });
  });
  const auth = () => ({ Authorization: `Bearer ${apiKey}`, 'X-Admin-TOTP': totp(secret) });
  const json = async (url, options = {}) => { const response = await fetch(base + url, options); const body = await response.json(); return { response, body }; };
  const adminPost = (url, body) => json(url, { method: 'POST', headers: { ...auth(), 'content-type': 'application/json' }, body: JSON.stringify(body) });
  let result = await json('/api/admin/quotes'); assert.equal(result.response.status, 403);
  result = await json('/api/admin/quotes', { headers: { Authorization: `Bearer ${apiKey}`, 'X-Admin-TOTP': '000000' } }); assert.equal(result.response.status, 403);
  result = await json('/api/quotes', { method: 'POST', headers: { origin: 'https://malicious.example' }, body: makeForm(quoteData) }); assert.equal(result.response.status, 403);
  result = await json('/api/quotes', { method: 'POST', body: makeForm(quoteData, 'fake.pdf', 'not a pdf') }); assert.equal(result.response.status, 400);
  assert.deepEqual(await fs.readdir(path.join(root, 'tmp')), []);
  result = await json('/api/quotes', { method: 'POST', body: makeForm(quoteData) }); assert.equal(result.response.status, 201); assert.match(result.body.reference, /^KOR-/);
  result = await json('/api/admin/quotes', { headers: auth() }); assert.equal(result.body.length, 1); const id = result.body[0].id;
  const savedQuote = JSON.parse(await fs.readFile(path.join(root, 'quotes', `${id}.json`), 'utf8'));
  assert.equal((await fetch(`${base}/@fs${root}/files/${savedQuote.source_file.storage_id}`)).status, 404, 'Vite ne doit pas servir le stockage privé');
  result = await adminPost(`/api/admin/quotes/${id}/file-link`, {}); assert.equal(result.response.status, 200); assert.equal(result.body.authentication_required, true);
  const fileUrl = result.body.url; const token = new URL(fileUrl).pathname.split('/').pop();
  assert.equal((await fetch(fileUrl)).status, 403);
  const download = await fetch(fileUrl, { headers: auth() }); assert.equal(download.status, 200); assert.match(await download.text(), /^%PDF-/);
  const linkFile = path.join(root, 'links', `${tokenHash(token)}.json`); const link = JSON.parse(await fs.readFile(linkFile, 'utf8')); link.expires_at = new Date(0).toISOString(); await fs.writeFile(linkFile, JSON.stringify(link));
  assert.equal((await fetch(fileUrl, { headers: auth() })).status, 404);
  result = await adminPost(`/api/admin/quotes/${id}/delivered`, { confirm: true }); assert.equal(result.response.status, 400);
  result = await adminPost(`/api/admin/quotes/${id}/status`, { status: 'quote_sent', quote_url: 'https://example.ci/devis/123' }); assert.equal(result.body.status, 'quote_sent');
  result = await adminPost(`/api/admin/quotes/${id}/status`, { status: 'quote_validated' }); assert.equal(result.body.status, 'quote_validated');
  result = await adminPost(`/api/admin/quotes/${id}/status`, { status: 'deposit_paid' }); assert.equal(result.body.status, 'deposit_paid');
  const createBat = async () => { const form = new FormData(); form.append('quote_id', id); form.append('proof', new Blob(['%PDF-1.7\nproof'], { type: 'application/pdf' }), 'bat.pdf'); return json('/api/admin/bats', { method: 'POST', headers: auth(), body: form }); };
  const first = await createBat(); assert.equal(first.response.status, 201); const firstToken = new URL(first.body.client_url).searchParams.get('bat');
  const second = await createBat(); assert.equal(second.response.status, 201); const batToken = new URL(second.body.client_url).searchParams.get('bat');
  assert.equal((await fetch(`${base}/api/bat/${firstToken}`)).status, 404, 'un BAT remplacé ne peut plus être validé');
  result = await json(`/api/bat/${batToken}`); assert.equal(result.body.status, 'pending');
  const preview = await fetch(`${base}/api/bat/${batToken}/file`); assert.equal(preview.status, 200); assert.equal(preview.headers.get('content-type'), 'application/pdf');
  result = await json(`/api/bat/${batToken}/approve`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm: false }) }); assert.equal(result.response.status, 400);
  const waitProduction = new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Ordre de fabrication non transmis')), 8000); notify = () => { if (events.some(e => e.event_type === 'bat_approved')) { clearTimeout(timer); resolve(); } }; });
  const approval = () => json(`/api/bat/${batToken}/approve`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm: true }) });
  const approvals = await Promise.all([approval(), approval()]);
  assert.ok(approvals.every(item => item.body.status === 'approved'));
  await waitProduction;
  assert.equal(events.filter(e => e.event_type === 'bat_approved').length, 1, 'des validations simultanées ne créent pas deux ordres');
  const workOrder = events.find(e => e.event_type === 'bat_approved'); assert.equal(workOrder.project_lead.file_attachment.prepresse_status, 'bat_approved');
  const leadEvent = events.find(e => e.event_type === 'web_form_submission');
  assert.equal(leadEvent.client_info.email, 'awa@example.ci'); assert.equal(leadEvent.project_lead.file_attachment.file_url, null);
  result = await json(`/api/admin/quotes/${id}`, { headers: auth() }); assert.equal(result.body.status, 'bat_approved');
  const archivedBat = await fetch(`${base}/api/admin/quotes/${id}/bat`, { headers: auth() }); assert.equal(archivedBat.status, 200); assert.match(await archivedBat.text(), /^%PDF-/);
  result = await adminPost(`/api/admin/quotes/${id}/delivered`, { confirm: true }); assert.equal(result.response.status, 200);
  result = await json(`/api/bat/${batToken}`); assert.equal(result.body.status, 'approved');
});

test('en production, les formulaires échouent sans HTTPS et sans reCAPTCHA', { timeout: 20000 }, async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kora-production-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const port = await freePort(); const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server/index.js'], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'production', PORT: String(port), PRIVATE_STORAGE_DIR: root, TRUST_PROXY: '1', PUBLIC_BASE_URL: 'https://example.ci', RECAPTCHA_SITE_KEY: '', RECAPTCHA_SECRET_KEY: '', CRM_WEBHOOK_URL: '', AUTOMATION_WEBHOOK_URL: '', PRODUCTION_WEBHOOK_URL: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => child.kill('SIGTERM'));
  let logs = ''; child.stderr.on('data', data => { logs += data.toString(); });
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error(logs || 'Démarrage impossible')), 10000); child.stdout.on('data', data => { if (data.toString().includes('KORA disponible')) { clearTimeout(timer); resolve(); } }); child.once('exit', code => { clearTimeout(timer); reject(new Error(`Arrêt ${code}: ${logs}`)); }); });
  const request = { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Awa', email: 'awa@example.ci', message: 'Bonjour', consent: true }) };
  assert.equal((await fetch(`${base}/api/contact`, request)).status, 403);
  const response = await fetch(`${base}/api/contact`, { ...request, headers: { ...request.headers, 'x-forwarded-proto': 'https' } });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /anti-spam/);
  assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN');
});
