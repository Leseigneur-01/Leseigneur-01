import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, CheckCircle2, FileText, Layers3, Lightbulb, LoaderCircle, LockKeyhole, Palette, Printer, ShieldCheck, Trash2, UploadCloud, X } from 'lucide-react';
import { Modal, Star } from './App.jsx';
import { getCaptchaToken } from './api.js';

const MAX_FILE_SIZE = 1024 * 1024 * 1024;
const smallProducts = ['Brochure', 'Dépliant', 'Flyer', 'Affiche', 'Magazine', 'Carte de visite', 'Autre'];
const largeProducts = ['Bâche', 'Roll-up', 'Enseigne', 'Autocollant', 'Covering', 'Autre'];
const finishes = ['Dos carré collé', 'Piqûre métal', 'Plis simples', 'Pelliculage mat', 'Pelliculage brillant', 'Vernis sélectif'];
const projectTypes = [
  { value: 'Conseil & création', icon: Palette, description: 'Stratégie, identité, design' },
  { value: 'Impression de supports', icon: Printer, description: 'Print, grand format, finitions' },
  { value: 'Projet 360°', icon: Layers3, description: 'Création et impression' },
];
const blank = initialType => ({ company: '', contact: '', email: '', phone: '+225 ', district: '', projectType: initialType || '', category: '', product: '', service: '', brief: '', format: 'A4', customWidth: '', customHeight: '', width: '', height: '', paper: 'Couché mat', grammage: '135 g/m²', printSide: 'Recto / verso', colors: 'CMJN', support: 'Bâche Pro', lamination: 'Aucune', finishings: [], fixings: ['Aucune'], quantity: '', delivery: '', deliveryAddress: '', desiredDate: '', additionalDetails: '', consent: false, website: '' });
function Field({ label, required, error, children, hint, className = '' }) {
  return <label className={`form-field ${className}`}><span>{label}{required && <b> *</b>}</span>{children}{hint && <small>{hint}</small>}{error && <small className="field-error">{error}</small>}</label>;
}
function formatSize(bytes) { return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.ceil(bytes / 1024))} Ko`; }
const validDimension = value => Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) <= 100000;

export default function QuoteModal({ initialType, onClose, initialStep = 1, initialValues = {} }) {
  const [step, setStep] = useState(initialStep);
  const [values, setValues] = useState(() => ({ ...blank(initialType), ...initialValues }));
  const [errors, setErrors] = useState({});
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [serverError, setServerError] = useState('');
  const [result, setResult] = useState(null);
  const request = useRef(null);
  const content = useRef(null);
  const isPrint = values.projectType !== 'Conseil & création';
  const isSmall = values.category === 'Petit format';
  const set = (name, value) => { setValues(v => ({ ...v, [name]: value })); setErrors(e => ({ ...e, [name]: '' })); };
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => { if (content.current) content.current.scrollTop = 0; }, [step]);
  const toggle = (name, value) => {
    setValues(v => {
      let next = v[name].includes(value) ? v[name].filter(x => x !== value) : [...v[name], value];
      if (name === 'fixings') next = value === 'Aucune' ? (v.fixings.includes('Aucune') ? [] : ['Aucune']) : next.filter(x => x !== 'Aucune');
      return { ...v, [name]: next };
    });
    setErrors(e => ({ ...e, [name]: '' }));
  };
  const chooseFile = selected => {
    if (!selected) return;
    if (!/\.(pdf|ai|psd|indd)$/i.test(selected.name)) { setErrors(e => ({ ...e, file: 'Choisissez un fichier PDF, AI, PSD ou INDD.' })); setFile(null); return; }
    if (selected.size > MAX_FILE_SIZE) { setErrors(e => ({ ...e, file: 'Votre fichier dépasse la limite de 1 Go.' })); setFile(null); return; }
    setFile(selected); setErrors(e => ({ ...e, file: '' }));
  };
  const validate = current => {
    const e = {};
    if (current === 1) {
      if (!values.company.trim()) e.company = 'Indiquez votre entreprise ou votre nom.';
      if (!values.contact.trim()) e.contact = 'Indiquez votre nom.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) e.email = 'Indiquez une adresse e-mail valide.';
      if (!/^\+225\d{10}$/.test(values.phone.replace(/[\s().-]/g, ''))) e.phone = 'Format attendu : +225 suivi de 10 chiffres.';
      if (!values.projectType) e.projectType = 'Choisissez le type de projet.';
    }
    if (current === 2) {
      if (isPrint) {
        if (!values.category) e.category = 'Choisissez une catégorie.';
        if (!values.product) e.product = 'Choisissez un produit.';
      } else {
        if (!values.service) e.service = 'Choisissez le besoin qui vous correspond.';
        if (!values.brief.trim()) e.brief = 'Décrivez-nous votre projet en quelques mots.';
      }
    }
    if (current === 3 && isPrint) {
      if (isSmall && values.format === 'Personnalisé') {
        if (!validDimension(values.customWidth)) e.customWidth = 'Indiquez une largeur valide.';
        if (!validDimension(values.customHeight)) e.customHeight = 'Indiquez une hauteur valide.';
      }
      if (!isSmall) {
        if (!validDimension(values.width)) e.width = 'Indiquez une largeur valide.';
        if (!validDimension(values.height)) e.height = 'Indiquez une hauteur valide.';
        if (values.fixings.length === 0) e.fixings = 'Choisissez au moins une option.';
      }
    }
    if (current === 4) {
      if (isPrint) {
        if (!Number.isSafeInteger(Number(values.quantity)) || Number(values.quantity) < 1 || Number(values.quantity) > 100000000) e.quantity = 'Indiquez une quantité valide.';
        if (!values.delivery) e.delivery = 'Choisissez un mode de récupération.';
        if (values.delivery === 'Livraison sur site / Pose' && !values.deliveryAddress.trim()) e.deliveryAddress = 'Précisez le lieu de livraison ou de pose.';
      }
      if (!values.consent) e.consent = 'Votre accord est nécessaire pour traiter votre demande.';
      if (errors.file) e.file = errors.file;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  const next = () => { if (validate(step)) { setStep(s => Math.min(4, s + 1)); setServerError(''); } };
  const submit = async e => {
    e.preventDefault();
    if (!validate(4) || sending) return;
    setSending(true); setServerError(''); setProgress(0);
    try {
      const captchaToken = await getCaptchaToken('quote');
      const body = new FormData();
      body.append('data', JSON.stringify(values));
      if (file) body.append('file', file);
      const response = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest(); request.current = xhr;
        xhr.open('POST', '/api/quotes');
        if (captchaToken) xhr.setRequestHeader('X-Recaptcha-Token', captchaToken);
        xhr.upload.onprogress = event => { if (event.lengthComputable) setProgress(Math.round(event.loaded / event.total * 100)); };
        xhr.onload = () => {
          let body = {}; try { body = JSON.parse(xhr.responseText); } catch { /* ignore invalid response */ }
          if (xhr.status >= 200 && xhr.status < 300) resolve(body); else reject(new Error(body.error || 'Une erreur est survenue. Veuillez réessayer.'));
        };
        xhr.onerror = () => reject(new Error('Connexion interrompue. Vérifiez votre connexion et réessayez.'));
        xhr.onabort = () => reject(new Error('Envoi annulé.'));
        xhr.send(body);
      });
      request.current = null; setResult(response);
    } catch (err) { setServerError(err.message || 'Une erreur est survenue.'); }
    finally { setSending(false); }
  };
  const steps = ['Vos coordonnées', 'Votre besoin', 'Les détails', 'La dernière touche'];
  return <Modal onClose={onClose} label="Demande de devis" className="quote-modal">
    <div className="quote-side"><div className="quote-side-top"><div className="quote-side-brand">kora<span>.</span> <small>STUDIO & PRINT</small></div><Star size={35}/></div><div className="quote-side-intro"><span>UN PROJET EN TÊTE ?</span><h2>Racontons<br />la suite <em>ensemble.</em></h2><p>Quelques détails suffisent pour nous aider à imaginer la meilleure réponse à votre besoin.</p></div><div className="quote-steps">{steps.map((label, i) => <div className={`quote-step ${step === i + 1 && !result ? 'current' : ''} ${step > i + 1 || result ? 'done' : ''}`} key={label}><span>{step > i + 1 || result ? <Check size={14}/> : `0${i + 1}`}</span><strong>{label}</strong></div>)}</div><div className="quote-side-bottom"><Star size={18}/> LE SUR-MESURE COMMENCE ICI.</div></div>
    <div className="quote-main" ref={content}>
      <button className="modal-close quote-close" onClick={onClose} aria-label="Fermer le formulaire"><X size={21}/></button>
      {result ? <div className="quote-success"><div className="success-icon"><Check size={30}/></div><div className="section-kicker"><span>DEMANDE ENREGISTRÉE</span></div><h2>Merci, votre idée<br />est entre <em>de bonnes mains.</em></h2><p>Votre demande a bien été enregistrée. Conservez cette référence pour retrouver votre dossier :</p><div className="reference-box"><span>VOTRE RÉFÉRENCE</span><strong>{result.reference}</strong></div>{!result.crmConfigured && <div className="demo-notice">Mode démonstration : la connexion au CRM et les notifications de l’agence doivent encore être configurées. La demande est enregistrée sur le serveur.</div>}<button className="button button-dark button-large" onClick={onClose}>Retour au site <ArrowRight size={17}/></button></div> : <form onSubmit={submit} noValidate>
        <div className="quote-topline"><span>VOTRE DEVIS SUR MESURE</span><span>ÉTAPE 0{step} <i>/ 04</i></span></div><div className="progress-bars" aria-hidden="true">{steps.map((_,i)=><span className={i < step ? 'active' : ''} key={i}/>)}</div>
        {step === 1 && <div className="form-step"><div className="form-heading"><span className="mini-label">01 / FAISONS CONNAISSANCE</span><h2>Commençons par <em>vous.</em></h2><p>Pour mieux vous accompagner, dites-nous qui vous êtes.</p></div><div className="form-grid"><Field label="Entreprise / organisation" required error={errors.company}><input name="company" maxLength="150" value={values.company} onChange={e=>set('company',e.target.value)} placeholder="Votre entreprise" autoComplete="organization" /></Field><Field label="Nom du contact" required error={errors.contact}><input name="contact" maxLength="150" value={values.contact} onChange={e=>set('contact',e.target.value)} placeholder="Votre nom et prénom" autoComplete="name" /></Field><Field label="E-mail professionnel" required error={errors.email}><input name="email" type="email" maxLength="254" value={values.email} onChange={e=>set('email',e.target.value)} placeholder="vous@entreprise.ci" autoComplete="email" /></Field><Field label="Téléphone" required error={errors.phone}><input name="phone" type="tel" maxLength="32" value={values.phone} onChange={e=>set('phone',e.target.value)} placeholder="+225 07 00 00 00 00" autoComplete="tel" /></Field><Field label="Commune / quartier" className="full-field" hint="Facultatif, pour mieux situer votre projet."><input name="district" maxLength="150" value={values.district} onChange={e=>set('district',e.target.value)} placeholder="Ex. : Cocody, Marcory..." /></Field></div><fieldset className="choice-fieldset"><legend>De quoi avez-vous besoin ? <b>*</b></legend><div className="project-type-grid">{projectTypes.map(({value, icon: Icon, description})=><label className={`project-type ${values.projectType===value?'selected':''}`} key={value}><input type="radio" name="projectType" checked={values.projectType===value} onChange={()=>set('projectType',value)}/><Icon size={20}/><strong>{value}</strong><small>{description}</small><span className="choice-radio"/></label>)}</div>{errors.projectType && <small className="field-error">{errors.projectType}</small>}</fieldset></div>}
        {step === 2 && <div className="form-step"><div className="form-heading"><span className="mini-label">02 / VOTRE BESOIN</span><h2>{isPrint ? <>Que souhaitez-vous <em>imprimer ?</em></> : <>Parlons de votre <em>idée.</em></>}</h2><p>{isPrint ? 'Choisissez votre support pour afficher les bonnes options techniques.' : 'Partagez-nous les grandes lignes de votre projet créatif.'}</p></div>{isPrint ? <><fieldset className="choice-fieldset"><legend>Catégorie de support <b>*</b></legend><div className="category-grid">{[{value:'Petit format',title:'Petit format',desc:'Brochures, flyers, affiches…',icon:FileText},{value:'Grand format / Signalétique',title:'Grand format',desc:'Bâches, enseignes, covering…',icon:Layers3}].map(({value,title,desc,icon:Icon})=><label className={`category-choice ${values.category===value?'selected':''}`} key={value}><input type="radio" name="category" checked={values.category===value} onChange={()=>{setValues(v=>({...v,category:value,product:''}));setErrors(e=>({...e,category:'',product:''}));}}/><Icon size={22}/><span><strong>{title}</strong><small>{desc}</small></span><span className="choice-radio"/></label>)}</div>{errors.category&&<small className="field-error">{errors.category}</small>}</fieldset>{values.category && <div className="form-grid single-grid"><Field label="Type de produit" required error={errors.product}><select name="product" value={values.product} onChange={e=>set('product',e.target.value)}><option value="">Sélectionnez un produit</option>{(isSmall ? smallProducts : largeProducts).map(p=><option key={p}>{p}</option>)}</select></Field><Field label="Quelques mots sur votre projet" hint="Facultatif, mais toujours utile."><textarea value={values.brief} onChange={e=>set('brief',e.target.value)} placeholder="Parlez-nous de votre idée, de son usage..." rows="3" maxLength="4000"/></Field></div>}</> : <div className="form-grid single-grid"><Field label="Votre besoin principal" required error={errors.service}><select name="service" value={values.service} onChange={e=>set('service',e.target.value)}><option value="">Sélectionnez une expertise</option>{['Stratégie de marque','Identité visuelle','Création graphique / PAO','Contenus & digital','Autre'].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Décrivez votre projet" required error={errors.brief}><textarea name="brief" value={values.brief} onChange={e=>set('brief',e.target.value)} placeholder="Votre idée, vos objectifs, les supports souhaités..." rows="5" maxLength="4000"/></Field></div>}</div>}
        {step === 3 && <div className="form-step"><div className="form-heading"><span className="mini-label">03 / {isPrint ? 'LES DÉTAILS TECHNIQUES' : 'VOTRE PROJET'}</span><h2>{isPrint ? <>Entrons dans <em>le détail.</em></> : <>Tout est dans <em>les détails.</em></>}</h2><p>{isPrint ? 'Ces informations nous aideront à préparer un devis adapté.' : 'Si vous le souhaitez, ajoutez des précisions pour mieux nous guider.'}</p></div>{isPrint ? <><div className="form-grid">{isSmall ? <><Field label="Format" required><select value={values.format} onChange={e=>set('format',e.target.value)}>{['A4','A3','A5','Personnalisé'].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Type de papier" required><select value={values.paper} onChange={e=>set('paper',e.target.value)}>{['Couché mat','Couché brillant','Offset'].map(x=><option key={x}>{x}</option>)}</select></Field>{values.format==='Personnalisé' && <><Field label="Largeur (mm)" required error={errors.customWidth}><input type="number" min="0.1" max="100000" step="any" value={values.customWidth} onChange={e=>set('customWidth',e.target.value)} placeholder="210"/></Field><Field label="Hauteur (mm)" required error={errors.customHeight}><input type="number" min="0.1" max="100000" step="any" value={values.customHeight} onChange={e=>set('customHeight',e.target.value)} placeholder="297"/></Field></>}<Field label="Grammage" required><select value={values.grammage} onChange={e=>set('grammage',e.target.value)}>{['135 g/m²','250 g/m²','350 g/m²','400 g/m²'].map(x=><option key={x}>{x}</option>)}</select></Field></> : <><Field label="Largeur (m)" required error={errors.width}><input type="number" min="0.01" max="100000" step="any" value={values.width} onChange={e=>set('width',e.target.value)} placeholder="Ex. : 2"/></Field><Field label="Hauteur (m)" required error={errors.height}><input type="number" min="0.01" max="100000" step="any" value={values.height} onChange={e=>set('height',e.target.value)} placeholder="Ex. : 1,5"/></Field><Field label="Support" required><select value={values.support} onChange={e=>set('support',e.target.value)}>{['Bâche Pro','Vinyle','PVC','Alucobond'].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Lamination" required><select value={values.lamination} onChange={e=>set('lamination',e.target.value)}>{['Aucune','Anti-UV mate','Anti-UV brillante'].map(x=><option key={x}>{x}</option>)}</select></Field></>}<Field label="Impression" required><select value={values.printSide} onChange={e=>set('printSide',e.target.value)}>{['Recto / verso','Recto'].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Couleurs" required><select value={values.colors} onChange={e=>set('colors',e.target.value)}>{['CMJN','Noir et blanc'].map(x=><option key={x}>{x}</option>)}</select></Field></div><fieldset className="choice-fieldset finish-field"><legend>{isSmall ? 'Façonnage et finitions' : 'Œillets et fixations'} {isSmall ? <small>(facultatif)</small> : <b>*</b>}</legend><div className="check-chips">{(isSmall ? finishes : ['Tous les 50 cm','Aux 4 coins','Aucune']).map(x=><label className={(isSmall ? values.finishings : values.fixings).includes(x)?'checked':''} key={x}><input type="checkbox" checked={(isSmall ? values.finishings : values.fixings).includes(x)} onChange={()=>toggle(isSmall?'finishings':'fixings',x)}/><span>{(isSmall ? values.finishings : values.fixings).includes(x) && <Check size={13}/>}</span>{x}</label>)}</div>{errors.fixings&&<small className="field-error">{errors.fixings}</small>}</fieldset></> : <div className="form-grid single-grid"><Field label="Date souhaitée" hint="Facultatif — le délai sera confirmé dans votre devis."><input type="date" value={values.desiredDate} onChange={e=>set('desiredDate',e.target.value)}/></Field><Field label="Un détail à ajouter ?"><textarea value={values.additionalDetails} onChange={e=>set('additionalDetails',e.target.value)} placeholder="Vos inspirations, vos contraintes, votre calendrier..." rows="5" maxLength="2000"/></Field><div className="help-tip"><Lightbulb size={21}/><p><strong>Pas besoin d’avoir toutes les réponses.</strong><br/>Nous pourrons affiner votre besoin ensemble après réception de votre demande.</p></div></div>}</div>}
        {step === 4 && <div className="form-step"><div className="form-heading"><span className="mini-label">04 / LA DERNIÈRE TOUCHE</span><h2>On y est <em>presque.</em></h2><p>{isPrint ? 'Un dernier détail, et votre projet est prêt à nous être confié.' : 'Vous pouvez nous transmettre un élément utile à votre projet.'}</p></div>{isPrint && <><div className="form-grid"><Field label="Quantité souhaitée" required error={errors.quantity}><input type="number" min="1" step="1" value={values.quantity} onChange={e=>set('quantity',e.target.value)} placeholder="Ex. : 500"/></Field><Field label="Date souhaitée" hint="Facultatif"><input type="date" value={values.desiredDate} onChange={e=>set('desiredDate',e.target.value)}/></Field></div><fieldset className="choice-fieldset delivery-field"><legend>Mode de récupération <b>*</b></legend><div className="delivery-choices">{['Retrait à l’agence','Livraison sur site / Pose'].map(x=><label className={values.delivery===x?'selected':''} key={x}><input type="radio" name="delivery" checked={values.delivery===x} onChange={()=>set('delivery',x)}/><span className="choice-radio"/>{x}</label>)}</div>{errors.delivery&&<small className="field-error">{errors.delivery}</small>}</fieldset>{values.delivery==='Livraison sur site / Pose' && <Field label="Lieu de livraison / pose" required error={errors.deliveryAddress}><input maxLength="500" value={values.deliveryAddress} onChange={e=>set('deliveryAddress',e.target.value)} placeholder="Commune, quartier et adresse"/></Field>}</>}
          <div className="upload-block"><div className="upload-title"><strong>Vos fichiers graphiques</strong><span>FACULTATIF</span></div>{file ? <div className="uploaded-file"><span><FileText size={21}/><span><strong>{file.name}</strong><small>{formatSize(file.size)}</small></span></span><button type="button" onClick={()=>{setFile(null);setErrors(e=>({...e,file:''}));}} aria-label="Retirer le fichier"><Trash2 size={18}/></button></div> : <label className={`file-drop ${dragging?'dragging':''}`} onDragEnter={e=>{e.preventDefault();setDragging(true);}} onDragOver={e=>e.preventDefault()} onDragLeave={e=>{e.preventDefault();setDragging(false);}} onDrop={e=>{e.preventDefault();setDragging(false);chooseFile(e.dataTransfer.files[0]);}}><input type="file" accept=".pdf,.ai,.psd,.indd" onChange={e=>{chooseFile(e.target.files?.[0]);e.target.value='';}}/><UploadCloud size={25}/><strong>Glissez votre fichier ici <span>ou parcourez</span></strong><small>PDF, AI, PSD ou INDD · 1 Go maximum</small></label>}{errors.file&&<small className="field-error">{errors.file} <button type="button" className="clear-file-error" onClick={()=>setErrors(e=>({...e,file:''}))}>Continuer sans fichier</button></small>}<div className="prepress-tip"><ShieldCheck size={17}/><span>Pour l’impression : images à <b>300 DPI</b>, couleurs <b>CMJN</b> et polices <b>vectorisées</b>.</span></div></div>
          <label className="consent"><input type="checkbox" checked={values.consent} onChange={e=>set('consent',e.target.checked)}/><span>J’accepte que mes informations soient utilisées pour traiter ma demande. Les fichiers sources sont destinés au prépresse et supprimés 30 jours après la livraison enregistrée. <b>*</b></span></label>{errors.consent&&<small className="field-error">{errors.consent}</small>}<label className="honeypot" aria-hidden="true">Site web<input tabIndex="-1" autoComplete="off" value={values.website} onChange={e=>set('website',e.target.value)}/></label>
        </div>}
        {serverError && <div className="form-alert" role="alert">{serverError}</div>}
        {sending && <div className="upload-progress"><span>{progress < 100 ? `Envoi en cours... ${progress} %` : 'Finalisation de votre demande...'}</span><div><i style={{width:`${progress}%`}}/></div></div>}
        <div className="form-footer"><span className="form-required">* Champs obligatoires</span><div>{step>1 && <button type="button" className="back-button" onClick={()=>{setStep(s=>s-1);setErrors({});setServerError('');}} disabled={sending}><ArrowLeft size={16}/> Retour</button>}{step<4 ? <button type="button" className="button button-dark" onClick={next}>Continuer <ArrowRight size={17}/></button> : <button type="submit" className="button button-dark" disabled={sending}>{sending ? <><LoaderCircle className="spin" size={17}/> Envoi en cours</> : <>Envoyer ma demande <ArrowUpRight size={17}/></>}</button>}</div></div>
      </form>}
    </div>
  </Modal>;
}
