import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, ArrowUpRight, Check, ChevronDown, CircleDot, Layers3, Lightbulb, LockKeyhole, MapPin, Menu, MoveUpRight, PenTool, Plus, Printer, Sparkles, X } from 'lucide-react';
import QuoteModal from './QuoteModal.jsx';
import BatModal from './BatModal.jsx';
import ContactForm from './ContactForm.jsx';

export function Star({ className = '', size = 24 }) {
  return <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 48 48" fill="currentColor"><path d="M21.1 1h5.8l-1.1 14.5L35.3 4.4l4.1 4.1-11.1 9.5L42.8 17v5.8L28.3 22l11.1 9.5-4.1 4.1-9.5-11.1L26.9 39h-5.8l1.1-14.5-9.5 11.1-4.1-4.1L19.7 22l-14.5.8V17l14.5 1L8.6 8.5l4.1-4.1 9.5 11.1L21.1 1Z" transform="translate(0 4)" /></svg>;
}

function Logo({ light = false }) {
  return <a className={`logo ${light ? 'logo-light' : ''}`} href="#accueil" aria-label="KORA Studio & Print — accueil"><span className="logo-word">kora<span className="logo-period">.</span></span><span className="logo-divider"/><span className="logo-sub">STUDIO<br />& PRINT</span></a>;
}

export function Modal({ children, onClose, label, className = '' }) {
  const dialog = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusables = () => [...(dialog.current?.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])].filter(element => element.getClientRects().length && !element.closest('[aria-hidden="true"]'));
    const onKey = (event) => {
      if (event.key === 'Escape') { onClose(); return; }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) { event.preventDefault(); dialog.current?.focus(); return; }
      if (event.shiftKey && (document.activeElement === items[0] || !dialog.current?.contains(document.activeElement))) { event.preventDefault(); items[items.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0].focus(); }
    };
    document.addEventListener('keydown', onKey);
    if (!dialog.current?.contains(document.activeElement)) (focusables()[0] || dialog.current)?.focus();
    const overlay = dialog.current?.parentElement;
    const siblings = [...(document.getElementById('root')?.children || [])].filter(element => element !== overlay);
    const states = siblings.map(element => ({ element, ariaHidden: element.getAttribute('aria-hidden'), inert: element.hasAttribute('inert') }));
    siblings.forEach(element => { element.setAttribute('aria-hidden', 'true'); element.setAttribute('inert', ''); });
    return () => {
      states.forEach(({ element, ariaHidden, inert }) => { if (ariaHidden === null) element.removeAttribute('aria-hidden'); else element.setAttribute('aria-hidden', ariaHidden); if (!inert) element.removeAttribute('inert'); });
      document.body.style.overflow = oldOverflow; document.removeEventListener('keydown', onKey); previous?.focus?.();
    };
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={onClose}><section ref={dialog} tabIndex={-1} className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={label} onMouseDown={(e) => e.stopPropagation()}>{children}</section></div>;
}

const capabilities = [
  { number: '01', title: 'Conseil & stratégie', short: 'La bonne idée commence par les bonnes questions.', detail: 'Positionnement, plateforme de marque, conseil en communication et stratégie digitale : nous construisons les fondations d’une marque qui a quelque chose à dire.', tags: ['Stratégie de marque', 'Communication 360°', 'Réseaux sociaux'] },
  { number: '02', title: 'Création & conception', short: 'Des idées pensées pour être vues et retenues.', detail: 'Identité visuelle, direction artistique, conception-rédaction et création de contenus : le studio imagine vos supports, puis prépare des fichiers prêts à imprimer.', tags: ['Identité visuelle', 'Design graphique', 'Conception-rédaction', 'PAO & prépresse'] },
  { number: '03', title: 'Impression & production', short: 'Le bon procédé, pour le bon résultat.', detail: 'Offset pour les grands tirages, numérique pour les petites séries personnalisées, grand format et sérigraphie pour voir plus grand : chaque projet trouve sa technique.', tags: ['Offset', 'Numérique', 'Grand format', 'Sérigraphie'] },
  { number: '04', title: 'Façonnage & finitions', short: 'Parce que tout se joue aussi dans le détail.', detail: 'Du choix du papier à la touche finale : reliure dos carré collé ou piqûre métal, plis, pelliculage mat ou brillant et vernis sélectif donnent du relief à vos supports.', tags: ['Reliure', 'Pelliculage', 'Vernis sélectif', 'Découpe & pliage'] },
];

