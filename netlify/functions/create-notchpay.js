const https = require('https');

function npPost(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname: 'api.notchpay.co',
      path: path,
      method: 'POST',
      headers: {
        'Authorization': process.env.NOTCHPAY_SECRET_KEY,
        'X-Grant': process.env.NOTCHPAY_SECRET_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = https.request(opts, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
        catch(e) { resolve({ status: res.statusCode, body: buf }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { plan, amount, userId, email, phone, provider, paymentId } = JSON.parse(event.body);
    const SITE_URL = process.env.SITE_URL || 'https://boostme.social';

    // NotchPay channel codes
    const CHANNELS = {
      mtn:    'cm.mtn',
      orange: 'cm.orange',
      wave:   'sn.wave',
    };

    const payload = {
      amount: Math.round(amount * 655.957), // EUR → XAF (1 EUR ≈ 655.957 XAF)
      currency: 'XAF',
      description: plan === 'annual'
        ? 'BOOST.ME — Accès Annuel Illimité'
        : 'BOOST.ME — Challenge unitaire',
      email: email,
      phone: phone,
      channel: CHANNELS[provider] || 'cm.mtn',
      reference: 'bm-' + userId.substring(0, 8) + '-' + Date.now(),
      callback: SITE_URL + '/api/notchpay-webhook?paymentId=' + (paymentId || '') + '&userId=' + userId + '&plan=' + plan,
      redirect: SITE_URL + '/paiement-success',
    };

    const result = await npPost('/payments/initialize', payload);

    // Log for debugging
    console.log('NotchPay response status:', result.status);
    console.log('NotchPay response body:', JSON.stringify(result.body));

    if (result.body && result.body.transaction && result.body.transaction.authorization_url) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorization_url: result.body.transaction.authorization_url }),
      };
    }

    // If redirect URL is in a different field
    if (result.body && result.body.authorization_url) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorization_url: result.body.authorization_url }),
      };
    }

    const errMsg = (result.body && result.body.message) || JSON.stringify(result.body);
    throw new Error('NotchPay: ' + errMsg + ' (status ' + result.status + ')');

  } catch (err) {
    console.error('create-notchpay error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
