const https = require('https');

// NotchPay API — tries both auth formats to find what works
function npPost(hostname, path, payload, key) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    // NotchPay docs say: Authorization: {key} (no Bearer prefix for sk. keys)
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
      provider, paymentId, challengeId, challengeName
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

    // Try primary host (business.notchpay.co — current production)
    let result = await npPost('business.notchpay.co', '/payments/initialize', payload, key);
    console.log('[NotchPay] business host status:', result.status, JSON.stringify(result.body).substring(0, 200));

    // If 401/404 on business host, fallback to api.notchpay.co
    if (result.status === 401 || result.status === 404 || result.status === 0) {
      console.log('[NotchPay] fallback to api.notchpay.co');
      result = await npPost('api.notchpay.co', '/payments/initialize', payload, key);
      console.log('[NotchPay] api host status:', result.status, JSON.stringify(result.body).substring(0, 200));
    }

    if (result.status === 401) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'NotchPay 401 - Cle invalide',
          detail: 'Verifie NOTCHPAY_SECRET_KEY dans Netlify. La cle doit commencer par sk. — copie-la depuis app.notchpay.co > Settings > API Keys > Secret Key.',
          keyPrefix: key.substring(0, 10) + '...',
          npResponse: result.body
        })
      };
    }

    // Extract authorization URL from response
    const authUrl =
      (result.body && result.body.authorization_url) ||
      (result.body && result.body.transaction && result.body.transaction.authorization_url) ||
      (result.body && result.body.data && result.body.data.authorization_url);

    if (authUrl) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorization_url: authUrl, reference: ref })
      };
    }

    const errMsg = (result.body && (result.body.message || result.body.error))
      || JSON.stringify(result.body);
    throw new Error('NotchPay ' + result.status + ': ' + errMsg);

  } catch (err) {
    console.error('[NotchPay]', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
