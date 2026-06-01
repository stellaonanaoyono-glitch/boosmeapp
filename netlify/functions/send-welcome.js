const https = require('https');

function brevo(payload, apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  // Allow GET for test ping
  if (event.httpMethod === 'GET') {
    const key = process.env.BREVO_API_KEY;
    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        has_key: !!key,
        sender: process.env.BREVO_SENDER || 'aeliservicescmr@gmail.com',
        site: process.env.SITE_URL || 'https://boostme.social'
      })
    };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  
  const key = process.env.BREVO_API_KEY;
  if (!key) {
    console.error('[send-welcome] BREVO_API_KEY manquante');
    return { statusCode: 500, body: JSON.stringify({ error: 'BREVO_API_KEY manquante — configure cette variable dans Netlify' }) };
  }

  let email, prenom;
  try {
    const parsed = JSON.parse(event.body || '{}');
    email = parsed.email;
    prenom = parsed.prenom;
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'JSON invalide' }) };
  }

  if (!email) return { statusCode: 400, body: JSON.stringify({ error: 'email manquant' }) };

  const name = prenom || 'là';
  const SITE = process.env.SITE_URL || 'https://boostme.social';
  const SENDER = process.env.BREVO_SENDER || 'aeliservicescmr@gmail.com';

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#F2F2F2;font-family:'Helvetica Neue',Arial,sans-serif}
  .wrap{max-width:600px;margin:0 auto;background:#fff}
  .header{background:linear-gradient(135deg,#111,#1c1c1c);padding:36px 40px;text-align:center}
  .logo{font-size:28px;font-weight:900;color:#FFC107;letter-spacing:1px}
  .hero{padding:40px 40px 32px;text-align:center}
  h1{font-size:26px;font-weight:900;color:#111;margin:0 0 12px}
  .sub{font-size:15px;color:#555;line-height:1.7;margin:0 0 28px}
  .cta{display:inline-block;padding:14px 32px;background:#FFC107;color:#111;font-weight:800;font-size:15px;border-radius:10px;text-decoration:none}
  .vision{background:#FAFAFA;padding:28px 40px;border-top:1px solid #F0F0F0;border-bottom:1px solid #F0F0F0}
  .vision h2{font-size:17px;font-weight:800;color:#111;margin:0 0 10px}
  .vision p{font-size:14px;color:#555;line-height:1.7;margin:0}
  .challenges{padding:28px 40px}
  .challenges h2{font-size:17px;font-weight:800;color:#111;margin:0 0 18px}
  .ch{display:flex;align-items:flex-start;gap:14px;margin-bottom:16px;padding:14px;background:#FAFAFA;border-radius:10px;border-left:3px solid #FFC107}
  .ch-ico{font-size:22px;flex-shrink:0;margin-top:1px}
  .ch-nm{font-size:14px;font-weight:800;color:#111;margin:0 0 3px}
  .ch-ds{font-size:12px;color:#777;margin:0;line-height:1.5}
  .footer{padding:24px 40px;text-align:center;border-top:1px solid #F0F0F0}
  .footer p{font-size:12px;color:#bbb;margin:0;line-height:1.6}
  .footer a{color:#FFC107;text-decoration:none}
</style>
</head>
<body>
<div class="wrap">
  <div class="header"><div class="logo">BOOST.ME</div></div>
  <div class="hero">
    <h1>Bienvenue, ${name}&nbsp;! 🎉</h1>
    <p class="sub">Tu viens de rejoindre BOOST.ME. Confirme ton email pour activer ton compte et commencer ta transformation.</p>
    <a class="cta" href="${SITE}/login">Accéder à mon espace →</a>
  </div>
  <div class="vision">
    <h2>Notre vision ✨</h2>
    <p>BOOST.ME est construite sur une conviction simple : la transformation durable vient de petites actions cohérentes, tous les jours. Chaque challenge est conçu avec des leçons sourcées, une action concrète, et une IA qui s'adapte à tes contraintes.</p>
  </div>
  <div class="challenges">
    <h2>5 challenges pour commencer 🎯</h2>
    <div class="ch"><div class="ch-ico">✨</div><div><p class="ch-nm">Glow Up — 30 jours</p><p class="ch-ds">Deviens la femme que tu regardes de loin.</p></div></div>
    <div class="ch"><div class="ch-ico">💰</div><div><p class="ch-nm">Cash Clarity — 30 jours</p><p class="ch-ds">Reprends le contrôle de ton argent.</p></div></div>
    <div class="ch"><div class="ch-ico">🌅</div><div><p class="ch-nm">Morning Power — 30 jours</p><p class="ch-ds">Construis un rituel matinal qui t'élance.</p></div></div>
    <div class="ch"><div class="ch-ico">💪</div><div><p class="ch-nm">Unshakeable Confidence — 30 jours</p><p class="ch-ds">Une confiance qui ne dépend pas des circonstances.</p></div></div>
    <div class="ch"><div class="ch-ico">🚀</div><div><p class="ch-nm">Build Your Brand — 30 jours</p><p class="ch-ds">Crée ta marque personnelle authentique.</p></div></div>
    <p style="margin-top:18px;text-align:center"><a href="${SITE}/challenges" style="font-size:13px;color:#FFC107;font-weight:700;text-decoration:none">Voir tous les challenges →</a></p>
  </div>
  <div class="footer">
    <p>Tu reçois cet email parce que tu viens de créer un compte sur <a href="${SITE}">BOOST.ME</a>.<br>
    © 2025 BOOST.ME · AELI SERVICES · Paris &amp; Yaoundé<br>
    <a href="${SITE}/mon-espace">Se désabonner</a></p>
  </div>
</div>
</body>
</html>`;

  try {
    const r = await brevo({
      sender: { name: 'BOOST.ME', email: SENDER },
      to: [{ email, name: prenom || email }],
      subject: `Bienvenue sur BOOST.ME, ${name} ! Confirme ton compte ✨`,
      htmlContent: html,
    }, key);

    console.log('[send-welcome] Brevo status:', r.status, '— email:', email);
    
    if (r.status >= 400) {
      console.error('[send-welcome] Brevo error body:', r.body);
      return { statusCode: r.status, body: r.body };
    }
    return { statusCode: 200, body: JSON.stringify({ sent: true, email }) };
  } catch (err) {
    console.error('[send-welcome] Exception:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
