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
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const key = process.env.BREVO_API_KEY;
  if (!key) return { statusCode: 500, body: JSON.stringify({ error: 'BREVO_API_KEY manquante' }) };

  try {
    const { email, prenom } = JSON.parse(event.body);
    const name = prenom || 'là';
    const SITE = process.env.SITE_URL || 'https://boostme.social';

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
  .annual{margin:0 40px 28px;background:linear-gradient(135deg,#111,#1c1c1c);border-radius:14px;padding:24px;text-align:center}
  .annual h3{color:#FFC107;font-size:17px;font-weight:900;margin:0 0 8px}
  .annual p{color:rgba(255,255,255,.65);font-size:13px;margin:0 0 16px;line-height:1.6}
  .annual a{display:inline-block;padding:11px 28px;background:#FFC107;color:#111;font-weight:800;font-size:14px;border-radius:8px;text-decoration:none}
  .footer{padding:24px 40px;text-align:center;border-top:1px solid #F0F0F0}
  .footer p{font-size:12px;color:#bbb;margin:0;line-height:1.6}
  .footer a{color:#FFC107;text-decoration:none}
</style>
</head>
<body>
<div class="wrap">
  <div class="header"><div class="logo">BOOST.ME</div></div>
  <div class="hero">
    <h1>Bienvenue, ${name}&nbsp;! &#127881;</h1>
    <p class="sub">Tu viens de rejoindre une communauté de femmes et de professionnels qui choisissent de se transformer — un jour à la fois. Ton espace est prêt.</p>
    <a class="cta" href="${SITE}/dashboard">Accéder à mon espace →</a>
  </div>
  <div class="vision">
    <h2>Notre vision &#127775;</h2>
    <p>BOOST.ME est une plateforme de développement personnel construite sur une conviction simple : la transformation durable ne vient pas d'une grande résolution, mais de petites actions cohérentes, tous les jours. Chaque challenge est conçu pour s'inscrire dans ta vie réelle — avec une leçon sourçée, une action concrète, et une IA qui s'adapte à tes contraintes.</p>
  </div>
  <div class="challenges">
    <h2>5 challenges pour commencer &#127919;</h2>
    <div class="ch"><div class="ch-ico">✨</div><div><p class="ch-nm">Glow Up — 30 jours</p><p class="ch-ds">Deviens la femme que tu regardes de loin. Corps, image, posture, confiance.</p></div></div>
    <div class="ch"><div class="ch-ico">💰</div><div><p class="ch-nm">Cash Clarity — 30 jours</p><p class="ch-ds">Reprends le contrôle de ton argent. Budget, épargne, premières décisions d'investissement.</p></div></div>
    <div class="ch"><div class="ch-ico">🌅</div><div><p class="ch-nm">Morning Power — 30 jours</p><p class="ch-ds">Construis un rituel matinal qui te donne l'élan pour toute la journée.</p></div></div>
    <div class="ch"><div class="ch-ico">💪</div><div><p class="ch-nm">Unshakeable Confidence — 30 jours</p><p class="ch-ds">Construis une confiance qui ne dépend pas des circonstances.</p></div></div>
    <div class="ch"><div class="ch-ico">🚀</div><div><p class="ch-nm">Build Your Brand — 30 jours</p><p class="ch-ds">Crée ta présence en ligne et ta marque personnelle de façon authentique.</p></div></div>
    <p style="margin-top:18px;text-align:center"><a href="${SITE}/challenges" style="font-size:13px;color:#FFC107;font-weight:700;text-decoration:none">Voir tous les challenges →</a></p>
  </div>
  <div class="annual">
    <h3>⭐ Accès Annuel Illimité</h3>
    <p>13 challenges · Toute l'année · Certificats · IA personnalisée<br><strong style="color:#fff">€49/an — moins de €4 par mois</strong></p>
    <a href="${SITE}/tarifs">Découvrir l'offre annuelle</a>
  </div>
  <div class="footer">
    <p>Tu reçois cet email parce que tu viens de créer un compte sur <a href="${SITE}">BOOST.ME</a>.<br>
    © 2025 BOOST.ME · AELI SERVICES · Paris &amp; Yaoundé<br>
    <a href="${SITE}/mon-espace">Se désabonner</a></p>
  </div>
</div>
</body>
</html>`;

    const r = await brevo({
      sender: { name: 'Gaëlle · BOOST.ME', email: process.env.BREVO_SENDER || 'aeliservicescmr@gmail.com' },
      to: [{ email, name: prenom || email }],
      subject: `Bienvenue sur BOOST.ME, ${name} ! Ton espace t'attend ✨`,
      htmlContent: html,
    }, key);

    console.log('[send-welcome] status:', r.status, r.body.substring(0, 200));
    return { statusCode: r.status < 300 ? 200 : r.status, body: r.body };
  } catch (err) {
    console.error('[send-welcome]', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
