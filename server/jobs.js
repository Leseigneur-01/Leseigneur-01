import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export function createJobs(storage, config) {
  let busy = false;
  let rerun = false;
  async function enqueue(destination, payload, id = crypto.randomUUID(), condition = null) {
    await storage.withLock('outbox', id, async () => {
      const existing = await storage.read('outbox', id) || await storage.read('processed', id);
      if (!existing) await storage.write('outbox', id, { id, destination, payload, condition, attempts: 0, next_attempt: new Date().toISOString() });
    });
  }
  async function processOutbox() {
    for (const id of await storage.list('outbox')) {
      const job = await storage.read('outbox', id);
      if (!job || Date.parse(job.next_attempt) > Date.now()) continue;
      if (await storage.read('processed', id)) { await storage.remove('outbox', id); continue; }
      const target = config.webhooks[job.destination];
      if (!target?.url) continue;
      const send = async () => {
        if (job.condition) {
          const quote = await storage.read('quotes', job.condition.quoteId);
          if (job.condition.approvedBat) {
            if (!quote || (quote.approved_bat === job.condition.approvedBat && quote.status !== 'bat_approved') || (quote.approved_bat !== job.condition.approvedBat && (quote.status !== 'deposit_paid' || quote.pending_bat !== job.condition.approvedBat))) {
              await storage.remove('outbox', id); return;
            }
            // The event can be queued just before the approval record is saved.
            if (quote.approved_bat !== job.condition.approvedBat) return;
          } else if (!quote || (job.condition.status && quote.status !== job.condition.status) || (job.condition.allowedStatuses && !job.condition.allowedStatuses.includes(quote.status)) || (job.condition.generation && quote.follow_up?.generation !== job.condition.generation)) {
            await storage.remove('outbox', id); return;
          }
        }
        try {
          const body = JSON.stringify(job.payload);
          const headers = { 'content-type': 'application/json', 'x-kora-event-id': id, 'idempotency-key': id };
          if (target.secret) headers['x-kora-signature'] = `sha256=${crypto.createHmac('sha256', target.secret).update(body).digest('hex')}`;
          const response = await fetch(target.url, { method: 'POST', headers, body, signal: AbortSignal.timeout(10000), redirect: 'error' });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          await storage.withLock('outbox', id, async () => {
            await storage.write('processed', id, { delivered_at: new Date().toISOString(), destination: job.destination });
            await storage.remove('outbox', id);
          });
        } catch {
          job.attempts += 1;
          job.next_attempt = new Date(Date.now() + Math.min(6 * HOUR, 30_000 * 2 ** Math.min(job.attempts, 10))).toISOString();
          await storage.write('outbox', id, job);
          console.warn(`Webhook ${job.destination} indisponible : événement conservé pour une nouvelle tentative.`);
        }
      };
      if (job.condition?.quoteId) await storage.withLock('quotes', job.condition.quoteId, send);
      else await send();
    }
  }
  function automationPayload(quote, kind) {
    const client = quote.payload.client_info;
    const product = quote.payload.project_lead.specifications.product_name || quote.payload.project_lead.product_type;
    const quantity = quote.payload.project_lead.specifications.quantity;
    const url = quote.follow_up.quote_url;
    const agency = config.agencyName;
    const base = { lead_id: quote.id, reference: quote.reference, client_info: client, quote_url: url, product_name: product, quantity };
    if (kind === 'notification') return {
      ...base, event_type: 'quote_sent_notification', channels: ['email', 'sms'],
      email: { subject: `Votre devis - ${agency}`, body: `Bonjour ${client.contact_name},\n\nNotre département technique a étudié votre demande pour ${product}${quantity ? ` (quantité : ${quantity})` : ''}. Consultez et signez votre devis ici : ${url}\n\nAprès signature et paiement de l’acompte, votre fichier pourra être préparé pour le bon à tirer avant impression.\n\nL’équipe Relation Client\n${agency}` },
      sms: `Bonjour ${client.contact_name}, votre devis ${agency} est disponible : ${url}`,
    };
    if (kind === 'follow_up_48h') return {
      ...base, event_type: 'quote_follow_up_48h', channels: ['whatsapp', 'email', 'crm_task'],
      whatsapp: `Bonjour ${client.contact_name}, c’est l’équipe commerciale de ${agency}. Notre proposition pour ${product} vous convient-elle ? Des modifications à apporter aux quantités, supports ou finitions ? Répondez-nous ici ou consultez votre devis : ${url}. Excellente journée !`,
      email: { subject: `Un point sur votre projet ${product}`, body: `Bonjour ${client.contact_name},\n\nAvez-vous des questions ou des ajustements à apporter à notre proposition ? Nous sommes à votre disposition. Retrouvez votre devis : ${url}\n\nL’équipe ${agency}` },
      task: { priority: 'high', title: `Relance téléphonique — ${client.contact_name}`, description: `Appeler ${client.contact_name} (${client.company_name}) au ${client.phone} concernant le devis envoyé il y a 48 heures.` },
    };
    return {
      ...base, event_type: 'quote_validity_96h', channels: ['email'],
      email: { subject: `Validité de votre devis — ${product}`, body: `Bonjour ${client.contact_name},\n\nLes options tarifaires réservées pour votre projet arrivent à expiration sous 48 heures. Le coût des matières premières nous conduit à limiter la validité de nos offres. Si votre projet est toujours d’actualité, consultez votre devis : ${url}\n\nPassé ce délai, le devis pourra être réétudié.\n\nLa Direction Commerciale\n${agency}` },
    };
  }
  async function queueQuoteNotification(quote) {
    const kind = 'notification';
    await enqueue('automation', automationPayload(quote, kind), `auto-${quote.id}-${quote.follow_up.generation}-${kind}`, { quoteId: quote.id, allowedStatuses: ['quote_sent', 'quote_validated', 'deposit_paid', 'bat_approved'], generation: quote.follow_up.generation });
    quote.follow_up.queued[kind] = new Date().toISOString();
  }
  async function processAutomations() {
    for (const id of await storage.list('quotes')) {
      await storage.withLock('quotes', id, async () => {
        const quote = await storage.read('quotes', id);
        if (!quote || quote.status !== 'quote_sent' || !quote.follow_up?.sent_at) return;
        const elapsed = Date.now() - Date.parse(quote.follow_up.sent_at);
        const stages = [['notification', 0], ['follow_up_48h', 48 * HOUR], ['validity_96h', 96 * HOUR]];
        for (const [kind, delay] of stages) {
          if (elapsed >= delay && !quote.follow_up.queued[kind]) {
            if (kind === 'notification') await queueQuoteNotification(quote);
            else {
              await enqueue('automation', automationPayload(quote, kind), `auto-${id}-${quote.follow_up.generation}-${kind}`, { quoteId: id, status: 'quote_sent', generation: quote.follow_up.generation });
              quote.follow_up.queued[kind] = new Date().toISOString();
            }
          }
        }
        if (elapsed >= 144 * HOUR) {
          quote.status = 'quote_expired';
          quote.expired_at = new Date().toISOString();
          await enqueue('crm', { event_type: 'quote_expired', lead_id: id, timestamp: quote.expired_at }, `expired-${id}-${quote.follow_up.generation}`);
        }
        await storage.write('quotes', id, quote);
      });
    }
  }
  async function cleanup() {
    for (const id of await storage.list('quotes')) {
      await storage.withLock('quotes', id, async () => {
        const quote = await storage.read('quotes', id);
        if (!quote?.delivered_at || !quote.source_file || Date.now() - Date.parse(quote.delivered_at) < 30 * DAY) return;
        await fs.rm(path.join(storage.directory('files'), quote.source_file.storage_id), { force: true });
        quote.source_file = null;
        if (quote.payload.project_lead.file_attachment) {
          quote.payload.project_lead.file_attachment.prepresse_status = 'deleted_after_retention';
          quote.payload.project_lead.file_attachment.file_url = null;
        }
        await storage.write('quotes', id, quote);
        await storage.withLock('outbox', `lead-${id}`, async () => {
          const pendingLead = await storage.read('outbox', `lead-${id}`);
          if (pendingLead?.payload?.project_lead?.file_attachment) {
            pendingLead.payload.project_lead.file_attachment.prepresse_status = 'deleted_after_retention';
            pendingLead.payload.project_lead.file_attachment.file_url = null;
            await storage.write('outbox', `lead-${id}`, pendingLead);
          }
        });
      });
    }
    // Expired, unapproved proofs are not archives; keep approved BATs only.
    for (const hash of await storage.list('bats')) {
      const current = await storage.read('bats', hash);
      if (!current || Date.parse(current.expires_at) >= Date.now()) continue;
      await storage.withLock('quotes', current.quote_id, async () => {
        const bat = await storage.read('bats', hash);
        const quote = await storage.read('quotes', current.quote_id);
        if (!bat || Date.parse(bat.expires_at) >= Date.now() || quote?.approved_bat === hash) return;
        if (quote?.pending_bat === hash) {
          quote.pending_bat = null;
          if (quote.payload.project_lead.file_attachment) quote.payload.project_lead.file_attachment.prepresse_status = 'bat_expired';
          await storage.write('quotes', quote.id, quote);
        }
        await fs.rm(path.join(storage.directory('proofs'), bat.proof_id), { force: true });
        await storage.remove('bats', hash);
      });
    }
    for (const id of await storage.list('links')) {
      const link = await storage.read('links', id);
      if (link && Date.parse(link.expires_at) < Date.now()) await storage.remove('links', id);
    }
    for (const name of await fs.readdir(storage.directory('tmp'))) {
      const file = path.join(storage.directory('tmp'), name);
      const stat = await fs.stat(file).catch(() => null);
      if (stat && Date.now() - stat.mtimeMs > DAY) await fs.rm(file, { force: true });
    }
  }
  async function run() {
    if (busy) { rerun = true; return; }
    busy = true;
    try { await processAutomations(); await processOutbox(); await cleanup(); }
    catch (err) { console.error('Traitement des tâches en attente impossible :', err.message); }
    finally { busy = false; if (rerun) { rerun = false; queueMicrotask(() => void run()); } }
  }
  return { enqueue, queueQuoteNotification, run, cleanup };
}
