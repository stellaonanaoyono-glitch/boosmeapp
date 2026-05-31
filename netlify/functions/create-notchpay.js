const https = require('https');

function npPost(path, body, secretKey) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    
    // NotchPay accepte: soit "sk.xxx" soit "Bearer sk.xxx" selon les versions
    const authHeader = secretKey.startsWith('Bearer ') ? secretKey : secretKey;
    
    const opts = {
      hostname: 'api.notchpay.co',
      path: path,
      method: 'POST',
      headers: {
        'Authorization': authHeader,
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

  const secretKey = process.env.NOTCHPAY_SECRET_KEY;
  if (!secretKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'NOTCHPAY_SECRET_KEY manquante dans les variables Netlify' })
    };
  }

  try {
    const { plan, amount, userId, email, phone, provider, paymentId } = JSON.parse(event.body);
    const SITE_URL = process.env.SITE_URL || 'https://boostme.social';

    const CHANNELS = { mtn: 'cm.mtn', orange: 'cm.orange', wave: 'sn.wave' };

    // Convertir EUR → XAF (1 EUR ≈ 655.957 XAF, on arrondit à 656)
    const amountXAF = Math.round(amount * 656);

    const payload = {
      amount: amountXAF,
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

    console.log('NotchPay payload:', JSON.stringify(payload));
    console.log('Secret key prefix:', secretKey.substring(0, 8) + '...');

    const result = await npPost('/payments/initialize', payload, secretKey);

    console.log('NotchPay status:', result.status);
    console.log('NotchPay body:', JSON.stringify(result.body));

    if (result.status === 401) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          error: 'Clé API NotchPay invalide. Vérifie que NOTCHPAY_SECRET_KEY contient la clé secrète (sk.xxx) et non la clé publique (pk.xxx).',
          hint: 'Va sur app.notchpay.co > Settings > API Keys > copie la Secret Key'
        })
      };
    }

    if (result.body && result.body.transaction && result.body.transaction.authorization_url) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorization_url: result.body.transaction.authorization_url }),
      };
    }

    if (result.body && result.body.authorization_url) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorization_url: result.body.authorization_url }),
      };
    }

    const errMsg = (result.body && result.body.message) || JSON.stringify(result.body);
    throw new Error('NotchPay erreur: ' + errMsg + ' (status ' + result.status + ')');

  } catch (err) {
    console.error('create-notchpay error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
