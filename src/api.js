let configPromise;
let captchaScript;
export function getConfig() {
  if (!configPromise) configPromise = fetch('/api/config').then(r => r.json()).catch(() => ({}));
  return configPromise;
}
export async function getCaptchaToken(action) {
  const { recaptchaSiteKey } = await getConfig();
  if (!recaptchaSiteKey) return '';
  if (!captchaScript) captchaScript = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(recaptchaSiteKey)}`;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('La vérification anti-spam est indisponible.'));
    document.head.appendChild(script);
  });
  await captchaScript;
  return new Promise((resolve, reject) => {
    if (!window.grecaptcha) return reject(new Error('La vérification anti-spam est indisponible.'));
    window.grecaptcha.ready(() => window.grecaptcha.execute(recaptchaSiteKey, { action }).then(resolve).catch(reject));
  });
}
export async function postContact(data) {
  const token = await getCaptchaToken('contact');
  const response = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Recaptcha-Token': token } : {}) }, body: JSON.stringify(data) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Une erreur est survenue. Veuillez réessayer.');
  return body;
}
