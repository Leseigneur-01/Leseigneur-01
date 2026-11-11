import React, { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, FileCheck2, LoaderCircle, LockKeyhole, X } from 'lucide-react';
import { Modal, Star } from './App.jsx';

async function requestBat(value, signal) {
  let candidate = value.trim();
  try { if (candidate.startsWith('http')) candidate = new URL(candidate).searchParams.get('bat') || ''; } catch { candidate = ''; }
  if (!/^[A-Za-z0-9_-]{43}$/.test(candidate)) throw new Error('Saisissez le code ou le lien personnel transmis par l’agence.');
  const response = await fetch(`/api/bat/${encodeURIComponent(candidate)}`, { signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Impossible de retrouver votre BAT.');
  return { candidate, data };
}

export default function BatModal({ initialToken, onClose }) {
  const [input, setInput] = useState(initialToken || '');
  const [token, setToken] = useState('');
  const [bat, setBat] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(Boolean(initialToken));
  const [error, setError] = useState('');
  const [productionConfigured, setProductionConfigured] = useState(null);
  const load = async value => {
    setError(''); setLoading(true);
    try {
      const { candidate, data } = await requestBat(value);
      setToken(candidate); setBat(data); setProductionConfigured(data.productionConfigured);
    } catch (err) { setError(err.message || 'Impossible de retrouver votre BAT.'); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    if (!initialToken) return;
    const controller = new AbortController();
    const openInitialBat = async () => {
      try {
        const { candidate, data } = await requestBat(initialToken, controller.signal);
        if (!controller.signal.aborted) { setToken(candidate); setBat(data); setProductionConfigured(data.productionConfigured); }
      } catch (err) {
        if (!controller.signal.aborted) setError(err.message || 'Impossible de retrouver votre BAT.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void openInitialBat();
    return () => controller.abort();
  }, [initialToken]);
  const approve = async () => {
    if (!confirm) { setError('Confirmez avoir vérifié votre épreuve avant validation.'); return; }
    setError(''); setLoading(true);
    try {
      const response = await fetch(`/api/bat/${encodeURIComponent(token)}/approve`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({confirm:true}) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'La validation a échoué.');
      setBat(b => ({...b, status: 'approved', approved_at: data.approved_at})); setProductionConfigured(data.productionConfigured);
    } catch (err) { setError(err.message || 'La validation a échoué.'); }
    finally { setLoading(false); }
  };
  return <Modal onClose={onClose} label="Espace bon à tirer" className="bat-modal"><button className="modal-close" onClick={onClose} aria-label="Fermer"><X size={21}/></button><div className="bat-modal-header"><span className="bat-header-icon"><LockKeyhole size={23}/></span><div className="section-kicker"><span>VOTRE ESPACE PERSONNEL</span></div><h2>Votre bon <em>à tirer.</em></h2><p>Vérifiez chaque détail avant de donner vie à votre projet.</p></div>{!bat ? <form onSubmit={e=>{e.preventDefault();void load(input);}} className="bat-entry"><label>Votre lien ou code personnel<input value={input} onChange={e=>setInput(e.target.value)} placeholder="Collez le lien reçu de l’agence" autoFocus={!initialToken}/></label><p><LockKeyhole size={15}/> Votre lien personnel vous est transmis par l’agence une fois votre épreuve prête.</p>{error && <div className="form-alert" role="alert">{error}</div>}<button className="button button-dark" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={17}/> Vérification</> : <>Accéder à mon BAT <ArrowRight size={17}/></>}</button></form> : <div className="bat-content"><div className="bat-reference"><div><span>RÉFÉRENCE</span><strong>{bat.reference}</strong></div><div><span>PROJET</span><strong>{bat.product}</strong></div><div><span>STATUT</span><strong className={bat.status==='approved'?'status-approved':''}>{bat.status==='approved'?'Validé':'À vérifier'}</strong></div></div><div className="bat-preview"><iframe title="Aperçu du bon à tirer" src={`/api/bat/${encodeURIComponent(token)}/file`}/></div><a className="bat-open-link" target="_blank" rel="noreferrer" href={`/api/bat/${encodeURIComponent(token)}/file`}>Ouvrir l’épreuve dans un nouvel onglet <ArrowUpRight size={15}/></a>{bat.status==='approved' ? <div className="bat-approved"><span><Check size={19}/></span><div><strong>Votre BAT a été validé.</strong><p>Validation enregistrée le {new Date(bat.approved_at).toLocaleString('fr-FR')}.</p>{productionConfigured===false && <p>Mode démonstration : la connexion à l’atelier doit encore être configurée.</p>}</div></div> : <><label className="consent bat-consent"><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/><span>J’ai vérifié les textes, les couleurs, les dimensions et la mise en page. Je valide ce bon à tirer pour impression.</span></label>{error && <div className="form-alert" role="alert">{error}</div>}<button className="button button-dark" disabled={loading} onClick={approve}>{loading ? <><LoaderCircle className="spin" size={17}/> Validation</> : <><FileCheck2 size={17}/> Valider le BAT / Lancer l’impression</>}</button></>}</div>}<div className="bat-modal-foot"><Star size={15}/> CHAQUE DÉTAIL COMPTE.</div></Modal>;
}
