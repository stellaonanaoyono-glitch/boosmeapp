const https = require('https');

function npRequest(path, payload, key) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const options = {
      hostname: 'api.notchpay.co',
      path: path,
      method: 'POST',
      headers: {
        'Authorization': key,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch(e) { parsed = { raw: data }; }
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
    body: JSON.stringify({ error: 'NOTCHPAY_SECRET_KEY manquante' })
  };

  try {
    const { plan, amount, userId, email, phone, provider, paymentId, challengeId, challengeName } = JSON.parse(event.body);
    const SITE = process.env.SITE_URL || 'https://boostme.social';

    const CHANNELS = { mtn: 'cm.mtn', orange: 'cm.orange', wave: 'sn.wave', card: 'card' };
    const channel = CHANNELS[provider] || 'cm.mtn';
    const amountXAF = amount >= 100 ? Math.round(amount) : Math.round((amount || (plan === 'annual' ? 49 : 3.99)) * 656);
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
      redirect: SITE + '/paiement-success?plan=' + plan + (challengeId ? '&ch=' + encodeURIComponent(challengeId) : ''),
    };

    console.log('[NotchPay] key prefix:', key.substring(0, 10));
    console.log('[NotchPay] payload:', JSON.stringify(payload));

    const result = await npRequest('/payments/initialize', payload, key);

    console.log('[NotchPay] status:', result.status);
    console.log('[NotchPay] body:', JSON.stringify(result.body));

    if (result.status === 401) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'NotchPay 401 - Cle invalide. Verifie NOTCHPAY_SECRET_KEY dans Netlify (doit commencer par sk.).',
          keyPrefix: key.substring(0, 8) + '...',
        })
      };
    }

    const authUrl = (result.body && result.body.authorization_url) ||
                    (result.body && result.body.transaction && result.body.transaction.authorization_url) ||
                    (result.body && result.body.data && result.body.data.authorization_url);

    if (authUrl) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorization_url: authUrl, reference: ref })
      };
    }

    const errMsg = (result.body && result.body.message) || JSON.stringify(result.body);
    throw new Error('NotchPay erreur ' + result.status + ': ' + errMsg);

  } catch (err) {
    console.error('[NotchPay] Error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
