const https = require('https');

function brevo(payload, apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json', 'Accept': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d })); });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const key = process.env.BREVO_API_KEY;
  if (!key) return { statusCode: 500, body: JSON.stringify({ error: 'BREVO_API_KEY manquante' }) };

  try {
    const { email, prenom, plan, challengeName, amount } = JSON.parse(event.body);
    const name = prenom || 'là';
    const SITE = process.env.SITE_URL || 'https://boostme.social';
    const isAnnual = plan === 'annual';
    const amt = amount || (isAnnual ? '49,00' : '3,99');
    const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<style>
  body{margin:0;padding:0;background:#F2F2F2;font-family:'Helvetica Neue',Arial,sans-serif}
  .wrap{max-width:600px;margin:0 auto;background:#fff}
  .header{background:linear-gradient(135deg,#111,#1c1c1c);padding:32px 40px;text-align:center}
  .logo{font-size:26px;font-weight:900;color:#FFC107;letter-spacing:1px}
  .body{padding:36px 40px}
  h1{font-size:24px;font-weight:900;color:#111;margin:0 0 10px}
  .sub{font-size:14px;color:#555;line-height:1.7;margin:0 0 24px}
  .receipt{background:#FAFAFA;border-radius:12px;padding:20px 24px;margin-bottom:24px;border:1px solid #F0F0F0}
  .r-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #F0F0F0;font-size:13px}
  .r-row:last-child{border:none;padding-top:12px;font-weight:800;font-size:15px}
  .r-lbl{color:#777}.r-val{color:#111;font-weight:700}
  .r-total-lbl{color:#111}.r-total-val{color:#FFC107;font-size:18px}
  .check{width:56px;height:56px;border-radius:50%;background:#D1FAE5;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;font-size:26px;line-height:1}
  .cta{display:inline-block;padding:13px 30px;background:#FFC107;color:#111;font-weight:800;font-size:15px;border-radius:10px;text-decoration:none}
  .footer{padding:20px 40px;text-align:center;border-top:1px solid #F0F0F0}
  .footer p{font-size:12px;color:#bbb;margin:0;line-height:1.6}
  .footer a{color:#FFC107;text-decoration:none}
</style>
</head><body>
<div class="wrap">
  <div class="header"><div class="logo">BOOST.ME</div></div>
  <div class="body">
    <div class="check">✓</div>
    <h1>Paiement confirmé, ${name}&nbsp;! 🎉</h1>
    <p class="sub">${isAnnual
      ? 'Ton accès annuel illimité est activé. 13 challenges t\'attendent — commence celui qui t\'attire le plus.'
      : `Ton challenge <strong>${challengeName || ''}</strong> est activé et prêt à démarrer. Bonne transformation !`
    }</p>
    <div class="receipt">
      <div class="r-row"><span class="r-lbl">Produit</span><span class="r-val">${isAnnual ? 'Accès Annuel Illimité BOOST.ME' : 'Challenge ' + (challengeName || '')}</span></div>
      <div class="r-row"><span class="r-lbl">Date</span><span class="r-val">${date}</span></div>
      <div class="r-row"><span class="r-lbl">Statut</span><span class="r-val" style="color:#22C55E">✓ Confirmé</span></div>
      <div class="r-row"><span class="r-total-lbl">Total payé</span><span class="r-total-val">€${amt}</span></div>
    </div>
    <div style="text-align:center">
      <a class="cta" href="${SITE}/dashboard">${isAnnual ? 'Choisir mon premier challenge →' : 'Commencer le challenge →'}</a>
    </div>
  </div>
  <div class="footer">
    <p>© 2025 BOOST.ME · AELI SERVICES<br>
    <a href="${SITE}/mon-espace">Mon espace</a> · <a href="${SITE}/challenges">Les challenges</a></p>
  </div>
</div>
</body></html>`;

    const r = await brevo({
      sender: { name: 'Gaëlle · BOOST.ME', email: process.env.BREVO_SENDER || 'hello@boostme.social' },
      to: [{ email, name: prenom || email }],
      subject: `✓ Paiement confirmé — ${isAnnual ? 'Accès Annuel BOOST.ME' : 'Challenge ' + (challengeName || '')}`,
      htmlContent: html,
    }, key);

    return { statusCode: r.status < 300 ? 200 : r.status, body: r.body };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
