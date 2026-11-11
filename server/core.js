import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const MAX_FILE_SIZE = 1024 * 1024 * 1024;
export const ALLOWED_EXTENSIONS = new Set(['.pdf', '.ai', '.psd', '.indd']);
export const PROJECT_TYPES = ['Conseil & création', 'Impression de supports', 'Projet 360°'];
export const CATEGORIES = ['Petit format', 'Grand format / Signalétique'];
export const SMALL_PRODUCTS = ['Brochure', 'Dépliant', 'Flyer', 'Affiche', 'Magazine', 'Carte de visite', 'Autre'];
export const LARGE_PRODUCTS = ['Bâche', 'Roll-up', 'Enseigne', 'Autocollant', 'Covering', 'Autre'];
export const SERVICES = ['Stratégie de marque', 'Identité visuelle', 'Création graphique / PAO', 'Contenus & digital', 'Autre'];
export const SMALL_FINISHES = ['Dos carré collé', 'Piqûre métal', 'Plis simples', 'Pelliculage mat', 'Pelliculage brillant', 'Vernis sélectif'];
export const FIXINGS = ['Tous les 50 cm', 'Aux 4 coins', 'Aucune'];

const str = (value, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const present = (value) => typeof value === 'string' && value.trim().length > 0;
const inList = (value, list) => list.includes(value);
const positiveNumber = (value) => Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) <= 100000;
const error = (message) => Object.assign(new Error(message), { status: 400 });

