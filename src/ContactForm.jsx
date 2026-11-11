import React, { useState } from 'react';
import { ArrowUpRight, Check, LoaderCircle } from 'lucide-react';
import { postContact } from './api.js';

export default function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', message: '', consent: false, website: '' });
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const set = (name, value) => setForm(f => ({ ...f, [name]: value }));
  const submit = async (event) => {
    event.preventDefault(); setError('');
    if (!form.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) || !form.message.trim() || !form.consent) { setError('Veuillez remplir tous les champs et accepter le traitement de votre demande.'); return; }
    setStatus('sending');
    try { const response = await postContact(form); setResult(response); setStatus('success'); }
    catch (err) { setError(err.message); setStatus('idle'); }
  };
  return <div className="contact-card">{status === 'success' ? <div className="contact-success"><span><Check size={26}/></span><div className="mini-label">MESSAGE ENREGISTRÉ</div><h3>Merci pour<br/><em>votre message.</em></h3><p>Votre message a bien été enregistré.</p>{!result?.crmConfigured && <div className="demo-notice">Mode démonstration : la connexion au CRM et les notifications de l’agence doivent encore être configurées.</div>}<button className="text-link" onClick={()=>{setForm({name:'',email:'',message:'',consent:false,website:''});setStatus('idle');}}>Envoyer un autre message <ArrowUpRight size={16}/></button></div> : <><div className="contact-card-title"><span>UN PETIT MOT ?</span><StarMark/><h3>Écrivez-nous<span>.</span></h3><p>Nous serons ravis d’en savoir plus.</p></div><form onSubmit={submit} noValidate><div className="contact-form-grid"><label>Votre nom <b>*</b><input maxLength="150" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Nom et prénom" autoComplete="name" /></label><label>Votre e-mail <b>*</b><input type="email" maxLength="254" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="vous@exemple.ci" autoComplete="email" /></label></div><label>Votre message <b>*</b><textarea value={form.message} onChange={e=>set('message',e.target.value)} placeholder="Racontez-nous..." rows="4" maxLength="4000" /></label><label className="consent contact-consent"><input type="checkbox" checked={form.consent} onChange={e=>set('consent',e.target.checked)}/><span>J’accepte que mes informations soient utilisées pour répondre à mon message. <b>*</b></span></label><label className="honeypot" aria-hidden="true">Site web<input tabIndex="-1" autoComplete="off" value={form.website} onChange={e=>set('website',e.target.value)}/></label>{error && <div className="form-alert" role="alert">{error}</div>}<button className="button button-dark" disabled={status==='sending'}>{status==='sending' ? <><LoaderCircle className="spin" size={17}/> Envoi en cours</> : <>Envoyer mon message <ArrowUpRight size={17}/></>}</button></form></>}</div>;
}
function StarMark(){return <svg aria-hidden="true" width="25" height="25" viewBox="0 0 32 32" fill="currentColor"><path d="M14 1h4l-1 10 7-7 3 3-7 7 10-1v4l-10-1 7 7-3 3-7-7 1 10h-4l1-10-7 7-3-3 7-7-10 1v-4l10 1-7-7 3-3 7 7z"/></svg>}