function FinishSamples() {
  return <div className="finish-samples" aria-label="Exemples de finitions">
    <div><svg viewBox="0 0 92 60" aria-hidden="true"><rect x="19" y="9" width="55" height="42" rx="1"/><path d="M26 9v42M31 15h35M31 21h28M31 38h20"/><circle cx="23" cy="21" r="1.5"/><circle cx="23" cy="39" r="1.5"/></svg><strong>Reliure</strong><span>Dos carré ou piqûre métal</span></div>
    <div><svg viewBox="0 0 92 60" aria-hidden="true"><path d="M20 18h51v30H20zM25 13h51v30M31 8h51v30"/><path d="M55 20l2-5 2 5 5 2-5 2-2 5-2-5-5-2z"/></svg><strong>Pelliculage</strong><span>Mat ou brillant, pour protéger</span></div>
    <div><svg viewBox="0 0 92 60" aria-hidden="true"><rect x="20" y="9" width="53" height="42" rx="1"/><circle cx="46" cy="30" r="12"/><path d="M38 30h16M46 22v16M28 16h9M28 44h12M58 15h8"/></svg><strong>Vernis sélectif</strong><span>Une touche de relief ciblée</span></div>
  </div>;
}

const projects = [
  { id: 'brand', category: 'Branding', number: '01', title: 'Une identité qui a du caractère', subtitle: 'Identité visuelle · Papeterie · Packaging', image: '/images/project-brand.webp', alt: 'Papeterie et packaging créatifs dans des tons orange et ivoire', description: 'Un univers de marque pensé dans les moindres détails, de la signature graphique jusqu’aux supports que l’on garde entre les mains.', tags: ['Stratégie de marque', 'Identité visuelle', 'Impression'] },
  { id: 'edition', category: 'Édition', number: '02', title: 'Le beau se lit aussi', subtitle: 'Direction artistique · Édition · Offset', image: '/images/project-edition.webp', alt: 'Magazine ouvert et livre bleu aux compositions graphiques colorées', description: 'Une édition haute en couleur où la mise en page, le choix du papier et la précision d’impression racontent une seule et même histoire.', tags: ['Direction artistique', 'Mise en page', 'Impression offset'] },
  { id: 'signage', category: 'Signalétique', number: '03', title: 'Une marque qui prend sa place', subtitle: 'Identité · Grand format · Signalétique', image: '/images/project-signage.webp', alt: 'Façade contemporaine avec enseigne et store orange', description: 'Une identité qui sort du papier pour habiller un lieu et lui donner une présence reconnaissable, jusque dans les plus grands formats.', tags: ['Signalétique', 'Grand format', 'Pose'] },
];
const filters = ['Tous les projets', 'Branding', 'Édition', 'Signalétique'];
const processSteps = [
  { number: '01', icon: Lightbulb, title: 'On échange', text: 'Votre idée, vos objectifs, vos contraintes : on commence par vous écouter.' },
  { number: '02', icon: PenTool, title: 'On imagine', text: 'Notre studio transforme votre brief en une création qui vous ressemble.' },
  { number: '03', icon: Printer, title: 'On imprime', text: 'Notre atelier donne forme à votre projet, avec le souci du détail.' },
  { number: '04', icon: Layers3, title: 'On livre', text: 'Vos supports prennent vie, à retirer, à livrer ou à poser sur site.' },
];

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [quoteType, setQuoteType] = useState(null);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [batOpen, setBatOpen] = useState(false);
  const [batToken, setBatToken] = useState('');
  const [activeCapability, setActiveCapability] = useState(null);
  const [filter, setFilter] = useState('Tous les projets');
  const [project, setProject] = useState(null);
  const [faq, setFaq] = useState(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('bat');
    if (token) {
      setBatToken(token); setBatOpen(true);
      url.searchParams.delete('bat');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    }
  }, []);
  const openQuote = (type = null) => { setProject(null); setMenuOpen(false); setQuoteType(type); setQuoteOpen(true); };
  const closeQuote = React.useCallback(() => setQuoteOpen(false), []);
  const closeBat = React.useCallback(() => { setBatOpen(false); setBatToken(''); }, []);
  const closeProject = React.useCallback(() => setProject(null), []);
  const shownProjects = filter === 'Tous les projets' ? projects : projects.filter(p => p.category === filter);
  const agencyAddress = (import.meta.env.VITE_AGENCY_ADDRESS || '').trim();
  const agencyEmail = (import.meta.env.VITE_AGENCY_EMAIL || '').trim();
  const agencyPhone = (import.meta.env.VITE_AGENCY_PHONE || '').trim();
  const agencyHours = (import.meta.env.VITE_AGENCY_HOURS || '').trim();
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(agencyAddress || 'Abidjan, Côte d’Ivoire')}`;
  const questions = [
    { q: 'Quels fichiers puis-je vous envoyer ?', a: 'Vous pouvez joindre un fichier PDF, AI, PSD ou INDD jusqu’à 1 Go à votre demande. Pour une impression optimale, privilégiez des images en 300 DPI, des couleurs en CMJN et des polices vectorisées.' },
    { q: 'Puis-je faire appel à vous pour la création et l’impression ?', a: 'Bien sûr. Notre studio et notre atelier travaillent ensemble, du conseil à la réalisation. Choisissez « Projet 360° » dans le formulaire pour nous parler de votre besoin.' },
    { q: 'Comment se passe la validation avant impression ?', a: 'Après étude et validation de votre devis, un bon à tirer peut vous être transmis par lien personnel. Prenez le temps de vérifier les textes, couleurs et dimensions avant de le valider.' },
    { q: 'Quels sont les délais de production ?', a: 'Ils dépendent du support, de la quantité, des finitions et du planning de l’atelier. Le délai adapté à votre projet vous sera précisé dans votre devis.' },
  ];

  return <>
    <div className="site-topbar"><div className="container topbar-inner"><span><Star size={13} /> UNE AGENCE. UN ATELIER. TOUT UN UNIVERS.</span><span><MapPin size={13} /> ABIDJAN, CÔTE D’IVOIRE</span></div></div>
    <header className="header" id="accueil">
      <div className="container header-inner">
        <Logo />
        <nav className="desktop-nav" aria-label="Navigation principale">
          <a href="#expertises">Nos expertises</a><a href="#realisations">Nos réalisations</a><a href="#approche">Notre approche</a><a href="#contact">Contact</a>
        </nav>
        <div className="header-actions"><button type="button" className="header-bat" onClick={() => setBatOpen(true)}><LockKeyhole size={15} /> Espace BAT</button><button type="button" className="button button-dark header-cta" onClick={() => openQuote()}>Parlons de votre projet <ArrowUpRight size={16} /></button><button type="button" className="menu-toggle" aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button></div>
      </div>
      {menuOpen && <nav className="mobile-nav" aria-label="Navigation mobile"><a onClick={() => setMenuOpen(false)} href="#expertises">Nos expertises <ArrowUpRight size={18} /></a><a onClick={() => setMenuOpen(false)} href="#realisations">Nos réalisations <ArrowUpRight size={18} /></a><a onClick={() => setMenuOpen(false)} href="#approche">Notre approche <ArrowUpRight size={18} /></a><a onClick={() => setMenuOpen(false)} href="#contact">Contact <ArrowUpRight size={18} /></a><button onClick={() => { setMenuOpen(false); setBatOpen(true); }}>Accéder à mon BAT <LockKeyhole size={16} /></button><button className="button button-dark" onClick={() => openQuote()}>Parlons de votre projet <ArrowUpRight size={16} /></button></nav>}
    </header>

    <main>
      <section className="hero container" aria-labelledby="hero-title">
        <div className="hero-copy">
          <div className="eyebrow hero-eyebrow"><span className="dot"/> AGENCE CRÉATIVE & IMPRIMERIE À ABIDJAN</div>
          <h1 id="hero-title">Les idées<br />prennent <em>forme.</em></h1>
          <p>De la première intuition à la dernière impression, nous donnons vie à vos idées et du caractère à votre marque.</p>
          <div className="hero-buttons"><button className="button button-dark button-large" onClick={() => openQuote()}>Démarrer mon projet <ArrowUpRight size={18} /></button><a className="text-link" href="#expertises">Découvrir l’agence <ArrowDown size={16} /></a></div>
          <div className="hero-note"><div className="cmyk-dots" aria-hidden="true"><i/><i/><i/><i/></div><span>DEUX MÉTIERS, UNE MÊME PASSION.<br /><b>LA VÔTRE.</b></span></div>
        </div>
        <div className="hero-visual">
          <img src="/images/hero-print.webp" alt="Livre et imprimés graphiques colorés sur une table d’atelier" fetchPriority="high" />
          <div className="hero-image-index"><span>CRÉER.</span><span>IMPRIMER.</span><span>RAYONNER.</span></div>
          <div className="hero-seal" aria-hidden="true"><Star size={26}/><span>LES BONNES<br />IDÉES PRENNENT<br />VIE ICI</span></div>
          <button className="hero-image-card" onClick={() => openQuote()}><span className="hero-card-mark"><Star size={25} /></span><div><small>DE L’IDÉE AU PRODUIT FINI</small><strong>La créativité, <em>en vrai.</em></strong></div><ArrowUpRight size={19} /></button>
        </div>
        <div className="hero-side-text" aria-hidden="true">CRÉATIVITÉ & SAVOIR-FAIRE — DEPUIS ABIDJAN</div>
      </section>

      <div className="service-ribbon" aria-label="Notre accompagnement"><div className="container ribbon-inner"><span className="ribbon-intro"><Star size={23}/> TOUT COMMENCE<br /><b>PAR UNE IDÉE.</b></span><span><i>01</i> CONSEILLER</span><span><i>02</i> IMAGINER</span><span><i>03</i> IMPRIMER</span><span><i>04</i> FAIRE RAYONNER</span></div></div>

      <section className="section expertise-section" id="expertises">
        <div className="container">
          <div className="section-heading split-heading"><div><div className="section-kicker"><span>01 /</span> CE QUE L’ON FAIT</div><h2>Deux métiers.<br />Une même <em>passion.</em></h2></div><div className="heading-aside"><p>De la stratégie à la matière, notre studio et notre atelier avancent main dans la main pour faire de vos idées de belles réalités.</p><span className="tiny-signature"><Star size={17} /> PENSÉ ICI. FAIT AVEC SOIN.</span></div></div>
          <div className="expertise-grid">
            <article className="expertise-card" id="studio"><div className="expertise-image"><img loading="lazy" src="/images/project-brand.webp" alt="Papeterie et éléments d’une identité visuelle" /><span className="image-badge">01 / LE STUDIO</span><div className="image-corner"><Sparkles size={22} /></div></div><div className="expertise-body"><div><span className="mini-label">IMAGINER & CRÉER</span><h3>Le studio créatif<span>.</span></h3><p>Des idées justes, des identités singulières et des histoires qui donnent envie de vous suivre.</p><div className="tag-list"><span>STRATÉGIE</span><span>IDENTITÉ</span><span>DIGITAL</span></div></div><button className="round-arrow" aria-label="Démarrer un projet de création" onClick={() => openQuote('Conseil & création')}><ArrowUpRight size={20} /></button></div></article>
            <article className="expertise-card" id="atelier"><div className="expertise-image"><img loading="lazy" src="/images/atelier-print.webp" alt="Contrôle de feuilles imprimées sur une presse offset" /><span className="image-badge">02 / L’ATELIER</span><div className="image-corner"><Printer size={22} /></div></div><div className="expertise-body"><div><span className="mini-label">IMPRIMER & FAÇONNER</span><h3>L’atelier d’impression<span>.</span></h3><p>Du petit au grand format, des supports qui se voient, se touchent et font la différence.</p><div className="tag-list"><span>OFFSET</span><span>NUMÉRIQUE</span><span>GRAND FORMAT</span></div></div><button className="round-arrow" aria-label="Démarrer un projet d’impression" onClick={() => openQuote('Impression de supports')}><ArrowUpRight size={20} /></button></div></article>
          </div>
          <div className="capabilities-intro"><span>UN ACCOMPAGNEMENT COMPLET</span><p>Les bonnes idées méritent<br /><strong>le bon savoir-faire.</strong></p><span>DU CONSEIL À LA LIVRAISON <ArrowDown size={15}/></span></div>
          <div className="capabilities-list">{capabilities.map((item, index) => <div className={`capability ${activeCapability === index ? 'is-open' : ''}`} key={item.number}><button type="button" aria-expanded={activeCapability === index} onClick={() => setActiveCapability(activeCapability === index ? null : index)}><span className="cap-number">{item.number} /</span><strong>{item.title}</strong><span className="cap-short">{item.short}</span><span className="cap-plus"><Plus size={20}/></span></button><div className="capability-detail" hidden={activeCapability !== index}><p>{item.detail}</p><div className="tag-list">{item.tags.map(tag => <span key={tag}>{tag}</span>)}</div>{index === 3 && <FinishSamples />}</div></div>)}</div>
        </div>
      </section>

      <section className="section projects-section" id="realisations">
        <div className="container">
          <div className="section-heading split-heading projects-heading"><div><div className="section-kicker"><span>02 /</span> NOTRE SAVOIR-FAIRE EN IMAGES</div><h2>De belles idées.<br />De belles <em>impressions.</em></h2></div><div className="heading-aside"><p>Une petite sélection pour vous montrer ce qu’on aime faire : des projets bien pensés et encore mieux réalisés.</p><span className="tiny-signature"><Star size={17} /> IMAGINÉ AVEC INTENTION</span></div></div>
          <div className="portfolio-toolbar"><div className="filters" role="group" aria-label="Filtrer les projets">{filters.map(item => <button key={item} className={filter === item ? 'active' : ''} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}</div><span className="project-count">{String(shownProjects.length).padStart(2, '0')} PROJET{shownProjects.length > 1 ? 'S' : ''} <span>↗</span></span></div>
          <div className="project-grid">{shownProjects.map(item => <button type="button" className="project-card" key={item.id} onClick={() => setProject(item)}><div className="project-image"><img loading="lazy" src={item.image} alt={item.alt}/><span className="project-image-label">PROJET CONCEPT / {item.number}</span><span className="project-image-arrow"><ArrowUpRight size={21}/></span></div><div className="project-meta"><span>{item.category.toUpperCase()} <i>—</i> PROJET CONCEPT</span><ArrowUpRight size={17}/></div><h3>{item.title}</h3><p>{item.subtitle}</p><span hidden>{item.description}</span></button>)}</div>
          <p className="concept-note">Ces visuels sont des projets conceptuels présentés à titre d’illustration.</p>
        </div>
      </section>

      <section className="section process-section" id="approche"><div className="container"><div className="process-heading"><div><div className="section-kicker"><span>03 /</span> NOTRE FAÇON DE FAIRE</div><h2>De votre idée<br />à sa <em>réalisation.</em></h2></div><p>Un seul interlocuteur, plusieurs savoir-faire et la même envie : faire avancer votre projet, ensemble.</p><div className="process-stamp"><Star size={28}/><span>DU SUR-MESURE<br/>ET DU CŒUR</span></div></div><div className="process-grid">{processSteps.map(({number, icon: Icon, title, text}) => <article className="process-step" key={number}><div className="process-step-top"><span>{number} /</span><Icon size={26} strokeWidth={1.3}/></div><h3>{title}<span>.</span></h3><p>{text}</p></article>)}</div></div></section>

      <section className="quote-banner"><div className="container quote-banner-inner"><div className="banner-star"><Star size={95}/></div><div><div className="section-kicker"><span>VOTRE PROJET, NOTRE PROCHAIN DÉFI</span></div><h2>Une idée en tête ?<br /><em>Faisons-la grandir.</em></h2><p>Parlez-nous de votre projet, on s’occupe de la suite.</p></div><button className="button button-light button-large" onClick={() => openQuote()}>Demander un devis <ArrowUpRight size={18}/></button><div className="banner-outline" aria-hidden="true"><Star size={250}/></div></div></section>

      <section className="section contact-section" id="contact"><div className="container"><div className="section-heading split-heading contact-heading"><div><div className="section-kicker"><span>04 /</span> ET SI ON SE RENCONTRAIT ?</div><h2>De vraies idées<br />commencent par <em>un bonjour.</em></h2></div><div className="heading-aside"><p>Une question, une envie ou un projet en tête ? Notre équipe est là pour vous écouter.</p></div></div><div className="contact-grid"><div className="contact-info"><div className="contact-location"><div className="location-icon"><MapPin size={23}/></div><div><span className="mini-label">STUDIO & ATELIER</span><h3>{agencyAddress || 'Abidjan, Côte d’Ivoire'}</h3><p>{agencyHours || (!agencyAddress || !agencyEmail || !agencyPhone ? 'Coordonnées et horaires à compléter par l’agence.' : 'Studio créatif & atelier d’impression.')}</p>{(agencyEmail || agencyPhone) && <div className="contact-details">{agencyEmail && <a href={`mailto:${agencyEmail}`}>{agencyEmail}</a>}{agencyPhone && <a href={`tel:${agencyPhone.replace(/[^+\d]/g, '')}`}>{agencyPhone}</a>}</div>}<a href={mapUrl} target="_blank" rel="noreferrer">{agencyAddress ? 'Localiser l’atelier' : 'Voir Abidjan sur la carte'} <ArrowUpRight size={15}/></a></div></div><div className="map-art" aria-label={agencyAddress ? "Illustration de localisation de l’atelier" : "Illustration de localisation, adresse exacte à confirmer"}><div className="map-line map-line-a"/><div className="map-line map-line-b"/><div className="map-line map-line-c"/><div className="map-river"/><div className="map-pin"><MapPin size={23} fill="currentColor"/><span>ABIDJAN</span></div><span className="map-caption">{agencyAddress ? 'LOCALISER L’ATELIER' : 'CARTE INDICATIVE'} <ArrowUpRight size={14}/></span></div><div className="bat-callout"><span className="bat-icon"><LockKeyhole size={20}/></span><div><strong>Vous avez reçu un BAT ?</strong><p>Retrouvez et validez votre épreuve en ligne.</p></div><button onClick={() => setBatOpen(true)} aria-label="Accéder à mon BAT"><ArrowUpRight size={20}/></button></div></div><ContactForm /></div></div></section>

      <section className="faq-section"><div className="container faq-grid"><div><div className="section-kicker"><span>05 /</span> ON VOUS RÉPOND</div><h2>Des questions ?<br /><em>On est là.</em></h2><p>Tout ce qu’il faut savoir avant de se lancer.</p></div><div className="faq-list">{questions.map((item, i) => <div className="faq-item" key={item.q}><button aria-expanded={faq === i} onClick={() => setFaq(faq === i ? null : i)}><span>{item.q}</span><Plus size={20} className={faq === i ? 'rotated' : ''}/></button><p hidden={faq !== i}>{item.a}</p></div>)}</div></div></section>
    </main>

    <footer className="footer"><div className="container"><div className="footer-main"><div className="footer-about"><Logo light/><p>Des idées, de l’encre et beaucoup<br/>de belles choses à imaginer ensemble.</p><div className="footer-location"><MapPin size={15}/> ABIDJAN, CÔTE D’IVOIRE</div></div><div className="footer-links"><span>EXPLORER</span><a href="#expertises">Nos expertises</a><a href="#realisations">Nos réalisations</a><a href="#approche">Notre approche</a><a href="#contact">Contact</a></div><div className="footer-links"><span>VOTRE PROJET</span><button onClick={() => openQuote()}>Demander un devis</button><button onClick={() => setBatOpen(true)}>Accéder à mon BAT</button><a href="#studio">Studio créatif</a><a href="#atelier">Atelier d’impression</a></div><div className="footer-cta"><span>UNE BELLE IDÉE COMMENCE ICI.</span><button onClick={() => openQuote()}>On en parle ? <ArrowUpRight size={22}/></button><Star size={38}/></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} KORA STUDIO & PRINT.</span><span>IDENTITÉ ET PROJETS DE DÉMONSTRATION À PERSONNALISER.</span><a href="#accueil">RETOUR EN HAUT <ArrowUp size={14}/></a></div></div></footer>

    {quoteOpen && <QuoteModal initialType={quoteType} onClose={closeQuote} />}
    {batOpen && <BatModal initialToken={batToken} onClose={closeBat} />}
    {project && <Modal onClose={closeProject} label={`Projet : ${project.title}`} className="case-modal"><button className="modal-close" onClick={closeProject} aria-label="Fermer"><X size={21}/></button><img className="case-image" src={project.image} alt={project.alt}/><div className="case-content"><div className="section-kicker"><span>PROJET CONCEPT / {project.number}</span> {project.category.toUpperCase()}</div><h2>{project.title}<span>.</span></h2><p>{project.description}</p><div className="tag-list">{project.tags.map(tag => <span key={tag}>{tag}</span>)}</div><div className="case-footer"><span>VISUEL DE DÉMONSTRATION</span><button className="button button-dark" onClick={() => openQuote()}>Un projet similaire ? <ArrowUpRight size={16}/></button></div></div></Modal>}
  </>;
}
export default App;