export function validateQuote(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw error('La demande est invalide.');
  if (present(raw.website)) throw error('La demande est invalide.');
  const data = {
    company: str(raw.company, 150), contact: str(raw.contact, 150),
    email: str(raw.email, 254), phone: str(raw.phone, 32).replace(/[\s().-]/g, ''),
    district: str(raw.district, 150), projectType: str(raw.projectType, 60),
    category: str(raw.category, 80), product: str(raw.product, 100), service: str(raw.service, 100),
    brief: str(raw.brief, 4000), format: str(raw.format, 30), customWidth: str(raw.customWidth, 20),
    customHeight: str(raw.customHeight, 20), width: str(raw.width, 20), height: str(raw.height, 20),
    paper: str(raw.paper, 60), grammage: str(raw.grammage, 20), printSide: str(raw.printSide, 30),
    colors: str(raw.colors, 50), support: str(raw.support, 60), lamination: str(raw.lamination, 60),
    finishings: Array.isArray(raw.finishings) ? raw.finishings.filter((v) => inList(v, SMALL_FINISHES)) : [],
    fixings: Array.isArray(raw.fixings) ? raw.fixings.filter((v) => inList(v, FIXINGS)) : [],
    quantity: raw.quantity === '' || raw.quantity == null ? null : Number(raw.quantity),
    delivery: str(raw.delivery, 60), deliveryAddress: str(raw.deliveryAddress, 500), desiredDate: str(raw.desiredDate, 10), additionalDetails: str(raw.additionalDetails, 2000), consent: raw.consent === true,
  };
  if (!data.company || !data.contact) throw error('Renseignez le nom de l’entreprise et de votre contact.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) throw error('Renseignez une adresse e-mail valide.');
  if (!/^\+225\d{10}$/.test(data.phone)) throw error('Le téléphone doit être au format +225 suivi de 10 chiffres.');
  if (!inList(data.projectType, PROJECT_TYPES)) throw error('Choisissez un type de projet.');
  if (!data.consent) throw error('Votre accord est nécessaire pour traiter votre demande.');
  if (data.projectType === 'Conseil & création') {
    if (!inList(data.service, SERVICES) || !data.brief) throw error('Précisez votre besoin en création et décrivez votre projet.');
    return data;
  }
  if (!inList(data.category, CATEGORIES)) throw error('Choisissez une catégorie de support.');
  const small = data.category === 'Petit format';
  if (!inList(data.product, small ? SMALL_PRODUCTS : LARGE_PRODUCTS)) throw error('Choisissez un produit.');
  if (!inList(data.printSide, ['Recto', 'Recto / verso']) || !inList(data.colors, ['CMJN', 'Noir et blanc'])) throw error('Précisez le type d’impression.');
  if (small) {
    if (!inList(data.format, ['A4', 'A3', 'A5', 'Personnalisé'])) throw error('Choisissez un format.');
    if (data.format === 'Personnalisé' && (!positiveNumber(data.customWidth) || !positiveNumber(data.customHeight))) throw error('Renseignez les dimensions du format personnalisé.');
    if (!inList(data.paper, ['Couché mat', 'Couché brillant', 'Offset'])) throw error('Choisissez un papier.');
    if (!inList(data.grammage, ['135 g/m²', '250 g/m²', '350 g/m²', '400 g/m²'])) throw error('Choisissez un grammage.');
  } else {
    if (!positiveNumber(data.width) || !positiveNumber(data.height)) throw error('Renseignez des dimensions valides.');
    if (!inList(data.support, ['Bâche Pro', 'Vinyle', 'PVC', 'Alucobond'])) throw error('Choisissez un support.');
    if (data.fixings.length === 0 || (data.fixings.includes('Aucune') && data.fixings.length > 1)) throw error('Choisissez les fixations souhaitées.');
    if (!inList(data.lamination, ['Anti-UV mate', 'Anti-UV brillante', 'Aucune'])) throw error('Choisissez une lamination.');
  }
  if (!Number.isSafeInteger(data.quantity) || data.quantity < 1 || data.quantity > 100000000) throw error('Renseignez une quantité valide.');
  if (!inList(data.delivery, ['Retrait à l’agence', 'Livraison sur site / Pose'])) throw error('Choisissez un mode de récupération.');
  if (data.delivery === 'Livraison sur site / Pose' && !data.deliveryAddress) throw error('Précisez le lieu de livraison ou de pose.');
  return data;
}

export function validateContact(raw) {
  if (!raw || typeof raw !== 'object' || present(raw.website)) throw error('La demande est invalide.');
  const data = { name: str(raw.name, 150), email: str(raw.email, 254), message: str(raw.message, 4000), consent: raw.consent === true };
  if (!data.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || !data.message || !data.consent) throw error('Veuillez remplir les champs et accepter le traitement de votre demande.');
  return data;
}

export function makePayload(data, file, id, now = new Date()) {
  const isPrint = data.projectType !== 'Conseil & création';
  const small = data.category === 'Petit format';
  return {
    event_type: 'web_form_submission', source: 'site_web_agence', timestamp: now.toISOString(), lead_id: id,
    client_info: { company_name: data.company, contact_name: data.contact, email: data.email, phone: data.phone, location_district: data.district },
    project_lead: {
      category: data.projectType === 'Impression de supports' ? 'Print' : data.projectType,
      'assigned_pôle': data.projectType === 'Conseil & création' ? 'Conseil et Création' : data.projectType === 'Projet 360°' ? 'Conseil et Technique' : 'Technique et Imprimerie',
      product_type: isPrint ? data.category : data.service,
      specifications: isPrint ? {
        product_name: data.product,
        ...(small ? {
          format: data.format,
          ...(data.format === 'Personnalisé' ? { custom_dimensions_mm: { width: Number(data.customWidth), height: Number(data.customHeight) } } : {}),
          paper_type: data.paper, grammage: data.grammage, finishing_options: data.finishings,
        } : {
          dimensions_m: { width: Number(data.width), height: Number(data.height) },
          support: data.support, fixings: data.fixings, lamination: data.lamination,
        }),
        print_sides: data.printSide, colors: data.colors, quantity: data.quantity,
      } : { service: data.service },
      description: data.brief,
      additional_details: data.additionalDetails || null,
      desired_date: /^\d{4}-\d{2}-\d{2}$/.test(data.desiredDate) ? data.desiredDate : null,
      delivery_method: isPrint ? data.delivery : null,
      delivery_address: isPrint && data.deliveryAddress ? data.deliveryAddress : null,
      file_attachment: file ? { file_name: file.originalName, file_url: null, file_size_mb: Math.round(file.size / 1024 / 1024 * 100) / 100, prepresse_status: 'pending_check' } : null,
    },
  };
}

export function tokenHash(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
export function newToken() { return crypto.randomBytes(32).toString('base64url'); }
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aa = Buffer.from(a); const bb = Buffer.from(b);
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function base32Decode(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = value.toUpperCase().replace(/[\s=-]/g, '');
  if (!normalized || [...normalized].some(c => !alphabet.includes(c))) return Buffer.alloc(0);
  let bits = 0, buffer = 0; const bytes = [];
  for (const c of normalized) {
    buffer = (buffer << 5) | alphabet.indexOf(c); bits += 5;
    if (bits >= 8) { bits -= 8; bytes.push((buffer >>> bits) & 255); }
  }
  return Buffer.from(bytes);
}
export function totp(secret, time = Date.now()) {
  const key = base32Decode(secret || '');
  if (key.length < 10) return '';
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(time / 30000)));
  const digest = crypto.createHmac('sha1', key).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 1000000;
  return String(code).padStart(6, '0');
}
export function verifyTotp(secret, code, now = Date.now()) {
  return typeof code === 'string' && /^\d{6}$/.test(code) && [-30000, 0, 30000].some(offset => safeEqual(totp(secret, now + offset), code));
}

