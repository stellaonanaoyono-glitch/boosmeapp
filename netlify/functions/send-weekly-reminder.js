const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

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

const CH_NAMES = {
  'cash-clarity':'Cash Clarity','glow-up':'Glow Up','mental-detox':'Mental Detox',
  'morning-power':'Morning Power','unshakeable-confidence':'Unshakeable Confidence',
  'body-reset':'Body Reset','build-your-brand':'Build Your Brand',
  'side-hustle-starter':'Side Hustle Starter','own-the-room':'Own The Room',
  'deep-work-mode':'Deep Work Mode','network-like-a-pro':'Network Like a Pro',
  'read-and-lead':'Read & Lead','boostme-starter':'BoostMe Starter'
};

exports.handler = async (event) => {
  // This can be called by a Netlify Scheduled Function (cron) or manually
  const key = process.env.BREVO_API_KEY;
  const SITE = process.env.SITE_URL || 'https://boostme.social';
  if (!key) return { statusCode: 500, body: 'BREVO_API_KEY manquante' };

  // Get users with active challenges who haven't visited in 2+ days
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const { data: stale } = await sb
    .from('user_challenges')
    .select('user_id, challenge_id, current_day, streak, last_active')
    .eq('status', 'active')
    .lt('last_active', twoDaysAgo)
    .limit(200);

  if (!stale || !stale.length) {
    return { statusCode: 200, body: JSON.stringify({ sent: 0, reason: 'no stale users' }) };
  }

  // Get unique user IDs
  const userIds = [...new Set(stale.map(x => x.user_id))];
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, prenom, email, email_reminders')
    .in('id', userIds);

  let sent = 0;
  for (const p of (profiles || [])) {
    if (p.email_reminders === false) continue; // respect opt-out
    const uc = stale.find(x => x.user_id === p.id);
    if (!uc) continue;
    const chName = CH_NAMES[uc.challenge_id] || uc.challenge_id;
    const daysTxt = uc.streak > 0 ? `Ta série actuelle : ${uc.streak} jours` : 'Reprends ta progression';

    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<style>
  body{margin:0;padding:0;background:#F2F2F2;font-family:'Helvetica Neue',Arial,sans-serif}
  .wrap{max-width:600px;margin:0 auto;background:#fff}
  .header{background:linear-gradient(135deg,#111,#1c1c1c);padding:32px 40px;text-align:center}
  .logo{font-size:26px;font-weight:900;color:#FFC107;letter-spacing:1px}
  .body{padding:36px 40px;text-align:center}
  h1{font-size:22px;font-weight:900;color:#111;margin:0 0 10px}
  .sub{font-size:14px;color:#555;line-height:1.7;margin:0 0 20px}
  .ch-box{background:linear-gradient(135deg,#111,#1c1c1c);border-radius:12px;padding:20px;margin:0 auto 24px;text-align:left}
  .ch-lbl{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:rgba(255,193,7,.65);margin-bottom:6px}
  .ch-nm{font-size:16px;font-weight:800;color:#fff;margin-bottom:4px}
  .ch-day{font-size:13px;color:rgba(255,255,255,.5)}
  .streak{display:inline-block;background:rgba(255,193,7,.12);border:1px solid rgba(255,193,7,.3);color:#FFC107;font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;margin-bottom:20px}
  .cta{display:inline-block;padding:13px 32px;background:#FFC107;color:#111;font-weight:800;font-size:15px;border-radius:10px;text-decoration:none}
  .msg{font-size:13px;color:#777;margin-top:20px;line-height:1.6}
  .footer{padding:20px 40px;text-align:center;border-top:1px solid #F0F0F0}
  .footer p{font-size:11px;color:#bbb;margin:0;line-height:1.6}
  .footer a{color:#FFC107;text-decoration:none}
</style>
</head><body>
<div class="wrap">
  <div class="header"><div class="logo">BOOST.ME</div></div>
  <div class="body">
    <h1>Ta transformation t'attend, ${p.prenom || 'là'} 🔥</h1>
    <p class="sub">Ton challenge est en pause depuis quelques jours. Chaque jour compte — reprends là où tu t'es arrêté(e).</p>
    <div class="ch-box">
      <div class="ch-lbl">Challenge en cours</div>
      <div class="ch-nm">${chName}</div>
      <div class="ch-day">Jour ${uc.current_day} · ${daysTxt}</div>
    </div>
    <div class="streak">🔥 ${uc.streak || 0} jours de série</div><br>
    <a class="cta" href="${SITE}/challenge-day">Continuer mon challenge →</a>
    <p class="msg">La transformation durable ne demande pas la perfection.<br>Elle demande juste de <strong>reprendre</strong>.</p>
  </div>
  <div class="footer">
    <p>© 2025 BOOST.ME · AELI SERVICES<br>
    <a href="${SITE}/mon-espace">Se désabonner des rappels</a></p>
  </div>
</div>
</body></html>`;

    try {
      await brevo({
        sender: { name: 'Gaëlle · BOOST.ME', email: process.env.BREVO_SENDER || 'aeliservicescmr@gmail.com' },
        to: [{ email: p.email, name: p.prenom || p.email }],
        subject: `🔥 ${p.prenom || 'Hé'}, ton challenge ${chName} t'attend — Jour ${uc.current_day}`,
        htmlContent: html,
      }, key);
      sent++;
    } catch(e) { console.error('[weekly-reminder] email error:', p.email, e.message); }
  }

  return { statusCode: 200, body: JSON.stringify({ sent, total: profiles?.length || 0 }) };
};
