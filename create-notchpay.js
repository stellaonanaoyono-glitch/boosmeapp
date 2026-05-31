const https = require('https');

function npRequest(path, method, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname: 'api.notchpay.co',
      path,
      method,
      headers: {
        'Authorization': process.env.NOTCHPAY_SECRET_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = https.request(opts, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => { try { resolve(JSON.parse(buf)); } catch(e) { resolve(buf); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { plan, amount, userId, email, phone, provider, paymentId } = JSON.parse(event.body);

    const CHANNELS = { mtn: 'cm.mtn', orange: 'cm.orange', wave: 'sn.wave' };
    const channel = CHANNELS[provider] || 'cm.mtn';

    const SITE_URL = process.env.SITE_URL || 'https://boostme.social';

    const payload = {
      amount: amount,
      currency: 'XAF', // or EUR depending on NotchPay account
      description: plan === 'annual' ? 'BOOST.ME Accès Annuel Illimité' : 'BOOST.ME Challenge unitaire',
      email: email,
      phone: phone,
      channel: channel,
      reference: `boostme-${userId}-${Date.now()}`,
      callback: SITE_URL + `/api/notchpay-webhook?paymentId=${paymentId}&userId=${userId}&plan=${plan}`,
      redirect: SITE_URL + '/paiement-success',
    };

    const result = await npRequest('/payments/initialize', 'POST', payload);

    if (result.transaction && result.transaction.authorization_url) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorization_url: result.transaction.authorization_url }),
      };
    }

    throw new Error(result.message || JSON.stringify(result));
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