export async function hasValidSignature(file, extension) {
  const handle = await fs.open(file, 'r');
  try {
    const buffer = Buffer.alloc(32);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const head = buffer.subarray(0, bytesRead);
    if (extension === '.pdf') return head.subarray(0, 5).toString() === '%PDF-';
    if (extension === '.ai') return head.subarray(0, 5).toString() === '%PDF-' || head.subarray(0, 4).toString() === '%!PS';
    if (extension === '.psd') return head.subarray(0, 4).toString() === '8BPS';
    if (extension === '.indd') return head.subarray(0, 16).equals(Buffer.from('0606edf5d81d46e5bd31efe7fe74b71d', 'hex'));
    return false;
  } finally { await handle.close(); }
}

export function createStorage(root) {
  const directories = ['quotes', 'contacts', 'files', 'proofs', 'tmp', 'bats', 'links', 'outbox', 'processed'];
  const locks = new Map();
  const directory = (name) => path.join(root, name);
  const file = (name, id) => path.join(directory(name), `${id}.json`);
  return {
    root, directory, file,
    async withLock(name, id, action) {
      const key = `${name}:${id}`;
      const previous = locks.get(key) || Promise.resolve();
      let release;
      const current = new Promise(resolve => { release = resolve; });
      locks.set(key, current);
      await previous;
      try { return await action(); }
      finally { release(); if (locks.get(key) === current) locks.delete(key); }
    },
    async init() { for (const dir of directories) await fs.mkdir(directory(dir), { recursive: true, mode: 0o700 }); },
    async read(name, id) {
      if (!/^[a-zA-Z0-9_-]+$/.test(id)) return null;
      try { return JSON.parse(await fs.readFile(file(name, id), 'utf8')); }
      catch (e) { if (e.code === 'ENOENT') return null; throw e; }
    },
    async write(name, id, value) {
      if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Invalid storage identifier');
      const destination = file(name, id);
      const temporary = `${destination}.${crypto.randomUUID()}.tmp`;
      await fs.writeFile(temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
      await fs.rename(temporary, destination);
    },
    async list(name) {
      return (await fs.readdir(directory(name))).filter(n => n.endsWith('.json')).map(n => n.slice(0, -5));
    },
    async remove(name, id) { await fs.rm(file(name, id), { force: true }); },
  };
}
