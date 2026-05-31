const https = require('https');

function npPost(hostname, path, payload, key) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname,
      path,
      method: 'POST',
      headers: {
        'Authorization': key,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(d); } catch(e) { parsed = { raw: d }; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// All known NotchPay route variations
const ROUTES = [
  { host: 'api.notchpay.co',      path: '/payments'            },
  { host: 'api.notchpay.co',      path: '/payments/initialize' },
  { host: 'business.notchpay.co', path: '/payments'            },
  { host: 'business.notchpay.co', path: '/payments/initialize' },
];

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const key = process.env.NOTCHPAY_SECRET_KEY;
  if (!key) return {
    statusCode: 500,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'NOTCHPAY_SECRET_KEY manquante dans Netlify' })
  };

  try {
    const {
      plan, amount, userId, email, phone,
      provider, challengeId, challengeName
    } = JSON.parse(event.body);

    const SITE = process.env.SITE_URL || 'https://boostme.social';
    const CHANNELS = { mtn: 'cm.mtn', orange: 'cm.orange', wave: 'sn.wave', card: 'card' };
    const channel = CHANNELS[provider] || 'cm.mtn';
    const amountXAF = amount >= 100
      ? Math.round(amount)
      : Math.round((amount || (plan === 'annual' ? 49 : 3.99)) * 656);
    const ref = 'bm-' + (userId || '').substring(0, 8) + '-' + Date.now();

    const cbParams = '?userId=' + encodeURIComponent(userId || '')
      + '&plan=' + encodeURIComponent(plan || 'annual')
      + '&challengeId=' + encodeURIComponent(challengeId || '')
      + '&ref=' + encodeURIComponent(ref);

    const payload = {
      amount: amountXAF,
      currency: 'XAF',
      description: plan === 'annual'
        ? 'BOOST.ME Acces Annuel'
        : 'BOOST.ME - ' + (challengeName || 'Challenge'),
      email: email,
      phone: phone,
      channel: channel,
      reference: ref,
      callback: SITE + '/.netlify/functions/notchpay-webhook' + cbParams,
      redirect: SITE + '/paiement-success?plan=' + plan
        + (challengeId ? '&ch=' + encodeURIComponent(challengeId) : ''),
    };

    console.log('[NotchPay] key prefix:', key.substring(0, 12));
    console.log('[NotchPay] payload:', JSON.stringify(payload));

    let lastResult = null;
    for (const route of ROUTES) {
      const result = await npPost(route.host, route.path, payload, key);
      console.log('[NotchPay] tried', route.host + route.path, '→ status:', result.status);
      console.log('[NotchPay] response:', JSON.stringify(result.body).substring(0, 300));

      // 405 = wrong route, try next
      if (result.status === 405) { lastResult = result; continue; }

      // 401 = wrong key — stop immediately
      if (result.status === 401) {
        return {
          statusCode: 401,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'NotchPay 401 - Cle invalide',
            route: route.host + route.path,
            keyPrefix: key.substring(0, 10) + '...',
            npResponse: result.body
          })
        };
      }

      // Success — extract authorization URL
      const authUrl =
        (result.body && result.body.authorization_url) ||
        (result.body && result.body.transaction && result.body.transaction.authorization_url) ||
        (result.body && result.body.data && result.body.data.authorization_url);

      if (authUrl) {
        console.log('[NotchPay] SUCCESS on', route.host + route.path);
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ authorization_url: authUrl, reference: ref })
        };
      }

      // Got a non-405 response but no authUrl — stop and report
      lastResult = result;
      const errMsg = (result.body && (result.body.message || result.body.error))
        || JSON.stringify(result.body);
      throw new Error('NotchPay ' + result.status + ' (' + route.host + route.path + '): ' + errMsg);
    }

    // All routes returned 405
    throw new Error('NotchPay: toutes les routes renvoient 405. Verifie la doc NotchPay pour le bon endpoint.');

  } catch (err) {
    console.error('[NotchPay] FINAL ERROR:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
